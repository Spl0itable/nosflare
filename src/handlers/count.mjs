import { reqRateLimiter, sendError } from '../utils/rateLimiter.mjs';

export async function processCount(message, server, env) {
  if (!reqRateLimiter.removeToken()) {
    sendError(server, "Rate limit exceeded. Please try again later.");
    return;
  }

  const subscriptionId = message[1];
  const filters = message[2] || {};

  let query = "SELECT COUNT(*) as count FROM events WHERE 1=1";
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
    const result = await env.relayDb.prepare(query)
      .bind(...params)
      .first();

    const count = result ? result.count : 0;
    server.send(JSON.stringify(["COUNT", subscriptionId, { count }]));

  } catch (error) {
    console.error(`Error processing COUNT message:`, error);
    sendError(server, `Error processing COUNT message: ${error.message}`);
  }
}