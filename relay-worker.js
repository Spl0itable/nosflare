// Relay worker

import { schnorr } from "@noble/curves/secp256k1";

// Relay info (NIP-11)
const relayInfo = {
    name: "Nosflare",
    description: "A serverless Nostr relay through Cloudflare Worker and R2 bucket",
    pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
    contact: "lucas@censorship.rip",
    supported_nips: [1, 2, 4, 5, 9, 11, 12, 15, 16, 17, 20, 22, 33, 40],
    software: "https://github.com/Spl0itable/nosflare",
    version: "4.20.22",
};

// Relay favicon
const relayIcon = "https://workers.cloudflare.com/resources/logo/logo.svg";

// Nostr address NIP-05 verified users
const nip05Users = {
    "lucas": "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
    // ... more NIP-05 verified users
};

// Handles EVENT messages to helper workers
const eventHelpers = [
    "https://event-helper-1.example.com",
    "https://event-helper-2.example.com"
    // ... add more helper workers
];

// Handles REQ messages from helper workers
const reqHelpers = [
    "https://req-helper-1.example.com",
    "https://req-helper-2.example.com"
    // ... add more helper workers
];

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
    server.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
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
            if (!pubkeyRateLimiter.removeToken()) {
                sendOK(server, event.id, false, "Rate limit exceeded. Please try again later.");
                return;
            }
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
            if (event.kind === 5) {
                sendOK(server, event.id, true, "Deletion request received successfully.");
            } else {
                sendOK(server, event.id, true, "Event received successfully.");
            }
            await sendEventToHelper(event, server, event.id);
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
    const subscriptionId = message[1];
    const filters = message[2] || {};
    try {
      const shuffledHelpers = shuffleArray([...reqHelpers]);
      const numHelpers = Math.min(shuffledHelpers.length, 6);
      const filterPromises = [];
      const filterChunks = splitFilters(filters, numHelpers);
      for (let i = 0; i < numHelpers; i++) {
        const helperFilters = filterChunks[i];
        const helper = shuffledHelpers[i];
        filterPromises.push(fetchEventsFromHelper(helper, subscriptionId, helperFilters, server));
      }
      const fetchedEvents = await Promise.all(filterPromises);
      const events = fetchedEvents.flat();
      for (const event of events) {
        server.send(JSON.stringify(["EVENT", subscriptionId, event]));
      }
      server.send(JSON.stringify(["EOSE", subscriptionId]));
    } catch (error) {
      console.error("Error fetching events:", error);
      sendError(server, `Error fetching events: ${error.message}`);
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

// Handles requesting events from helper workers
async function fetchEventsFromHelper(helper, subscriptionId, filters, server) {
    try {
      const response = await fetch(helper, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ type: 'REQ', subscriptionId, filters }),
      });
      if (response.ok) {
        const events = await response.json();
        return events;
      } else {
        console.error(`Error fetching events from relay ${helper}: ${response.status} - ${response.statusText}`);
        throw new Error(`Error fetching events: ${response.status} - ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error fetching events from relay ${helper}:`, error);
      throw error;
    }
  }

// Handles sending event to helper workers
async function sendEventToHelper(event, server, eventId) {
    try {
        const randomHelper = eventHelpers[Math.floor(Math.random() * eventHelpers.length)];
        const response = await fetch(randomHelper, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ type: 'EVENT', event }),
        });
        if (!response.ok) {
            console.error(`Error sending event ${eventId} to helper ${randomHelper}: ${response.status} - ${response.statusText}`);
        }
    } catch (error) {
        console.error(`Error sending event ${eventId} to helper ${randomHelper}:`, error);
    }
}

// Splits filters into chunks for helpers
function splitFilters(filters, numChunks) {
    const baseFilters = {};
    const arrayFilters = {};
    // Separate base filters and array filters
    for (const key in filters) {
        if (Array.isArray(filters[key])) {
            arrayFilters[key] = filters[key];
        } else {
            baseFilters[key] = filters[key];
        }
    }
    const filterChunks = Array(numChunks).fill().map(() => ({ ...baseFilters }));
    const arrayKeys = Object.keys(arrayFilters);
    if (arrayKeys.length === 1) {
        // If there's only one filter, split it into chunks
        const key = arrayKeys[0];
        const arrayValues = arrayFilters[key];
        const arrayChunks = splitArray(arrayValues, numChunks);
        for (let i = 0; i < numChunks; i++) {
            filterChunks[i][key] = arrayChunks[i];
        }
    } else {
        // If there are multiple filters, split the 'authors' filter and assign other filters
        for (const key in arrayFilters) {
            const arrayValues = arrayFilters[key];
            if (key === 'authors') {
                const arrayChunks = splitArray(arrayValues, numChunks);
                for (let i = 0; i < numChunks; i++) {
                    filterChunks[i][key] = arrayChunks[i];
                }
            } else {
                for (let i = 0; i < numChunks; i++) {
                    filterChunks[i][key] = arrayValues;
                }
            }
        }
    }
    return filterChunks;
}

// Helper to split an array into chunks
function splitArray(arr, numChunks) {
    const chunkSize = Math.ceil(arr.length / numChunks);
    return Array(numChunks)
        .fill()
        .map((_, index) => arr.slice(index * chunkSize, (index + 1) * chunkSize));
}

// Helper to shuffle 6 reqHelper selection
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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