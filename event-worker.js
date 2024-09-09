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

// Bypass kinds from duplicate hash checks
// Add comma-separated kinds Ex: 3, 5
const bypassDuplicateKinds = new Set([
  0, 3 // Kinds 0, 3 are for metadata and should not be checked for duplicates
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
function isTagBlocked(tag) {
  return blockedTags.has(tag);
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

// Handles saving event to R2 bucket
async function saveEventToR2(event) {
  const eventKey = `events/event:${event.id}`;

  // Generate a hash of the event content
  const contentHash = await hashContent(event);

  // Define the content hash key depending on the global setting
  const contentHashKey = enableGlobalDuplicateCheck
    ? `hashes/${contentHash}`   // Global duplicate check (same content is blocked for everyone)
    : `hashes/${event.pubkey}:${contentHash}`;  // Per-pubkey duplicate check (same content is allowed once for different pubkeys)

  // Check if the event kind allows duplicate hash checks
  if (isDuplicateBypassed(event.kind)) {
    console.log(`Skipping duplicate check for kind: ${event.kind}`);
  } else {
    // Check if the content hash already exists
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

  // Check if the event ID already exists
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
    JSON.stringify(event); // Ensure event is valid JSON
  } catch (error) {
    console.error(`Invalid JSON for event: ${event.id}. Event dropped.`, error);
    return { success: false, error: `Invalid JSON for event: ${event.id}` };
  }

  // Save the event to R2
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
      if (tagName && tagValue && isTagAllowed(tagName) && !isTagBlocked(tagName)) {
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
      return tagName && tagValue && isTagAllowed(tagName) && !isTagBlocked(tagName);
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

    // Save the content hash if duplicate checks are allowed for this kind
    if (!isDuplicateBypassed(event.kind)) {
      await relayDb.put(contentHashKey, JSON.stringify(event));
    }

    return { success: true };
  } catch (error) {
    console.error(`Error saving event to R2: ${error.message}`);
    return { success: false, error: `Error saving event to R2: ${error.message}` };
  }
}

// Handles hashing the content of the event (excluding the ID)
async function hashContent(event) {
  // Conditionally include or exclude `pubkey` based on the global setting
  const contentToHash = enableGlobalDuplicateCheck
    ? JSON.stringify({
        kind: event.kind,
        tags: event.tags,
        content: event.content,
      })  // Exclude pubkey for global duplicate check
    : JSON.stringify({
        pubkey: event.pubkey,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
      });  // Include pubkey for per-pubkey duplicate check

  const buffer = new TextEncoder().encode(contentToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return bytesToHex(new Uint8Array(hashBuffer));
}

// Convert byte array to hex string
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
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
              const relatedDataKeys = [
                event.kindKey,
                event.pubkeyKey,
                ...Object.values(event).filter((value) => typeof value === "string" && value.startsWith("tags/"))
              ].filter((key) => key !== void 0);
              await relayDb.delete(idKey);
              if (event.kindKey) await relayDb.delete(event.kindKey);
              if (event.pubkeyKey) await relayDb.delete(event.pubkeyKey);
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