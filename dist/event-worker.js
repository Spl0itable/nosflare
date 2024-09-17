// event-worker.js
addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method === "POST") {
    event.respondWith(handlePostRequest(request));
  } else {
    event.respondWith(new Response("Invalid request", { status: 400 }));
  }
});
async function handlePostRequest(request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${authToken}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { type, event } = await request.json();
    if (type === "EVENT") {
      await processEvent(event);
      return new Response("Event received successfully", { status: 200 });
    } else {
      return new Response("Invalid request type", { status: 400 });
    }
  } catch (error) {
    console.error("Error processing POST request:", error);
    return new Response(`Error processing request: ${error.message}`, { status: 500 });
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
var rateLimiter = class {
  constructor(rate, capacity) {
    this.tokens = capacity;
    this.lastRefillTime = Date.now();
    this.capacity = capacity;
    this.fillRate = rate;
  }
  removeToken() {
    this.refill();
    if (this.tokens < 1) {
      return false;
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
};
var duplicateCheckRateLimiter = new rateLimiter(100 / 6e4, 100);
async function processEvent(event) {
  try {
    if (event.kind === 5) {
      await processDeletionEvent(event);
      return "Deletion request received successfully.";
    }
    const saveResult = await saveEventToR2(event);
    if (!saveResult.success) {
      return `Error: Failed to save event - ${saveResult.error}`;
    }
    return "Event received successfully.";
  } catch (error) {
    console.error("Error in EVENT processing:", error);
    return `Error: EVENT processing failed - ${error.message}`;
  }
}
async function saveEventToR2(event) {
  const eventKey = `events/event:${event.id}`;
  const contentHash = await hashContent(event);
  const contentHashKey = enableGlobalDuplicateCheck ? `hashes/${contentHash}` : `hashes/${event.pubkey}:${contentHash}`;
  if (isDuplicateBypassed(event.kind)) {
    console.log(`Skipping duplicate check for kind: ${event.kind}`);
  } else {
    try {
      const existingHash = await relayDb.get(contentHashKey);
      if (existingHash) {
        console.log(`Duplicate content detected. Event dropped.`);
        return { success: false, error: "Duplicate content detected" };
      }
    } catch (error) {
      if (error.name !== "R2Error" || error.message !== "R2 object not found") {
        console.error(`Error checking content hash in R2: ${error.message}`);
        return { success: false, error: `Error checking content hash in R2: ${error.message}` };
      }
    }
  }
  if (!duplicateCheckRateLimiter.removeToken(event.pubkey)) {
    console.log(`Duplicate check rate limit exceeded for pubkey: ${event.pubkey}`);
    return { success: false, error: "Duplicate check rate limit exceeded" };
  }
  try {
    const existingEvent = await relayDb.get(eventKey);
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
  try {
    JSON.stringify(event);
  } catch (error) {
    console.error(`Invalid JSON for event: ${event.id}. Event dropped.`, error);
    return { success: false, error: `Invalid JSON for event: ${event.id}` };
  }
  try {
    const kindCountKey = `counts/kind_count_${event.kind}`;
    const kindCountResponse = await relayDb.get(kindCountKey);
    const kindCountValue = kindCountResponse ? await kindCountResponse.text() : "0";
    let kindCount = parseInt(kindCountValue, 10);
    if (isNaN(kindCount)) {
      kindCount = 0;
    }
    const kindKey = `kinds/kind-${event.kind}:${kindCount + 1}`;
    const pubkeyCountKey = `counts/pubkey_count_${event.pubkey}`;
    const pubkeyCountResponse = await relayDb.get(pubkeyCountKey);
    const pubkeyCountValue = pubkeyCountResponse ? await pubkeyCountResponse.text() : "0";
    let pubkeyCount = parseInt(pubkeyCountValue, 10);
    if (isNaN(pubkeyCount)) {
      pubkeyCount = 0;
    }
    const pubkeyKey = `pubkeys/pubkey-${event.pubkey}:${pubkeyCount + 1}`;
    const eventWithCountRef = { ...event, kindKey, pubkeyKey };
    const tagBatches = [];
    let currentBatch = [];
    for (const tag of event.tags) {
      const tagName = tag[0];
      const tagValue = tag[1];
      if (tagName && tagValue) {
        const tagCountKey = `counts/${tagName}_count_${tagValue}`;
        const tagCountResponse = await relayDb.get(tagCountKey);
        const tagCountValue = tagCountResponse ? await tagCountResponse.text() : "0";
        let tagCount = parseInt(tagCountValue, 10);
        if (isNaN(tagCount)) {
          tagCount = 0;
        }
        const tagKey = `tags/${tagName}-${tagValue}:${tagCount + 1}`;
        eventWithCountRef[`${tagName}Key_${tagValue}`] = tagKey;
        currentBatch.push(relayDb.put(tagKey, JSON.stringify(event)));
        currentBatch.push(relayDb.put(tagCountKey, (tagCount + 1).toString()));
        if (currentBatch.length === 5) {
          tagBatches.push(currentBatch);
          currentBatch = [];
        }
      }
    }
    if (currentBatch.length > 0) {
      tagBatches.push(currentBatch);
    }
    eventWithCountRef.tags = event.tags.filter((tag) => {
      const [tagName, tagValue] = tag;
      return tagName && tagValue;
    }).map((tag) => {
      const [tagName, tagValue] = tag;
      return [tagName, tagValue, eventWithCountRef[`${tagName}Key_${tagValue}`]];
    });
    await Promise.all([
      relayDb.put(kindKey, JSON.stringify(event)),
      relayDb.put(pubkeyKey, JSON.stringify(event)),
      relayDb.put(eventKey, JSON.stringify(eventWithCountRef)),
      relayDb.put(kindCountKey, (kindCount + 1).toString()),
      relayDb.put(pubkeyCountKey, (pubkeyCount + 1).toString())
    ]);
    if (!isDuplicateBypassed(event.kind)) {
      await relayDb.put(contentHashKey, JSON.stringify(event));
    }
    return { success: true };
  } catch (error) {
    console.error(`Error saving event to R2: ${error.message}`);
    return { success: false, error: `Error saving event to R2: ${error.message}` };
  }
}
async function hashContent(event) {
  const contentToHash = enableGlobalDuplicateCheck ? JSON.stringify({
    kind: event.kind,
    tags: event.tags,
    content: event.content
  }) : JSON.stringify({
    pubkey: event.pubkey,
    kind: event.kind,
    tags: event.tags,
    content: event.content
  });
  const buffer = new TextEncoder().encode(contentToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return bytesToHex(new Uint8Array(hashBuffer));
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function processDeletionEvent(deletionEvent) {
  try {
    if (deletionEvent.kind === 5 && deletionEvent.pubkey) {
      const deletedEventIds = deletionEvent.tags.filter((tag) => tag[0] === "e").map((tag) => tag[1]);
      for (const eventId of deletedEventIds) {
        const idKey = `events/event:${eventId}`;
        const eventUrl = `https://${r2BucketDomain}/${encodeURIComponent(idKey)}`;
        try {
          const response = await fetch(eventUrl);
          if (response.ok) {
            const event = await response.json();
            if (event && event.pubkey === deletionEvent.pubkey) {
              const relatedDataKeys = [
                event.kindKey,
                event.pubkeyKey,
                ...Object.values(event).filter((value) => typeof value === "string" && value.startsWith("tags/"))
              ].filter((key) => key !== void 0);
              await relayDb.delete(idKey);
              if (event.kindKey)
                await relayDb.delete(event.kindKey);
              if (event.pubkeyKey)
                await relayDb.delete(event.pubkeyKey);
              for (const key of relatedDataKeys) {
                await relayDb.delete(key);
              }
              const relatedDataUrls = [
                eventUrl,
                event.kindKey ? `https://${r2BucketDomain}/${encodeURIComponent(event.kindKey)}` : void 0,
                event.pubkeyKey ? `https://${r2BucketDomain}/${encodeURIComponent(event.pubkeyKey)}` : void 0,
                ...relatedDataKeys.map((key) => `https://${r2BucketDomain}/${encodeURIComponent(key)}`)
              ].filter((url) => url !== void 0);
              for (const url of relatedDataUrls) {
                await purgeCloudflareCache(url);
              }
            }
          }
        } catch (error) {
          console.error(`Error retrieving event ${eventId} from R2:`, error);
        }
      }
    } else {
      return "Invalid deletion event.";
    }
  } catch (error) {
    console.error("Error processing deletion event:", error);
    return `Error processing deletion event: ${error.message}`;
  }
}
async function purgeCloudflareCache(url) {
  const headers = new Headers();
  headers.append("Authorization", `Bearer ${apiToken}`);
  headers.append("Content-Type", "application/json");
  const requestOptions = {
    method: "POST",
    headers,
    body: JSON.stringify({ files: [url] })
  };
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    requestOptions
  );
  if (!response.ok) {
    throw new Error(`Failed to purge Cloudflare cache: ${response.status}`);
  }
}
