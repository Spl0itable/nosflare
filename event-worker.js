// EVENT helper worker

// Handles POST request from relay worker
addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method === 'POST') {
    event.respondWith(handlePostRequest(request));
  } else {
    event.respondWith(new Response("Invalid request", { status: 400 }));
  }
});
async function handlePostRequest(request) {
  try {
    // Checks if Authorization header is present and matches authToken
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${authToken}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { type, event } = await request.json();
    if (type === 'EVENT') {
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

  // Setting to enable or disable global duplicate hash check
  const enableGlobalDuplicateCheck = false;  // Set to true for global duplicate hash regardless of pubkey, or set to false for per-pubkey hash
  
  // Bypass kinds from duplicate hash checks - all kinds bypassed by default
  // Add comma-separated kinds Ex: 3, 5
  const bypassDuplicateKinds = new Set([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 40, 41, 42, 43, 44, 64, 818, 1021, 1022, 1040, 1059, 1063, 1311, 1617, 1621, 1622, 1630, 1633, 1971, 1984, 1985, 1986, 1987, 2003, 2004, 2022, 4550, 5000, 5999, 6000, 6999, 7000, 9000, 9030, 9041, 9467, 9734, 9735, 9802, 10000, 10001, 10002, 10003, 10004, 10005, 10006, 10007, 10009, 10015, 10030, 10050, 10063, 10096, 13194, 21000, 22242, 23194, 23195, 24133, 24242, 27235, 30000, 30001, 30002, 30003, 30004, 30005, 30007, 30008, 30009, 30015, 30017, 30018, 30019, 30020, 30023, 30024, 30030, 30040, 30041, 30063, 30078, 30311, 30315, 30402, 30403, 30617, 30618, 30818, 30819, 31890, 31922, 31923, 31924, 31925, 31989, 31990, 34235, 34236, 34237, 34550, 39000, 39001, 39002, 39003, 39004, 39005, 39006, 39007, 39008, 39009
  ]);
  
  // Kinds subjected to duplicate hash checks
  const duplicateCheckedKinds = new Set([
    // Add kinds you explicitly want to have duplication checks
    // Ex: 1, 2, 4, 5
  ]);
  function isDuplicateChecked(kind) {
    if (duplicateCheckedKinds.size > 0 && !duplicateCheckedKinds.has(kind)) {
      return false;
    }
    return !bypassDuplicateKinds.has(kind);
  }
  function isDuplicateBypassed(kind) {
    return bypassDuplicateKinds.has(kind);
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
const duplicateCheckRateLimiter = new rateLimiter(100 / 60000, 100); // 100 duplicate checks per min

// Handles EVENT message
async function processEvent(event) {
  try {
    // Check if deletion event (kind 5)
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

// Helper function to process tasks in batches
async function processInBatches(tasks, batchSize) {
  const results = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    results.push(...await Promise.all(batch));
  }
  return results;
}

// Handles saving event to R2 bucket
async function saveEventToR2(event) {
  const eventKey = `events/event:${event.id}`;
  
  // Generate a hash of the event content
  const contentHash = await hashContent(event);
  const contentHashKey = enableGlobalDuplicateCheck
    ? `hashes/${contentHash}`
    : `hashes/${event.pubkey}:${contentHash}`;

  const tasks = [];

  // Check for duplicate content
  if (!isDuplicateBypassed(event.kind)) {
    tasks.push((async () => {
      const existingHash = await relayDb.get(contentHashKey);
      if (existingHash) {
        console.log(`Duplicate content detected. Event dropped.`);
        throw new Error("Duplicate content detected");
      }
    })());
  }

  // Check if event ID already exists
  tasks.push((async () => {
    const existingEvent = await relayDb.get(eventKey);
    if (existingEvent) {
      console.log(`Duplicate event: ${event.id}. Event dropped.`);
      throw new Error("Duplicate event");
    }
  })());

  // Wait for duplicate checks to complete
  try {
    await Promise.all(tasks);
  } catch (error) {
    return { success: false, error: error.message };
  }

  const saveTasks = [];

  // Save event and update counts
  const kindCountKey = `counts/kind_count_${event.kind}`;
  const pubkeyCountKey = `counts/pubkey_count_${event.pubkey}`;

  // Get counts for kind and pubkey
  const kindCountResponse = await relayDb.get(kindCountKey);
  const kindCountValue = kindCountResponse ? await kindCountResponse.text() : "0";
  let kindCount = parseInt(kindCountValue, 10);
  if (isNaN(kindCount)) kindCount = 0;

  const pubkeyCountResponse = await relayDb.get(pubkeyCountKey);
  const pubkeyCountValue = pubkeyCountResponse ? await pubkeyCountResponse.text() : "0";
  let pubkeyCount = parseInt(pubkeyCountValue, 10);
  if (isNaN(pubkeyCount)) pubkeyCount = 0;

  const kindKey = `kinds/kind-${event.kind}:${kindCount + 1}`;
  const pubkeyKey = `pubkeys/pubkey-${event.pubkey}:${pubkeyCount + 1}`;

  // Save the event and counts
  saveTasks.push(
    relayDb.put(eventKey, JSON.stringify(event)),
    relayDb.put(kindKey, JSON.stringify(event)),
    relayDb.put(pubkeyKey, JSON.stringify(event)),
    relayDb.put(kindCountKey, (kindCount + 1).toString()),
    relayDb.put(pubkeyCountKey, (pubkeyCount + 1).toString())
  );

  // Save the related keys in the event object for easy retrieval later
  event.kindKey = kindKey;
  event.pubkeyKey = pubkeyKey;

  // Handle tags in batches
  const tagSaveTasks = [];
  const tagKeys = [];
  for (const tag of event.tags) {
    const tagName = tag[0];
    const tagValue = tag[1];
    if (tagName && tagValue) {
      const tagCountKey = `counts/${tagName}_count_${tagValue}`;
      const tagCountResponse = await relayDb.get(tagCountKey);
      const tagCountValue = tagCountResponse ? await tagCountResponse.text() : "0";
      let tagCount = parseInt(tagCountValue, 10);
      if (isNaN(tagCount)) tagCount = 0;

      const tagKey = `tags/${tagName}-${tagValue}:${tagCount + 1}`;
      event[`${tagName}Key_${tagValue}`] = tagKey;
      tagKeys.push(tagKey);

      tagSaveTasks.push(
        relayDb.put(tagKey, JSON.stringify(event)),
        relayDb.put(tagCountKey, (tagCount + 1).toString())
      );
    }
  }

  // Save the tag keys as part of the event object
  event.tagKeys = tagKeys;

  // Process tag saves in batches of 3 to avoid exceeding connection limits
  await processInBatches(tagSaveTasks, 3);

  // Save content hash if duplicate checks are enabled
  if (!isDuplicateBypassed(event.kind)) {
    saveTasks.push(relayDb.put(contentHashKey, JSON.stringify(event)));
  }

  // Process the final save tasks (including event and counts)
  await Promise.all(saveTasks);

  return { success: true };
}

// Function to hash content of the event
async function hashContent(event) {
  const contentToHash = enableGlobalDuplicateCheck
    ? JSON.stringify({
        kind: event.kind,
        tags: event.tags,
        content: event.content,
      })
    : JSON.stringify({
        pubkey: event.pubkey,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
      });

  const buffer = new TextEncoder().encode(contentToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return bytesToHex(new Uint8Array(hashBuffer));
}

// Convert byte array to hex string
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Handles event deletes (NIP-09)
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
              // Delete the main event ID
              await relayDb.delete(idKey);

              // Delete related keys (kind, pubkey, and tags)
              const relatedDataKeys = [
                event.kindKey,
                event.pubkeyKey,
                ...(event.tagKeys || [])  // Include all tag keys
              ].filter((key) => key !== undefined);

              for (const key of relatedDataKeys) {
                await relayDb.delete(key);
              }

              // Purge keys from Cloudflare cache
              const relatedDataUrls = [
                eventUrl,
                event.kindKey ? `https://${r2BucketDomain}/${encodeURIComponent(event.kindKey)}` : undefined,
                event.pubkeyKey ? `https://${r2BucketDomain}/${encodeURIComponent(event.pubkeyKey)}` : undefined,
                ...relatedDataKeys.map((key) => `https://${r2BucketDomain}/${encodeURIComponent(key)}`)
              ].filter((url) => url !== undefined);
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