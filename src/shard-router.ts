/**
 * Shard Router - Determines which shards to query
 */

import { pack, unpack } from 'msgpackr';
import type {
  NostrEvent,
  NostrFilter,
  Env,
  ShardQueryResponse,
  ShardInsertResponse
} from './types';
import { MAX_TIME_WINDOWS_PER_QUERY, READ_REPLICAS_PER_SHARD } from './config';

export const SHARD_WINDOW_SECONDS = 24 * 60 * 60;

export const SUB_SHARDS_PER_TIME_WINDOW = 1;

const REPLICA_FETCH_TIMEOUT = 30000;
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 1000;

export const MAX_QUERY_SHARDS = 900;

export function getTimeShardId(timestamp: number): string {
  const timeWindow = Math.floor(timestamp / SHARD_WINDOW_SECONDS);
  return `shard-${timeWindow}`;
}

export function getShardId(timestamp: number, eventId?: string): string {
  const baseShard = getTimeShardId(timestamp);

  if (SUB_SHARDS_PER_TIME_WINDOW === 1) {
    return baseShard;
  }

  if (eventId) {
    const subShardNum = hashString(eventId) % SUB_SHARDS_PER_TIME_WINDOW;
    return `${baseShard}-s${subShardNum}`;
  }
  return `${baseShard}-s0`;
}

export function getAllSubShardsForTimeWindow(timestamp: number): string[] {
  const baseShard = getTimeShardId(timestamp);

  if (SUB_SHARDS_PER_TIME_WINDOW === 1) {
    return [baseShard];
  }

  const subShards: string[] = [];
  for (let i = 0; i < SUB_SHARDS_PER_TIME_WINDOW; i++) {
    subShards.push(`${baseShard}-s${i}`);
  }
  return subShards;
}

export function getEventShardId(event: NostrEvent): string {
  return getShardId(event.created_at, event.id);
}

export function getBaseShardId(shardId: string): string {
  return shardId.replace(/-r\d+$/, '');
}

export function getReplicaShardId(baseShardId: string, replicaNum: number): string {
  return `${baseShardId}-r${replicaNum}`;
}

export function getAllReplicaShardIds(baseShardId: string): string[] {
  const replicas: string[] = [];
  for (let i = 0; i < READ_REPLICAS_PER_SHARD; i++) {
    replicas.push(getReplicaShardId(baseShardId, i));
  }
  return replicas;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function selectReadReplica(baseShardId: string, subscriptionId?: string): string {

  if (!subscriptionId) {
    const replicaNum = Math.floor(Math.random() * READ_REPLICAS_PER_SHARD);
    return getReplicaShardId(baseShardId, replicaNum);
  }

  const hash = hashString(subscriptionId);
  const replicaNum = hash % READ_REPLICAS_PER_SHARD;
  return getReplicaShardId(baseShardId, replicaNum);
}

export function getTimeRangeShards(since: number, until: number, authorPubkey?: string): string[] {
  const timeWindows: number[] = [];

  const startWindow = Math.floor(since / SHARD_WINDOW_SECONDS);
  const endWindow = Math.floor(until / SHARD_WINDOW_SECONDS);

  for (let window = startWindow; window <= endWindow; window++) {
    timeWindows.push(window);
  }

  if (timeWindows.length > MAX_TIME_WINDOWS_PER_QUERY) {
    const timeRangeDays = Math.round((until - since) / 86400);
    const returnedDays = Math.round((MAX_TIME_WINDOWS_PER_QUERY * SHARD_WINDOW_SECONDS) / 86400);

    console.warn(
      `Query requires ${timeWindows.length} time windows (${timeRangeDays} days), ` +
      `limited to ${MAX_TIME_WINDOWS_PER_QUERY} time windows (${returnedDays} days). ` +
      `Use 'since' parameter to paginate and request additional historical days.`
    );

    timeWindows.splice(0, timeWindows.length - MAX_TIME_WINDOWS_PER_QUERY);
  }

  const shards: string[] = [];
  for (const window of timeWindows) {
    const windowTimestamp = window * SHARD_WINDOW_SECONDS;
    const subShards = getAllSubShardsForTimeWindow(windowTimestamp);
    shards.push(...subShards);
  }

  if (shards.length > MAX_QUERY_SHARDS) {
    const timeRangeDays = Math.round((until - since) / 86400);
    console.error(
      `Query requires ${shards.length} shards (${timeRangeDays} days × ${SUB_SHARDS_PER_TIME_WINDOW} sub-shards), ` +
      `HARD LIMITED to ${MAX_QUERY_SHARDS} shards to avoid 1000 subrequest limit.`
    );
    return shards.slice(-MAX_QUERY_SHARDS);
  }

  return shards;
}

export function getShardsForFilter(filter: NostrFilter): string[] {
  const now = Math.floor(Date.now() / 1000);
  const until = filter.until ?? now;

  const defaultDays = MAX_TIME_WINDOWS_PER_QUERY;
  const since = filter.since ?? (until - defaultDays * 24 * 60 * 60);

  const singleAuthor = filter.authors?.length === 1 ? filter.authors[0] : undefined;

  const requestedDays = Math.ceil((until - since) / 86400);
  const maxDays = Math.floor(MAX_QUERY_SHARDS / SUB_SHARDS_PER_TIME_WINDOW);

  if (requestedDays > maxDays) {
    const cappedSince = until - (maxDays * 86400);
    console.warn(
      `REQ time range of ${requestedDays} days exceeds ${maxDays} day limit ` +
      `(accounting for ${SUB_SHARDS_PER_TIME_WINDOW} sub-shards per day). ` +
      `Capping to most recent ${maxDays} days to avoid 1000 subrequest limit.`
    );
    return getTimeRangeShards(cappedSince, until, singleAuthor);
  }

  return getTimeRangeShards(since, until, singleAuthor);
}

async function triggerBackfill(env: Env, events: any[], targetReplicaId: string): Promise<void> {
  try {
    const stub = env.EVENT_SHARD_DO.get(env.EVENT_SHARD_DO.idFromName(targetReplicaId));

    const response = await stub.fetch('https://internal/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/msgpack' },
      body: pack(events)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = unpack(new Uint8Array(await response.arrayBuffer())) as ShardInsertResponse;
    console.log(`Backfilled ${result.inserted} events to ${targetReplicaId}`);
  } catch (error: any) {
    throw new Error(`Backfill to ${targetReplicaId} failed: ${error.message}`);
  }
}

export async function queryEventShard(
  env: Env,
  shardId: string,
  filter: NostrFilter,
  subscriptionId?: string
): Promise<ShardQueryResponse> {
  const emptyResponse: ShardQueryResponse = {
    eventIds: [],
    events: [],
    count: 0,
    latencyMs: 0,
    shardInfo: { startTime: 0, endTime: 0, eventCount: 0, isStale: false }
  };

  try {
    const replicaShardId = selectReadReplica(shardId, subscriptionId);
    const stub = env.EVENT_SHARD_DO.get(env.EVENT_SHARD_DO.idFromName(replicaShardId));

    const shardFilter = transformNostrFilterToShardFormat(filter);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REPLICA_FETCH_TIMEOUT);

    try {
      const startTime = Date.now();
      const response = await stub.fetch('https://internal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/msgpack' },
        body: pack(shardFilter),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Shard ${replicaShardId} query failed: ${response.status}`);
        return emptyResponse;
      }

      const result = unpack(new Uint8Array(await response.arrayBuffer())) as ShardQueryResponse;
      const latency = Date.now() - startTime;

      if (latency > 5000) {
        console.warn(`Slow query for ${replicaShardId}: ${latency}ms (returned ${result.eventIds?.length || 0} events)`);
      }

      if (result.eventIds.length === 0 && !replicaShardId.endsWith('-r0')) {
        const replica0Id = getReplicaShardId(shardId, 0);
        const replica0Stub = env.EVENT_SHARD_DO.get(env.EVENT_SHARD_DO.idFromName(replica0Id));

        try {
          const replica0Response = await replica0Stub.fetch('https://internal/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/msgpack' },
            body: pack(shardFilter),
            signal: controller.signal
          });

          if (replica0Response.ok) {
            const replica0Result = unpack(new Uint8Array(await replica0Response.arrayBuffer())) as ShardQueryResponse;

            if (replica0Result.eventIds.length > 0 && replica0Result.events) {
              console.log(`Lazy backfill: ${replicaShardId} empty, found ${replica0Result.eventIds.length} events in ${replica0Id}`);

              triggerBackfill(env, replica0Result.events, replicaShardId).catch(err =>

                console.error(`Background backfill failed for ${replicaShardId}:`, err.message)
              );

              return replica0Result;
            }
          }
        } catch (error: any) {
          console.warn(`Replica 0 fallback failed for ${shardId}:`, error.message);
        }
      }

      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error(`Shard ${replicaShardId} query timeout after ${REPLICA_FETCH_TIMEOUT}ms (possible cold start or storage bottleneck)`);
      } else {
        throw error;
      }
      return emptyResponse;
    }
  } catch (error: any) {
    console.error(`Error querying shard ${shardId}:`, error.message);
    return emptyResponse;
  }
}

function transformNostrFilterToShardFormat(filter: NostrFilter): any {
  const shardFilter: any = {
    kinds: filter.kinds,
    authors: filter.authors,
    ids: filter.ids,
    since: filter.since,
    until: filter.until,
    limit: filter.limit,
    search: filter.search
  };

  const tags: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith('#') && Array.isArray(value)) {
      const tagType = key.substring(1);
      tags[tagType] = value as string[];
    }
  }

  if (Object.keys(tags).length > 0) {
    shardFilter.tags = tags;
  }

  return shardFilter;
}

export async function queryShards(
  env: Env,
  filter: NostrFilter,
  subscriptionId?: string
): Promise<{ eventIds: string[], events: any[], shardMapping: Map<string, string[]> }> {
  const allShards = getShardsForFilter(filter);
  const queryStartTime = Date.now();

  const requestedLimit = filter.limit ?? 1000;
  const perShardLimit = Math.min(requestedLimit * 3, 5000);
  const expandedFilter = { ...filter, limit: perShardLimit };

  const seen = new Set<string>();
  const merged: string[] = [];
  const allEvents: any[] = [];
  const shardMapping = new Map<string, string[]>();

  const shards = [...allShards].reverse();

  const batchSize = requestedLimit <= 10 ? 2 : requestedLimit <= 100 ? 5 : shards.length;

  for (let batchStart = 0; batchStart < shards.length; batchStart += batchSize) {
    if (merged.length >= requestedLimit) {
      break;
    }

    const batchShards = shards.slice(batchStart, batchStart + batchSize);
    const promises = batchShards.map(shardId => queryEventShard(env, shardId, expandedFilter, subscriptionId));
    const results = await Promise.all(promises);

    for (let i = 0; i < results.length; i++) {
      const shardId = batchShards[i];
      const shardResults = results[i];
      const shardEventIds: string[] = [];

      for (const eventId of shardResults.eventIds || []) {
        if (!seen.has(eventId)) {
          seen.add(eventId);
          merged.push(eventId);
        }
        shardEventIds.push(eventId);
      }

      if (shardResults.events) {
        for (const event of shardResults.events) {
          if (event && !allEvents.find(e => e.id === event.id)) {
            allEvents.push(event);
          }
        }
      }

      if (shardEventIds.length > 0) {
        shardMapping.set(shardId, shardEventIds);
      }
    }
  }

  const totalLatency = Date.now() - queryStartTime;
  if (totalLatency > 10000) {
    console.warn(`Parallel query of ${shards.length} shards took ${totalLatency}ms total`);
  }

  const safetyCap = 10000;
  const cappedEventIds = merged.slice(0, safetyCap);

  if (merged.length > safetyCap) {
    console.warn(
      `Query returned ${merged.length} events from ${shards.length} shards, ` +
      `capped to ${safetyCap} for memory safety. Results may be incomplete.`
    );
  }

  const cappedSet = new Set(cappedEventIds);
  const filteredMapping = new Map<string, string[]>();
  for (const [shardId, eventIds] of shardMapping.entries()) {
    const filtered = eventIds.filter(id => cappedSet.has(id));
    if (filtered.length > 0) {
      filteredMapping.set(shardId, filtered);
    }
  }

  const cappedEvents = allEvents.filter(event => cappedSet.has(event.id));

  return { eventIds: cappedEventIds, events: cappedEvents, shardMapping: filteredMapping };
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  context: string,
  maxAttempts: number = MAX_RETRY_ATTEMPTS
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === maxAttempts) {
        console.error(`${context}: All ${maxAttempts} retry attempts failed - ${error.message}`);
        return null;
      }

      const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
      console.warn(`${context}: Attempt ${attempt} failed (${error.message}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return null;
}

export async function insertEventsIntoShard(
  env: Env,
  events: NostrEvent[]
): Promise<boolean> {
  if (events.length === 0) {
    return true;
  }

  try {
    const baseShardId = getEventShardId(events[0]);

    const replicaShardIds = getAllReplicaShardIds(baseShardId);

    const insertPromises = replicaShardIds.map(async (replicaShardId) => {
      const result = await retryWithBackoff(async () => {
        const stub = env.EVENT_SHARD_DO.get(env.EVENT_SHARD_DO.idFromName(replicaShardId));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REPLICA_FETCH_TIMEOUT);

        try {
          const response = await stub.fetch('https://internal/insert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/msgpack' },
            body: pack(events),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const insertResult = unpack(new Uint8Array(await response.arrayBuffer())) as ShardInsertResponse;
          return insertResult.inserted > 0;
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            throw new Error(`Timeout after ${REPLICA_FETCH_TIMEOUT}ms`);
          }
          throw error;
        }
      }, `Replica ${replicaShardId}`);

      return { shardId: replicaShardId, success: result === true };
    });

    const results = await Promise.all(insertPromises);
    const failedReplicas = results.filter(r => !r.success).map(r => r.shardId);
    const allSucceeded = failedReplicas.length === 0;

    if (!allSucceeded) {
      console.error(
        `REPLICA WRITE FAILED: ${results.length - failedReplicas.length}/${results.length} replicas succeeded ` +
        `for batch of ${events.length} events to shard ${baseShardId}. ` +
        `Failed replicas: ${failedReplicas.join(', ')}. ` +
        `Event IDs: ${events.slice(0, 5).map(e => e.id).join(', ')}${events.length > 5 ? '...' : ''}`
      );
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`Error inserting batch into shard:`, error.message);
    return false;
  }
}