// req-worker.js
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
    const { type, subscriptionId, filters } = await request.json();
    if (type === "REQ") {
      const events = await processReq(subscriptionId, filters);
      return new Response(JSON.stringify(events), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response("Invalid request type", { status: 400 });
    }
  } catch (error) {
    console.error("Error processing POST request:", error);
    return new Response(`Error processing request: ${error.message}`, { status: 500 });
  }
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
var reqRateLimiter = new rateLimiter(100 / 6e4, 100);
async function processReq(subscriptionId, filters) {
  if (!reqRateLimiter.removeToken()) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }
  let events = [];
  const eventPromises = [];
  if (filters.ids)
    validateIds(filters.ids);
  if (filters.authors)
    validateAuthors(filters.authors);
  try {
    if (filters.ids) {
      eventPromises.push(...fetchEventsById(filters.ids));
    }
    if (filters.kinds) {
      eventPromises.push(...await fetchEventsByKind(filters.kinds));
    }
    if (filters.authors) {
      eventPromises.push(...await fetchEventsByAuthor(filters.authors));
    }
    const fetchedEvents = await Promise.all(eventPromises);
    events = filterEvents(fetchedEvents.filter((event) => event !== null), filters);
  } catch (error) {
    console.error(`Error retrieving events from R2:`, error);
  }
  return events;
}
function validateIds(ids) {
  for (const id of ids) {
    if (!/^[a-f0-9]{64}$/.test(id)) {
      throw new Error(`Invalid event ID format: ${id}`);
    }
  }
}
function validateAuthors(authors) {
  for (const author of authors) {
    if (!/^[a-f0-9]{64}$/.test(author)) {
      throw new Error(`Invalid author pubkey format: ${author}`);
    }
  }
}
function fetchEventsById(ids, batchSize = 10) {
  const batches = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    batches.push(...batch.map((id) => fetchEventById(id)));
  }
  return batches;
}
async function fetchEventById(id) {
  const idKey = `events/event:${id}`;
  const eventUrl = `https://${r2BucketDomain}/${idKey}`;
  try {
    const response = await fetch(eventUrl);
    if (!response.ok)
      return null;
    const data = await response.text();
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error fetching event with ID ${id}:`, error);
    return null;
  }
}
async function fetchEventsByKind(kinds, limit = 25) {
  const promises = [];
  for (const kind of kinds) {
    const kindCountKey = `counts/kind_count_${kind}`;
    const kindCountResponse = await relayDb.get(kindCountKey);
    const kindCountValue = kindCountResponse ? await kindCountResponse.text() : "0";
    const kindCount = parseInt(kindCountValue, 10);
    for (let i = kindCount; i >= Math.max(1, kindCount - limit + 1); i--) {
      const kindKey = `kinds/kind-${kind}:${i}`;
      promises.push(fetchEventByKey(kindKey));
    }
  }
  return promises;
}
async function fetchEventsByAuthor(authors, limit = 25) {
  const promises = [];
  for (const author of authors) {
    const pubkeyCountKey = `counts/pubkey_count_${author}`;
    const pubkeyCountResponse = await relayDb.get(pubkeyCountKey);
    const pubkeyCountValue = pubkeyCountResponse ? await pubkeyCountResponse.text() : "0";
    const pubkeyCount = parseInt(pubkeyCountValue, 10);
    for (let i = pubkeyCount; i >= Math.max(1, pubkeyCount - limit + 1); i--) {
      const pubkeyKey = `pubkeys/pubkey-${author}:${i}`;
      promises.push(fetchEventByKey(pubkeyKey));
    }
  }
  return promises;
}
async function fetchEventByKey(eventKey) {
  const eventUrl = `https://${r2BucketDomain}/${eventKey}`;
  try {
    const response = await fetch(eventUrl);
    if (!response.ok)
      return null;
    const data = await response.text();
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error fetching event with key ${eventKey}:`, error);
    return null;
  }
}
function filterEvents(events, filters) {
  return events.filter((event) => {
    const includeEvent = (!filters.ids || filters.ids.includes(event.id)) && (!filters.kinds || filters.kinds.includes(event.kind)) && (!filters.authors || filters.authors.includes(event.pubkey)) && (!filters.since || event.created_at >= filters.since) && (!filters.until || event.created_at <= filters.until);
    const tagFilters = Object.entries(filters).filter(([key]) => key.startsWith("#"));
    for (const [tagKey, tagValues] of tagFilters) {
      const tagName = tagKey.slice(1);
      const eventTags = event.tags.filter(([t]) => t === tagName).map(([, v]) => v);
      if (!tagValues.some((value) => eventTags.includes(value))) {
        return false;
      }
    }
    return includeEvent;
  });
}
