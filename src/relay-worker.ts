/**
 * Relay Worker - Main relay functionality and landing page
 */

import { schnorr } from "@noble/curves/secp256k1";
import { pack } from 'msgpackr';
import { Env, NostrEvent, NostrFilter, QueryResult, NostrMessage, Nip05Response, EventToIndex, BroadcastQueueMessage, R2ArchiveQueueMessage } from './types';
import * as config from './config';

const DEBUG = false;

const {
  relayInfo,
  PAY_TO_RELAY_ENABLED,
  RELAY_ACCESS_PRICE_SATS,
  relayNpub,
  nip05Users,
  checkValidNip05,
  blockedNip05Domains,
  allowedNip05Domains,
  MAX_TIME_WINDOWS_PER_QUERY,
  CONNECTION_DO_SHARDING_ENABLED,
} = config;

const GLOBAL_MAX_EVENTS = 1000;
const MAX_QUERY_COMPLEXITY = 1000;

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

type ProcessedFilter = NostrFilter & { since: number; until: number };

async function verifyEventSignature(event: NostrEvent): Promise<boolean> {
  try {
    const signatureBytes = hexToBytes(event.sig);
    const serializedEventData = serializeEventForSigning(event);
    const messageHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(serializedEventData)
    );
    const messageHash = new Uint8Array(messageHashBuffer);
    const publicKeyBytes = hexToBytes(event.pubkey);
    return schnorr.verify(signatureBytes, messageHash, publicKeyBytes);
  } catch (error) {
    console.error("Error verifying event signature:", error);
    return false;
  }
}

function serializeEventForSigning(event: NostrEvent): string {
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

function hexToBytes(hexString: string): Uint8Array {
  if (hexString.length % 2 !== 0) throw new Error("Invalid hex string");
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function hasPaidForRelay(pubkey: string, env: Env): Promise<boolean> {
  if (!PAY_TO_RELAY_ENABLED) return true;

  try {
    const { hasPaidForRelay: checkPayment } = await import('./payment-router');
    return await checkPayment(pubkey, env);
  } catch (error) {
    console.error(`Error checking paid status for ${pubkey}:`, error);
    return false;
  }
}

async function savePaidPubkey(pubkey: string, env: Env): Promise<boolean> {
  try {
    const { recordPayment } = await import('./payment-router');
    const success = await recordPayment(pubkey, RELAY_ACCESS_PRICE_SATS, env);

    if (success) {
      console.log(`Payment recorded for pubkey: ${pubkey}`);
    } else {
      console.error(`Failed to record payment for pubkey: ${pubkey}`);
    }

    return success;
  } catch (error) {
    console.error(`Error saving paid pubkey ${pubkey}:`, error);
    return false;
  }
}

function fetchEventFromFallbackRelay(pubkey: string): Promise<NostrEvent | null> {
  return new Promise((resolve, reject) => {
    const fallbackRelayUrl = 'wss://relay.nostr.band';
    const ws = new WebSocket(fallbackRelayUrl);
    let hasClosed = false;

    const closeWebSocket = (subscriptionId: string | null) => {
      if (!hasClosed && ws.readyState === WebSocket.OPEN) {
        if (subscriptionId) {
          ws.send(JSON.stringify(["CLOSE", subscriptionId]));
        }
        ws.close();
        hasClosed = true;
        console.log('WebSocket connection to fallback relay closed');
      }
    };

    ws.addEventListener('open', () => {
      console.log("WebSocket connection to fallback relay opened.");
      const subscriptionId = Math.random().toString(36).substr(2, 9);
      const filters = {
        kinds: [0],
        authors: [pubkey],
        limit: 1
      };
      const reqMessage = JSON.stringify(["REQ", subscriptionId, filters]);
      ws.send(reqMessage);
    });

    ws.addEventListener('message', event => {
      try {
        const message = JSON.parse(event.data) as NostrMessage;

        if (message[0] === "EVENT" && message[1]) {
          const eventData = message[2];
          if (eventData.kind === 0 && eventData.pubkey === pubkey) {
            console.log("Received kind 0 event from fallback relay.");
            closeWebSocket(message[1]);
            resolve(eventData);
          }
        }

        else if (message[0] === "EOSE") {
          console.log("EOSE received from fallback relay, no kind 0 event found.");
          closeWebSocket(message[1]);
          resolve(null);
        }
      } catch (error) {
        console.error(`Error processing fallback relay event for pubkey ${pubkey}: ${error}`);
        reject(error);
      }
    });

    ws.addEventListener('error', (error: Event) => {
      console.error(`WebSocket error with fallback relay:`, error);
      ws.close();
      hasClosed = true;
      reject(error);
    });

    ws.addEventListener('close', () => {
      hasClosed = true;
      console.log('Fallback relay WebSocket connection closed.');
    });

    setTimeout(() => {
      if (!hasClosed) {
        console.log('Timeout reached. Closing WebSocket connection to fallback relay.');
        closeWebSocket(null);
        reject(new Error(`No response from fallback relay for pubkey ${pubkey}`));
      }
    }, 5000);
  });
}

async function fetchKind0EventForPubkey(pubkey: string, env: Env): Promise<NostrEvent | null> {
  try {
    const filters = [{ kinds: [0], authors: [pubkey], limit: 1 }];
    const result = await queryEvents(filters, env);

    if (result.events && result.events.length > 0) {
      return result.events[0];
    }

    console.log(`No kind 0 event found locally, trying fallback relay: wss://relay.nostr.band`);
    const fallbackEvent = await fetchEventFromFallbackRelay(pubkey);
    if (fallbackEvent) {
      return fallbackEvent;
    }
  } catch (error) {
    console.error(`Error fetching kind 0 event for pubkey ${pubkey}: ${error}`);
  }

  return null;
}

async function validateNIP05FromKind0(pubkey: string, env: Env): Promise<boolean> {
  try {
    const metadataEvent = await fetchKind0EventForPubkey(pubkey, env);

    if (!metadataEvent) {
      console.error(`No kind 0 metadata event found for pubkey: ${pubkey}`);
      return false;
    }

    const metadata = JSON.parse(metadataEvent.content);
    const nip05Address = metadata.nip05;

    if (!nip05Address) {
      console.error(`No NIP-05 address found in kind 0 for pubkey: ${pubkey}`);
      return false;
    }

    const isValid = await validateNIP05(nip05Address, pubkey);
    return isValid;

  } catch (error) {
    console.error(`Error validating NIP-05 for pubkey ${pubkey}: ${error}`);
    return false;
  }
}

async function validateNIP05(nip05Address: string, pubkey: string): Promise<boolean> {
  try {
    const [name, domain] = nip05Address.split('@');

    if (!domain) {
      throw new Error(`Invalid NIP-05 address format: ${nip05Address}`);
    }

    if (blockedNip05Domains.has(domain)) {
      console.error(`NIP-05 domain is blocked: ${domain}`);
      return false;
    }

    if (allowedNip05Domains.size > 0 && !allowedNip05Domains.has(domain)) {
      console.error(`NIP-05 domain is not allowed: ${domain}`);
      return false;
    }

    const url = `https://${domain}/.well-known/nostr.json?name=${name}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch NIP-05 data from ${url}: ${response.statusText}`);
      return false;
    }

    const nip05Data = await response.json() as Nip05Response;

    if (!nip05Data.names || !nip05Data.names[name]) {
      console.error(`NIP-05 data does not contain a matching public key for ${name}`);
      return false;
    }

    const nip05Pubkey = nip05Data.names[name];
    return nip05Pubkey === pubkey;

  } catch (error) {
    console.error(`Error validating NIP-05 address: ${error}`);
    return false;
  }
}

function calculateQueryComplexity(filter: NostrFilter): number {
  let complexity = 0;

  complexity += (filter.ids?.length || 0) * 1;
  complexity += (filter.authors?.length || 0) * 2;
  complexity += (filter.kinds?.length || 0) * 5;

  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith('#') && Array.isArray(values)) {
      complexity += values.length * 10;
    }
  }

  if (!filter.since && !filter.until) {
    complexity *= 2;
  }

  if ((filter.limit || 0) > 1000) {
    complexity *= 1.5;
  }

  return complexity;
}

async function processEvent(event: NostrEvent, sessionId: string, env: Env): Promise<{ success: boolean; message: string }> {
  try {
    if (event.kind !== 1059 && checkValidNip05 && event.kind !== 0) {
      const isValidNIP05 = await validateNIP05FromKind0(event.pubkey, env);
      if (!isValidNIP05) {
        console.error(`Event denied. NIP-05 validation failed for pubkey ${event.pubkey}.`);
        return { success: false, message: "invalid: NIP-05 validation failed" };
      }
    }

    if (event.kind === 5) {
      return await processDeletionEvent(event, env);
    }

    return await queueEvent(event, env);

  } catch (error: any) {
    console.error(`Error processing event: ${error.message}`);
    return { success: false, message: `error: ${error.message}` };
  }
}

let queueLatencySum = 0;
let queueLatencyCount = 0;
let lastBackpressureWarning = 0;
const BACKPRESSURE_LATENCY_THRESHOLD_MS = 500;
const BACKPRESSURE_WARNING_INTERVAL_MS = 60000;
const BACKPRESSURE_SAMPLE_SIZE = 100;

async function queueEvent(event: NostrEvent, env: Env): Promise<{ success: boolean; message: string }> {
  try {
    const cache = caches.default;
    const cacheKey = new Request(`https://event-cache/${event.id}`);

    const cached = await cache.match(cacheKey);
    if (cached) {
      return { success: false, message: "duplicate: event already exists" };
    }

    await cache.put(cacheKey, new Response('cached', {
      headers: {
        'Cache-Control': 'max-age=3600'
      }
    }));

    const eventData = {
      event,
      timestamp: Date.now()
    };

    const shardNum = Math.abs(hashCode(event.id)) % 50;

    const queueStartTime = Date.now();

    const queueReplicas = ['PRIMARY', 'REPLICA_ENAM', 'REPLICA_WEUR', 'REPLICA_APAC'];
    const selectedQueueIndex = Math.abs(hashCode(event.id + 'queue')) % 4;
    const selectedQueue = queueReplicas[selectedQueueIndex];
    const queueName = `INDEXING_QUEUE_${selectedQueue}_${shardNum}`;

    try {
      await (env as any)[queueName].send(eventData);
      const queueLatency = Date.now() - queueStartTime;

      queueLatencySum += queueLatency;
      queueLatencyCount++;

      if (queueLatencyCount > BACKPRESSURE_SAMPLE_SIZE) {
        queueLatencySum = (queueLatencySum / queueLatencyCount) * BACKPRESSURE_SAMPLE_SIZE;
        queueLatencyCount = BACKPRESSURE_SAMPLE_SIZE;
      }

      const avgLatency = queueLatencySum / queueLatencyCount;
      if (avgLatency > BACKPRESSURE_LATENCY_THRESHOLD_MS) {
        const now = Date.now();
        if (now - lastBackpressureWarning > BACKPRESSURE_WARNING_INTERVAL_MS) {
          console.warn(
            `BACKPRESSURE DETECTED: Average queue latency ${avgLatency.toFixed(0)}ms ` +
            `exceeds threshold ${BACKPRESSURE_LATENCY_THRESHOLD_MS}ms. ` +
            `Queues may be backing up. Consider scaling or rate limiting.`
          );
          lastBackpressureWarning = now;
        }
      }
    } catch (err) {
      console.error(`Failed to send event ${event.id} to queues:`, err);
    }

    if (DEBUG) console.log(`Event ${event.id} (kind ${event.kind}) queued to shard ${shardNum} (4 replicas)`);
    return { success: true, message: "Event received and queued for indexing" };

  } catch (error: any) {
    console.error(`Error queueing event: ${error.message}`);
    console.error(`Event details: ID=${event.id}, Tags count=${event.tags.length}`);
    return { success: false, message: "error: could not queue event" };
  }
}

async function processDeletionEvent(event: NostrEvent, env: Env): Promise<{ success: boolean; message: string }> {
  if (DEBUG) console.log(`Processing deletion event ${event.id}`);
  const deletedEventIds = event.tags.filter(tag => tag[0] === "e").map(tag => tag[1]);

  if (deletedEventIds.length === 0) {
    return { success: true, message: "No events to delete" };
  }

  let deletedCount = 0;
  const errors: string[] = [];

  if (env.NOSTR_ARCHIVE) {
    const r2Promises = deletedEventIds.map(eventId => {
      const eventPath = `events/raw/${eventId}.json`;
      return env.NOSTR_ARCHIVE.get(eventPath).then(obj => ({ eventId, eventPath, obj }));
    });

    const r2Results = await Promise.all(r2Promises);

    const { getEventShardId, getAllReplicaShardIds } = await import('./shard-router');

    for (const { eventId, eventPath, obj: r2Object } of r2Results) {
      try {
        if (r2Object) {
          const existingEvent = JSON.parse(await r2Object.text()) as NostrEvent;

          if (existingEvent.pubkey !== event.pubkey) {
            console.warn(`Event ${eventId} does not belong to pubkey ${event.pubkey}. Skipping deletion.`);
            errors.push(`unauthorized: cannot delete event ${eventId}`);
            continue;
          }

          await env.NOSTR_ARCHIVE.delete(eventPath);

          const baseShardId = getEventShardId(existingEvent);
          const replicaShardIds = getAllReplicaShardIds(baseShardId);

          const deletePromises = replicaShardIds.map(async (replicaShardId) => {
            try {
              const shardStub = env.EVENT_SHARD_DO.get(env.EVENT_SHARD_DO.idFromName(replicaShardId));
              const response = await shardStub.fetch('https://internal/delete-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/msgpack' },
                body: pack({ eventIds: [eventId] })
              });

              if (response.ok) {
                if (DEBUG) console.log(`Event ${eventId} deleted from replica ${replicaShardId}`);
                return true;
              } else {
                console.warn(`Failed to delete event ${eventId} from replica ${replicaShardId}: ${response.status}`);
                return false;
              }
            } catch (error: any) {
              console.error(`Error deleting from replica ${replicaShardId}:`, error.message);
              return false;
            }
          });

          const deleteResults = await Promise.all(deletePromises);
          const successCount = deleteResults.filter(r => r).length;

          if (successCount > 0) {
            deletedCount++;
            if (DEBUG) console.log(`Event ${eventId} deleted from R2 and ${successCount}/${replicaShardIds.length} replicas`);
          } else {
            console.warn(`Failed to delete event ${eventId} from all replicas`);
          }
        } else {
          console.warn(`Event ${eventId} not found in R2, skipping`);
        }
      } catch (error: any) {
        console.error(`Error deleting event ${eventId}:`, error);
        errors.push(`error deleting ${eventId}: ${error.message}`);
      }
    }
  }

  await queueEvent(event, env);

  if (errors.length > 0 && deletedCount === 0) {
    return { success: false, message: errors[0] };
  }

  return {
    success: true,
    message: deletedCount > 0
      ? `Successfully deleted ${deletedCount} event(s)`
      : "No matching events found to delete"
  };
}

async function queryEvents(filters: NostrFilter[], env: Env, subscriptionId?: string): Promise<QueryResult> {
  const normalizedFilters = JSON.stringify(filters.map(f => ({
    ...f,
    since: f.since ? Math.floor(f.since / 60) * 60 : undefined,
    until: f.until ? Math.floor(f.until / 60) * 60 : undefined
  })));
  const cacheKey = new Request(`https://query-cache/${normalizedFilters}`);

  try {
    const cache = caches.default;
    const cached = await cache.match(cacheKey);

    if (cached) {
      const cachedResult = await cached.json() as QueryResult;
      return cachedResult;
    }
  } catch (error) {
    console.error('Error checking cache:', error);
  }

  try {
    const processedFilters = filters.map(filter => {
      const complexity = calculateQueryComplexity(filter);
      if (complexity > MAX_QUERY_COMPLEXITY) {
        console.warn(`Query too complex (complexity: ${complexity}), skipping filter`);
        return null;
      }

      const maxTimeRangeSeconds = MAX_TIME_WINDOWS_PER_QUERY * 24 * 60 * 60;
      const now = Math.floor(Date.now() / 1000);

      let since = filter.since;
      let until = filter.until || now;

      if (!since) {
        const defaultDays = MAX_TIME_WINDOWS_PER_QUERY;
        since = now - (defaultDays * 24 * 60 * 60);
      }

      const requestedRange = until - since;

      if (requestedRange > maxTimeRangeSeconds) {
        since = until - maxTimeRangeSeconds;
      }

      return { ...filter, since, until };
    }).filter((f): f is ProcessedFilter => f !== null);

    if (processedFilters.length === 0) {
      console.warn('All filters were too complex, returning empty result');
      return { events: [] };
    }

    const allEventIds: string[] = [];
    const allShardMapping = new Map<string, string[]>();

    const { queryShards } = await import('./shard-router');

    const filterPromises = processedFilters.map(async (filter) => {
      return await queryShards(env, filter, subscriptionId);
    });

    const filterResults = await Promise.all(filterPromises);

    const seen = new Set<string>();
    const events: NostrEvent[] = [];
    for (const result of filterResults) {
      for (const id of result.eventIds) {
        if (!seen.has(id)) {
          seen.add(id);
          allEventIds.push(id);
        }
      }
      for (const event of result.events || []) {
        if (event && !events.find(e => e.id === event.id)) {
          events.push(event);
        }
      }
      for (const [shardId, eventIds] of result.shardMapping.entries()) {
        const existing = allShardMapping.get(shardId) || [];
        const combined = new Set([...existing, ...eventIds]);
        allShardMapping.set(shardId, Array.from(combined));
      }
    }

    events.sort((a, b) => b.created_at - a.created_at);

    const requestedLimit = processedFilters.reduce((max, filter) => {
      const filterLimit = filter.limit ?? GLOBAL_MAX_EVENTS;
      return Math.max(max, filterLimit);
    }, 0);

    const finalLimit = Math.min(requestedLimit, GLOBAL_MAX_EVENTS);
    const limitedEvents = events.slice(0, finalLimit);

    const result: QueryResult = { events: limitedEvents };

    try {
      const cache = caches.default;
      cache.put(cacheKey, new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        }
      })).catch(err => console.error('Failed to cache query result:', err));
    } catch (error) {
      console.error('Error caching query result:', error);
    }

    return result;

  } catch (error: any) {
    console.error(`[ShardedCFNDB] Query error: ${error.message}`);
    return { events: [] };
  }
}

async function processIndexingQueue(batch: MessageBatch<EventToIndex>, env: Env): Promise<void> {
  if (DEBUG) console.log(`Processing indexing queue batch: ${batch.messages.length} events`);

  const startTime = Date.now();

  const events = batch.messages.map(m => m.body.event);

  try {
    await indexEventsInCFNDB(env, events);

    batch.messages.forEach(m => m.ack());

    const duration = Date.now() - startTime;
    if (DEBUG) console.log(`Indexing queue batch completed: ${events.length} events indexed in ${duration}ms (batched)`);
  } catch (error: any) {
    console.error(`Failed to index batch:`, error.message);
    batch.messages.forEach(m => m.retry());
  }
}

export {
  verifyEventSignature,
  hasPaidForRelay,
  processEvent,
  queryEvents
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === 'POST' && url.searchParams.has('notify-zap') && PAY_TO_RELAY_ENABLED) {
        return await handlePaymentNotification(request, env);
      }

      if (url.pathname === "/api/check-payment" && PAY_TO_RELAY_ENABLED) {
        return await handleCheckPayment(request, env);
      }

      if (url.pathname === "/") {
        if (request.headers.get("Upgrade") === "websocket") {
          const doId = CONNECTION_DO_SHARDING_ENABLED
            ? env.CONNECTION_DO.newUniqueId()
            : env.CONNECTION_DO.idFromName('connection-main');
          const stub = env.CONNECTION_DO.get(doId);
          return stub.fetch(request);
        } else if (request.headers.get("Accept") === "application/nostr+json") {
          return handleRelayInfoRequest(request);
        } else {
          return serveLandingPage();
        }
      } else if (url.pathname === "/.well-known/nostr.json") {
        return handleNIP05Request(url);
      } else if (url.pathname === "/favicon.ico") {
        return await serveFavicon();
      } else {
        return new Response("Invalid request", { status: 400 });
      }
    } catch (error) {
      console.error("Error in fetch handler:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },

  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      const queueName = batch.queue;

      if (queueName.includes('broadcast')) {
        const broadcastConsumer = await import('./broadcast-consumer');
        await broadcastConsumer.default.queue(batch as MessageBatch<BroadcastQueueMessage>, env);
      } else if (queueName.includes('indexing')) {
        await processIndexingQueue(batch as MessageBatch<EventToIndex>, env);
      } else if (queueName.includes('r2-archive')) {
        const r2ArchiveConsumer = await import('./r2-archive-consumer');
        await r2ArchiveConsumer.default.queue(batch as MessageBatch<R2ArchiveQueueMessage>, env);
      } else {
        console.error(`Unknown queue type: ${queueName}`);
      }
    } catch (error) {
      console.error('Queue processing failed:', error);
    }
  }
};

async function indexEventsInCFNDB(env: Env, events: NostrEvent[]): Promise<void> {
  if (!env.EVENT_SHARD_DO) {
    throw new Error('EVENT_SHARD_DO not configured');
  }

  if (events.length === 0) {
    return;
  }

  const persistentEvents = events.filter(e => !(e.kind >= 20000 && e.kind < 30000));
  const ephemeralCount = events.length - persistentEvents.length;

  if (ephemeralCount > 0) {
    if (DEBUG) console.log(`Filtered ${ephemeralCount} ephemeral events (kinds 20000-29999)`);
  }

  if (persistentEvents.length === 0) {
    console.log('All events were ephemeral, nothing to index');
    return;
  }

  const { insertEventsIntoShard, getEventShardId } = await import('./shard-router');

  const eventsByShardId = new Map<string, NostrEvent[]>();

  for (const event of persistentEvents) {
    const shardId = getEventShardId(event);
    if (!eventsByShardId.has(shardId)) {
      eventsByShardId.set(shardId, []);
    }
    eventsByShardId.get(shardId)!.push(event);
  }

  const indexPromises: Promise<any>[] = [];

  for (const [shardId, shardEvents] of eventsByShardId) {
    indexPromises.push(insertEventsIntoShard(env, shardEvents));
  }

  const results = await Promise.all(indexPromises);

  const failedCount = results.filter(r => r === false).length;
  if (failedCount > 0) {
    throw new Error(
      `Replica write failed for ${failedCount}/${results.length} time shards. ` +
      `Event IDs: ${persistentEvents.slice(0, 5).map(e => e.id).join(', ')}${persistentEvents.length > 5 ? '...' : ''}`
    );
  }

  if (env.R2_ARCHIVE_QUEUE && env.NOSTR_ARCHIVE) {
    const archivePromises = persistentEvents.map(event => {
      return env.R2_ARCHIVE_QUEUE.send({
        event,
        timestamp: Date.now()
      });
    });

    try {
      await Promise.all(archivePromises);
      if (DEBUG) console.log(`Queued ${persistentEvents.length} events for R2 archival`);
    } catch (err) {
      console.error(`Failed to queue ${persistentEvents.length} events for R2 archival:`, err);
    }
  }

  if (DEBUG) console.log(`Batch: ${persistentEvents.length} events indexed across ${eventsByShardId.size} time shards (R2 archival queued)`);
}

function handleRelayInfoRequest(request: Request): Response {
  const responseInfo = { ...relayInfo };

  if (PAY_TO_RELAY_ENABLED) {
    const url = new URL(request.url);
    responseInfo.payments_url = `${url.protocol}//${url.host}`;
    responseInfo.fees = {
      admission: [{ amount: RELAY_ACCESS_PRICE_SATS * 1000, unit: "msats" }]
    };
  }

  return new Response(JSON.stringify(responseInfo), {
    status: 200,
    headers: {
      "Content-Type": "application/nostr+json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Allow-Methods": "GET",
    }
  });
}

function serveLandingPage(): Response {
  const payToRelaySection = PAY_TO_RELAY_ENABLED ? `
    <div class="pay-section" id="paySection">
      <p style="margin-bottom: 1rem;">Pay to access this relay:</p>
      <button id="payButton" class="pay-button" data-npub="${relayNpub}" data-relays="wss://relay.damus.io,wss://relay.primal.net,wss://sendit.nosflare.com" data-sats-amount="${RELAY_ACCESS_PRICE_SATS}">
        <img src="https://nosflare.com/images/pwb-button-min.png" alt="Pay with Bitcoin" style="height: 60px;">
      </button>
      <p class="price-info">${RELAY_ACCESS_PRICE_SATS.toLocaleString()} sats</p>
    </div>
    <div class="info-box" id="accessSection" style="display: none;">
      <p style="margin-bottom: 1rem;">Connect your Nostr client to:</p>
      <div class="url-display" onclick="copyToClipboard()" id="relay-url">
      </div>
      <p class="copy-hint">Click to copy</p>
    </div>
  ` : `
    <div class="info-box">
      <p style="margin-bottom: 1rem;">Connect your Nostr client to:</p>
      <div class="url-display" onclick="copyToClipboard()" id="relay-url">
      </div>
      <p class="copy-hint">Click to copy</p>
    </div>
  `;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="A serverless Nostr relay powered by Cloudflare Workers and Durable Objects" />
    <title>Nosflare - Nostr Relay</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #0a0a0a;
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        }

        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at 20% 50%, rgba(255, 69, 0, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 80% 50%, rgba(255, 140, 0, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 50% 100%, rgba(255, 0, 0, 0.05) 0%, transparent 50%);
            animation: pulse 10s ease-in-out infinite;
            z-index: -1;
        }

        @keyframes pulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }

        .container {
            text-align: center;
            padding: 2rem;
            max-width: 600px;
            z-index: 1;
        }

        .logo {
            width: 400px;
            height: auto;
            filter: drop-shadow(0 0 30px rgba(255, 69, 0, 0.5));
        }

        .tagline {
            font-size: 1.2rem;
            color: #999;
            margin-bottom: 3rem;
        }

        .info-box, .pay-section {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
        }

        .pay-button {
            background: none;
            border: none;
            cursor: pointer;
            padding: 0;
            margin: 1rem 0;
            transition: transform 0.3s ease;
        }

        .pay-button:hover {
            transform: scale(1.05);
        }

        .price-info {
            font-size: 1.2rem;
            color: #ff8c00;
            font-weight: 600;
        }

        .url-display {
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 69, 0, 0.3);
            border-radius: 8px;
            padding: 1rem;
            font-family: 'Courier New', monospace;
            font-size: 1.1rem;
            color: #ff8c00;
            margin: 1rem 0;
            word-break: break-all;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .url-display:hover {
            border-color: #ff4500;
            background: rgba(255, 69, 0, 0.1);
        }

        .copy-hint {
            margin-top: 0.5rem;
            font-size: 0.9rem;
            color: #666;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-top: 2rem;
        }

        .stat-item {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 1rem;
        }

        .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #ff4500;
        }

        .stat-label {
            font-size: 0.9rem;
            color: #999;
            margin-top: 0.25rem;
        }

        .links {
            display: flex;
            gap: 2rem;
            justify-content: center;
            margin-top: 2rem;
        }

        .link {
            color: #ff8c00;
            text-decoration: none;
            transition: color 0.3s ease;
        }

        .link:hover {
            color: #ff4500;
        }

        .toast {
            position: fixed;
            bottom: 2rem;
            background: #ff4500;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            transform: translateY(100px);
            transition: transform 0.3s ease;
            z-index: 1000;
        }

        .toast.show {
            transform: translateY(0);
        }

        @media (max-width: 600px) {
            .logo {
                width: 300px;
            }

            .container {
                padding: 1rem;
            }

            .url-display {
                font-size: 0.9rem;
                padding: 0.75rem 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://nosflare.com/images/nosflare.png" alt="Nosflare Logo" class="logo">
        <p class="tagline">A serverless Nostr relay powered by Cloudflare</p>

        ${payToRelaySection}

        <div class="stats">
            <div class="stat-item">
                <div class="stat-value">${config.relayInfo.supported_nips.length}</div>
                <div class="stat-label">Supported NIPs</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${config.relayInfo.version}</div>
                <div class="stat-label">Version</div>
            </div>
        </div>

        <div class="links">
            <a href="https://github.com/Spl0itable/nosflare-cfndb" class="link" target="_blank">GitHub</a>
            <a href="https://nostr.com" class="link" target="_blank">Learn about Nostr</a>
        </div>
    </div>

    <div class="toast" id="toast">Copied to clipboard!</div>

    <script>
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const relayUrl = protocol + '//' + window.location.host;
        const relayUrlElement = document.getElementById('relay-url');
        if (relayUrlElement) {
            relayUrlElement.textContent = relayUrl;
        }

        function copyToClipboard() {
            const relayUrl = document.getElementById('relay-url').textContent;
            navigator.clipboard.writeText(relayUrl).then(() => {
                const toast = document.getElementById('toast');
                toast.classList.add('show');
                setTimeout(() => {
                    toast.classList.remove('show');
                }, 2000);
            });
        }

        ${PAY_TO_RELAY_ENABLED ? `
        let paymentCheckInterval;

        async function checkPaymentStatus() {
            if (!window.nostr || !window.nostr.getPublicKey) return false;

            try {
                const pubkey = await window.nostr.getPublicKey();
                const response = await fetch('/api/check-payment?pubkey=' + pubkey);
                const data = await response.json();

                if (data.paid) {
                    showRelayAccess();
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Error checking payment status:', error);
                return false;
            }
        }

        function showRelayAccess() {
            const paySection = document.getElementById('paySection');
            const accessSection = document.getElementById('accessSection');

            if (paySection && accessSection) {
                paySection.style.transition = 'opacity 0.3s ease-out';
                paySection.style.opacity = '0';

                setTimeout(() => {
                    paySection.style.display = 'none';
                    accessSection.style.display = 'block';
                    accessSection.style.opacity = '0';
                    accessSection.style.transition = 'opacity 0.3s ease-in';

                    void accessSection.offsetHeight;

                    accessSection.style.opacity = '1';
                }, 300);
            }

            if (paymentCheckInterval) {
                clearInterval(paymentCheckInterval);
                paymentCheckInterval = null;
            }
        }

        window.addEventListener('payment-success', async (event) => {
            console.log('Payment success event received');
            setTimeout(() => {
                showRelayAccess();
            }, 500);
        });

        async function initPayment() {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/gh/Spl0itable/nosflare@main/nostr-zap.js';
            script.onload = () => {
                if (window.nostrZap) {
                    window.nostrZap.initTargets('#payButton');

                    document.getElementById('payButton').addEventListener('click', () => {
                        if (!paymentCheckInterval) {
                            paymentCheckInterval = setInterval(async () => {
                                await checkPaymentStatus();
                            }, 3000);
                        }
                    });
                }
            };
            document.head.appendChild(script);

            await checkPaymentStatus();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initPayment);
        } else {
            initPayment();
        }
        ` : ''}
    </script>
    ${PAY_TO_RELAY_ENABLED ? '<script src="https://unpkg.com/nostr-login@latest/dist/unpkg.js" data-perms="sign_event:1" data-methods="connect,extension,local" data-dark-mode="true"></script>' : ''}
</body>
</html>
  `;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

async function serveFavicon(): Promise<Response> {
  const response = await fetch(relayInfo.icon);
  if (response.ok) {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "max-age=3600");
    return new Response(response.body, {
      status: response.status,
      headers: headers,
    });
  }
  return new Response(null, { status: 404 });
}

function handleNIP05Request(url: URL): Response {
  const name = url.searchParams.get("name");
  if (!name) {
    return new Response(JSON.stringify({ error: "Missing 'name' parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const pubkey = nip05Users[name.toLowerCase()];
  if (!pubkey) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  const response = {
    names: { [name]: pubkey },
    relays: { [pubkey]: [] }
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

async function handleCheckPayment(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pubkey = url.searchParams.get('pubkey');

  if (!pubkey) {
    return new Response(JSON.stringify({ error: 'Missing pubkey' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const paid = await hasPaidForRelay(pubkey, env);

  return new Response(JSON.stringify({ paid }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handlePaymentNotification(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const pubkey = url.searchParams.get('npub');

    if (!pubkey) {
      return new Response(JSON.stringify({ error: 'Missing pubkey' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const success = await savePaidPubkey(pubkey, env);

    return new Response(JSON.stringify({
      success,
      message: success ? 'Payment recorded successfully' : 'Failed to save payment'
    }), {
      status: success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error processing payment notification:', error);
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}