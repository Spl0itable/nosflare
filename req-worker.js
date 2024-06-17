// REQ helper worker

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
        const { type, subscriptionId, filters } = await request.json();
        if (type === 'REQ') {
            const events = await processReq(subscriptionId, filters);
            return new Response(JSON.stringify(events), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response("Invalid request type", { status: 400 });
        }
    } catch (error) {
        console.error("Error processing POST request:", error);
        return new Response(`Error processing request: ${error.message}`, { status: 500 });
    }
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
function generateSubscriptionCacheKey(filters) {
    const filterKeys = Object.keys(filters).sort();
    const cacheKey = filterKeys.map(key => {
        let value = filters[key];
        if (Array.isArray(value)) {
            if (key === 'kinds' || key === 'authors' || key === 'ids' ||
                key.startsWith('#') && /^#[a-zA-Z]$/.test(key)) {
                value = value.sort().join(',');
            } else {
                value = value.sort();
            }
        }
        value = Array.isArray(value) ? value.join(',') : String(value);
        return `${key}:${value}`;
    }).join('|');
    return `subscription:${cacheKey}`;
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
const reqRateLimiter = new rateLimiter(100 / 60000, 100); // 100 reqs per min

// Handles REQ message
async function processReq(subscriptionId, filters) {
    if (!reqRateLimiter.removeToken()) {
        throw new Error("Rate limit exceeded. Please try again later.");
    }
    const cacheKey = generateSubscriptionCacheKey(filters);
    let events = [];
    if (filters.ids) {
        for (const id of filters.ids) {
            if (!/^[a-f0-9]{64}$/.test(id)) {
                throw new Error(`Invalid event ID format: ${id}`);
            }
        }
    }
    if (filters.authors) {
        for (const author of filters.authors) {
            if (!/^[a-f0-9]{64}$/.test(author)) {
                throw new Error(`Invalid author pubkey format: ${author}`);
            }
        }
    }
    let cachedEvents = relayCache.get(cacheKey);
    if (cachedEvents) {
        events = cachedEvents;
    } else {
        try {
            const eventPromises = [];
            if (filters.ids) {
                for (const id of filters.ids.slice(0, 100)) {
                    const idKey = `events/event:${id}`;
                    const eventUrl = `${customDomain}/${idKey}`;
                    eventPromises.push(
                        fetch(eventUrl).then((response) => {
                            if (response.ok) {
                                return response.text().then((data) => {
                                    try {
                                        return JSON.parse(data);
                                    } catch (error) {
                                        console.error(`Malformed JSON for event with ID ${id}:`, error);
                                        return null;
                                    }
                                });
                            } else if (response.status === 404) {
                                return null;
                            } else {
                                response.body.cancel();
                                throw new Error(`Error fetching event with ID ${id} from URL: ${eventUrl}. Status: ${response.status}`);
                            }
                        }).catch((error) => {
                            console.error(`Error fetching event with ID ${id} from URL: ${eventUrl}.`, error);
                            return null;
                        })
                    );
                }
            }
            if (filters.kinds) {
                for (const kind of filters.kinds) {
                    const kindCountKey = `count/kind_count_${kind}`;
                    const kindCountUrl = `${customDomain}/${kindCountKey}`;
                    const kindCountResponse = await fetch(kindCountUrl);
                    const kindCountValue = kindCountResponse.ok ? await kindCountResponse.text() : '0';
                    const kindCount = parseInt(kindCountValue, 10);
                    for (let i = kindCount; i >= Math.max(1, kindCount - 100 + 1); i--) {
                        const kindKey = `kinds/kind-${kind}:${i}`;
                        const eventUrl = `${customDomain}/${kindKey}`;
                        eventPromises.push(
                            fetch(eventUrl).then((response) => {
                                if (response.ok) {
                                    return response.text().then((data) => {
                                        try {
                                            return JSON.parse(data);
                                        } catch (error) {
                                            console.error(`Malformed JSON for event with kind ${kind}:`, error);
                                            return null;
                                        }
                                    });
                                } else if (response.status === 404) {
                                    return null;
                                } else {
                                    response.body.cancel();
                                    throw new Error(`Error fetching event for kind ${kind} from URL: ${eventUrl}. Status: ${response.status}`);
                                }
                            }).catch((error) => {
                                console.error(`Error fetching event for kind ${kind} from URL: ${eventUrl}.`, error);
                                return null;
                            })
                        );
                    }
                }
            }
            if (filters.authors) {
                for (const author of filters.authors) {
                    const pubkeyCountKey = `count/pubkey_count_${author}`;
                    const pubkeyCountUrl = `${customDomain}/${pubkeyCountKey}`;
                    const pubkeyCountResponse = await fetch(pubkeyCountUrl);
                    const pubkeyCountValue = pubkeyCountResponse.ok ? await pubkeyCountResponse.text() : '0';
                    const pubkeyCount = parseInt(pubkeyCountValue, 10);
                    for (let i = pubkeyCount; i >= Math.max(1, pubkeyCount - 100 + 1); i--) {
                        const pubkeyKey = `pubkeys/pubkey-${author}:${i}`;
                        const eventUrl = `${customDomain}/${pubkeyKey}`;
                        eventPromises.push(
                            fetch(eventUrl).then((response) => {
                                if (response.ok) {
                                    return response.text().then((data) => {
                                        try {
                                            return JSON.parse(data);
                                        } catch (error) {
                                            console.error(`Malformed JSON for event with author ${author}:`, error);
                                            return null;
                                        }
                                    });
                                } else if (response.status === 404) {
                                    return null;
                                } else {
                                    response.body.cancel();
                                    throw new Error(`Error fetching event for author ${author} from URL: ${eventUrl}. Status: ${response.status}`);
                                }
                            }).catch((error) => {
                                console.error(`Error fetching event for author ${author} from URL: ${eventUrl}.`, error);
                                return null;
                            })
                        );
                    }
                }
            }
            const tagQueries = Array.from({ length: 26 }, (_, i) => ({
                key: String.fromCharCode(97 + i),
                label: String.fromCharCode(97 + i),
            })).concat(
                Array.from({ length: 26 }, (_, i) => ({
                    key: String.fromCharCode(65 + i),
                    label: String.fromCharCode(65 + i),
                }))
            );
            for (const query of tagQueries) {
                if (filters[`#${query.key}`]) {
                    for (const tag of filters[`#${query.key}`]) {
                        const tagCountKey = `count/${query.label}_count_${tag}`;
                        const tagCountUrl = `${customDomain}/${tagCountKey}`;
                        const tagCountResponse = await fetch(tagCountUrl);
                        const tagCountValue = tagCountResponse.ok ? await tagCountResponse.text() : '0';
                        const tagCount = parseInt(tagCountValue, 10);
                        for (let i = tagCount; i >= Math.max(1, tagCount - 100 + 1); i--) {
                            const tagKey = `tags/${query.label}-${tag}:${i}`;
                            const eventUrl = `${customDomain}/${tagKey}`;
                            eventPromises.push(
                                fetch(eventUrl).then((response) => {
                                    if (response.ok) {
                                        return response.text().then((data) => {
                                            try {
                                                return JSON.parse(data);
                                            } catch (error) {
                                                console.error(`Malformed JSON for event with ${query.label} tag ${tag}:`, error);
                                                return null;
                                            }
                                        });
                                    } else if (response.status === 404) {
                                        return null;
                                    } else {
                                        response.body.cancel();
                                        throw new Error(`Error fetching event for ${query.label} tag ${tag} from URL: ${eventUrl}. Status: ${response.status}`);
                                    }
                                }).catch((error) => {
                                    console.error(`Error fetching event for ${query.label} tag ${tag} from URL: ${eventUrl}.`, error);
                                    return null;
                                })
                            );
                        }
                    }
                }
            }
            const fetchedEvents = await Promise.all(eventPromises);
            events = fetchedEvents.filter((event) => event !== null);
            events = events.filter((event) => {
                const includeEvent = (!filters.ids || filters.ids.includes(event.id)) &&
                    (!filters.kinds || filters.kinds.includes(event.kind)) &&
                    (!filters.authors || filters.authors.includes(event.pubkey)) &&
                    (!filters.since || event.created_at >= filters.since) &&
                    (!filters.until || event.created_at <= filters.until);
                const tagFilters = Object.entries(filters).filter(([key]) => key.startsWith('#'));
                for (const [tagKey, tagValues] of tagFilters) {
                    const tagName = tagKey.slice(1);
                    const eventTags = event.tags.filter(([t]) => t === tagName).map(([, v]) => v);
                    if (!tagValues.some((value) => eventTags.includes(value))) {
                        return false;
                    }
                }
                return includeEvent;
            });
            relayCache.set(cacheKey, events);
        } catch (error) {
            console.error(`Error retrieving events from R2:`, error);
            events = [];
        }
    }
    return events;
}