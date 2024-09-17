// Relay worker

import { schnorr } from "@noble/curves/secp256k1";

// Relay info (NIP-11)
const relayInfo = {
    name: "Nosflare",
    description: "A serverless Nostr relay through Cloudflare Worker and R2 bucket",
    pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
    contact: "lux@censorship.rip",
    supported_nips: [1, 2, 4, 5, 9, 11, 12, 15, 16, 17, 20, 22, 33, 40],
    software: "https://github.com/Spl0itable/nosflare",
    version: "4.21.24",
};

// Relay favicon
const relayIcon = "https://cdn-icons-png.flaticon.com/128/426/426833.png";

// Nostr address NIP-05 verified users
const nip05Users = {
    "lux": "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
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
        const blockedLower = blocked.toLowerCase(); // Checks case-insensitively
        if (
            lowercaseContent.includes(blockedLower) ||
            lowercaseTags.some(tag => tag.includes(blockedLower))
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
    _subscriptions: {}, // Store subscriptions

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
    addSubscription(wsId, subscriptionId, filters) {
        if (!this._subscriptions[wsId]) {
            this._subscriptions[wsId] = {};
        }
        this._subscriptions[wsId][subscriptionId] = filters;
    },
    getSubscription(wsId, subscriptionId) {
        return this._subscriptions[wsId]?.[subscriptionId] || null;
    },
    deleteSubscription(wsId, subscriptionId) {
        if (this._subscriptions[wsId]) {
            delete this._subscriptions[wsId][subscriptionId];
        }
    },
    clearSubscriptions(wsId) {
        delete this._subscriptions[wsId];
    }
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
const pubkeyRateLimiter = new rateLimiter(10 / 60000, 10); // 10 EVENT messages per min
const excludedRateLimitKinds = []; // kinds to exclude from EVENT rate limiting Ex: 1, 2, 3
const reqRateLimiter = new rateLimiter(10 / 60000, 10);  // 10 REQ messages per min

// Handles websocket messages
async function handleWebSocket(event, request) {
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    server.addEventListener("message", async (messageEvent) => {
        event.waitUntil(
            (async () => {
                try {
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
        const wsId = server.id || Math.random().toString(36).substr(2, 9);
        relayCache.clearSubscriptions(wsId); // Clear all subscriptions for this connection
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

// Handles EVENT messages
async function processEvent(event, server) {
    try {
        // Check cache for duplicate event ID
        const cacheKey = `event:${event.id}`;
        const cachedEvent = relayCache.get(cacheKey);
        if (cachedEvent) {
            sendOK(server, event.id, false, "Duplicate. Event dropped.");
            return;
        }

        // Verify event signature
        const isValidSignature = await verifyEventSignature(event);
        if (!isValidSignature) {
            sendOK(server, event.id, false, "Invalid: signature verification failed.");
            return;
        }

        // Add event to cache with a TTL of 60 seconds (or more, as needed)
        relayCache.set(cacheKey, event, 60000);

        // Acknowledge the event to the client (send OK after basic validation)
        sendOK(server, event.id, true, "Event received successfully for processing.");

        // Process the event asynchronously without blocking the WebSocket
        processEventInBackground(event, server);

    } catch (error) {
        console.error("Error in EVENT processing:", error);
        sendOK(server, event.id, false, `Error: EVENT processing failed - ${error.message}`);
    }
}

// Process the event asynchronously in the background
async function processEventInBackground(event, server) {
    try {
        // Check if the pubkey is allowed
        if (!isPubkeyAllowed(event.pubkey)) {
            return "Denied. The pubkey is not allowed.";
        }

        // Check if the event kind is allowed
        if (!isEventKindAllowed(event.kind)) {
            return `Denied. Event kind ${event.kind} is not allowed.`;
        }

        // Check for blocked content
        if (containsBlockedContent(event)) {
            return "Denied. The event contains blocked content.";
        }

        // Check if the tags are allowed or blocked
        for (const tag of event.tags) {
            const tagKey = tag[0]; 
            const tagValue = tag[1] || "";

            // If the tag is not allowed, reject the event
            if (!isTagAllowed(tagKey)) {
                return `Denied. Tag '${tagKey}' is not allowed.`;
            }

            // If the tag is blocked, reject the event
            if (blockedTags.has(tagKey)) {
                return `Denied. Tag '${tagKey}' is blocked.`;
            }
        }

        // Rate limit all event kinds except excluded kinds
        if (!excludedRateLimitKinds.includes(event.kind)) {
            if (!pubkeyRateLimiter.removeToken()) {
                return "Rate limit exceeded. Please try again later.";
            }
        }

        // Send event to matching subscriptions
        const wsId = server.id || Math.random().toString(36).substr(2, 9);
        const subscriptions = relayCache._subscriptions[wsId];

        if (subscriptions) {
            for (const [subscriptionId, filters] of Object.entries(subscriptions)) {
                if (matchesFilters(event, filters)) {
                    server.send(JSON.stringify(["EVENT", subscriptionId, event]));
                }
            }
        }

        // Update the cache for matching subscriptions in memory
        for (const [wsId, wsSubscriptions] of Object.entries(relayCache._subscriptions)) {
            for (const [subscriptionId, filters] of Object.entries(wsSubscriptions)) {
                if (matchesFilters(event, filters)) {
                    const cacheKey = `req:${JSON.stringify(filters)}`;
                    const cachedEvents = relayCache.get(cacheKey) || [];
                    cachedEvents.push(event);
                    relayCache.set(cacheKey, cachedEvents, 60000); // Cache for 60 seconds
                }
            }
        }

        // Forward the event to helper workers
        await sendEventToHelper(event, server, event.id);

    } catch (error) {
        console.error("Error in background event processing:", error);
    }
}

// Handles REQ messages
async function processReq(message, server) {
    const subscriptionId = message[1];
    const filters = message[2] || {};

    const wsId = server.id || Math.random().toString(36).substr(2, 9);

    // Check the REQ rate limiter
    if (!reqRateLimiter.removeToken()) {
        sendError(server, "REQ message rate limit exceeded. Please slow down.");
        sendEOSE(server, subscriptionId);
        return;
    }

    // Check if event kinds allowed
    if (filters.kinds) {
        const invalidKinds = filters.kinds.filter(kind => !isEventKindAllowed(kind));
        if (invalidKinds.length > 0) {
            sendError(server, `Blocked kinds in request: ${invalidKinds.join(', ')}`);
            sendEOSE(server, subscriptionId);
            return;
        }
    }

    // Allow up to 50 event IDs
    if (filters.ids && filters.ids.length > 50) {
        sendError(server, "The 'ids' filter must contain 50 or fewer event IDs.");
        sendEOSE(server, subscriptionId);
        return;
    }

    // Allow up to limit of 50 events
    if (filters.limit && filters.limit > 50) {
        sendError(server, "REQ limit exceeded. Maximum allowed limit is 50.");
        sendEOSE(server, subscriptionId);
        return;
    }

    // If no limit is provided, set it to 50
    filters.limit = filters.limit || 50;

    // Store the subscription in the relayCache for future reference
    relayCache.addSubscription(wsId, subscriptionId, filters);

    // Generate a unique cache key based on the filters
    const cacheKey = `req:${JSON.stringify(filters)}`;
    const cachedEvents = relayCache.get(cacheKey);

    if (cachedEvents && cachedEvents.length > 0) {
        // If cached events exist and are non-empty, return them immediately
        for (const event of cachedEvents.slice(0, filters.limit)) {
            server.send(JSON.stringify(["EVENT", subscriptionId, event]));
        }
        sendEOSE(server, subscriptionId);
        return;
    }

    try {
        // Shuffle helpers and distribute the filters
        const shuffledHelpers = shuffleArray([...reqHelpers]);
        const numHelpers = Math.min(shuffledHelpers.length, 6);
        const filterPromises = [];
        const filterChunks = splitFilters(filters, numHelpers);

        for (let i = 0; i < numHelpers; i++) {
            const helperFilters = filterChunks[i];
            const helper = shuffledHelpers[i];
            filterPromises.push(fetchEventsFromHelper(helper, subscriptionId, helperFilters, server));
        }

        // Await all events from the helper workers
        const fetchedEvents = await Promise.all(filterPromises);
        const events = fetchedEvents.flat();

        // Only cache the events if we actually have events
        if (events.length > 0) {
            relayCache.set(cacheKey, events, 60000); // Cache for 60 seconds
        }

        // Send the events to the client (respecting the limit)
        for (const event of events.slice(0, filters.limit)) {
            server.send(JSON.stringify(["EVENT", subscriptionId, event]));
        }
        sendEOSE(server, subscriptionId);
    } catch (error) {
        console.error("Error fetching events:", error);
        sendError(server, `Error fetching events: ${error.message}`);
        sendEOSE(server, subscriptionId);
    }
}

// Handles CLOSE messages
async function closeSubscription(subscriptionId, server) {
    const wsId = server.id || Math.random().toString(36).substr(2, 9);
    relayCache.deleteSubscription(wsId, subscriptionId);

    // Notify the client that the subscription is closed
    server.send(JSON.stringify(["CLOSED", subscriptionId, "Subscription closed"]));
}

// Handles requesting events from helper workers
async function fetchEventsFromHelper(helper, subscriptionId, filters, server) {
    const logContext = {
        helper,
        subscriptionId,
        filters,
    };

    try {
        console.log(`Requesting events from helper worker`, logContext);

        const response = await fetch(helper, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`,
            },
            body: JSON.stringify({ type: "REQ", subscriptionId, filters }),
        });

        if (response.ok) {
            // Check if the response is JSON or ArrayBuffer
            const contentType = response.headers.get("Content-Type");
            let events;

            if (contentType && contentType.includes("application/json")) {
                // Parse as JSON
                events = await response.json();
            } else {
                // Handle ArrayBuffer response
                const arrayBuffer = await response.arrayBuffer();
                const textDecoder = new TextDecoder("utf-8");
                const jsonString = textDecoder.decode(arrayBuffer);

                try {
                    events = JSON.parse(jsonString);
                } catch (error) {
                    console.error("Error parsing ArrayBuffer to JSON:", error);
                    throw new Error("Failed to parse response as JSON.");
                }
            }

            console.log(`Successfully retrieved events from helper worker`, {
                ...logContext,
                eventCount: events.length,
            });
            return events;
        } else {
            console.error(`Error fetching events from helper worker`, {
                ...logContext,
                status: response.status,
                statusText: response.statusText,
            });
            throw new Error(
                `Failed to fetch events: ${response.status} - ${response.statusText}`
            );
        }
    } catch (error) {
        console.error(`Error in fetchEventsFromHelper`, {
            ...logContext,
            error: error.message,
        });
        throw error;
    }
}

// Handles sending event to helper workers
async function sendEventToHelper(event, server, eventId) {
    const randomHelper = eventHelpers[Math.floor(Math.random() * eventHelpers.length)];
    const logContext = {
        helper: randomHelper,
        eventId,
        pubkey: event.pubkey,
    };

    try {
        console.log(`Sending event to helper worker`, logContext);

        const response = await fetch(randomHelper, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`,
            },
            body: JSON.stringify({ type: "EVENT", event }),
        });

        if (response.ok) {
            console.log(`Successfully sent event to helper worker`, logContext);
        } else {
            console.error(`Error sending event to helper worker`, {
                ...logContext,
                status: response.status,
                statusText: response.statusText,
            });
        }
    } catch (error) {
        console.error(`Error in sendEventToHelper`, {
            ...logContext,
            error: error.message,
        });
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

// Check if an event matches the subscription filters
function matchesFilters(event, filters) {
    // Example filter checks
    if (filters.ids && !filters.ids.includes(event.id)) return false;
    if (filters.authors && !filters.authors.includes(event.pubkey)) return false;
    if (filters.kinds && !filters.kinds.includes(event.kind)) return false;
    if (filters.since && event.created_at < filters.since) return false;
    if (filters.until && event.created_at > filters.until) return false;

    // Check tag filters (#e, #p, etc.)
    for (const [filterKey, filterValues] of Object.entries(filters)) {
        if (filterKey.startsWith("#")) {
            const tagKey = filterKey.slice(1);
            const eventTags = event.tags.filter(tag => tag[0] === tagKey).map(tag => tag[1]);
            if (!filterValues.some(value => eventTags.includes(value))) {
                return false;
            }
        }
    }

    return true; // All filters passed
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
function sendEOSE(server, subscriptionId) {
    server.send(JSON.stringify(["EOSE", subscriptionId]));
}