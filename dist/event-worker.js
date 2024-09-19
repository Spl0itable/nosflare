// event-worker.js
addEventListener("fetch", (event) => {
  const { request } = event;
  console.log(`Received ${request.method} request at ${(/* @__PURE__ */ new Date()).toISOString()}`);
  if (request.method === "POST") {
    console.log("Handling POST request...");
    event.respondWith(handlePostRequest(request));
  } else {
    console.warn(`Invalid request method: ${request.method}`);
    event.respondWith(new Response("Invalid request", { status: 400 }));
  }
});
async function handlePostRequest(request) {
  try {
    const authHeader = request.headers.get("Authorization");
    console.log(`Authorization header received: ${authHeader !== null}`);
    if (!authHeader || authHeader !== `Bearer ${authToken}`) {
      console.warn("Unauthorized request.");
      return new Response("Unauthorized", { status: 401 });
    }
    const { type, event } = await request.json();
    console.log(`Request type: ${type}, Event ID: ${event.id}`);
    if (type === "EVENT") {
      console.log(`Processing event with ID: ${event.id}`);
      await processEvent(event);
      return new Response("Event received successfully", { status: 200 });
    } else {
      console.warn(`Invalid request type: ${type}`);
      return new Response("Invalid request type", { status: 400 });
    }
  } catch (error) {
    console.error("Error processing POST request:", error);
    return new Response(`Error processing request: ${error.message}`, { status: 500 });
  }
}
var MAX_CONCURRENT_CONNECTIONS = 6;
var activeConnections = 0;
async function withConnectionLimit(promiseFunction) {
  console.log(`Active connections: ${activeConnections} / ${MAX_CONCURRENT_CONNECTIONS}`);
  while (activeConnections >= MAX_CONCURRENT_CONNECTIONS) {
    console.log("Connection limit reached, waiting...");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  activeConnections += 1;
  try {
    return await promiseFunction();
  } finally {
    activeConnections -= 1;
    console.log(`Connection closed. Active connections: ${activeConnections}`);
  }
}
var enableGlobalDuplicateCheck = false;
var bypassDuplicateKinds = /* @__PURE__ */ new Set([
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  16,
  17,
  40,
  41,
  42,
  43,
  44,
  64,
  818,
  1021,
  1022,
  1040,
  1059,
  1063,
  1311,
  1617,
  1621,
  1622,
  1630,
  1633,
  1971,
  1984,
  1985,
  1986,
  1987,
  2003,
  2004,
  2022,
  4550,
  5e3,
  5999,
  6e3,
  6999,
  7e3,
  9e3,
  9030,
  9041,
  9467,
  9734,
  9735,
  9802,
  1e4,
  10001,
  10002,
  10003,
  10004,
  10005,
  10006,
  10007,
  10009,
  10015,
  10030,
  10050,
  10063,
  10096,
  13194,
  21e3,
  22242,
  23194,
  23195,
  24133,
  24242,
  27235,
  3e4,
  30001,
  30002,
  30003,
  30004,
  30005,
  30007,
  30008,
  30009,
  30015,
  30017,
  30018,
  30019,
  30020,
  30023,
  30024,
  30030,
  30040,
  30041,
  30063,
  30078,
  30311,
  30315,
  30402,
  30403,
  30617,
  30618,
  30818,
  30819,
  31890,
  31922,
  31923,
  31924,
  31925,
  31989,
  31990,
  34235,
  34236,
  34237,
  34550,
  39e3,
  39001,
  39002,
  39003,
  39004,
  39005,
  39006,
  39007,
  39008,
  39009
]);
function isDuplicateBypassed(kind) {
  return bypassDuplicateKinds.has(kind);
}
async function processEvent(event) {
  try {
    if (event.kind === 5) {
      console.log(`Processing deletion event for event ID: ${event.id}`);
      await processDeletionEvent(event);
      return "Deletion request received successfully.";
    }
    console.log(`Saving event with ID: ${event.id} to R2...`);
    const saveResult = await saveEventToR2(event);
    if (!saveResult.success) {
      console.error(`Failed to save event with ID: ${event.id}`);
      return `Error: Failed to save event - ${saveResult.error}`;
    }
    console.log(`Event with ID: ${event.id} processed successfully.`);
    return "Event received successfully.";
  } catch (error) {
    console.error("Error in EVENT processing:", error);
    return `Error: EVENT processing failed - ${error.message}`;
  }
}
async function saveEventToR2(event) {
  const eventKey = `events/event:${event.id}`;
  const metadataKey = `metadata/event:${event.id}`;
  console.log(`Generating content hash for event with ID: ${event.id}`);
  const contentHash = await hashContent(event);
  const contentHashKey = enableGlobalDuplicateCheck ? `hashes/${contentHash}` : `hashes/${event.pubkey}:${contentHash}`;
  if (isDuplicateBypassed(event.kind)) {
    console.log(`Skipping duplicate check for kind: ${event.kind}`);
  } else {
    try {
      console.log(`Checking for existing content hash for event ID: ${event.id}`);
      const existingHash = await withConnectionLimit(() => relayDb.get(contentHashKey));
      if (existingHash) {
        console.log(`Duplicate content detected for event: ${JSON.stringify(event)}. Event dropped.`);
        return { success: false, error: `Duplicate content detected for event with content: ${event.content}` };
      }
    } catch (error) {
      if (error.name !== "R2Error" || error.message !== "R2 object not found") {
        console.error(`Error checking content hash in R2: ${error.message}`);
        return { success: false, error: `Error checking content hash in R2: ${error.message}` };
      }
    }
  }
  try {
    console.log(`Checking for existing event ID: ${event.id}`);
    const existingEvent = await withConnectionLimit(() => relayDb.get(eventKey));
    if (existingEvent) {
      console.log(`Duplicate event: ${event.id}. Event dropped.`);
      return { success: false, error: "Duplicate event" };
    }
  } catch (error) {
    if (error.name !== "R2Error" || error.message !== "R2 object not found") {
      console.error(`Error checking duplicate event in R2: ${error.message}`);
      return { success: false, error: `Error checking duplicate event in R2: ${error.message}` };
    }
  }
  let kindCount, pubkeyCount;
  try {
    const kindCountKey = `counts/kind_count_${event.kind}`;
    const pubkeyCountKey = `counts/pubkey_count_${event.pubkey}`;
    console.log(`Fetching counts for kind: ${event.kind} and pubkey: ${event.pubkey}`);
    kindCount = await getCount(kindCountKey);
    pubkeyCount = await getCount(pubkeyCountKey);
  } catch (error) {
    console.error(`Error fetching counts for kind or pubkey: ${error.message}`);
    return { success: false, error: `Error fetching counts: ${error.message}` };
  }
  const kindKey = `kinds/kind-${event.kind}:${kindCount + 1}`;
  const pubkeyKey = `pubkeys/pubkey-${event.pubkey}:${pubkeyCount + 1}`;
  const metadata = {
    kindKey,
    pubkeyKey,
    tags: [],
    contentHashKey
  };
  const eventWithCountRef = { ...event, kindKey, pubkeyKey };
  const tagBatches = [];
  let currentBatch = [];
  try {
    console.log(`Processing and saving tags for event ID: ${event.id}`);
    for (const tag of event.tags) {
      const [tagName, tagValue] = tag;
      if (tagName && tagValue) {
        const tagKey = `tags/${tagName}-${tagValue}:${kindCount + 1}`;
        metadata.tags.push(tagKey);
        currentBatch.push(withConnectionLimit(() => relayDb.put(tagKey, JSON.stringify(event))));
        if (currentBatch.length === 5) {
          tagBatches.push(currentBatch);
          currentBatch = [];
        }
      }
    }
    if (currentBatch.length > 0) {
      tagBatches.push(currentBatch);
    }
  } catch (error) {
    console.error(`Error processing tags for event ID: ${event.id}: ${error.message}`);
    return { success: false, error: `Error processing tags: ${error.message}` };
  }
  try {
    console.log(`Saving event and related data for event ID: ${event.id}`);
    await Promise.all([
      withConnectionLimit(() => relayDb.put(kindKey, JSON.stringify(event))),
      withConnectionLimit(() => relayDb.put(pubkeyKey, JSON.stringify(event))),
      withConnectionLimit(() => relayDb.put(eventKey, JSON.stringify(eventWithCountRef))),
      withConnectionLimit(() => relayDb.put(`counts/kind_count_${event.kind}`, (kindCount + 1).toString())),
      withConnectionLimit(() => relayDb.put(`counts/pubkey_count_${event.pubkey}`, (pubkeyCount + 1).toString())),
      withConnectionLimit(() => relayDb.put(metadataKey, JSON.stringify(metadata)))
    ]);
    for (const batch of tagBatches) {
      await Promise.all(batch);
    }
    if (!isDuplicateBypassed(event.kind)) {
      console.log(`Saving content hash for event ID: ${event.id}`);
      await withConnectionLimit(() => relayDb.put(contentHashKey, JSON.stringify(event)));
    }
    console.log(`Event ${event.id} saved successfully.`);
    return { success: true };
  } catch (error) {
    console.error(`Error saving event data in R2 for event ID: ${event.id}: ${error.message}`);
    return { success: false, error: `Error saving event data: ${error.message}` };
  }
}
async function getCount(key) {
  try {
    console.log(`Retrieving count for key: ${key}`);
    const response = await withConnectionLimit(() => relayDb.get(key));
    const value = response ? await response.text() : "0";
    let count = parseInt(value, 10);
    return isNaN(count) ? 0 : count;
  } catch (error) {
    console.error(`Error retrieving count for key ${key}: ${error.message}`);
    throw new Error(`Error retrieving count for key ${key}: ${error.message}`);
  }
}
async function processDeletionEvent(deletionEvent) {
  console.log(`Processing deletion event with ID: ${deletionEvent.id}`);
  const deletedEventIds = deletionEvent.tags.filter((tag) => tag[0] === "e").map((tag) => tag[1]);
  for (const eventId of deletedEventIds) {
    const metadataKey = `metadata/event:${eventId}`;
    try {
      console.log(`Deleting event with ID: ${eventId}`);
      const metadataResponse = await withConnectionLimit(() => relayDb.get(metadataKey));
      if (metadataResponse) {
        const metadata = await metadataResponse.json();
        const keysToDelete = [
          `events/event:${eventId}`,
          // Event content
          metadata.kindKey,
          // Kind reference
          metadata.pubkeyKey,
          // Pubkey reference
          metadata.contentHashKey,
          // Content hash reference
          ...metadata.tags
          // Associated tags
        ];
        await Promise.all(keysToDelete.map((key) => withConnectionLimit(() => relayDb.delete(key))));
        await withConnectionLimit(() => relayDb.delete(metadataKey));
        await purgeCloudflareCache(keysToDelete);
        console.log(`Event ${eventId} and its metadata deleted successfully.`);
      }
    } catch (error) {
      console.error(`Error processing deletion for event ${eventId}: ${error.message}`);
    }
  }
}
async function purgeCloudflareCache(keys) {
  const headers = new Headers();
  headers.append("Authorization", `Bearer ${apiToken}`);
  headers.append("Content-Type", "application/json");
  const urls = keys.map((key) => `https://${r2BucketDomain}/${key}`);
  const requestOptions = {
    method: "POST",
    headers,
    body: JSON.stringify({ files: urls })
  };
  return withConnectionLimit(async () => {
    console.log(`Purging Cloudflare cache for URLs: ${urls}`);
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, requestOptions);
    if (response.ok) {
      response.body.cancel();
    } else {
      throw new Error(`Failed to purge Cloudflare cache: ${response.status}`);
    }
    console.log(`Cloudflare cache purged for URLs:`, urls);
  });
}
async function hashContent(event) {
  const contentToHash = enableGlobalDuplicateCheck ? JSON.stringify({ kind: event.kind, tags: event.tags, content: event.content }) : JSON.stringify({ pubkey: event.pubkey, kind: event.kind, tags: event.tags, content: event.content });
  const buffer = new TextEncoder().encode(contentToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hash = bytesToHex(new Uint8Array(hashBuffer));
  console.log(`Generated hash for event ID: ${event.id}: ${hash}`);
  return hash;
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
