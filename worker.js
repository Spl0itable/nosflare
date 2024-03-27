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
    description:
      "A serverless Nostr relay through Cloudflare Worker and KV store",
    pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
    contact: "lucas@censorship.rip",
    supported_nips: [1, 2, 4, 9, 11, 12, 15, 16, 20, 22, 33, 40],
    software: "https://github.com/Spl0itable/nosflare",
    version: "1.4.6",
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
};
// Handle event request (NIP-01, etc)
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
                // Check for duplicate event ID
                const existingEvent = await relayDb.get(`event:${event.id}`, "json");
                if (existingEvent) {
                  server.send(JSON.stringify(["OK", event.id, false, "Duplicate. Event dropped."]));
                  break;
                }
                const isValidSignature = await verifyEventSignature(event);
                if (isValidSignature) {
                  // Directly store the event in the KV store
                  await relayDb.put(`event:${event.id}`, JSON.stringify(event));
                  await relayDb.put(`kind:${event.kind}:${event.id}`, `event:${event.id}`);
                  await relayDb.put(`pubkey:${event.pubkey}:${event.id}`, `event:${event.id}`);
                  for (const tag of event.tags) {
                    await relayDb.put(`tag:${tag[0]}:${tag[1]}:${event.id}`, `event:${event.id}`);
                  }
                  server.send(JSON.stringify(["OK", event.id, true, ""]));
                } else {
                  server.send(JSON.stringify(["OK", event.id, false, "invalid: signature verification failed"]));
                }
              } catch (error) {
                console.error("Error in EVENT processing:", error);
                server.send(JSON.stringify(["OK", event.id, false, `error: EVENT processing failed - ${error.message}`]));
              }
              break;
            }
            case "REQ": {
              const subscriptionId = message[1];
              const filters = message.slice(2).reduce((acc, filter) => {
                return { ...acc, ...filter };
              }, {});
            
              try {
                if (filters.ids && filters.ids.length > 0) {
                  // Check the cache for the requested event IDs
                  const cachedEvents = filters.ids.map((id) => relayCache.get(`event:${id}`));
                  const nonCachedIds = filters.ids.filter((id, index) => !cachedEvents[index]);
            
                  // Fetch non-cached events from the KV store
                  const nonCachedEvents = await Promise.all(
                    nonCachedIds.map((id) => relayDb.get(`event:${id}`, "json"))
                  );
            
                  // Update the cache with the fetched events
                  nonCachedEvents.forEach((event, index) => {
                    if (event) relayCache.set(`event:${nonCachedIds[index]}`, event);
                  });
            
                  // Combine cached and non-cached events
                  const events = filters.ids.map((id, index) => cachedEvents[index] || nonCachedEvents[filters.ids.indexOf(id)]);
            
                  // Send each event if it exists
                  events.forEach((event) => {
                    if (event) server.send(JSON.stringify(["EVENT", subscriptionId, event]));
                  });
                } else {
                  // Apply other filters if 'ids' filter is not provided
                  let eventIDs = new Set();
                  let prefix = 'kind:1:';
                  if (filters.kinds && filters.kinds.length === 1) {
                    prefix = `kind:${filters.kinds[0]}:`;
                  }
                  let cursor = null;
                  do {
                    const listResponse = await relayDb.list({
                      prefix: prefix,
                      cursor: cursor,
                      limit: 100
                    });
                    listResponse.keys.forEach((key) => {
                      const eventID = key.name.split(":").pop();
                      eventIDs.add(eventID);
                    });
                    cursor = listResponse.cursor;
                  } while (cursor && eventIDs.size < 100);
            
                  // Check the cache for the retrieved event IDs
                  const cachedEvents = Array.from(eventIDs).map((id) => relayCache.get(`event:${id}`));
                  const nonCachedIds = Array.from(eventIDs).filter((id, index) => !cachedEvents[index]);
            
                  // Fetch non-cached events from the KV store
                  const nonCachedEvents = await Promise.all(
                    nonCachedIds.map((id) => relayDb.get(`event:${id}`, "json"))
                  );
            
                  // Update the cache with the fetched events
                  nonCachedEvents.forEach((event, index) => {
                    if (event) relayCache.set(`event:${nonCachedIds[index]}`, event);
                  });
            
                  // Combine cached and non-cached events
                  const events = Array.from(eventIDs).map((id, index) => cachedEvents[index] || nonCachedEvents[nonCachedIds.indexOf(id)]);
            
                  // Filter events based on additional filters
                  const filteredEvents = events.filter((event) => {
                    if (!event) return false;
                    if (filters.authors && !filters.authors.includes(event.pubkey)) return false;
                    if (filters.since && event.created_at < filters.since) return false;
                    if (filters.until && event.created_at > filters.until) return false;
                    return true;
                  });
            
                  // Sort filtered events by created_at in descending order
                  filteredEvents.sort((a, b) => b.created_at - a.created_at);
            
                  // Send filtered and sorted events
                  filteredEvents.forEach((event) => {
                    server.send(JSON.stringify(["EVENT", subscriptionId, event]));
                  });
                }
            
                // Signal end of event stream
                server.send(JSON.stringify(["EOSE", subscriptionId]));
              } catch (dbError) {
                console.error("Database error:", dbError);
                server.send(JSON.stringify(["NOTICE", subscriptionId, "Database error"]));
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
// Handle follow lists event (NIP-02)
async function processFollowListEvent(event, server) {
  await deletePreviousFollowLists(event.pubkey);
  await relayDb.put(`event:${event.id}`, JSON.stringify(event));
  server.send(JSON.stringify(["OK", event.id, true, "Follow list updated."]));
}

async function deletePreviousFollowLists(pubkey) {
  const keys = await relayDb.list({ prefix: `event:${pubkey}:` });
  await Promise.all(
    keys.keys.map(async (key) => {
      const eventValue = await relayDb.get(key.name, "json");
      if (eventValue && eventValue.kind === 3) {
        await relayDb.delete(key.name);
      }
    })
  );
}
// Delete event
async function processDeletionEvent(deletionEvent, server) {
  try {
    if (Array.isArray(deletionEvent.tags)) {
      let deleteCount = 0;
      for (const tag of deletionEvent.tags) {
        if (tag[0] === "e") {
          const eventIdToDelete = tag[1];
          const eventToDelete = await relayDb.get(
            `event:${eventIdToDelete}`,
            "json"
          );
          if (eventToDelete && eventToDelete.pubkey === deletionEvent.pubkey) {
            await relayDb.delete(`event:${eventIdToDelete}`);
            deleteCount++;
            server.send(
              JSON.stringify([
                "NOTICE",
                `Event ${eventIdToDelete} deleted by author request.`,
              ])
            );
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
          "No tags present for deletion.",
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