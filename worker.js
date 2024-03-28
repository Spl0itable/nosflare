import { schnorr } from "@noble/curves/secp256k1";

addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.pathname === "/favicon.ico") {
    event.respondWith(serveFavicon());
  } else if (request.headers.get("Upgrade") === "websocket") {
    event.respondWith(handleWebSocket(request));
  } else if (request.headers.get("Accept") === "application/nostr+json") {
    event.respondWith(handleRelayInfoRequest(request));
  } else {
    event.respondWith(
      new Response("Connect using a Nostr client", { status: 400 })
    );
  }
});

async function handleRelayInfoRequest(request) {
  const headers = new Headers({
    "Content-Type": "application/nostr+json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET",
  });
  // Relay information (NIP-11)
  const relayInfo = {
    name: "Nosflare",
    description: "A serverless Nostr relay through Cloudflare Worker and KV store",
    pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
    contact: "lucas@censorship.rip",
    supported_nips: [1, 9, 11],
    software: "https://github.com/Spl0itable/nosflare",
    version: "1.5.6",
  };
  return new Response(JSON.stringify(relayInfo), {
    status: 200,
    headers: headers,
  });
}

// Relay favicon
const relayIcon = "https://workers.cloudflare.com/resources/logo/logo.svg";
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
    return this._cache[key];
  },
  set(key, value) {
    this._cache[key] = value;
  },
  delete(key) {
    delete this._cache[key];
  },
};

// Check if the cached events have expired
function isExpired(timestamp) {
  const expirationTime = 60 * 60 * 1000; // 1 hour in milliseconds
  return Date.now() - timestamp > expirationTime;
}

// Handle event request (NIP-01)
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
            case "EVENT": {
              const event = message[1];
              try {
                if (event.kind === 1) {
                  if (event.kind !== 1) {
                    server.send(
                      JSON.stringify([
                        "OK",
                        event.id,
                        false,
                        "Only kind 1 and 5 events are supported",
                      ])
                    );
                    break;
                  }
                  // Check for duplicate event ID
                  const existingEvent = await relayDb.get(
                    `event:${event.id}:*`,
                    "json"
                  );
                  if (existingEvent) {
                    server.send(
                      JSON.stringify([
                        "OK",
                        event.id,
                        false,
                        "Duplicate. Event dropped.",
                      ])
                    );
                    break;
                  }
                  const isValidSignature = await verifyEventSignature(event);
                  if (isValidSignature) {
                    // Save the event in KV store
                    const eventKey = `event:${event.id}:${event.created_at}`;
                    await relayDb.put(eventKey, JSON.stringify(event));
                    server.send(JSON.stringify(["OK", event.id, true, ""]));
                  } else {
                    server.send(
                      JSON.stringify([
                        "OK",
                        event.id,
                        false,
                        "invalid: signature verification failed",
                      ])
                    );
                  }
                } else if (event.kind === 5) {
                  await processDeletionEvent(event, server);
                } else {
                  server.send(
                    JSON.stringify([
                      "OK",
                      event.id,
                      false,
                      "Only kind 1 and 5 events are supported",
                    ])
                  );
                }
              } catch (error) {
                console.error("Error in EVENT processing:", error);
                server.send(
                  JSON.stringify([
                    "OK",
                    event.id,
                    false,
                    `error: EVENT processing failed - ${error.message}`,
                  ])
                );
              }
              break;
            }
            case "REQ": {
              const subscriptionId = message[1];
              const filters = message.slice(2).reduce((acc, filter) => {
                return { ...acc, ...filter };
              }, {});

              try {
                // Check if the events are already cached
                const cacheKey = JSON.stringify(filters);
                const cachedEvents = relayCache.get(cacheKey);
                if (cachedEvents && !isExpired(cachedEvents.timestamp)) {
                  // Send cached events to the client
                  cachedEvents.events.forEach((event) => {
                    server.send(
                      JSON.stringify(["EVENT", subscriptionId, event])
                    );
                  });
                  server.send(
                    JSON.stringify([
                      "NOTICE",
                      subscriptionId,
                      "Event(s) served from cache",
                    ])
                  );
                } else {
                  let events = [];

                  if (filters.ids && filters.ids.length > 0) {
                    // Retrieve specific events by ID
                    const eventPromises = filters.ids.map(async (id) => {
                      const eventKeys = await relayDb.list({
                        prefix: `event:${id}:`,
                      });
                      if (eventKeys.keys.length > 0) {
                        const eventKey = eventKeys.keys[0].name;
                        return relayDb.get(eventKey, "json");
                      }
                      return null;
                    });
                    events = await Promise.all(eventPromises);
                    events = events.filter((event) => event !== null);
                  } else {
                    // Retrieve all events in chronological order
                    let cursor = null;
                    do {
                      const listResponse = await relayDb.list({
                        prefix: "event:",
                        cursor: cursor,
                        limit: 50,
                      });
                      const eventPromises = listResponse.keys.map((key) =>
                        relayDb.get(key.name, "json")
                      );
                      const fetchedEvents = await Promise.all(eventPromises);
                      events = events.concat(
                        fetchedEvents.filter((event) => event !== null)
                      );
                      cursor = listResponse.cursor;
                    } while (cursor);
                  }

                  if (events.length > 0) {
                    // Cache the fetched events with timestamp
                    relayCache.set(cacheKey, { events, timestamp: Date.now() });

                    // Send events to the client
                    events.forEach((event) => {
                      server.send(
                        JSON.stringify(["EVENT", subscriptionId, event])
                      );
                    });
                    server.send(
                      JSON.stringify([
                        "NOTICE",
                        subscriptionId,
                        "Event(s) retrieved from KV store",
                      ])
                    );
                  } else {
                    server.send(
                      JSON.stringify([
                        "NOTICE",
                        subscriptionId,
                        "No event(s) found",
                      ])
                    );
                  }
                }
                server.send(JSON.stringify(["EOSE", subscriptionId]));
              } catch (dbError) {
                console.error("Database error:", dbError);
                server.send(
                  JSON.stringify(["NOTICE", subscriptionId, "Database error"])
                );
              }
              break;
            }
            case "CLOSE": {
              const closeSubscriptionId = message[1];
              try {
                await relayDb.delete(`sub:${closeSubscriptionId}`);
                server.send(
                  JSON.stringify([
                    "CLOSED",
                    closeSubscriptionId,
                    "Subscription closed",
                  ])
                );
              } catch (error) {
                console.error("Error closing subscription:", error);
                server.send(
                  JSON.stringify([
                    "CLOSED",
                    closeSubscriptionId,
                    `error: failed to close subscription ${closeSubscriptionId}`,
                  ])
                );
              }
              break;
            }
            // Add more cases
          }
        } catch (e) {
          server.send(
            JSON.stringify(["NOTICE", "Failed to process the message"])
          );
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

// Delete event (NIP-05)
async function processDeletionEvent(deletionEvent, server) {
  try {
    if (deletionEvent.kind === 5 && deletionEvent.pubkey) {
      const deletedEventIds = deletionEvent.tags
        .filter((tag) => tag[0] === "e")
        .map((tag) => tag[1]);

      let deleteCount = 0;
      for (const eventId of deletedEventIds) {
        const eventKeys = await relayDb.list({
          prefix: `event:${eventId}:`,
        });
        for (const key of eventKeys.keys) {
          const event = await relayDb.get(key.name, "json");
          if (event && event.pubkey === deletionEvent.pubkey) {
            await relayDb.delete(key.name);
            deleteCount++;
            server.send(
              JSON.stringify([
                "NOTICE",
                `Event ${event.id} deleted by author request.`,
              ])
            );
            // Invalidate cache for the deleted event
            relayCache.delete(event.id);
          }
        }
      }
      server.send(
        JSON.stringify([
          "OK",
          deletionEvent.id,
          true,
          `Processed deletion request. Events deleted: ${deleteCount}`,
        ])
      );
    } else {
      server.send(
        JSON.stringify([
          "OK",
          deletionEvent.id,
          false,
          "Invalid deletion event.",
        ])
      );
    }
  } catch (error) {
    console.error("Error processing deletion event:", error);
    server.send(
      JSON.stringify([
        "OK",
        deletionEvent.id,
        false,
        `Error processing deletion event: ${error.message}`,
      ])
    );
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
    const signatureIsValid = schnorr.verify(
      signatureBytes,
      messageHash,
      publicKeyBytes
    );
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
