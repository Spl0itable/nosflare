import { schnorr } from "@noble/curves/secp256k1";

// Relay info (NIP-11)
const relayInfo = {
  name: "Nosflare",
  description: "A serverless Nostr relay through Cloudflare Worker and KV store",
  pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
  contact: "lucas@censorship.rip",
  supported_nips: [1, 2, 4, 9, 11, 12, 15, 16, 20, 22, 33, 40],
  software: "https://github.com/Spl0itable/nosflare",
  version: "1.11.9",
};

// Relay favicon
const relayIcon = "https://workers.cloudflare.com/resources/logo/logo.svg";

// Blocked pubkeys
// Add pubkeys in hex format as strings to block write access
const blockedPubkeys = [
  "3c7f5948b5d80900046a67d8e3bf4971d6cba013abece1dd542eca223cf3dd3f",
  "fed5c0c3c8fe8f51629a0b39951acdf040fd40f53a327ae79ee69991176ba058",
  "e810fafa1e89cdf80cced8e013938e87e21b699b24c8570537be92aec4b12c18"
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

addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.pathname === "/") {
    if (request.headers.get("Upgrade") === "websocket") {
      event.respondWith(handleWebSocket(request));
    } else if (request.headers.get("Accept") === "application/nostr+json") {
      event.respondWith(handleRelayInfoRequest());
    } else {
      event.respondWith(
        new Response("Connect using a Nostr client", { status: 200 })
      );
    }
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

// Use in-memory cache
const relayCache = {
  _cache: {},
  get(key) {
    return this._cache[key]?.value || null;
  },
  set(key, value) {
    this._cache[key] = { value, timestamp: Date.now() };
  },
  delete(key) {
    delete this._cache[key];
  },
};
const recentEventsCache = 'recent_events_cache';
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

// Rate-limit messages and cache
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
    const tokensToAdd = ((now - this.lastRefillTime) * this.fillRate);
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }
}
const messageRateLimiter = new rateLimiter(100 / 1000, 200);
const kvCacheRateLimiter = new rateLimiter(1 / 1.1, 200);
async function getEventFromCacheOrKV(eventId) {
  if (!kvCacheRateLimiter.removeToken()) {
    throw new Error('Rate limit exceeded for KV store access');
  }
  const cacheKey = `event:${eventId}`;
  let event = relayCache.get(cacheKey);
  if (event) {
    return event;
  }
  event = await relayDb.get(cacheKey, { type: 'json' });
  if (event) {
    relayCache.set(cacheKey, event);
  }
  return event;
}

// Handle event requests (NIP-01)
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

// Handles EVENT messages
async function processEvent(event, server) {
  try {
    // Check if the pubkey is allowed
    if (!isPubkeyAllowed(event.pubkey)) {
      sendOK(server, event.id, false, "This pubkey is not allowed.");
      return;
    }
    // Check if the event kind is allowed
    if (!isEventKindAllowed(event.kind)) {
      sendOK(server, event.id, false, `Event kind ${event.kind} is not allowed.`);
      return;
    }
    // Special handling for deletion events (kind 5)
    if (event.kind === 5) {
      await processDeletionEvent(event, server);
      return;
    }
    const cacheKey = `event:${event.id}`;
    const cachedEvent = relayCache.get(cacheKey);
    if (cachedEvent) {
      // Event found in cache, skip KV store request
      sendOK(server, event.id, false, "Duplicate. Event dropped.");
      return;
    }
    // Event not found in cache, retrieve from KV store
    const existingEvent = await relayDb.get(cacheKey, "json");
    if (existingEvent) {
      // Event already exists, update cache and recent events cache
      relayCache.set(cacheKey, existingEvent);
      // Update the recent events cache
      let recentEvents = relayCache.get(recentEventsCache) || [];
      recentEvents.push(existingEvent);
      relayCache.set(recentEventsCache, recentEvents);
      sendOK(server, event.id, false, "Duplicate. Event dropped.");
      return;
    }
    const isValidSignature = await verifyEventSignature(event);
    if (isValidSignature) {
      // Store the event in KV store and cache
      await relayDb.put(cacheKey, JSON.stringify(event));
      relayCache.set(cacheKey, event);
      // Update the recent events cache
      let recentEvents = relayCache.get(recentEventsCache) || [];
      recentEvents.unshift(event);
      if (recentEvents.length > 100) {
        recentEvents = recentEvents.slice(0, 100);
      }
      relayCache.set(recentEventsCache, recentEvents);
      sendOK(server, event.id, true, "");
    } else {
      sendOK(server, event.id, false, "Invalid: signature verification failed.");
    }
  } catch (error) {
    console.error("Error in EVENT processing:", error);
    sendOK(server, event.id, false, `Error: EVENT processing failed - ${error.message}`);
  }
}

// Handles REQ messages
async function processReq(message, server) {
  const subscriptionId = message[1];
  const filters = message[2] || {};
  const cacheKey = generateSubscriptionCacheKey(filters);
  let events = [];
  // Check the cache for filtered events
  let cachedEvents = relayCache.get(cacheKey);
  if (cachedEvents) {
    events = cachedEvents;
  } else {
    let recentEvents = relayCache.get(recentEventsCache) || [];
    events = recentEvents.filter(event => {
      if (filters.ids && !filters.ids.includes(event.id)) {
        return false;
      }
      if (filters.kinds && !filters.kinds.includes(event.kind)) {
        return false;
      }
      if (filters.authors && !filters.authors.includes(event.pubkey)) {
        return false;
      }
      if (filters['#e'] && !event.tags.some(tag => tag[0] === 'e' && filters['#e'].includes(tag[1]))) {
        return false;
      }
      if (filters['#p'] && !event.tags.some(tag => tag[0] === 'p' && filters['#p'].includes(tag[1]))) {
        return false;
      }
      if (filters.since && event.created_at < filters.since) {
        return false;
      }
      if (filters.until && event.created_at > filters.until) {
        return false;
      }
      return true;
    });
    if (events.length === 0) {
      const filterPromises = Object.entries(filters).map(async ([filterKey, filterValue]) => {
        if (filterKey === 'ids') {
          const eventPromises = filterValue.map(async (eventId) => {
            try {
              if (!kvCacheRateLimiter.removeToken()) {
                throw new Error('Rate limit exceeded for KV store access');
              }
              const cacheKey = `event:${eventId}`;
              let event = relayCache.get(cacheKey);
              if (!event) {
                const eventKey = `event:${eventId}`;
                event = await relayDb.get(eventKey, { type: 'json' });
                if (event) {
                  relayCache.set(cacheKey, event);
                }
              }
              return event;
            } catch (error) {
              console.error(`Error retrieving event ${eventId}:`, error);
              return null;
            }
          });
          return Promise.all(eventPromises);
        } else if (filterKey === 'kinds' || filterKey === 'authors' || filterKey === '#e' || filterKey === '#p') {
          const eventPromises = filterValue.map(async (value) => {
            try {
              if (!kvCacheRateLimiter.removeToken()) {
                throw new Error('Rate limit exceeded for KV store access');
              }
              const latestEventsKeys = await relayDb.list({ prefix: "event:", limit: 100, reverse: true });
              const eventPromises = latestEventsKeys.keys.map(async (key) => {
                try {
                  const event = await getEventFromCacheOrKV(key.name.replace('event:', ''));
                  return event;
                } catch (error) {
                  console.error(`Error retrieving event ${key.name}:`, error);
                  return null;
                }
              });
              const latestEvents = (await Promise.all(eventPromises)).filter(event => event !== null);
              return latestEvents.filter(event => {
                if (filterKey === 'kinds') {
                  return event.kind === value;
                } else if (filterKey === 'authors') {
                  return event.pubkey === value;
                } else if (filterKey === '#e') {
                  return event.tags.some(tag => tag[0] === 'e' && tag[1] === value);
                } else if (filterKey === '#p') {
                  return event.tags.some(tag => tag[0] === 'p' && tag[1] === value);
                }
              });
            } catch (error) {
              console.error(`Error retrieving events for ${filterKey}:`, error);
              return [];
            }
          });
          return Promise.all(eventPromises).then(results => results.flat());
        } else if (filterKey === 'since' || filterKey === 'until') {
          try {
            if (!kvCacheRateLimiter.removeToken()) {
              throw new Error('Rate limit exceeded for KV store access');
            }
            const latestEventsKeys = await relayDb.list({ prefix: "event:", limit: 100, reverse: true });
            const eventPromises = latestEventsKeys.keys.map(async (key) => {
              try {
                const event = await getEventFromCacheOrKV(key.name.replace('event:', ''));
                return event;
              } catch (error) {
                console.error(`Error retrieving event ${key.name}:`, error);
                return null;
              }
            });
            const latestEvents = (await Promise.all(eventPromises)).filter(event => event !== null);
            return latestEvents.filter(event => {
              if (filterKey === 'since') {
                return event.created_at >= filterValue;
              } else if (filterKey === 'until') {
                return event.created_at <= filterValue;
              }
            });
          } catch (error) {
            console.error(`Error retrieving events for ${filterKey}:`, error);
            return [];
          }
        }
      });
      const filterResults = await Promise.all(filterPromises);
      events = filterResults.flat().filter(event => event !== null);
    }
    relayCache.set(cacheKey, events);
  }
  if (filters.limit && events.length > filters.limit) {
    events = events.slice(0, filters.limit);
  }
  for (const event of events) {
    server.send(JSON.stringify(["EVENT", subscriptionId, event]));
  }
  server.send(JSON.stringify(["EOSE", subscriptionId]));
}

// Handles CLOSE messages
async function closeSubscription(subscriptionId, server) {
  try {
    server.send(JSON.stringify(["CLOSED", subscriptionId, "Subscription closed"]));
  } catch (error) {
    console.error("Error closing subscription:", error);
    sendError(server, `error: failed to close subscription ${subscriptionId}`);
  }
}

// Handles event deletes (NIP-09)
async function processDeletionEvent(deletionEvent, server) {
  try {
    if (deletionEvent.kind === 5 && deletionEvent.pubkey) {
      const deletedEventIds = deletionEvent.tags
        .filter((tag) => tag[0] === "e")
        .map((tag) => tag[1]);
      const maxDeletedEvents = 50;
      const limitedDeletedEventIds = deletedEventIds.slice(0, maxDeletedEvents);
      const deletePromises = limitedDeletedEventIds.map(async (eventId) => {
        const eventKey = `event:${eventId}`;
        const event = await relayDb.get(eventKey, "json");
        if (event && event.pubkey === deletionEvent.pubkey) {
          await relayDb.delete(eventKey);
          relayCache.delete(eventId);
          return true;
        }
        return false;
      });
      const deleteResults = await Promise.all(deletePromises);
      const deletedCount = deleteResults.filter((result) => result).length;
      if (deletedEventIds.length > maxDeletedEvents) {
        server.send(JSON.stringify(["NOTICE", `Only the first ${maxDeletedEvents} deleted events were processed.`]));
      }
      sendOK(server, deletionEvent.id, true, `Processed deletion request. Events deleted: ${deletedCount}`);
    } else {
      sendOK(server, deletionEvent.id, false, "Invalid deletion event.");
    }
  } catch (error) {
    console.error("Error processing deletion event:", error);
    sendOK(server, deletionEvent.id, false, `Error processing deletion event: ${error.message}`);
  }
}
function sendOK(server, eventId, status, message) {
  server.send(JSON.stringify(["OK", eventId, status, message]));
}
function sendError(server, message) {
  server.send(JSON.stringify(["NOTICE", message]));
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