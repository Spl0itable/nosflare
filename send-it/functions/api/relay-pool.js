// Cloudflare Pages Function: Multiplexed WebSocket relay pool proxy for Send It
// Single WebSocket from the main worker, fans out EVENTs to many upstream relays.
// Adapted from NYM's relay-pool.js — simplified for write-only blast use case.
//
// Protocol (main worker → pool):
//   ["RELAYS", ["wss://relay1", "wss://relay2", ...]]  - configure relay list
//   ["EVENT", eventObj]                                  - fan out to all connected relays
//
// Protocol (pool → main worker):
//   ["OK", eventId, bool, msg]                          - first OK per event ID
//   ["POOL:STATUS", { connected, count, latency }]      - connection status
//   ["POOL:PING", timestamp]                            - keepalive

const BLAST_AUTH_TOKEN = "nosflare-blast-internal";

export async function onRequest(context) {
  const { request } = context;

  // Verify auth token from query param
  const url = new URL(request.url);
  if (url.searchParams.get('auth') !== BLAST_AUTH_TOKEN) {
    return new Response('Unauthorized', { status: 403 });
  }

  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();

  // Relay pool state
  const upstreams = new Map();       // relayUrl -> { ws, status, eventCount, handled }
  const relayLatency = new Map();    // relayUrl -> latency ms
  const seenOKs = new Set();         // eventId (only forward first OK per event)
  let serverOpen = true;

  // Dedup housekeeping for OKs
  function trimOKs() {
    if (seenOKs.size > 2000) {
      let deleted = 0;
      for (const key of seenOKs) {
        if (deleted >= 1000) break;
        seenOKs.delete(key);
        deleted++;
      }
    }
  }

  // Keepalive to prevent Cloudflare idle timeout
  let keepaliveTimer = setInterval(() => {
    try {
      if (serverOpen && server.readyState === 1) {
        server.send(JSON.stringify(['POOL:PING', Date.now()]));
      } else {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
      }
    } catch {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
  }, 30000);

  // Track failed relays with backoff
  const failedRelays = new Map();
  const FAILED_COOLDOWN = 60000;
  const MAX_BACKOFF = 180000;

  const reconnectAttempts = new Map();
  const MAX_RECONNECT_ATTEMPTS = 5;
  const pendingReconnect = new Set();
  const reconnectTimers = new Map();
  const intentionallyClosed = new Set();

  // Throttle pool status updates
  let statusTimer = null;
  function schedulePoolStatus() {
    if (statusTimer) return;
    statusTimer = setTimeout(() => {
      statusTimer = null;
      sendPoolStatus();
    }, 300);
  }

  function sendToClient(data) {
    try {
      if (serverOpen && server.readyState === 1) {
        server.send(typeof data === 'string' ? data : JSON.stringify(data));
      }
    } catch { /* client disconnected */ }
  }

  function sendPoolStatus() {
    const connected = [];
    const latency = {};
    upstreams.forEach((info, url) => {
      if (info.status === 'connected') {
        connected.push(url);
      }
    });
    relayLatency.forEach((ms, url) => {
      if (connected.includes(url)) latency[url] = ms;
    });
    sendToClient(JSON.stringify(['POOL:STATUS', {
      connected,
      count: connected.length,
      latency
    }]));
  }

  function shouldSkipRelay(relayUrl) {
    const failure = failedRelays.get(relayUrl);
    if (failure) {
      const backoff = Math.min(FAILED_COOLDOWN * Math.pow(2, failure.attempts - 1), MAX_BACKOFF);
      if (Date.now() - failure.failedAt < backoff) return true;
      failedRelays.delete(relayUrl);
    }
    return false;
  }

  function trackRelayFailure(relayUrl) {
    const existing = failedRelays.get(relayUrl);
    const attempts = existing ? existing.attempts + 1 : 1;
    failedRelays.set(relayUrl, { failedAt: Date.now(), attempts });
  }

  function clearRelayFailure(relayUrl) {
    failedRelays.delete(relayUrl);
  }

  function validateRelayUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'wss:' || parsed.protocol === 'ws:';
    } catch { return false; }
  }

  // Extract OK event ID from raw string without JSON.parse
  function extractOKEventId(raw) {
    const start = 6; // ["OK","  = positions 0-5
    const end = raw.indexOf('"', start);
    if (end === -1 || end - start < 16) return null;
    return raw.substring(start, end);
  }

  function scheduleReconnect(relayUrl) {
    if (!serverOpen) return;
    if (pendingReconnect.has(relayUrl)) return;

    const attempts = reconnectAttempts.get(relayUrl) || 0;
    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      trackRelayFailure(relayUrl);
      reconnectAttempts.delete(relayUrl);
      return;
    }
    reconnectAttempts.set(relayUrl, attempts + 1);
    pendingReconnect.add(relayUrl);

    const delay = 3000 * Math.pow(1.5, attempts) + Math.random() * 2000;
    const timerId = setTimeout(() => {
      reconnectTimers.delete(relayUrl);
      pendingReconnect.delete(relayUrl);
      if (serverOpen && !upstreams.has(relayUrl) && !intentionallyClosed.has(relayUrl)) {
        connectUpstream(relayUrl);
      }
    }, delay);
    reconnectTimers.set(relayUrl, timerId);
  }

  function connectUpstream(relayUrl) {
    if (upstreams.has(relayUrl)) return;
    if (!validateRelayUrl(relayUrl)) return;
    if (shouldSkipRelay(relayUrl)) return;

    const info = { ws: null, status: 'connecting', eventCount: 0, handled: false };
    upstreams.set(relayUrl, info);

    const connectStartTime = Date.now();

    try {
      const ws = new WebSocket(relayUrl);
      info.ws = ws;

      const timeout = setTimeout(() => {
        if (info.status === 'connecting') {
          info.handled = true;
          info.status = 'failed';
          trackRelayFailure(relayUrl);
          try { ws.close(); } catch { /* noop */ }
          upstreams.delete(relayUrl);
          schedulePoolStatus();
        }
      }, 8000);

      ws.addEventListener('open', () => {
        clearTimeout(timeout);
        info.status = 'connected';
        clearRelayFailure(relayUrl);
        reconnectAttempts.delete(relayUrl);
        relayLatency.set(relayUrl, Date.now() - connectStartTime);
        schedulePoolStatus();
      });

      // Only care about OK responses for blast use case
      ws.addEventListener('message', (event) => {
        const raw = event.data;
        if (typeof raw !== 'string' || raw.length < 10) return;

        // OK: ["OK","eventId",bool,"msg"]
        if (raw.charCodeAt(2) === 79 && raw.startsWith('["OK"')) {
          const eventId = extractOKEventId(raw);
          if (eventId) {
            if (seenOKs.has(eventId)) return;
            seenOKs.add(eventId);
            trimOKs();
          }
          info.eventCount++;
          sendToClient(raw);
        }
        // Ignore EVENT, EOSE, NOTICE — this is write-only
      });

      ws.addEventListener('close', () => {
        clearTimeout(timeout);
        if (info.handled) return;
        info.handled = true;

        const wasConnected = info.status === 'connected';
        info.status = 'closed';
        upstreams.delete(relayUrl);
        schedulePoolStatus();

        if (intentionallyClosed.has(relayUrl)) {
          intentionallyClosed.delete(relayUrl);
          return;
        }

        if (wasConnected) {
          scheduleReconnect(relayUrl);
        } else {
          trackRelayFailure(relayUrl);
        }
      });

      ws.addEventListener('error', () => {
        clearTimeout(timeout);
        if (info.handled) return;
        info.handled = true;

        info.status = 'failed';
        trackRelayFailure(relayUrl);
        upstreams.delete(relayUrl);
        schedulePoolStatus();
      });
    } catch {
      info.handled = true;
      info.status = 'failed';
      trackRelayFailure(relayUrl);
      upstreams.delete(relayUrl);
      schedulePoolStatus();
    }
  }

  function sendToUpstreams(data) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    upstreams.forEach((info) => {
      if (info.status === 'connected' && info.ws && info.ws.readyState === WebSocket.OPEN) {
        try { info.ws.send(msg); } catch { /* noop */ }
      }
    });
  }

  // Handle messages from main worker
  server.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (!Array.isArray(msg)) return;

      const msgType = msg[0];

      if (msgType === 'RELAYS') {
        const relayList = msg[1];
        if (!Array.isArray(relayList)) return;

        // Disconnect relays no longer in the list
        const newRelaySet = new Set(relayList);
        for (const [url, info] of upstreams) {
          if (!newRelaySet.has(url)) {
            intentionallyClosed.add(url);
            try { if (info.ws) info.ws.close(); } catch { /* noop */ }
            upstreams.delete(url);
          }
        }

        // Cancel pending reconnect timers
        for (const [, timerId] of reconnectTimers) clearTimeout(timerId);
        reconnectTimers.clear();
        pendingReconnect.clear();

        // Connect all relays immediately
        for (const url of relayList) {
          if (!upstreams.has(url)) {
            connectUpstream(url);
          }
        }
      } else if (msgType === 'EVENT') {
        const eventMsg = JSON.stringify(['EVENT', msg[1]]);
        sendToUpstreams(eventMsg);
      }
    } catch { /* parse error */ }
  });

  // Cleanup on disconnect
  function cleanupAll() {
    serverOpen = false;
    for (const [, timerId] of reconnectTimers) clearTimeout(timerId);
    reconnectTimers.clear();
    pendingReconnect.clear();
    intentionallyClosed.clear();
    if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
    upstreams.forEach((info) => {
      try { if (info.ws) info.ws.close(); } catch { /* noop */ }
    });
    upstreams.clear();
  }

  server.addEventListener('close', cleanupAll);
  server.addEventListener('error', cleanupAll);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
