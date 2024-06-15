import { reqRateLimiter, sendError } from '../utils/rateLimiter.mjs';
import { relayCache, generateSubscriptionCacheKey } from '../utils/cache.mjs';

export async function processReq(message, server, env) {
  if (!reqRateLimiter.removeToken()) {
    sendError(server, "Rate limit exceeded. Please try again later.");
    return;
  }

  const subscriptionId = message[1];
  const filters = message[2] || {};

  let query = "SELECT * FROM events WHERE 1=1";
  const params = [];

  if (filters.ids) {
    query += " AND id IN (?)";
    params.push(filters.ids.join(','));
  }

  if (filters.kinds) {
    query += " AND kind IN (?)";
    params.push(filters.kinds.join(','));
  }

  if (filters.authors) {
    query += " AND pubkey IN (?)";
    params.push(filters.authors.join(','));
  }

  if (filters.since) {
    query += " AND created_at >= ?";
    params.push(filters.since);
  }

  if (filters.until) {
    query += " AND created_at <= ?";
    params.push(filters.until);
  }

  try {
    const events = await env.relayDb.prepare(query)
      .bind(...params)
      .all();

    for (const event of events.results) {
      server.send(JSON.stringify(["EVENT", subscriptionId, event]));
    }

    server.send(JSON.stringify(["EOSE", subscriptionId]));

  } catch (error) {
    console.error(`Error processing REQ message:`, error);
    sendError(server, `Error processing REQ message: ${error.message}`);
  }
}