import { schnorr } from "@noble/curves/secp256k1";

// Relay info (NIP-11)
const relayInfo = {
  name: "Nosflare",
  description: "A serverless Nostr relay through Cloudflare Worker and KV store",
  pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
  contact: "lucas@censorship.rip",
  supported_nips: [1, 2, 4, 5, 9, 11, 12, 15, 16, 20, 22, 33, 40],
  software: "https://github.com/Spl0itable/nosflare",
  version: "2.15.9",
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

// Blast events to other relays
const blastRelays = [
  "wss://nostr.mutinywallet.com",
  "wss://bostr.online"
  // ... add more relays
];

// Handles upgrading to websocket and serving relay info
addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.pathname === "/") {
    if (request.headers.get("Upgrade") === "websocket") {
      event.respondWith(handleWebSocket(event, request));
    } else if (request.headers.get("Accept") === "application/nostr+json") {
      event.respondWith(handleRelayInfoRequest());
    } else {
      event.respondWith(
        new Response("Connect using a Nostr client", { status: 200 })
      );
    }
  } else if (url.pathname === "/.well-known/nostr.json") {
    event.respondWith(handleNIP05Request(url));
  } else if (url.pathname === "/favicon.ico") {
    event.respondWith(serveFavicon(event));
  } else {
    event.respondWith(new Response("Invalid request", { status: 400 }));
  }
});
async function handleRelayInfoRequest() {
  const headers = new Headers({
    "Content-Type": "application/nostr+json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET",
  });
  return new Response(JSON.stringify(relayInfo), { status: 200, headers: headers });
}
async function serveFavicon() {
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
      if (key === 'kinds' || key === 'authors' || key === '#e' || key === '#p' || key === 'ids') {
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
const pubkeyRateLimiters = new Map();
const messageRateLimiter = new rateLimiter(100 / 1000, 200);
const reqRateLimiter = new rateLimiter(1 / 1.1, 200);
const excludedRateLimitKinds = []; // kinds to exclude from rate limiting Ex: 1, 2, 3

// Handles websocket messages
async function handleWebSocket(event, request) {
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  server.addEventListener("message", async (messageEvent) => {
    event.waitUntil(
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
              await processEvent(message[1], server);
              break;
            case "REQ":
              await processReq(message, server);
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
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

// Handles EVENT message
async function processEvent(event, server) {
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
      let pubkeyRateLimiter = pubkeyRateLimiters.get(event.pubkey);
      if (!pubkeyRateLimiter) {
        pubkeyRateLimiter = new rateLimiter(10 / 60000, 10); // 10 events per minute
        pubkeyRateLimiters.set(event.pubkey, pubkeyRateLimiter);
      }
      if (!pubkeyRateLimiter.removeToken()) {
        sendOK(server, event.id, false, "Rate limit exceeded. Please try again later.");
        return;
      }
    }
    // Check if deletion event (kind 5)
    if (event.kind === 5) {
      await processDeletionEvent(event, server);
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
      event.waitUntil(saveEventToKV(event));
    } else {
      sendOK(server, event.id, false, "Invalid: signature verification failed.");
    }
  } catch (error) {
    console.error("Error in EVENT processing:", error);
    sendOK(server, event.id, false, `Error: EVENT processing failed - ${error.message}`);
  }
}

// Handles REQ message
async function processReq(message, server) {
  if (!reqRateLimiter.removeToken()) {
    sendError(server, "Rate limit exceeded. Please try again later.");
    return;
  }
  const subscriptionId = message[1];
  const filters = message[2] || {};
  const pagination = filters.pagination || { page: 1, limit: 20 };
  // Limit the maximum number of pages to 10
  const maxPages = 10;
  pagination.page = Math.min(pagination.page, maxPages);
  const cacheKey = generateSubscriptionCacheKey(filters);
  let events = [];
  // Check the cache for filtered events
  let cachedEvents = relayCache.get(cacheKey);
  if (cachedEvents) {
    events = cachedEvents;
  } else {
    try {
      const eventPromises = [];
      if (filters.ids) {
        // Check the cache for events matching the ids filter
        const cachedEvents = filters.ids.map(id => relayCache.get(`event:${id}`)).filter(event => event !== null);
        events = cachedEvents;
        const missingIds = filters.ids.filter(id => !events.some(event => event.id === id));
        for (const id of missingIds) {
          const idKey = `event:${id}`;
          eventPromises.push(relayDb.get(idKey, { type: 'json' }));
        }
      }
      if (filters.kinds) {
        // Check the cache for events matching the kinds filter
        const cachedKindEvents = [];
        for (const kind of filters.kinds) {
          const kindCacheKey = `kind-${kind}`;
          const cachedEvents = relayCache.get(kindCacheKey);
          if (cachedEvents) {
            cachedKindEvents.push(...cachedEvents);
          } else {
            const kindCountKey = `${KIND_COUNT_KEY_PREFIX}${kind}`;
            const kindCount = parseInt(await relayDb.get(kindCountKey, 'text') || '0', 10);
            const startIndex = (pagination.page - 1) * pagination.limit;
            const endIndex = startIndex + pagination.limit - 1;
            const startCount = Math.max(0, kindCount - endIndex);
            const endCount = Math.max(0, kindCount - startIndex);
            for (let i = endCount; i >= startCount; i--) {
              const kindKey = `kind-${kind}:${i}`;
              eventPromises.push(relayDb.get(kindKey, { type: 'json' }));
            }
          }
        }
        events = cachedKindEvents;
      }
      if (filters.authors) {
        // Check the cache for events matching the authors filter
        const cachedAuthorEvents = [];
        for (const author of filters.authors) {
          const authorCacheKey = `pubkey-${author}`;
          const cachedEvents = relayCache.get(authorCacheKey);
          if (cachedEvents) {
            cachedAuthorEvents.push(...cachedEvents);
          } else {
            const pubkeyCountKey = `${PUBKEY_COUNT_KEY_PREFIX}${author}`;
            const pubkeyCount = parseInt(await relayDb.get(pubkeyCountKey, 'text') || '0', 10);
            const startIndex = (pagination.page - 1) * pagination.limit;
            const endIndex = startIndex + pagination.limit - 1;
            const startCount = Math.max(0, pubkeyCount - endIndex);
            const endCount = Math.max(0, pubkeyCount - startIndex);
            for (let i = endCount; i >= startCount; i--) {
              const pubkeyKey = `pubkey-${author}:${i}`;
              eventPromises.push(relayDb.get(pubkeyKey, { type: 'json' }));
            }
          }
        }
        events = cachedAuthorEvents;
      }
      if (filters['#e']) {
        // Check the cache for events matching the 'e' filter
        const cachedETagEvents = [];
        for (const eTag of filters['#e']) {
          const eTagCacheKey = `e-${eTag}`;
          const cachedEvents = relayCache.get(eTagCacheKey);
          if (cachedEvents) {
            cachedETagEvents.push(...cachedEvents);
          } else {
            const eTagCountKey = `${ETAG_COUNT_KEY_PREFIX}${eTag}`;
            const eTagCount = parseInt(await relayDb.get(eTagCountKey, 'text') || '0', 10);
            const startIndex = (pagination.page - 1) * pagination.limit;
            const endIndex = startIndex + pagination.limit - 1;
            const startCount = Math.max(0, eTagCount - endIndex);
            const endCount = Math.max(0, eTagCount - startIndex);
            for (let i = endCount; i >= startCount; i--) {
              const eTagKey = `e-${eTag}:${i}`;
              eventPromises.push(relayDb.get(eTagKey, { type: 'json' }));
            }
          }
        }
        events = cachedETagEvents;
      }
      if (filters['#p']) {
        // Check the cache for events matching the 'p' filter
        const cachedPTagEvents = [];
        for (const pTag of filters['#p']) {
          const pTagCacheKey = `p-${pTag}`;
          const cachedEvents = relayCache.get(pTagCacheKey);
          if (cachedEvents) {
            cachedPTagEvents.push(...cachedEvents);
          } else {
            const pTagCountKey = `${PTAG_COUNT_KEY_PREFIX}${pTag}`;
            const pTagCount = parseInt(await relayDb.get(pTagCountKey, 'text') || '0', 10);
            const startIndex = (pagination.page - 1) * pagination.limit;
            const endIndex = startIndex + pagination.limit - 1;
            const startCount = Math.max(0, pTagCount - endIndex);
            const endCount = Math.max(0, pTagCount - startIndex);
            for (let i = endCount; i >= startCount; i--) {
              const pTagKey = `p-${pTag}:${i}`;
              eventPromises.push(relayDb.get(pTagKey, { type: 'json' }));
            }
          }
        }
        events = cachedPTagEvents;
      }
      const fetchedEvents = await Promise.all(eventPromises);
      events = [...events, ...fetchedEvents.filter((event) => event !== null)];
      // Check if the events should be included based on the filters
      events = events.filter((event) => {
        const includeEvent =
          (!filters.ids || filters.ids.includes(event.id)) &&
          (!filters.kinds || filters.kinds.includes(event.kind)) &&
          (!filters.authors || filters.authors.includes(event.pubkey)) &&
          (!filters['#e'] || event.tags.some(tag => tag[0] === 'e' && filters['#e'].includes(tag[1]))) &&
          (!filters['#p'] || event.tags.some(tag => tag[0] === 'p' && filters['#p'].includes(tag[1]))) &&
          (!filters.since || event.created_at >= filters.since) &&
          (!filters.until || event.created_at <= filters.until);
        return includeEvent;
      });
      relayCache.set(cacheKey, events);
    } catch (error) {
      console.error(`Error retrieving events:`, error);
      events = [];
    }
  }
  const totalEvents = events.length;
  const totalPages = Math.min(Math.ceil(totalEvents / pagination.limit), maxPages);
  const paginatedEvents = events.slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit);
  for (const event of paginatedEvents) {
    server.send(JSON.stringify(["EVENT", subscriptionId, event]));
  }
  if (pagination.page >= totalPages) {
    server.send(JSON.stringify(["EOSE", subscriptionId]));
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

// Handles saving event to KV store
const KIND_COUNT_KEY_PREFIX = 'kind_count_';
const PUBKEY_COUNT_KEY_PREFIX = 'pubkey_count_';
const ETAG_COUNT_KEY_PREFIX = 'etag_count_';
const PTAG_COUNT_KEY_PREFIX = 'ptag_count_';
async function saveEventToKV(event) {
  const eventKey = `event:${event.id}`;
  const storedEvent = await relayDb.get(eventKey, "json");
  if (storedEvent) {
    console.log(`Duplicate event: ${event.id}. Event dropped.`);
    return;
  }
  const kindCountKey = `${KIND_COUNT_KEY_PREFIX}${event.kind}`;
  const kindCount = parseInt(await relayDb.get(kindCountKey, 'text') || '0', 10);
  const kindKey = `kind-${event.kind}:${kindCount + 1}`;
  const pubkeyCountKey = `${PUBKEY_COUNT_KEY_PREFIX}${event.pubkey}`;
  const pubkeyCount = parseInt(await relayDb.get(pubkeyCountKey, 'text') || '0', 10);
  const pubkeyKey = `pubkey-${event.pubkey}:${pubkeyCount + 1}`;
  const eventWithCountRef = { ...event, kindKey, pubkeyKey };
  await relayDb.put(kindKey, JSON.stringify(event));
  await relayDb.put(pubkeyKey, JSON.stringify(event));
  await relayDb.put(eventKey, JSON.stringify(eventWithCountRef));
  await relayDb.put(kindCountKey, (kindCount + 1).toString());
  await relayDb.put(pubkeyCountKey, (pubkeyCount + 1).toString());
  for (const tag of event.tags) {
    if (tag[0] === 'e') {
      const eTagCountKey = `${ETAG_COUNT_KEY_PREFIX}${tag[1]}`;
      const eTagCount = parseInt(await relayDb.get(eTagCountKey, 'text') || '0', 10);
      const eTagKey = `e-${tag[1]}:${eTagCount + 1}`;
      await relayDb.put(eTagKey, JSON.stringify(event));
      await relayDb.put(eTagCountKey, (eTagCount + 1).toString());
    } else if (tag[0] === 'p') {
      const pTagCountKey = `${PTAG_COUNT_KEY_PREFIX}${tag[1]}`;
      const pTagCount = parseInt(await relayDb.get(pTagCountKey, 'text') || '0', 10);
      const pTagKey = `p-${tag[1]}:${pTagCount + 1}`;
      await relayDb.put(pTagKey, JSON.stringify(event));
      await relayDb.put(pTagCountKey, (pTagCount + 1).toString());
    }
  }
  await blastEventToRelays(event);
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

// Handles event deletes (NIP-09)
async function processDeletionEvent(deletionEvent, server) {
  try {
    if (deletionEvent.kind === 5 && deletionEvent.pubkey) {
      const deletedEventIds = deletionEvent.tags
        .filter((tag) => tag[0] === "e")
        .map((tag) => tag[1]);
      const deletePromises = deletedEventIds.map(async (eventId) => {
        const idKey = `event:${eventId}`;
        const event = await relayDb.get(idKey, "json");
        if (event && event.pubkey === deletionEvent.pubkey) {
          await relayDb.delete(idKey);
          if (event.kindKey) {
            await relayDb.delete(event.kindKey);
          }
          if (event.pubkeyKey) {
            await relayDb.delete(event.pubkeyKey);
          }
          for (const tag of event.tags) {
            if (tag[0] === 'e') {
              const eTagKey = `e-${tag[1]}:${event.created_at}`;
              await relayDb.delete(eTagKey);
            } else if (tag[0] === 'p') {
              const pTagKey = `p-${tag[1]}:${event.created_at}`;
              await relayDb.delete(pTagKey);
            }
          }
          // Delete event from the cache
          const cacheKey = `event:${eventId}`;
          relayCache.delete(cacheKey);
          return true;
        }
        return false;
      });
      const deleteResults = await Promise.all(deletePromises);
      const deletedCount = deleteResults.filter((result) => result).length;
      sendOK(server, deletionEvent.id, true, `Processed deletion request. Events deleted: ${deletedCount}`);
    } else {
      sendOK(server, deletionEvent.id, false, "Invalid deletion event.");
    }
  } catch (error) {
    console.error("Error processing deletion event:", error);
    sendOK(server, deletionEvent.id, false, `Error processing deletion event: ${error.message}`);
  }
}

// Verify event sig
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