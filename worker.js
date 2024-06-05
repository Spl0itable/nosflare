import { schnorr } from "@noble/curves/secp256k1";

// Relay info (NIP-11)
const relayInfo = {
  name: "Nosflare",
  description: "A serverless Nostr relay through Cloudflare Worker and R2 bucket",
  pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
  contact: "lucas@censorship.rip",
  supported_nips: [1, 2, 4, 5, 9, 11, 12, 15, 16, 17, 20, 22, 33, 40, 45],
  software: "https://github.com/Spl0itable/nosflare",
  version: "3.18.14",
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
  "wss://nostr.mutinywallet.com"
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
const messageRateLimiter = new rateLimiter(100 / 60000, 100); // 100 messages per min
const pubkeyRateLimiter = new rateLimiter(10 / 60000, 10); // 10 events per min
const reqRateLimiter = new rateLimiter(100 / 60000, 100); // 100 reqs per min
const duplicateCheckRateLimiter = new rateLimiter(100 / 60000, 100); // 100 duplicate checks per min
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
      saveEventToR2(event).catch((error) => {
        console.error("Error saving event to R2:", error);
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
async function processReq(message, server) {
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
        for (const id of filters.ids.slice(0, 25)) {
          const idKey = `event:${id}`;
          const eventUrl = `${customDomain}/${idKey}`;
          eventPromises.push(
            fetch(eventUrl).then((response) => {
              if (response.ok) {
                return response.text().then((data) => {
                  try {
                    return JSON.parse(data);
                  } catch (error) {
                    console.error(`Malformed JSON for event with ID ${id}:`, error);
                    return null;
                  }
                });
              } else if (response.status === 404) {
                return null;
              } else {
                throw new Error(`Error fetching event with ID ${id} from URL: ${eventUrl}. Status: ${response.status}`);
              }
            }).catch((error) => {
              console.error(`Error fetching event with ID ${id} from URL: ${eventUrl}.`, error);
              return null;
            })
          );
        }
      }
      if (filters.kinds) {
        for (const kind of filters.kinds) {
          const kindCountKey = `kind_count_${kind}`;
          const kindCountResponse = await relayDb.get(kindCountKey);
          const kindCountValue = kindCountResponse ? await kindCountResponse.text() : '0';
          const kindCount = parseInt(kindCountValue, 10);
          for (let i = kindCount; i >= Math.max(1, kindCount - 25 + 1); i--) {
            const kindKey = `kind-${kind}:${i}`;
            const eventUrl = `${customDomain}/${kindKey}`;
            eventPromises.push(
              fetch(eventUrl).then((response) => {
                if (response.ok) {
                  return response.text().then((data) => {
                    try {
                      return JSON.parse(data);
                    } catch (error) {
                      console.error(`Malformed JSON for event with kind ${kind}:`, error);
                      return null;
                    }
                  });
                } else if (response.status === 404) {
                  return null;
                } else {
                  throw new Error(`Error fetching event for kind ${kind} from URL: ${eventUrl}. Status: ${response.status}`);
                }
              }).catch((error) => {
                console.error(`Error fetching event for kind ${kind} from URL: ${eventUrl}.`, error);
                return null;
              })
            );
          }
        }
      }
      if (filters.authors) {
        for (const author of filters.authors) {
          const pubkeyCountKey = `pubkey_count_${author}`;
          const pubkeyCountResponse = await relayDb.get(pubkeyCountKey);
          const pubkeyCountValue = pubkeyCountResponse ? await pubkeyCountResponse.text() : '0';
          const pubkeyCount = parseInt(pubkeyCountValue, 10);
          for (let i = pubkeyCount; i >= Math.max(1, pubkeyCount - 25 + 1); i--) {
            const pubkeyKey = `pubkey-${author}:${i}`;
            const eventUrl = `${customDomain}/${pubkeyKey}`;
            eventPromises.push(
              fetch(eventUrl).then((response) => {
                if (response.ok) {
                  return response.text().then((data) => {
                    try {
                      return JSON.parse(data);
                    } catch (error) {
                      console.error(`Malformed JSON for event with author ${author}:`, error);
                      return null;
                    }
                  });
                } else if (response.status === 404) {
                  return null;
                } else {
                  throw new Error(`Error fetching event for author ${author} from URL: ${eventUrl}. Status: ${response.status}`);
                }
              }).catch((error) => {
                console.error(`Error fetching event for author ${author} from URL: ${eventUrl}.`, error);
                return null;
              })
            );
          }
        }
      }
      if (filters.tags) {
        for (const [tagName, tagValues] of Object.entries(filters.tags)) {
          for (const tagValue of tagValues) {
            const tagCountKey = `${tagName}_count_${tagValue}`;
            const tagCountResponse = await relayDb.get(tagCountKey);
            const tagCountValue = tagCountResponse ? await tagCountResponse.text() : '0';
            const tagCount = parseInt(tagCountValue, 10);
            for (let i = tagCount; i >= Math.max(1, tagCount - 25 + 1); i--) {
              const tagKey = `${tagName}-${tagValue}:${i}`;
              const eventUrl = `${customDomain}/${tagKey}`;
              eventPromises.push(
                fetch(eventUrl).then((response) => {
                  if (response.ok) {
                    return response.text().then((data) => {
                      try {
                        return JSON.parse(data);
                      } catch (error) {
                        console.error(`Malformed JSON for event with tag ${tagName}:${tagValue}:`, error);
                        return null;
                      }
                    });
                  } else if (response.status === 404) {
                    return null;
                  } else {
                    throw new Error(`Error fetching event for tag ${tagName}:${tagValue} from URL: ${eventUrl}. Status: ${response.status}`);
                  }
                }).catch((error) => {
                  console.error(`Error fetching event for tag ${tagName}:${tagValue} from URL: ${eventUrl}.`, error);
                  return null;
                })
              );
            }
          }
        }
      }
      const fetchedEvents = await Promise.all(eventPromises);
      events = fetchedEvents.filter((event) => event !== null);
      events = events.filter((event) => {
        const includeEvent = (!filters.ids || filters.ids.includes(event.id)) &&
          (!filters.kinds || filters.kinds.includes(event.kind)) &&
          (!filters.authors || filters.authors.includes(event.pubkey)) &&
          (!filters.tags || Object.entries(filters.tags).every(([tagName, tagValues]) =>
            event.tags.some((tag) => tag[0] === tagName && tagValues.includes(tag[1]))
          )) &&
          (!filters.since || event.created_at >= filters.since) &&
          (!filters.until || event.created_at <= filters.until);
        return includeEvent;
      });
      relayCache.set(cacheKey, events);
    } catch (error) {
      console.error(`Error retrieving events from R2:`, error);
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
  try {
    const eventPromises = [];
    if (filters.kinds) {
      for (const kind of filters.kinds) {
        const kindCountKey = `kind_count_${kind}`;
        const kindCountResponse = await relayDb.get(kindCountKey);
        const kindCountValue = kindCountResponse ? await kindCountResponse.text() : '0';
        count += parseInt(kindCountValue, 10);
      }
    }
    if (filters.authors) {
      for (const author of filters.authors) {
        const pubkeyCountKey = `pubkey_count_${author}`;
        const pubkeyCountResponse = await relayDb.get(pubkeyCountKey);
        const pubkeyCountValue = pubkeyCountResponse ? await pubkeyCountResponse.text() : '0';
        count += parseInt(pubkeyCountValue, 10);
      }
    }
    if (filters.tags) {
      for (const [tagName, tagValues] of Object.entries(filters.tags)) {
        for (const tagValue of tagValues) {
          const tagCountKey = `${tagName}_count_${tagValue}`;
          const tagCountResponse = await relayDb.get(tagCountKey);
          const tagCountValue = tagCountResponse ? await tagCountResponse.text() : '0';
          count += parseInt(tagCountValue, 10);
        }
      }
    }
    server.send(JSON.stringify(["COUNT", subscriptionId, { count }]));
  } catch (error) {
    console.error(`Error processing count request:`, error);
    sendError(server, "Failed to process count request");
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

// Handles saving event to R2 storage
async function saveEventToR2(event) {
  const eventKey = `event:${event.id}`;
  // Rate limit duplicate event checks
  if (!duplicateCheckRateLimiter.removeToken(event.pubkey)) {
    console.log(`Duplicate check rate limit exceeded for pubkey: ${event.pubkey}`);
    return;
  }
  try {
    const eventUrl = `${customDomain}/${eventKey}`;
    const response = await fetch(eventUrl);
    if (response.ok) {
      console.log(`Duplicate event: ${event.id}. Event dropped.`);
      return;
    } else if (response.status !== 404) {
      console.error(`Error checking duplicate event in R2: ${response.status}`);
      return;
    }
  } catch (error) {
    console.error(`Error checking duplicate event in R2: ${error.message}`);
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
    const kindCountKey = `kind_count_${event.kind}`;
    const kindCountResponse = await relayDb.get(kindCountKey);
    const kindCountValue = kindCountResponse ? await kindCountResponse.text() : '0';
    let kindCount = parseInt(kindCountValue, 10);
    if (isNaN(kindCount)) {
      kindCount = 0;
    }
    const kindKey = `kind-${event.kind}:${kindCount + 1}`;
    const pubkeyCountKey = `pubkey_count_${event.pubkey}`;
    const pubkeyCountResponse = await relayDb.get(pubkeyCountKey);
    const pubkeyCountValue = pubkeyCountResponse ? await pubkeyCountResponse.text() : '0';
    let pubkeyCount = parseInt(pubkeyCountValue, 10);
    if (isNaN(pubkeyCount)) {
      pubkeyCount = 0;
    }
    const pubkeyKey = `pubkey-${event.pubkey}:${pubkeyCount + 1}`;
    const eventWithCountRef = { ...event, kindKey, pubkeyKey };
    const tagPromises = event.tags.map(async (tag) => {
      const tagName = tag[0];
      const tagValue = tag[1];
      switch (tagName) {
        case 'a':
        case 'd':
        case 'e':
        case 'g':
        case 'i':
        case 'k':
        case 'l':
        case 'L':
        case 'm':
        case 'p':
        case 'q':
        case 'r':
        case 't':
        case 'alt':
        case 'amount':
        case 'bolt11':
        case 'challenge':
        case 'client':
        case 'clone':
        case 'content-warning':
        case 'delegation':
        case 'description':
        case 'emoji':
        case 'encrypted':
        case 'expiration':
        case 'goal':
        case 'image':
        case 'imeta':
        case 'lnurl':
        case 'location':
        case 'name':
        case 'nonce':
        case 'preimage':
        case 'price':
        case 'proxy':
        case 'published_at':
        case 'relay':
        case 'relays':
        case 'server':
        case 'subject':
        case 'summary':
        case 'thumb':
        case 'title':
        case 'web':
        case 'zap':
          // Handle tags
          const tagCountKey = `${tagName}_count_${tagValue}`;
          const tagCountResponse = await relayDb.get(tagCountKey);
          const tagCountValue = tagCountResponse ? await tagCountResponse.text() : '0';
          let tagCount = parseInt(tagCountValue, 10);
          if (isNaN(tagCount)) {
            tagCount = 0;
          }
          const tagKey = `${tagName}-${tagValue}:${tagCount + 1}`;
          await relayDb.put(tagKey, JSON.stringify(event));
          await relayDb.put(tagCountKey, (tagCount + 1).toString());
          break;
        default:
          // Ignore unknown tags
          break;
      }
    });
    await Promise.all([
      relayDb.put(kindKey, JSON.stringify(event)),
      relayDb.put(pubkeyKey, JSON.stringify(event)),
      relayDb.put(eventKey, JSON.stringify(eventWithCountRef)),
      relayDb.put(kindCountKey, (kindCount + 1).toString()),
      relayDb.put(pubkeyCountKey, (pubkeyCount + 1).toString()),
      ...tagPromises,
    ]);
    await blastEventToRelays(event);
  } catch (error) {
    console.error(`Error saving event to R2: ${error.message}`);
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

// Handles event deletes (NIP-09)
async function processDeletionEvent(deletionEvent, server) {
  try {
    if (deletionEvent.kind === 5 && deletionEvent.pubkey) {
      sendOK(server, deletionEvent.id, true, "Deletion request received successfully.");
      const deletedEventIds = deletionEvent.tags
        .filter((tag) => tag[0] === "e")
        .map((tag) => tag[1]);

      for (const eventId of deletedEventIds) {
        const idKey = `event:${eventId}`;
        const eventUrl = `${customDomain}/${encodeURIComponent(idKey)}`;
        try {
          const response = await fetch(eventUrl);
          if (response.ok) {
            const event = await response.text();
            const eventData = JSON.parse(event);
            if (eventData && eventData.pubkey === deletionEvent.pubkey) {
              const relatedDataKeys = [
                eventData.kindKey,
                eventData.pubkeyKey,
                ...eventData.tags
                  .filter((tag) => tag[0] === 'e' || tag[0] === 'p')
                  .map((tag) => `${tag[0]}-${tag[1]}:${eventData.created_at}`),
              ];
              const deletePromises = [
                relayDb.delete(idKey),
                ...relatedDataKeys.map((key) => relayDb.delete(key)),
              ];
              await Promise.all(deletePromises);
              const cacheKey = `event:${eventId}`;
              relayCache.delete(cacheKey);
              const relatedDataUrls = [
                eventUrl,
                ...relatedDataKeys.map((key) => `${customDomain}/${encodeURIComponent(key)}`),
              ];
              const purgePromises = relatedDataUrls.map((url) => purgeCloudflareCache(url));
              await Promise.all(purgePromises);
            }
          }
        } catch (error) {
          console.error(`Error retrieving event ${eventId} from R2:`, error);
        }
      }
    } else {
      sendOK(server, deletionEvent.id, false, "Invalid deletion event.");
    }
  } catch (error) {
    console.error("Error processing deletion event:", error);
    sendOK(server, deletionEvent.id, false, `Error processing deletion event: ${error.message}`);
  }
}

// Handles purging event from cache
async function purgeCloudflareCache(url) {
  const headers = new Headers();
  headers.append('Authorization', `Bearer ${apiToken}`);
  headers.append('Content-Type', 'application/json');
  const requestOptions = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ files: [url] }),
  };
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    requestOptions
  );
  if (!response.ok) {
    throw new Error(`Failed to purge Cloudflare cache: ${response.status}`);
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