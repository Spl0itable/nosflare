// req-worker.js
addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method === "POST") {
    event.respondWith(handlePostRequest(request));
  } else {
    event.respondWith(new Response("Invalid request", { status: 400 }));
  }
});
var MAX_CONCURRENT_CONNECTIONS = 6;
var activeConnections = 0;
async function withConnectionLimit(promiseFunction) {
  while (activeConnections >= MAX_CONCURRENT_CONNECTIONS) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  activeConnections += 1;
  try {
    return await promiseFunction();
  } finally {
    activeConnections -= 1;
  }
}
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
async function processReq(subscriptionId, filters) {
  let events = [];
  const eventPromises = [];
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
    if (filters.tags) {
      eventPromises.push(...await fetchEventsByTag(filters.tags));
    }
    const fetchedEvents = await Promise.all(eventPromises);
    events = filterEvents(fetchedEvents.filter((event) => event !== null), filters);
  } catch (error) {
    console.error(`Error retrieving events from R2:`, error);
  }
  return events;
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
    return withConnectionLimit(async () => {
      const response = await fetch(eventUrl);
      if (!response.ok)
        return null;
      const data = await response.text();
      return JSON.parse(data);
    });
  } catch (error) {
    console.error(`Error fetching event with ID ${id}:`, error);
    return null;
  }
}
async function fetchEventsByKind(kinds, limit = 25) {
  const promises = [];
  for (const kind of kinds) {
    const kindCountKey = `counts/kind_count_${kind}`;
    const kindCountResponse = await withConnectionLimit(() => relayDb.get(kindCountKey));
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
    const pubkeyCountResponse = await withConnectionLimit(() => relayDb.get(pubkeyCountKey));
    const pubkeyCountValue = pubkeyCountResponse ? await pubkeyCountResponse.text() : "0";
    const pubkeyCount = parseInt(pubkeyCountValue, 10);
    for (let i = pubkeyCount; i >= Math.max(1, pubkeyCount - limit + 1); i--) {
      const pubkeyKey = `pubkeys/pubkey-${author}:${i}`;
      promises.push(fetchEventByKey(pubkeyKey));
    }
  }
  return promises;
}
async function fetchEventsByTag(tags, limit = 25) {
  const promises = [];
  for (const [tagName, tagValue] of tags) {
    const tagCountKey = `counts/${tagName}_count_${tagValue}`;
    const tagCountResponse = await withConnectionLimit(() => relayDb.get(tagCountKey));
    const tagCountValue = tagCountResponse ? await tagCountResponse.text() : "0";
    const tagCount = parseInt(tagCountValue, 10);
    for (let i = tagCount; i >= Math.max(1, tagCount - limit + 1); i--) {
      const tagKey = `tags/${tagName}-${tagValue}:${i}`;
      promises.push(fetchEventByKey(tagKey));
    }
  }
  return promises;
}
async function fetchEventByKey(eventKey) {
  const eventUrl = `https://${r2BucketDomain}/${eventKey}`;
  try {
    return withConnectionLimit(async () => {
      const response = await fetch(eventUrl);
      if (!response.ok)
        return null;
      const data = await response.text();
      return JSON.parse(data);
    });
  } catch (error) {
    console.error(`Error fetching event with key ${eventKey}:`, error);
    return null;
  }
}
function filterEvents(events, filters) {
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
