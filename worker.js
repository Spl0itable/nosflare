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
    version: "0.3.4"
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
              // Find the expiration tag if it exists (NIP-40)
              const expirationTag = event.tags.find(tag => tag[0] === 'expiration');
              let expirationTime = null;
              if (expirationTag) {
                expirationTime = parseInt(expirationTag[1], 10);
              }
              // Handle event deletion request (NIP-09)
              if (event.kind === 5) {
                await processDeletionEvent(event, server);
              } else if (event.kind === 3) {
                await processFollowListEvent(event, server);
              } else {
                // Store regular event or event with expiration time
                const eventToStore = expirationTime ? { ...event, expirationTime } : event;
                await relayDb.put(`event:${event.id}`, JSON.stringify(eventToStore));
                server.send(JSON.stringify(["OK", event.id, true, ""]));
              }
            } else {
              server.send(JSON.stringify(["OK", event.id, false, "invalid: signature verification failed"]));
            }
          } catch (verifyError) {
            console.error("Error in EVENT processing:", verifyError);
            server.send(JSON.stringify(["OK", event.id, false, "error: EVENT processing failed"]));
          }
          break;
        }
        case "REQ": {
          const subscriptionId = message[1];
          const filters = message.slice(2).reduce((acc, filter) => {
            return { ...acc, ...filter };
          }, {});
          try {
            let events = [];
            let expiredEvents = [];
            if (filters.ids && filters.ids.length > 0) {
              for (const id of filters.ids) {
                const eventValue = await relayDb.get(`event:${id}`, 'json');
                if (eventValue) {
                  if (eventValue.expirationTime && Date.now() > eventValue.expirationTime) {
                    expiredEvents.push(id);
                  } else {
                    events.push(eventValue);
                  }
                }
              }
              for (const expiredId of expiredEvents) {
                await relayDb.delete(`event:${expiredId}`);
              }
            }
            server.send(JSON.stringify(["EVENT", subscriptionId, ...events]));
          } catch (dbError) {
            console.error('Database error:', dbError);
            server.send(JSON.stringify(["ERROR", subscriptionId, 'Database error']));
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
    const signatureBytes = hexToBytes2(event.sig);
    const serializedEventData = serializeEventForSigning(event);
    const messageHash = await sha2562(serializedEventData);
    const messageHashBytes = hexToBytes2(messageHash);
    const publicKeyBytes = hexToBytes2(event.pubkey);
    const signatureIsValid = schnorr.verify(signatureBytes, messageHashBytes, publicKeyBytes);
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
    event.content
  ]);
  return serializedEvent;
}
function hexToBytes2(hexString) {
  if (hexString.length % 2 !== 0)
    throw new Error("Invalid hex string");
  const bytes2 = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes2.length; i++) {
    bytes2[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes2;
}
async function sha2562(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return bufferToHex(hashBuffer);
}
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
} 