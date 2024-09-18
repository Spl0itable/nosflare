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
    version: "4.22.28",
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

// Blocked NIP-05 domains
const blockedNip05Domains = new Set([
    // Add domains that are explicitly blocked
    // "primal.net"
]);

// Allowed NIP-05 domains
const allowedNip05Domains = new Set([
    // Add domains that are explicitly allowed
    // Leave empty to allow all domains (unless blocked)
]);

// Blocked tags
// Add comma-separated tags Ex: t, e, p
const blockedTags = new Set([
    // ... tags that are explicitly blocked
]);
// Allowed tags
// Add comma-separated tags Ex: p, e, t
const allowedTags = new Set([
    // "p", "e", "t"
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

// Controls concurrent connections
const MAX_CONCURRENT_CONNECTIONS = 6;
let activeConnections = 0;

// Controls number of active connections
async function withConnectionLimit(promiseFunction) {
    // Wait if too many connections are active
    while (activeConnections >= MAX_CONCURRENT_CONNECTIONS) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    activeConnections += 1;
    try {
        return await promiseFunction();
    } finally {
        activeConnections -= 1;
    }
}

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
        // Log event processing start
        console.log(`Processing event ${event.id}`);

        // Check cache for duplicate event ID
        const cacheKey = `event:${event.id}`;
        const cachedEvent = relayCache.get(cacheKey);
        if (cachedEvent) {
            console.log(`Duplicate event detected: ${event.id}. Dropping event.`);
            sendOK(server, event.id, false, "Duplicate. Event dropped.");
            return;
        }

        // Verify event signature
        const isValidSignature = await verifyEventSignature(event);
        if (!isValidSignature) {
            console.error(`Signature verification failed for event ${event.id}`);
            sendOK(server, event.id, false, "Invalid: signature verification failed.");
            return;
        } else {
            console.log(`Signature verification passed for event ${event.id}`);
        }

        // Check if the pubkey is allowed
        if (!isPubkeyAllowed(event.pubkey)) {
            console.error(`Pubkey not allowed: ${event.pubkey} for event ${event.id}`);
            sendOK(server, event.id, false, `Invalid: pubkey ${event.pubkey} is not allowed.`);
            return;
        }

        // Check if the event kind is allowed
        if (!isEventKindAllowed(event.kind)) {
            console.error(`Event kind ${event.kind} is not allowed for event ${event.id}`);
            sendOK(server, event.id, false, `Invalid: event kind ${event.kind} is not allowed.`);
            return;
        }

        // Check for blocked content
        if (containsBlockedContent(event)) {
            console.error(`Event ${event.id} contains blocked content.`);
            sendOK(server, event.id, false, "Invalid: event contains blocked content.");
            return;
        }

        // Add event to cache with a TTL of 60 seconds
        relayCache.set(cacheKey, event, 60000);
        console.log(`Event ${event.id} cached with a TTL of 60 seconds`);

        // Acknowledge the event to the client
        sendOK(server, event.id, true, "Event received successfully for processing.");
        console.log(`Event ${event.id} acknowledged to the client`);

        // Process the event asynchronously
        console.log(`Processing event ${event.id} asynchronously in background`);
        processEventInBackground(event, server);

    } catch (error) {
        console.error(`Error in processing event ${event.id}:`, error);
        sendOK(server, event.id, false, `Error: EVENT processing failed - ${error.message}`);
    }
}

// Process the event asynchronously in the background
async function processEventInBackground(event, server) {
    try {
        // Log event processing start
        console.log(`Processing event ${event.id} in the background`);

        // Ensure event is valid JSON
        if (typeof event !== "object" || event === null || Array.isArray(event)) {
            console.error("Invalid JSON format. Expected a JSON object.");
            return { success: false, error: "Invalid JSON format. Expected a JSON object." };
        }

        // Check if the pubkey is allowed
        if (!isPubkeyAllowed(event.pubkey)) {
            console.error(`Event denied. Pubkey ${event.pubkey} is not allowed.`);
            return { success: false, error: `Pubkey ${event.pubkey} is not allowed.` };
        }

        // Check if the event kind is allowed
        if (!isEventKindAllowed(event.kind)) {
            console.error(`Event denied. Event kind ${event.kind} is not allowed.`);
            return { success: false, error: `Event kind ${event.kind} is not allowed.` };
        }

        // Check for blocked content
        if (containsBlockedContent(event)) {
            console.error(`Event denied. Content contains blocked phrases.`);
            return { success: false, error: "Event contains blocked content." };
        }

        // Check if the tags are allowed or blocked
        for (const tag of event.tags) {
            const tagKey = tag[0];

            // If the tag is not allowed, reject the event
            if (!isTagAllowed(tagKey)) {
                console.error(`Event denied. Tag '${tagKey}' is not allowed.`);
                return { success: false, error: `Tag '${tagKey}' is not allowed.` };
            }

            // If the tag is blocked, reject the event
            if (blockedTags.has(tagKey)) {
                console.error(`Event denied. Tag '${tagKey}' is blocked.`);
                return { success: false, error: `Tag '${tagKey}' is blocked.` };
            }
        }

        // NIP-05 validation
        if (event.kind !== 0) {
            const isValidNIP05 = await validateNIP05FromKind0(event.pubkey);
            if (!isValidNIP05) {
                console.error(`Event denied. NIP-05 validation failed for pubkey ${event.pubkey}.`);
                return { success: false, error: `NIP-05 validation failed for pubkey ${event.pubkey}.` };
            }
        }

        // Rate limit all event kinds except excluded kinds
        if (!excludedRateLimitKinds.includes(event.kind)) {
            if (!pubkeyRateLimiter.removeToken()) {
                console.error(`Event denied. Rate limit exceeded for pubkey ${event.pubkey}.`);
                return { success: false, error: "Rate limit exceeded. Please try again later." };
            }
        }

        // Send event to matching subscriptions
        const wsId = server.id || Math.random().toString(36).substr(2, 9);
        const subscriptions = relayCache._subscriptions[wsId];

        if (subscriptions) {
            let matched = false;
            for (const [subscriptionId, filters] of Object.entries(subscriptions)) {
                if (matchesFilters(event, filters)) {
                    matched = true;
                    console.log(`Event ${event.id} matched subscription ${subscriptionId}`);
                    server.send(JSON.stringify(["EVENT", subscriptionId, event]));
                }
            }
            if (!matched) {
                console.log(`Event ${event.id} did not match any subscriptions for wsId: ${wsId}`);
            }
        }

        // Update the cache for matching subscriptions in memory
        for (const [wsId, wsSubscriptions] of Object.entries(relayCache._subscriptions)) {
            for (const [subscriptionId, filters] of Object.entries(wsSubscriptions)) {
                if (matchesFilters(event, filters)) {
                    const cacheKey = `req:${JSON.stringify(filters)}`;
                    const cachedEvents = relayCache.get(cacheKey) || [];
                    cachedEvents.push(event);

                    // Log cache update
                    console.log(`Event ${event.id} added to cache for subscription ${subscriptionId}`);
                    relayCache.set(cacheKey, cachedEvents, 60000); // Cache for 60 seconds
                }
            }
        }

        // Forward the event to helper workers
        console.log(`Forwarding event ${event.id} to helper workers`);
        await sendEventToHelper(event, server, event.id);

    } catch (error) {
        console.error("Error in background event processing:", error);
        return { success: false, error: `Error: ${error.message}` };
    }
}

// Handles REQ messages
async function processReq(message, server) {
    const subscriptionId = message[1];
    const filters = message[2] || {};

    const wsId = server.id || Math.random().toString(36).substr(2, 9);

    // Check the REQ rate limiter
    if (!reqRateLimiter.removeToken()) {
        console.error(`REQ rate limit exceeded for subscriptionId: ${subscriptionId}`);
        sendError(server, "REQ message rate limit exceeded. Please slow down.");
        sendEOSE(server, subscriptionId);
        return;
    }

    // Block unsupported filters
    const unsupportedFilters = ['since', 'until'];
    for (const filter of unsupportedFilters) {
        if (filters[filter]) {
            console.error(`Unsupported filter '${filter}' used in subscriptionId: ${subscriptionId}`);
            sendError(server, `Unsupported filter: '${filter}'`);
            sendEOSE(server, subscriptionId);
            return;
        }
    }

    // Validate event IDs if present in filters
    try {
        if (filters.ids) {
            validateIds(filters.ids);
        }
    } catch (error) {
        console.error(`Invalid event ID format in subscriptionId: ${subscriptionId} - ${error.message}`);
        sendError(server, `Invalid event ID format: ${error.message}`);
        sendEOSE(server, subscriptionId);
        return;
    }

    // Validate author(s) pubkey(s) if present in filters
    try {
        if (filters.authors) {
            validateAuthors(filters.authors);
        }
    } catch (error) {
        console.error(`Invalid author public key format in subscriptionId: ${subscriptionId} - ${error.message}`);
        sendError(server, `Invalid author public key format: ${error.message}`);
        sendEOSE(server, subscriptionId);
        return;
    }

    // Check if event kinds are allowed
    if (filters.kinds) {
        const invalidKinds = filters.kinds.filter(kind => !isEventKindAllowed(kind));
        if (invalidKinds.length > 0) {
            console.error(`Blocked kinds in subscriptionId: ${subscriptionId} - ${invalidKinds.join(', ')}`);
            sendError(server, `Blocked kinds in request: ${invalidKinds.join(', ')}`);
            sendEOSE(server, subscriptionId);
            return;
        }
    }

    // Allow up to 50 event IDs
    if (filters.ids && filters.ids.length > 50) {
        console.error(`Too many event IDs in subscriptionId: ${subscriptionId} - Maximum is 50`);
        sendError(server, "The 'ids' filter must contain 50 or fewer event IDs.");
        sendEOSE(server, subscriptionId);
        return;
    }

    // Allow up to a limit of 50 events
    if (filters.limit && filters.limit > 50) {
        console.error(`REQ limit exceeded in subscriptionId: ${subscriptionId} - Maximum allowed is 50`);
        sendError(server, "REQ limit exceeded. Maximum allowed limit is 50.");
        sendEOSE(server, subscriptionId);
        return;
    }

    // If no limit is provided, set it to 50
    filters.limit = filters.limit || 50;

    // Store the subscription in cache
    relayCache.addSubscription(wsId, subscriptionId, filters);

    // Generate a unique cache key based on the filters
    const cacheKey = `req:${JSON.stringify(filters)}`;
    const cachedEvents = relayCache.get(cacheKey);

    if (cachedEvents && cachedEvents.length > 0) {
        console.log(`Serving cached events for subscriptionId: ${subscriptionId}`);
        // Send cached events to the client immediately
        sendEventsToClient(server, subscriptionId, cachedEvents.slice(0, filters.limit));
        sendEOSE(server, subscriptionId);
        return;
    }

    try {
        // Distribute filters to helper workers
        const shuffledHelpers = shuffleArray([...reqHelpers]);
        const numHelpers = Math.min(shuffledHelpers.length, 6);
        const filterChunks = splitFilters(filters, numHelpers);

        const allEvents = [];

        // Set EOSE timeout
        const TIMEOUT_MS = 5000; // 5 seconds to return events
        let eoseSent = false;

        const eoseTimeout = setTimeout(() => {
            if (!eoseSent) {
                console.log(`Sending EOSE due to timeout for subscriptionId: ${subscriptionId}`);
                sendEOSE(server, subscriptionId);
                eoseSent = true;
            }
        }, TIMEOUT_MS);

        // Process each helper request with concurrency control
        const helperPromises = filterChunks.map((helperFilters, i) => {
            const helper = shuffledHelpers[i];

            return withConnectionLimit(() =>
                fetchEventsFromHelper(helper, subscriptionId, helperFilters, server)
                    .then(events => {
                        if (events.length > 0) {
                            console.log(`Received ${events.length} events from ${helper} for subscriptionId: ${subscriptionId}`);

                            // Cache the events for future requests
                            const cachedEvents = relayCache.get(cacheKey) || [];
                            relayCache.set(cacheKey, [...cachedEvents, ...events], 60000); // Cache for 60 seconds

                            // Send the events to the client immediately
                            sendEventsToClient(server, subscriptionId, events.slice(0, filters.limit));
                        } else {
                            console.log(`No events returned from ${helper} for subscriptionId: ${subscriptionId}`);
                        }
                    })
                    .catch(error => {
                        console.error(`Error fetching events from helper ${helper} for subscriptionId: ${subscriptionId} - ${error.message}`);
                    })
            );
        });

        // Wait for all helper requests to finish
        Promise.allSettled(helperPromises).then(() => {
            clearTimeout(eoseTimeout);

            if (!eoseSent) {
                console.log(`Sending EOSE after all helper requests completed for subscriptionId: ${subscriptionId}`);
                sendEOSE(server, subscriptionId);
                eoseSent = true;
            }
        });

    } catch (error) {
        console.error(`Error fetching events for subscriptionId: ${subscriptionId} - ${error.message}`);
        sendError(server, `Error fetching events: ${error.message}`);
        if (!eoseSent) {
            sendEOSE(server, subscriptionId);
            eoseSent = true;
        }
    }
}

// Handles CLOSE messages
async function closeSubscription(subscriptionId, server) {
    const wsId = server.id || Math.random().toString(36).substr(2, 9);
    relayCache.deleteSubscription(wsId, subscriptionId);

    // Notify the client that the subscription is closed
    server.send(JSON.stringify(["CLOSED", subscriptionId, "Subscription closed"]));
}

// Fetches NIP-05 from kind 0 event
async function validateNIP05FromKind0(pubkey) {
    try {
        // Check if we have a kind 0 event cached for the pubkey
        let metadataEvent = relayCache.get(`metadata:${pubkey}`);

        if (!metadataEvent) {
            // If not cached, fetch the kind 0 event from the helper or fallback relay
            metadataEvent = await fetchKind0EventForPubkey(pubkey);

            if (!metadataEvent) {
                console.error(`No kind 0 metadata event found for pubkey: ${pubkey}`);
                return false;
            }

            // Cache the event for future reference
            relayCache.set(`metadata:${pubkey}`, metadataEvent, 3600000); // Cache for 1 hour
        }

        // Parse the content field of the kind 0 event
        const metadata = JSON.parse(metadataEvent.content);
        const nip05Address = metadata.nip05;

        if (!nip05Address) {
            console.error(`No NIP-05 address found in kind 0 for pubkey: ${pubkey}`);
            return false;
        }

        // Validate the NIP-05 address
        const isValid = await validateNIP05(nip05Address, pubkey);
        return isValid;

    } catch (error) {
        console.error(`Error validating NIP-05 for pubkey ${pubkey}: ${error.message}`);
        return false;
    }
}

// Fetch kind 0 event for pubkey
async function fetchKind0EventForPubkey(pubkey) {
    try {
        // Shuffle helpers and distribute the request to fetch kind 0
        const shuffledHelpers = shuffleArray([...reqHelpers]);
        const filters = { kinds: [0], authors: [pubkey], limit: 1 };

        // Try fetching from helper workers first
        for (const helper of shuffledHelpers) {
            const events = await fetchEventsFromHelper(helper, null, filters);
            if (events && events.length > 0) {
                return events[0];
            }
        }

        // If no event found from helpers, use fallback relay
        console.log(`No kind 0 event found from helpers, trying fallback relay: wss://relay.nostr.band`);
        const fallbackEvent = await fetchEventFromFallbackRelay(pubkey);
        if (fallbackEvent) {
            return fallbackEvent;
        }
    } catch (error) {
        console.error(`Error fetching kind 0 event for pubkey ${pubkey}: ${error.message}`);
    }

    return null;
}

// Checks if NIP-05 is valid
async function validateNIP05(nip05Address, pubkey) {
    try {
        // Extract the domain and username
        const [name, domain] = nip05Address.split('@');

        if (!domain) {
            throw new Error(`Invalid NIP-05 address format: ${nip05Address}`);
        }

        // Check if the domain is in the blocked list
        if (blockedNip05Domains.has(domain)) {
            console.error(`NIP-05 domain is blocked: ${domain}`);
            return false;
        }

        // If allowed domains are defined, check if the domain is in the allowed list
        if (allowedNip05Domains.size > 0 && !allowedNip05Domains.has(domain)) {
            console.error(`NIP-05 domain is not allowed: ${domain}`);
            return false;
        }

        // Fetch the NIP-05 .well-known/nostr.json file
        const url = `https://${domain}/.well-known/nostr.json?name=${name}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Failed to fetch NIP-05 data from ${url}: ${response.statusText}`);
            return false;
        }

        const nip05Data = await response.json();

        if (!nip05Data.names || !nip05Data.names[name]) {
            console.error(`NIP-05 data does not contain a matching public key for ${name}`);
            return false;
        }

        // Compare the pubkey from NIP-05 with the event's pubkey
        const nip05Pubkey = nip05Data.names[name];
        return nip05Pubkey === pubkey;

    } catch (error) {
        console.error(`Error validating NIP-05 address: ${error.message}`);
        return false;
    }
}

// Fetches kind 0 event from other relay
async function fetchEventFromFallbackRelay(pubkey) {
    return new Promise((resolve, reject) => {
        const fallbackRelayUrl = 'wss://relay.nostr.band';
        const ws = new WebSocket(fallbackRelayUrl);
        let hasClosed = false;

        const closeWebSocket = (subscriptionId) => {
            if (!hasClosed && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(["CLOSE", subscriptionId]));
                ws.close();
                hasClosed = true;
                console.log('WebSocket connection to fallback relay closed');
            }
        };

        ws.onopen = () => {
            console.log("WebSocket connection to fallback relay opened.");
            const subscriptionId = Math.random().toString(36).substr(2, 9);
            const filters = {
                kinds: [0],
                authors: [pubkey], // Only for the specified pubkey
                limit: 1 // We only need one event (the latest kind 0 event)
            };
            const reqMessage = JSON.stringify(["REQ", subscriptionId, filters]);
            ws.send(reqMessage);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                // Handle EVENT message
                if (message[0] === "EVENT" && message[1]) {
                    const eventData = message[2];
                    if (eventData.kind === 0 && eventData.pubkey === pubkey) {
                        console.log("Received kind 0 event from fallback relay.");
                        closeWebSocket(message[1]);
                        resolve(eventData);
                    }
                }

                // Handle EOSE message
                else if (message[0] === "EOSE") {
                    console.log("EOSE received from fallback relay, no kind 0 event found.");
                    closeWebSocket(message[1]); // Close WebSocket after receiving EOSE
                    resolve(null); // Resolve with null if no event is found
                }
            } catch (error) {
                console.error(`Error processing fallback relay event for pubkey ${pubkey}: ${error.message}`);
                reject(error);
            }
        };

        ws.onerror = (error) => {
            console.error(`WebSocket error with fallback relay: ${error.message}`);
            ws.close();
            hasClosed = true;
            reject(error);
        };

        ws.onclose = () => {
            hasClosed = true;
            console.log('Fallback relay WebSocket connection closed.');
        };

        // Timeout if no response is received within 10 seconds
        setTimeout(() => {
            if (!hasClosed) {
                console.log('Timeout reached. Closing WebSocket connection to fallback relay.');
                closeWebSocket(null);
                reject(new Error(`No response from fallback relay for pubkey ${pubkey}`));
            }
        }, 10000);
    });
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

        const response = await withConnectionLimit(() => fetch(helper, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`,
            },
            body: JSON.stringify({ type: "REQ", subscriptionId, filters }),
        }));

        if (response.ok) {
            const contentType = response.headers.get("Content-Type");
            let events;

            if (contentType && contentType.includes("application/json")) {
                events = await response.json();
            } else {
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
            console.log(`Successfully retrieved events from helper worker`, { ...logContext, eventCount: events.length });
            return events;
        } else {
            console.error(`Error fetching events from helper worker`, { ...logContext, status: response.status, statusText: response.statusText });
            throw new Error(`Failed to fetch events: ${response.status} - ${response.statusText}`);
        }
    } catch (error) {
        console.error(`Error in fetchEventsFromHelper`, { ...logContext, error: error.message });
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

        const response = await withConnectionLimit(() => fetch(randomHelper, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`,
            },
            body: JSON.stringify({ type: "EVENT", event }),
        }));

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
    // Single kind or single author do not split
    if (
        (arrayFilters.kinds && arrayFilters.kinds.length <= 1) &&
        (!arrayFilters.authors || arrayFilters.authors.length <= 1)
    ) {
        return [filters];
    }

    // Otherwise, split the filters across chunks
    const filterChunks = Array(numChunks).fill().map(() => ({ ...baseFilters }));
    const arrayKeys = Object.keys(arrayFilters);

    if (arrayKeys.length === 1) {
        const key = arrayKeys[0];
        const arrayValues = arrayFilters[key];
        const arrayChunks = splitArray(arrayValues, numChunks);
        for (let i = 0; i < numChunks; i++) {
            filterChunks[i][key] = arrayChunks[i];
        }
    } else {
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

    return true;
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

// Validate event IDs
function validateIds(ids) {
    for (const id of ids) {
        if (!/^[a-f0-9]{64}$/.test(id)) {
            throw new Error(`Invalid event ID format: ${id}`);
        }
    }
}

// Validate author pubkeys
function validateAuthors(authors) {
    for (const author of authors) {
        if (!/^[a-f0-9]{64}$/.test(author)) {
            throw new Error(`Invalid author pubkey format: ${author}`);
        }
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
function sendEventsToClient(server, subscriptionId, events) {
    for (const event of events) {
        server.send(JSON.stringify(["EVENT", subscriptionId, event]));
    }
}
function sendOK(server, eventId, status, message) {
    server.send(JSON.stringify(["OK", eventId, status, message]));
}
function sendError(server, message) {
    server.send(JSON.stringify(["NOTICE", message]));
}
function sendEOSE(server, subscriptionId) {
    server.send(JSON.stringify(["EOSE", subscriptionId]));
}