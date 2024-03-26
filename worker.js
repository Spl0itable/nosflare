import { schnorr } from '@noble/curves/secp256k1';

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
    event.respondWith(new Response("Connect using a Nostr client", { status: 400 }));
  }
});
async function handleRelayInfoRequest(request) {
  const headers = new Headers({
    "Content-Type": "application/nostr+json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET"
  });
  // Relay information (NIP-11)
  const relayInfo = {
    name: "Nosflare",
    description: "A serverless Nostr relay through Cloudflare Worker and KV store",
    pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
    contact: "lucas@censorship.rip",
    supported_nips: [1, 2, 4, 9, 11, 12, 15, 16, 20, 22, 33, 40],
    software: "https://github.com/Spl0itable/nosflare",
    version: "1.4.4"
  };
  return new Response(JSON.stringify(relayInfo), { status: 200, headers: headers });
}
// Relay favicon
const relayIcon = "https://workers.cloudflare.com/resources/logo/logo.svg";
async function serveFavicon() {
  const response = await fetch(relayIcon);
  if (response.ok) {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'max-age=3600');
    return new Response(response.body, {
      status: response.status,
      headers: headers
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
async function handleWebSocket(request) {
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  server.addEventListener("message", async (messageEvent) => {
    try {
      const message = JSON.parse(messageEvent.data);
      const messageType = message[0];
      switch (messageType) {
        case "EVENT": {
          const event = message[1];
          try {
            // Check for duplicate event ID
            const existingEvent = await relayDb.get(`event:${event.id}`, 'json');
            if (existingEvent) {
              server.send(JSON.stringify(["OK", event.id, false, "Duplicate. Event dropped."]));
              break;
            }
            const isValidSignature = await verifyEventSignature(event);
            if (isValidSignature) {
              await relayDb.put(`event:${event.id}`, JSON.stringify(event));
              const mainEventKey = `event:${event.id}`;
              await relayDb.put(`kind:${event.kind}:${event.id}`, mainEventKey);
              await relayDb.put(`pubkey:${event.pubkey}:${event.id}`, mainEventKey);
              for (const tag of event.tags) {
                const tagKey = tag[0];
                const tagValue = tag[1];
                await relayDb.put(`tag:${tagKey}:${tagValue}:${event.id}`, mainEventKey);
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
            let eventIDs = new Set();
            // If no filter is provided, return only kind 1 events
            if (Object.keys(filters).length === 0) {
              filters.kinds = [1];
            }
            // If 'ids' filter is provided, add the specified IDs to eventIDs
            if (filters.ids) {
              for (const id of filters.ids) {
                eventIDs.add(id);
              }
            }
            // If 'kinds' filter is provided, fetch kind index keys
            if (filters.kinds) {
              for (const kind of filters.kinds) {
                const kindKeys = await relayDb.list({ prefix: `kind:${kind}:` });
                for (const key of kindKeys.keys) {
                  const eventID = key.name.split(':')[2];
                  eventIDs.add(eventID);
                }
              }
            }
            // If 'authors' filter is provided, fetch author index keys
            if (filters.authors) {
              for (const author of filters.authors) {
                const authorKeys = await relayDb.list({ prefix: `pubkey:${author}:` });
                for (const key of authorKeys.keys) {
                  const eventID = key.name.split(':')[2];
                  eventIDs.add(eventID);
                }
              }
            }
            // If tag filters are provided, fetch tag index keys
            for (const tagKey in filters) {
              if (tagKey.startsWith("#")) {
                const tag = tagKey.substring(1);
                for (const tagValue of filters[tagKey]) {
                  const tagKeys = await relayDb.list({ prefix: `tag:${tag}:${tagValue}:` });
                  for (const key of tagKeys.keys) {
                    const eventID = key.name.split(':')[3];
                    eventIDs.add(eventID);
                  }
                }
              }
            }
            // Apply pagination
            const page = filters.page || 1;
            const limit = filters.limit || 50;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            // Fetch the full events by IDs and apply additional filters
            let events = [];
            let fetchedCount = 0;
            for (const id of eventIDs) {
              if (fetchedCount >= endIndex) break;
              const event = await relayDb.get(`event:${id}`, 'json');
              if (event) {
                // Apply time-based filters
                if (filters.since && event.created_at < filters.since) continue;
                if (filters.until && event.created_at > filters.until) continue;
                if (fetchedCount >= startIndex) {
                  events.push(event);
                }
                fetchedCount++;
              }
            }
            // Respond with the paginated events
            for (const event of events) {
              server.send(JSON.stringify(["EVENT", subscriptionId, event]));
            }
            // Generate the next page token
            const nextPage = page + 1;
            const nextPageToken = `${subscriptionId}:${nextPage}`;
            // Send the next page token if there are more events
            if (fetchedCount > endIndex) {
              server.send(JSON.stringify(["NOTICE", subscriptionId, `Next page token: ${nextPageToken}`]));
            }
            server.send(JSON.stringify(["EOSE", subscriptionId]));
          } catch (dbError) {
            console.error('Database error:', dbError);
            server.send(JSON.stringify(["NOTICE", subscriptionId, 'Database error']));
          }
          break;
        }
        case "CLOSE": {
          const closeSubscriptionId = message[1];
          try {
            await relayDb.delete(`sub:${closeSubscriptionId}`);
            server.send(JSON.stringify(['CLOSED', closeSubscriptionId, 'Subscription closed']));
          } catch (error) {
            console.error('Error closing subscription:', error);
            server.send(JSON.stringify(['CLOSED', closeSubscriptionId, `error: failed to close subscription ${closeSubscriptionId}`]));
          }
          break;
        }
        // Add more cases
      }
    } catch (e) {
      server.send(JSON.stringify(["NOTICE", "Failed to process the message"]));
      console.error("Failed to process message:", e);
    }
  });
  server.addEventListener("close", (event) => {
    console.log("WebSocket closed", event.code, event.reason);
  });
  return new Response(null, {
    status: 101,
    webSocket: client
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
  for (const key of keys.keys) {
    const eventValue = await relayDb.get(key.name, 'json');
    if (eventValue && eventValue.kind === 3) {
      await relayDb.delete(key.name);
    }
  }
}
// Delete event
async function processDeletionEvent(deletionEvent, server) {
  try {
    if (Array.isArray(deletionEvent.tags)) {
      let deleteCount = 0;
      for (const tag of deletionEvent.tags) {
        if (tag[0] === 'e') {
          const eventIdToDelete = tag[1];
          const eventToDelete = await relayDb.get(`event:${eventIdToDelete}`, 'json');
          if (eventToDelete && eventToDelete.pubkey === deletionEvent.pubkey) {
            await relayDb.delete(`event:${eventIdToDelete}`);
            deleteCount++;
            server.send(JSON.stringify(["NOTICE", `Event ${eventIdToDelete} deleted by author request.`]));
          }
        }
      }
      server.send(JSON.stringify(["OK", deletionEvent.id, true, `Processed deletion request. Events deleted: ${deleteCount}`]));
    } else {
      server.send(JSON.stringify(["OK", deletionEvent.id, false, "No tags present for deletion."]));
    }
  } catch (error) {
    console.error("Error processing deletion event:", error);
    server.send(JSON.stringify(["OK", deletionEvent.id, false, `Error processing deletion event: ${error.message}`]));
  }
}
// Verify event sig 
async function verifyEventSignature(event) {
  try {
    const signatureBytes = hexToBytes(event.sig);
    const serializedEventData = serializeEventForSigning(event);
    const messageHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serializedEventData));
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