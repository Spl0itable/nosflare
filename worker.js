import { schnorr } from "@noble/curves/secp256k1";

// Relay info (NIP-11)
const relayInfo = {
  name: "Nosflare",
  description: "A serverless Nostr relay through Cloudflare Worker and D1 database",
  pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
  contact: "lucas@censorship.rip",
  supported_nips: [1, 2, 4, 5, 9, 11, 12, 15, 16, 17, 20, 22, 33, 40, 45],
  software: "https://github.com/Spl0itable/nosflare",
  version: "3.19.18",
};

// Relay favicon
const relayIcon = "https://workers.cloudflare.com/resources/logo/logo.svg";

// Nostr address NIP-05 verified users
const nip05Users = {
  "lucas": "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
  // ... more NIP-05 verified users
};

// Blocked pubkeys
// Add pubkeys in hex format as strings to block write access
const blockedPubkeys = [
  "3c7f5948b5d80900046a67d8e3bf4971d6cba013abece1dd542eca223cf3dd3f",
  "fed5c0c3c8fe8f51629a0b39951acdf040fd40f53a327ae79ee69991176ba058",
  "e810fafa1e89cdf80cced8e013938e87e21b699b24c8570537be92aec4b12c18",
  "05aee96dd41429a3ae97a9dac4dfc6867fdfacebca3f3bdc051e5004b0751f01",
  "53a756bb596055219d93e888f71d936ec6c47d960320476c955efd8941af4362"
];
// Allowed pubkeys
// Add pubkeys in hex format as strings to allow write access
const allowedPubkeys = [
  // ... pubkeys that are explicitly allowed
];
function isPubkeyAllowed(pubkey) {
  if (allowedPubkeys.length > 0 && !allowedPubkeys.includes(pubkey)) {
    return false;
  }
  return !blockedPubkeys.includes(pubkey);
}

// Blocked event kinds
// Add comma-separated kinds Ex: 1064, 4, 22242
const blockedEventKinds = new Set([
  1064
]);
// Allowed event kinds 
// Add comma-separated kinds Ex: 1, 2, 3
const allowedEventKinds = new Set([
  // ... kinds that are explicitly allowed  
]);
function isEventKindAllowed(kind) {
  if (allowedEventKinds.size > 0 && !allowedEventKinds.has(kind)) {
    return false;
  }
  return !blockedEventKinds.has(kind);
}

// Blocked words or phrases (case-insensitive)
const blockedContent = new Set([
  "~~ hello world! ~~"
  // ... more blocked content
]);
function containsBlockedContent(event) {
  const lowercaseContent = (event.content || "").toLowerCase();
  const lowercaseTags = event.tags.map(tag => tag.join("").toLowerCase());
  for (const blocked of blockedContent) {
    if (
      lowercaseContent.includes(blocked) ||
      lowercaseTags.some(tag => tag.includes(blocked))  
    ) {
      return true;
    }
  }
  return false;
}

// Blocked tags
// Add comma-separated tags Ex: t, e, p 
const blockedTags = new Set([
  // ... tags that are explicitly blocked
]);
// Allowed tags
// Add comma-separated tags Ex: p, e, t
const allowedTags = new Set([
  "p", "e"
  // ... tags that are explicitly allowed
]);
function isTagAllowed(tag) {
  if (allowedTags.size > 0 && !allowedTags.has(tag)) {
    return false;
  }
  return !blockedTags.has(tag);  
}
function isTagBlocked(tag) {
  return blockedTags.has(tag);
}

// Blast events to other relays
const blastRelays = [
  "wss://nostr.mutinywallet.com"
  // ... add more relays  
];

// Use in-memory cache
const relayCache = {
  _cache: {},
  get(key) {
    const item = this._cache[key];
    if (item && item.expires > Date.now()) {
      return item.value;
    }
    return null;
  },
  set(key, value, ttl = 60000) {
    this._cache[key] = {
      value,
      expires: Date.now() + ttl,
    };
  },
  delete(key) {
    delete this._cache[key];
  },
};
function generateSubscriptionCacheKey(filters) {
  const filterKeys = Object.keys(filters).sort();
  const cacheKey = filterKeys.map(key => {
    let value = filters[key];
    if (Array.isArray(value)) {
      if (key === 'kinds' || key === 'authors' || key === 'ids' || 
          key.startsWith('#') && /^#[a-zA-Z]$/.test(key)) {
        value = value.sort().join(',');
      } else {
        value = value.sort();
      }
    }
    value = Array.isArray(value) ? value.join(',') : String(value);
    return `${key}:${value}`;
  }).join('|'); 
  return `subscription:${cacheKey}`;
}

// Rate limit messages
class rateLimiter {
  constructor(rate, capacity) {
    this.tokens = capacity;
    this.lastRefillTime = Date.now();
    this.capacity = capacity;
    this.fillRate = rate; // tokens per millisecond
  }
  removeToken() {
    this.refill();
    if (this.tokens < 1) {
      return false; // no tokens available, rate limit exceeded
    }
    this.tokens -= 1;
    return true;    
  }
  refill() {
    const now = Date.now();
    const elapsedTime = now - this.lastRefillTime;
    const tokensToAdd = Math.floor(elapsedTime * this.fillRate);
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }
}
const messageRateLimiter = new rateLimiter(100 / 60000, 100); // 100 messages per min  
const pubkeyRateLimiter = new rateLimiter(10 / 60000, 10); // 10 events per min
const reqRateLimiter = new rateLimiter(100 / 60000, 100); // 100 reqs per min
const duplicateCheckRateLimiter = new rateLimiter(100 / 60000, 100); // 100 duplicate checks per min
const excludedRateLimitKinds = []; // kinds to exclude from rate limiting Ex: 1, 2, 3

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/") {
        if (request.headers.get("Upgrade") === "websocket") {
          const { 0: client, 1: server } = new WebSocketPair();
          server.accept();
          server.addEventListener("message", async (messageEvent) => {
            ctx.waitUntil(
              (async () => {
                try {
                  if (!messageRateLimiter.removeToken()) {
                    sendError(server, "Rate limit exceeded. Please try again later.");
                    return;
                  }
                  const message = JSON.parse(messageEvent.data);
                  const messageType = message[0];
                  switch (messageType) {
                    case "EVENT":
                      await processEvent(message[1], server, env);
                      break;
                    case "REQ":
                      await processReq(message, server, env);
                      break;
                    case "COUNT":
                      await processCount(message, server);
                      break;
                    case "CLOSE":
                      await closeSubscription(message[1], server);
                      break;
                    // Add more cases
                  }
                } catch (e) {
                  sendError(server, "Failed to process the message");
                  console.error("Failed to process message:", e);
                }
              })()
            );
          });
          server.addEventListener("close", (event) => {
            console.log("WebSocket closed", event.code, event.reason);
          });
          server.addEventListener("error", (error) => {
            console.error("WebSocket error:", error);
          });
          return new Response(null, {
            status: 101,
            webSocket: client,
          });
        } else if (request.headers.get("Accept") === "application/nostr+json") {
          return handleRelayInfoRequest();
        } else {
          return new Response("Connect using a Nostr client", { status: 200 });
        }
      } else if (url.pathname === "/.well-known/nostr.json") {
        return handleNIP05Request(url);
      } else if (url.pathname === "/favicon.ico") {
        return serveFavicon(env);
      } else {
        return new Response("Invalid request", { status: 400 });
      }
    } catch (error) {
      console.error("Error handling request:", error);
      return new Response("Internal server error", { status: 500 });
    }
  },
  async scheduled(event, env, ctx) {
    // Implement scheduled tasks if needed
  },
};

async function handleRelayInfoRequest() {
  const headers = new Headers({
    "Content-Type": "application/nostr+json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET",
  });
  return new Response(JSON.stringify(relayInfo), { status: 200, headers: headers });
}

async function serveFavicon(env) {
  const response = await fetch(relayIcon);
  if (response.ok) {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "max-age=3600");
    return new Response(response.body, {
      status: response.status,
      headers: headers,
    });
  }
  return new Response(null, { status: 404 });
}

async function handleNIP05Request(url) {
  const name = url.searchParams.get("name");
  if (!name) {
    return new Response(JSON.stringify({ error: "Missing 'name' parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const pubkey = nip05Users[name.toLowerCase()];
  if (!pubkey) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const response = {
    names: {
      [name]: pubkey,
    },
    relays: {
      [pubkey]: [
        // ... add relays for NIP-05 users
      ],
    },
  };
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Handles EVENT message
async function processEvent(event, server, env) {
  try {
    // Check if the pubkey is allowed
    if (!isPubkeyAllowed(event.pubkey)) {
      sendOK(server, event.id, false, "Denied. The pubkey is not allowed.");
      return;
    }
    // Check if the event kind is allowed
    if (!isEventKindAllowed(event.kind)) {
      sendOK(server, event.id, false, `Denied. Event kind ${event.kind} is not allowed.`);
      return;
    }
    // Check for blocked content
    if (containsBlockedContent(event)) {
      sendOK(server, event.id, false, "Denied. The event contains blocked content.");
      return;
    }
    // Rate limit all event kinds except excluded
    if (!excludedRateLimitKinds.includes(event.kind)) {
      if (!pubkeyRateLimiter.removeToken()) {
        sendOK(server, event.id, false, "Rate limit exceeded. Please try again later.");
        return;
      }
    }
    // Check if deletion event (kind 5)
    if (event.kind === 5) {
      await processDeletionEvent(event, server, env);
      return;
    }
    // Check cache for duplicate event ID
    const cacheKey = `event:${event.id}`;
    const cachedEvent = relayCache.get(cacheKey);
    if (cachedEvent) {
      sendOK(server, event.id, false, "Duplicate. Event dropped.");
      return;
    }
    const isValidSignature = await verifyEventSignature(event);
    if (isValidSignature) {
      relayCache.set(cacheKey, event);
      sendOK(server, event.id, true, "Event received successfully.");
      blastEventToRelays(event);
      saveEventToDb(event, env).catch((error) => {
        console.error("Error saving event to D1:", error);
      });
    } else {
      sendOK(server, event.id, false, "Invalid: signature verification failed.");
    }
  } catch (error) {
    console.error("Error in EVENT processing:", error);
    sendOK(server, event.id, false, `Error: EVENT processing failed - ${error.message}`);
  }
}

// Handles REQ message
async function processReq(message, server, env) {
    if (!reqRateLimiter.removeToken()) {
      sendError(server, "Rate limit exceeded. Please try again later.");
      return;
    }
    const subscriptionId = message[1];
    const filters = message[2] || {};
    const cacheKey = generateSubscriptionCacheKey(filters);
    let events = [];
    if (filters.ids) {
      for (const id of filters.ids) {
        if (!/^[a-f0-9]{64}$/.test(id)) {
          sendError(server, `Invalid event ID format: ${id}`);
          return;
        }
      }
    }
    if (filters.authors) {
      for (const author of filters.authors) {
        if (!/^[a-f0-9]{64}$/.test(author)) {
          sendError(server, `Invalid author pubkey format: ${author}`);
          return;
        }
      }
    }
    let cachedEvents = relayCache.get(cacheKey);
    if (cachedEvents) {
      events = cachedEvents;
    } else {
      try {
        const eventPromises = [];
        if (filters.ids) {
          const query = 'SELECT content FROM events WHERE id IN (?)';
          const ids = filters.ids.slice(0, 25);
          const { results } = await env.relayDb.prepare(query).bind(ids).all();
          for (const { content } of results) {
            const event = JSON.parse(content);
            if (event !== null) {
              eventPromises.push(event);
            }
          }
        }
        if (filters.kinds) {
          for (const kind of filters.kinds) {
            const query = 'SELECT content FROM events WHERE kind = ? ORDER BY created_at DESC LIMIT 25';
            const { results } = await env.relayDb.prepare(query).bind(kind).all();
            for (const { content } of results) {
              const event = JSON.parse(content);
              if (event !== null) {
                eventPromises.push(event);
              }
            }
          }
        }
        if (filters.authors) {
          for (const author of filters.authors) {
            const query = 'SELECT content FROM events WHERE pubkey = ? ORDER BY created_at DESC LIMIT 25';
            const { results } = await env.relayDb.prepare(query).bind(author).all();
            for (const { content } of results) {
              const event = JSON.parse(content);
              if (event !== null) {
                eventPromises.push(event);
              }
            }
          }
        }
        const tagQueries = Array.from({ length: 26 }, (_, i) => ({
          key: String.fromCharCode(97 + i),
          label: String.fromCharCode(97 + i),
        })).concat(
          Array.from({ length: 26 }, (_, i) => ({
            key: String.fromCharCode(65 + i),
            label: String.fromCharCode(65 + i),
          }))
        );
        for (const query of tagQueries) {
          if (filters[`#${query.key}`]) {
            for (const tag of filters[`#${query.key}`]) {
              const tagQuery = `SELECT content FROM events WHERE tags LIKE '%${query.label}:${tag}%' ORDER BY created_at DESC LIMIT 25`;
              const { results } = await env.relayDb.prepare(tagQuery).all();
              for (const { content } of results) {
                const event = JSON.parse(content);
                if (event !== null) {
                  eventPromises.push(event);
                }
              }
            }
          }
        }
        const fetchedEvents = await Promise.all(eventPromises);
        events = fetchedEvents.filter((event) => {
          const includeEvent = (!filters.ids || filters.ids.includes(event.id)) &&
            (!filters.kinds || filters.kinds.includes(event.kind)) &&
            (!filters.authors || filters.authors.includes(event.pubkey)) &&
            (!filters.since || event.created_at >= filters.since) &&
            (!filters.until || event.created_at <= filters.until);
          const tagFilters = Object.entries(filters).filter(([key]) => key.startsWith('#'));
          for (const [tagKey, tagValues] of tagFilters) {
            const tagName = tagKey.slice(1);
            const eventTags = event.tags.filter(([t]) => t === tagName).map(([, v]) => v);
            if (!tagValues.some((value) => eventTags.includes(value))) {
              return false;
            }
          }
          return includeEvent;
        });
        relayCache.set(cacheKey, events);
      } catch (error) {
        console.error(`Error retrieving events from D1:`, error);
        events = [];
      }
    }
    for (const event of events) {
      server.send(JSON.stringify(["EVENT", subscriptionId, event]));
    }
    server.send(JSON.stringify(["EOSE", subscriptionId]));
  }
  
  // Handles COUNT message
  async function processCount(message, server) {
    if (!reqRateLimiter.removeToken()) {
      sendError(server, "Rate limit exceeded. Please try again later.");
      return;
    }
    const subscriptionId = message[1];
    const filters = message[2] || {};
    let count = 0;
    let approximate = false;
    try {
      if (filters.authors && filters.kinds) {
        const authorCounts = await Promise.all(
          filters.authors.map(async (author) => {
            const query = 'SELECT COUNT(*) as count FROM events WHERE pubkey = ? AND kind IN (?)';
            const { count } = await env.relayDb.prepare(query).bind(author, filters.kinds).first();
            return count;
          })
        );
        count = authorCounts.reduce((sum, authorCount) => sum + authorCount, 0);
      } else if (filters.kinds) {
        const query = 'SELECT COUNT(*) as count FROM events WHERE kind IN (?)';
        const { count: kindCount } = await env.relayDb.prepare(query).bind(filters.kinds).first();
        count = kindCount;
      } else if (filters.authors) {
        const query = 'SELECT COUNT(*) as count FROM events WHERE pubkey IN (?)';
        const { count: authorCount } = await env.relayDb.prepare(query).bind(filters.authors).first();
        count = authorCount;
      }
      // Use approximate counts for large values
      if (count > 1000000) {
        count = Math.floor(count / 1000) * 1000;
        approximate = true;
      }
      server.send(JSON.stringify(["COUNT", subscriptionId, { count, approximate }]));
    } catch (error) {
      console.error(`Error processing count request:`, error);
      server.send(JSON.stringify(["CLOSED", subscriptionId, "Failed to process count request"]));
    }
  }
  
  // Handles CLOSE message
  async function closeSubscription(subscriptionId, server) {
    try {
      server.send(JSON.stringify(["CLOSED", subscriptionId, "Subscription closed"]));
    } catch (error) {
      console.error("Error closing subscription:", error);
      sendError(server, `error: failed to close subscription ${subscriptionId}`);
    }
  }
  
  // Handles saving event to D1 database
  async function saveEventToDb(event, env) {
    // Rate limit duplicate event checks
    if (!duplicateCheckRateLimiter.removeToken(event.pubkey)) {
      console.log(`Duplicate check rate limit exceeded for pubkey: ${event.pubkey}`);
      return;
    }
    try {
      const query = 'SELECT id FROM events WHERE id = ?';
      const { results } = await env.relayDb.prepare(query).bind(event.id).all();
      if (results.length > 0) {
        console.log(`Duplicate event: ${event.id}. Event dropped.`);
        return;
      }
    } catch (error) {
      console.error(`Error checking duplicate event in D1: ${error.message}`);
      return;
    }
    // Validate event JSON
    try {
      JSON.stringify(event);
    } catch (error) {
      console.error(`Invalid JSON for event: ${event.id}. Event dropped.`, error);
      return;
    }
    try {
      const insertQuery = 'INSERT INTO events (id, pubkey, created_at, kind, tags, content) VALUES (?, ?, ?, ?, ?, ?)';
      const tags = JSON.stringify(event.tags);
      const params = [event.id, event.pubkey, event.created_at, event.kind, tags, JSON.stringify(event)];
      await env.relayDb.prepare(insertQuery).bind(...params).run();
    } catch (error) {
      console.error(`Error saving event to D1: ${error.message}`);
    }
  }
  
  // Handles event deletes (NIP-09)
  async function processDeletionEvent(deletionEvent, server, env) {
    try {
      if (deletionEvent.kind === 5 && deletionEvent.pubkey) {
        sendOK(server, deletionEvent.id, true, "Deletion request received successfully.");
        const deletedEventIds = deletionEvent.tags
          .filter((tag) => tag[0] === "e")
          .map((tag) => tag[1]);
  
        const query = 'DELETE FROM events WHERE id IN (?) AND pubkey = ?';
        await env.relayDb.prepare(query).bind(deletedEventIds, deletionEvent.pubkey).run();
  
        for (const eventId of deletedEventIds) {
          const cacheKey = `event:${eventId}`;
          relayCache.delete(cacheKey);
        }
      } else {
        sendOK(server, deletionEvent.id, false, "Invalid deletion event.");
      }
    } catch (error) {
      console.error("Error processing deletion event:", error);
      sendOK(server, deletionEvent.id, false, `Error processing deletion event: ${error.message}`);
    }
  }
  
  // Handles blasting event to other relays
  async function blastEventToRelays(event) {
    for (const relayUrl of blastRelays) {
      try {
        const socket = new WebSocket(relayUrl);
        socket.addEventListener("open", () => {
          const eventMessage = JSON.stringify(["EVENT", event]);
          socket.send(eventMessage);
          socket.close();
        });
        socket.addEventListener("error", (error) => {
          console.error(`Error blasting event to relay ${relayUrl}:`, error);
        });
      } catch (error) {
        console.error(`Error blasting event to relay ${relayUrl}:`, error);
      }
    }
  }
  
  // Verify event signature
  async function verifyEventSignature(event) {
    try {
      const signatureBytes = hexToBytes(event.sig);
      const serializedEventData = serializeEventForSigning(event);
      const messageHashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(serializedEventData)
      );
      const messageHash = new Uint8Array(messageHashBuffer);
      const publicKeyBytes = hexToBytes(event.pubkey);
      const signatureIsValid = schnorr.verify(signatureBytes, messageHash, publicKeyBytes);
      return signatureIsValid;
    } catch (error) {
      console.error("Error verifying event signature:", error);
      return false;
    }
  }
  function serializeEventForSigning(event) {
    const serializedEvent = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]);
    return serializedEvent;
  }
  function hexToBytes(hexString) {
    if (hexString.length % 2 !== 0) throw new Error("Invalid hex string");
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
    }
    return bytes;
  }
  
  // Sends event response to client
  function sendOK(server, eventId, status, message) {
    server.send(JSON.stringify(["OK", eventId, status, message]));
  }
  function sendError(server, message) {
    server.send(JSON.stringify(["NOTICE", message]));
  }