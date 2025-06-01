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
function getBestCompoundKeyPrefix(filters) {
  const hasTime = filters.since || filters.until;
  const hasAuthors = filters.authors && filters.authors.length > 0;
  const hasKinds = filters.kinds && filters.kinds.length > 0;
  const hasTags = filters["#e"] || filters["#p"] || filters["#a"] || filters["#t"];
  if (hasAuthors && hasKinds && hasTime) {
    return {
      type: "author-kind-time",
      prefixes: filters.authors.flatMap(
        (author) => filters.kinds.map(
          (kind) => `compound/author-${author}-kind-${kind}/time/`
        )
      )
    };
  }
  if (hasAuthors && hasTags && hasTime) {
    const tagFilters = [];
    ["#e", "#p", "#a", "#t"].forEach((tagKey) => {
      if (filters[tagKey]) {
        const tagName = tagKey.substring(1);
        filters[tagKey].forEach((tagValue) => {
          filters.authors.forEach((author) => {
            tagFilters.push(`compound/author-${author}-tag-${tagName}-${tagValue}/time/`);
          });
        });
      }
    });
    return { type: "author-tag-time", prefixes: tagFilters };
  }
  if (hasKinds && hasTags && hasTime) {
    const tagFilters = [];
    ["#e", "#p", "#a", "#t"].forEach((tagKey) => {
      if (filters[tagKey]) {
        const tagName = tagKey.substring(1);
        filters[tagKey].forEach((tagValue) => {
          filters.kinds.forEach((kind) => {
            tagFilters.push(`compound/kind-${kind}-tag-${tagName}-${tagValue}/time/`);
          });
        });
      }
    });
    return { type: "kind-tag-time", prefixes: tagFilters };
  }
  if (hasAuthors && hasTime) {
    return {
      type: "author-time",
      prefixes: filters.authors.map((author) => `compound/author-${author}/time/`)
    };
  }
  if (hasKinds && hasTime) {
    return {
      type: "kind-time",
      prefixes: filters.kinds.map((kind) => `compound/kind-${kind}/time/`)
    };
  }
  if (hasTags && hasTime) {
    const tagFilters = [];
    ["#e", "#p", "#a", "#t"].forEach((tagKey) => {
      if (filters[tagKey]) {
        const tagName = tagKey.substring(1);
        filters[tagKey].forEach((tagValue) => {
          tagFilters.push(`compound/tag-${tagName}-${tagValue}/time/`);
        });
      }
    });
    return { type: "tag-time", prefixes: tagFilters };
  }
  if (hasTime) {
    return { type: "time", prefixes: ["compound/time/"] };
  }
  return null;
}
async function fetchEventsByCompoundKey(prefix, since, until, limit = 50) {
  const events = [];
  const eventIds = /* @__PURE__ */ new Set();
  const sinceTs = since ? since.toString().padStart(10, "0") : "0000000000";
  const untilTs = until ? until.toString().padStart(10, "0") : "9999999999";
  try {
    const options = {
      prefix,
      limit: Math.min(limit * 2, 1e3)
    };
    if (since) {
      options.cursor = `${prefix}${sinceTs}`;
    }
    console.log(`Listing R2 objects with prefix: ${prefix}, cursor: ${options.cursor || "none"}`);
    const listed = await withConnectionLimit(() => relayDb.list(options));
    console.log(`Found ${listed.objects.length} objects for prefix: ${prefix}`);
    for (const object of listed.objects) {
      const timePart = object.key.split("/time/")[1];
      if (!timePart) continue;
      const [timestamp, eventId] = timePart.split(":");
      if (timestamp > untilTs) break;
      if (timestamp >= sinceTs && timestamp <= untilTs) {
        if (!eventIds.has(eventId)) {
          eventIds.add(eventId);
          const eventUrl = `https://${r2BucketDomain}/${object.key}`;
          const eventResponse = await withConnectionLimit(() => fetch(eventUrl));
          if (eventResponse.ok) {
            const eventText = await eventResponse.text();
            const event = JSON.parse(eventText);
            if (event) {
              events.push(event);
              if (events.length >= limit) break;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching events by compound key ${prefix}:`, error);
  }
  console.log(`Returning ${events.length} events for prefix: ${prefix}`);
  return events;
}
async function processReq(subscriptionId, filters) {
  console.log(`Processing request for subscription ID: ${subscriptionId}`);
  let events = [];
  const compoundKeyInfo = getBestCompoundKeyPrefix(filters);
  if (compoundKeyInfo) {
    console.log(`Using optimized compound key query: ${compoundKeyInfo.type}`);
    const promises = compoundKeyInfo.prefixes.map(
      (prefix) => fetchEventsByCompoundKey(
        prefix,
        filters.since,
        filters.until,
        filters.limit || 50
      )
    );
    const results = await Promise.all(promises);
    const allEvents = results.flat();
    const eventMap = /* @__PURE__ */ new Map();
    allEvents.forEach((event) => {
      if (!eventMap.has(event.id)) {
        eventMap.set(event.id, event);
      }
    });
    events = Array.from(eventMap.values());
  } else {
    const eventPromises = [];
    if (filters.ids) {
      console.log(`Fetching events by IDs: ${filters.ids}`);
      eventPromises.push(...fetchEventsById(filters.ids));
    }
    if (filters.kinds) {
      console.log(`Fetching events by kinds: ${filters.kinds}`);
      eventPromises.push(...await fetchEventsByKind(filters.kinds, filters.limit));
    }
    if (filters.authors) {
      console.log(`Fetching events by authors: ${filters.authors}`);
      eventPromises.push(...await fetchEventsByAuthor(filters.authors, filters.limit));
    }
    const tagPromises = [];
    ["#e", "#p", "#a", "#t"].forEach((tagKey) => {
      if (filters[tagKey]) {
        const tagName = tagKey.substring(1);
        filters[tagKey].forEach((tagValue) => {
          console.log(`Fetching events by tag: ${tagName}=${tagValue}`);
          tagPromises.push(...fetchEventsByTag([[tagName, tagValue]], filters.limit));
        });
      }
    });
    if (tagPromises.length > 0) {
      eventPromises.push(...await Promise.all(tagPromises.flat()));
    }
    const fetchedEvents = await Promise.all(eventPromises);
    events = fetchedEvents.filter((event) => event !== null);
  }
  console.log(`Fetched ${events.length} events, applying final filters...`);
  events = filterEventsComplete(events, filters);
  events.sort((a, b) => b.created_at - a.created_at);
  if (filters.limit) {
    events = events.slice(0, filters.limit);
  }
  console.log(`Returning ${events.length} filtered events.`);
  return events;
}
function filterEventsComplete(events, filters) {
  return events.filter((event) => {
    if (filters.ids && !filters.ids.includes(event.id)) return false;
    if (filters.kinds && !filters.kinds.includes(event.kind)) return false;
    if (filters.authors && !filters.authors.includes(event.pubkey)) return false;
    if (filters.since && event.created_at < filters.since) return false;
    if (filters.until && event.created_at > filters.until) return false;
    const tagFilters = ["#e", "#p", "#a", "#t"];
    for (const filterKey of tagFilters) {
      if (filters[filterKey]) {
        const tagName = filterKey.substring(1);
        const eventTagValues = event.tags.filter((tag) => tag[0] === tagName).map((tag) => tag[1]);
        const hasMatch = filters[filterKey].some(
          (filterValue) => eventTagValues.includes(filterValue)
        );
        if (!hasMatch) return false;
      }
    }
    return true;
  });
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
