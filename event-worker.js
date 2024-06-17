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
        // Check cache for duplicate event ID
        const cacheKey = `event:${event.id}`;
        const cachedEvent = relayCache.get(cacheKey);
        if (cachedEvent) {
            return "Duplicate. Event dropped.";
        }
        relayCache.set(cacheKey, event);
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
    if (!duplicateCheckRateLimiter.removeToken(event.pubkey)) {
      console.log(`Duplicate check rate limit exceeded for pubkey: ${event.pubkey}`);
      return { success: false, error: "Duplicate check rate limit exceeded" };
    }
    try {
      const eventUrl = `${customDomain}/${eventKey}`;
      const response = await fetch(eventUrl);
      if (response.ok) {
        console.log(`Duplicate event: ${event.id}. Event dropped.`);
        return { success: false, error: "Duplicate event" };
      } else if (response.status !== 404) {
        console.error(`Error checking duplicate event in R2: ${response.status}`);
        response.body.cancel();
        return { success: false, error: `Error checking duplicate event in R2: ${response.status}` };
      } else {
        purgeCloudflareCache(eventUrl);
      }
    } catch (error) {
      console.error(`Error checking duplicate event in R2: ${error.message}`);
      return { success: false, error: `Error checking duplicate event in R2: ${error.message}` };
    }
    try {
      JSON.stringify(event);
    } catch (error) {
      console.error(`Invalid JSON for event: ${event.id}. Event dropped.`, error);
      return { success: false, error: `Invalid JSON for event: ${event.id}` };
    }
    try {
      const kindCountKey = `count/kind_count_${event.kind}`;
      const kindCountUrl = `${customDomain}/${kindCountKey}`;
      const kindCountResponse = await fetch(kindCountUrl);
      const kindCountValue = kindCountResponse.ok ? await kindCountResponse.text() : "0";
      let kindCount = parseInt(kindCountValue, 10);
      if (isNaN(kindCount)) {
        kindCount = 0;
      }
      const kindKey = `kinds/kind-${event.kind}:${kindCount + 1}`;
      const pubkeyCountKey = `count/pubkey_count_${event.pubkey}`;
      const pubkeyCountUrl = `${customDomain}/${pubkeyCountKey}`;
      const pubkeyCountResponse = await fetch(pubkeyCountUrl);
      const pubkeyCountValue = pubkeyCountResponse.ok ? await pubkeyCountResponse.text() : "0";
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
          const tagCountKey = `count/${tagName}_count_${tagValue}`;
          const tagCountUrl = `${customDomain}/${tagCountKey}`;
          const tagCountResponse = await fetch(tagCountUrl);
          const tagCountValue = tagCountResponse.ok ? await tagCountResponse.text() : "0";
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
        relayDb.put(pubkeyCountKey, (pubkeyCount + 1).toString()),
      ]);
      for (const batch of tagBatches) {
        await Promise.all(batch);
      }
      return { success: true };
    } catch (error) {
      console.error(`Error saving event to R2: ${error.message}`);
      return { success: false, error: `Error saving event to R2: ${error.message}` };
    }
  }

// Handles event deletes (NIP-09)
async function processDeletionEvent(deletionEvent) {
    try {
      if (deletionEvent.kind === 5 && deletionEvent.pubkey) {
        const deletedEventIds = deletionEvent.tags.filter((tag) => tag[0] === "e").map((tag) => tag[1]);
        for (const eventId of deletedEventIds) {
          const idKey = `events/event:${eventId}`;
          const eventUrl = `${customDomain}/${encodeURIComponent(idKey)}`;
          try {
            const response = await fetch(eventUrl);
            if (response.ok) {
              const event = await response.json();
              if (event && event.pubkey === deletionEvent.pubkey) {
                const relatedDataKeys = [
                  event.kindKey,
                  event.pubkeyKey,
                  ...Object.values(event).filter((value) => typeof value === "string" && value.startsWith("tags/"))
                ].filter((key) => key !== undefined);
                const deleteOperations = [
                  relayDb.delete(idKey),
                  event.kindKey ? relayDb.delete(event.kindKey) : Promise.resolve(),
                  event.pubkeyKey ? relayDb.delete(event.pubkeyKey) : Promise.resolve(),
                  ...relatedDataKeys.map((key) => relayDb.delete(key)),
                ];
                const deleteBatches = [];
                let currentBatch = [];
                for (const operation of deleteOperations) {
                  currentBatch.push(operation);
                  if (currentBatch.length === 5) {
                    deleteBatches.push(currentBatch);
                    currentBatch = [];
                  }
                }
                if (currentBatch.length > 0) {
                  deleteBatches.push(currentBatch);
                }
                for (const batch of deleteBatches) {
                  await Promise.all(batch);
                }
                const cacheKey = `event:${eventId}`;
                relayCache.delete(cacheKey);
                const relatedDataUrls = [
                  eventUrl,
                  event.kindKey ? `${customDomain}/${encodeURIComponent(event.kindKey)}` : undefined,
                  event.pubkeyKey ? `${customDomain}/${encodeURIComponent(event.pubkeyKey)}` : undefined,
                  ...relatedDataKeys.map((key) => `${customDomain}/${encodeURIComponent(key)}`),
                ].filter((url) => url !== undefined);
                const purgeBatches = [];
                let currentPurgeBatch = [];
                for (const url of relatedDataUrls) {
                  currentPurgeBatch.push(purgeCloudflareCache(url));
                  if (currentPurgeBatch.length === 5) {
                    purgeBatches.push(currentPurgeBatch);
                    currentPurgeBatch = [];
                  }
                }
                if (currentPurgeBatch.length > 0) {
                  purgeBatches.push(currentPurgeBatch);
                }
                for (const batch of purgeBatches) {
                  await Promise.all(batch);
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