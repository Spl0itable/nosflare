// req-worker.js
addEventListener("fetch", (event) => {
  const { request } = event;
  console.log(`Received ${request.method} request at ${(/* @__PURE__ */ new Date()).toISOString()}`);
  if (request.method === "POST") {
    event.respondWith(handlePostRequest(request));
  } else {
    console.warn(`Invalid request method: ${request.method}`);
    event.respondWith(new Response("Invalid request", { status: 400 }));
  }
});
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
async function handlePostRequest(request) {
  try {
    const authHeader = request.headers.get("Authorization");
    console.log(`Authorization header received: ${authHeader !== null}`);
    if (!authHeader || authHeader !== `Bearer ${authToken}`) {
      console.warn("Unauthorized request.");
      return new Response("Unauthorized", { status: 401 });
    }
    const { type, subscriptionId, filters } = await request.json();
    console.log(`Request type: ${type}, Subscription ID: ${subscriptionId}`);
    if (type === "REQ") {
      console.log(`Processing REQ with filters: ${JSON.stringify(filters)}`);
      const events = await processReq(subscriptionId, filters);
      console.log(`Returning ${events.length} events for subscription ID: ${subscriptionId}`);
      return new Response(JSON.stringify(events), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      console.warn(`Invalid request type: ${type}`);
      return new Response("Invalid request type", { status: 400 });
    }
  } catch (error) {
    console.error("Error processing POST request:", error);
    return new Response(`Error processing request: ${error.message}`, { status: 500 });
  }
}
async function processReq(subscriptionId, filters) {
  console.log(`Processing request for subscription ID: ${subscriptionId}`);
  let events = [];
  const eventPromises = [];
  try {
    if (filters.ids) {
      console.log(`Fetching events by IDs: ${filters.ids}`);
      eventPromises.push(...fetchEventsById(filters.ids));
    }
    if (filters.kinds) {
      console.log(`Fetching events by kinds: ${filters.kinds}`);
      eventPromises.push(...await fetchEventsByKind(filters.kinds));
    }
    if (filters.authors) {
      console.log(`Fetching events by authors: ${filters.authors}`);
      eventPromises.push(...await fetchEventsByAuthor(filters.authors));
    }
    if (filters.tags) {
      console.log(`Fetching events by tags: ${JSON.stringify(filters.tags)}`);
      eventPromises.push(...await fetchEventsByTag(filters.tags));
    }
    const fetchedEvents = await Promise.all(eventPromises);
    console.log(`Fetched ${fetchedEvents.length} events, applying filters...`);
    events = filterEvents(fetchedEvents.filter((event) => event !== null), filters);
  } catch (error) {
    console.error(`Error retrieving events from R2:`, error);
  }
  console.log(`Returning ${events.length} filtered events.`);
  return events;
}
function fetchEventsById(ids, batchSize = 10) {
  console.log(`Fetching events by IDs in batches of ${batchSize}`);
  const batches = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    console.log(`Processing batch: ${batch}`);
    batches.push(...batch.map((id) => fetchEventById(id)));
  }
  return batches;
}
async function fetchEventById(id) {
  const idKey = `events/event:${id}`;
  const eventUrl = `https://${r2BucketDomain}/${idKey}`;
  console.log(`Fetching event by ID: ${id} from ${eventUrl}`);
  try {
    return withConnectionLimit(async () => {
      const response = await fetch(eventUrl);
      if (!response.ok) {
        console.warn(`Event not found for ID: ${id}`);
        return null;
      }
      const data = await response.text();
      console.log(`Event found for ID: ${id}`);
      return JSON.parse(data);
    });
  } catch (error) {
    console.error(`Error fetching event with ID ${id}:`, error);
    return null;
  }
}
async function fetchEventsByKind(kinds, limit = 25) {
  console.log(`Fetching events by kinds: ${kinds} with limit: ${limit}`);
  const promises = [];
  for (const kind of kinds) {
    const kindCountKey = `counts/kind_count_${kind}`;
    console.log(`Fetching kind count for kind: ${kind}`);
    const kindCountResponse = await withConnectionLimit(() => relayDb.get(kindCountKey));
    const kindCountValue = kindCountResponse ? await kindCountResponse.text() : "0";
    const kindCount = parseInt(kindCountValue, 10);
    console.log(`Found ${kindCount} events for kind: ${kind}`);
    for (let i = kindCount; i >= Math.max(1, kindCount - limit + 1); i--) {
      const kindKey = `kinds/kind-${kind}:${i}`;
      promises.push(fetchEventByKey(kindKey));
    }
  }
  return promises;
}
async function fetchEventsByAuthor(authors, limit = 25) {
  console.log(`Fetching events by authors: ${authors} with limit: ${limit}`);
  const promises = [];
  for (const author of authors) {
    const pubkeyCountKey = `counts/pubkey_count_${author}`;
    console.log(`Fetching pubkey count for author: ${author}`);
    const pubkeyCountResponse = await withConnectionLimit(() => relayDb.get(pubkeyCountKey));
    const pubkeyCountValue = pubkeyCountResponse ? await pubkeyCountResponse.text() : "0";
    const pubkeyCount = parseInt(pubkeyCountValue, 10);
    console.log(`Found ${pubkeyCount} events for author: ${author}`);
    for (let i = pubkeyCount; i >= Math.max(1, pubkeyCount - limit + 1); i--) {
      const pubkeyKey = `pubkeys/pubkey-${author}:${i}`;
      promises.push(fetchEventByKey(pubkeyKey));
    }
  }
  return promises;
}
async function fetchEventsByTag(tags, limit = 25) {
  console.log(`Fetching events by tags: ${JSON.stringify(tags)} with limit: ${limit}`);
  const promises = [];
  for (const [tagName, tagValue] of tags) {
    const tagCountKey = `counts/${tagName}_count_${tagValue}`;
    console.log(`Fetching tag count for tag: ${tagName}-${tagValue}`);
    const tagCountResponse = await withConnectionLimit(() => relayDb.get(tagCountKey));
    const tagCountValue = tagCountResponse ? await tagCountResponse.text() : "0";
    const tagCount = parseInt(tagCountValue, 10);
    console.log(`Found ${tagCount} events for tag: ${tagName}-${tagValue}`);
    for (let i = tagCount; i >= Math.max(1, tagCount - limit + 1); i--) {
      const tagKey = `tags/${tagName}-${tagValue}:${i}`;
      promises.push(fetchEventByKey(tagKey));
    }
  }
  return promises;
}
async function fetchEventByKey(eventKey) {
  const eventUrl = `https://${r2BucketDomain}/${eventKey}`;
  console.log(`Fetching event by key: ${eventKey} from ${eventUrl}`);
  try {
    return withConnectionLimit(async () => {
      const response = await fetch(eventUrl);
      if (!response.ok) {
        console.warn(`Event not found for key: ${eventKey}`);
        return null;
      }
      const data = await response.text();
      console.log(`Event found for key: ${eventKey}`);
      return JSON.parse(data);
    });
  } catch (error) {
    console.error(`Error fetching event with key ${eventKey}:`, error);
    return null;
  }
}
function filterEvents(events, filters) {
  console.log(`Filtering events based on filters: ${JSON.stringify(filters)}`);
  return events.filter((event) => {
    const includeEvent = (!filters.ids || filters.ids.includes(event.id)) && (!filters.kinds || filters.kinds.includes(event.kind)) && (!filters.authors || filters.authors.includes(event.pubkey)) && (!filters.since || event.created_at >= filters.since) && (!filters.until || event.created_at <= filters.until);
    if (filters.tags) {
      for (const [tagName, tagValue] of filters.tags) {
        const eventTags = event.tags.filter(([t]) => t === tagName).map(([, v]) => v);
        if (!eventTags.includes(tagValue)) {
          return false;
        }
      }
    }
    return includeEvent;
  });
}
