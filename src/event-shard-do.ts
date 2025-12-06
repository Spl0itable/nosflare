/**
 * EventShardDO - Time-Sharded Event Storage with Co-located Indices
 */

import { pack, unpack } from 'msgpackr';
import type {
  DurableObject,
  DurableObjectState,
  NostrEvent,
  ShardQueryRequest,
  ShardQueryResponse,
  ShardInsertResponse,
  ShardGetEventsRequest,
  ShardGetEventsResponse,
  IndexEntry,
  SortedIndex,
  ErrorResponse
} from './types';

export class EventShardDO implements DurableObject {
  private state: DurableObjectState;
  private env: any;

  private kindIndex: Map<number, SortedIndex> = new Map();
  private authorIndex: Map<string, SortedIndex> = new Map();
  private tagIndex: Map<string, SortedIndex> = new Map();

  private pubkeyKindIndex: Map<string, Map<number, SortedIndex>> = new Map();
  private tagKindIndex: Map<string, Map<number, SortedIndex>> = new Map();
  private createdIndex: SortedIndex | null = null;

  private contentIndex: Map<string, Set<string>> = new Map();
  private eventContent: Map<string, string> = new Map();

  private replaceableIndex: Map<string, string> = new Map();

  private addressableIndex: Map<string, string> = new Map();

  private channelMetadataIndex: Map<string, string> = new Map();

  private deletedEvents: Set<string> = new Set();

  private expirationIndex: Map<string, number> = new Map();

  private trimmedIndices: Set<string> = new Set();

  private eventCache: Map<string, NostrEvent> = new Map();
  private readonly MAX_EVENT_CACHE_SIZE = 10_000;

  private shardStartTime: number = 0;
  private shardEndTime: number = 0;
  private eventCount: number = 0;
  private isStale: boolean = false;

  private insertQueue: NostrEvent[] = [];
  private isProcessingQueue: boolean = false;
  private queueResolvers: Map<string, {resolve: Function, reject: Function}> = new Map();

  private readonly MAX_EVENTS_PER_SHARD = 500_000;
  private readonly MAX_INDEX_SIZE = 50_000;
  private readonly MAX_CREATED_INDEX_SIZE = 200_000;
  private readonly INDEX_WARNING_THRESHOLD = 40_000;
  private readonly CREATED_INDEX_WARNING_THRESHOLD = 160_000;
  private readonly MAX_BATCH_SIZE = 20;
  private readonly BATCH_DELAY_MS = 50;

  private readonly MAX_CONTENT_TOKENS = 50;
  private readonly MIN_TOKEN_LENGTH = 3;
  private readonly MAX_CONTENT_LENGTH = 500;

  private readonly EXPIRATION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

  private readonly STOP_WORDS = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
    'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
    'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
    'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me'
  ]);

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;

    this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();
      await this.scheduleExpirationCleanup();
    });
  }

  private async scheduleExpirationCleanup(): Promise<void> {
    const currentAlarm = await this.state.storage.getAlarm();
    if (!currentAlarm) {
      await this.state.storage.setAlarm(Date.now() + this.EXPIRATION_CLEANUP_INTERVAL_MS);
    }
  }

  async alarm(): Promise<void> {
    console.log(`NIP-40: Running expiration cleanup for shard with ${this.expirationIndex.size} tracked expiring events`);

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expiredEventIds: string[] = [];

    for (const [eventId, expirationTimestamp] of this.expirationIndex) {
      if (expirationTimestamp <= currentTimestamp) {
        expiredEventIds.push(eventId);
      }
    }

    if (expiredEventIds.length > 0) {
      console.log(`NIP-40: Deleting ${expiredEventIds.length} expired events`);

      const BATCH_SIZE = 50;
      for (let i = 0; i < expiredEventIds.length; i += BATCH_SIZE) {
        const batch = expiredEventIds.slice(i, i + BATCH_SIZE);
        for (const eventId of batch) {
          await this.deleteEventById(eventId);
          this.expirationIndex.delete(eventId);
        }
      }

      await this.state.storage.put('expiration_index', Array.from(this.expirationIndex.entries()));
      await this.state.storage.put('deleted_events', Array.from(this.deletedEvents));
      await this.saveMetadata();

      console.log(`NIP-40: Cleanup complete. Deleted ${expiredEventIds.length} expired events`);
    }

    await this.state.storage.setAlarm(Date.now() + this.EXPIRATION_CLEANUP_INTERVAL_MS);
  }

  private isReplaceableKind(kind: number): boolean {
    return kind === 0 || kind === 3 || kind === 40 || (kind >= 10000 && kind < 20000);
  }

  private isAddressableKind(kind: number): boolean {
    return kind >= 30000 && kind < 40000;
  }

  private isChannelMetadataKind(kind: number): boolean {
    return kind === 41;
  }

  private getDTag(event: NostrEvent): string {
    const dTag = event.tags.find(tag => tag[0] === 'd');
    return dTag?.[1] || '';
  }

  private getETag(event: NostrEvent): string {
    const eTag = event.tags.find(tag => tag[0] === 'e');
    return eTag?.[1] || '';
  }

  private getReplaceableKey(kind: number, pubkey: string): string {
    return `${kind}:${pubkey}`;
  }

  private getAddressableKey(kind: number, pubkey: string, dTag: string): string {
    return `${kind}:${pubkey}:${dTag}`;
  }

  private getChannelMetadataKey(pubkey: string, eTag: string): string {
    return `41:${pubkey}:${eTag}`;
  }

  private getExpirationTimestamp(event: NostrEvent): number | null {
    const expirationTag = event.tags.find(tag => tag[0] === 'expiration');
    if (!expirationTag || !expirationTag[1]) {
      return null;
    }
    const timestamp = parseInt(expirationTag[1], 10);
    return isNaN(timestamp) ? null : timestamp;
  }

  private isEventFullyIndexed(event: NostrEvent): boolean {
    const kindIdx = this.kindIndex.get(event.kind);
    if (!kindIdx?.eventIdSet.has(event.id)) {
      return false;
    }

    const authorIdx = this.authorIndex.get(event.pubkey);
    if (!authorIdx?.eventIdSet.has(event.id)) {
      return false;
    }

    const pubkeyKindMap = this.pubkeyKindIndex.get(event.pubkey);
    if (!pubkeyKindMap?.get(event.kind)?.eventIdSet.has(event.id)) {
      return false;
    }

    if (!this.createdIndex?.eventIdSet.has(event.id)) {
      return false;
    }

    return true;
  }

  private tokenizeContent(content: string): string[] {
    if (!content || content.trim().length === 0) {
      return [];
    }

    const tokens = content
      .toLowerCase()
      .replace(/[^\w\s#@]/g, ' ')
      .split(/\s+/)
      .filter(token =>
        token.length >= this.MIN_TOKEN_LENGTH &&
        !this.STOP_WORDS.has(token)
      )
      .slice(0, this.MAX_CONTENT_TOKENS);

    return tokens;
  }

  private async loadFromStorage(): Promise<void> {
    const startTime = Date.now();

    const [
      metadata,
      deletedData,
      createdData,
      replaceableData,
      addressableData,
      channelMetadataData,
      expirationData,
      kindIndicesData
    ] = await Promise.all([
      this.state.storage.get<{
        shardStartTime: number;
        shardEndTime: number;
        eventCount: number;
        isStale: boolean;
      }>('metadata'),
      this.state.storage.get<string[]>('deleted_events'),
      this.state.storage.get<SortedIndex>('created_index'),
      this.state.storage.list<string>({ prefix: 'replaceable:' }),
      this.state.storage.list<string>({ prefix: 'addressable:' }),
      this.state.storage.list<string>({ prefix: 'channelmeta:' }),
      this.state.storage.get<[string, number][]>('expiration_index'),
      this.state.storage.list<SortedIndex>({ prefix: 'kind:' })
    ]);

    if (metadata) {
      this.shardStartTime = metadata.shardStartTime;
      this.shardEndTime = metadata.shardEndTime;
      this.eventCount = metadata.eventCount;
      this.isStale = metadata.isStale;
    }

    if (deletedData) {
      this.deletedEvents = new Set(deletedData);
    }

    if (createdData) {
      this.createdIndex = this.deserializeIndex(createdData);
    }

    for (const [key, eventId] of replaceableData) {
      const replaceableKey = key.replace('replaceable:', '');
      this.replaceableIndex.set(replaceableKey, eventId);
    }

    for (const [key, eventId] of addressableData) {
      const addressableKey = key.replace('addressable:', '');
      this.addressableIndex.set(addressableKey, eventId);
    }

    for (const [key, eventId] of channelMetadataData) {
      const channelMetadataKey = key.replace('channelmeta:', '');
      this.channelMetadataIndex.set(channelMetadataKey, eventId);
    }

    if (expirationData) {
      this.expirationIndex = new Map(expirationData);
    }

    for (const [key, indexData] of kindIndicesData) {
      const kind = parseInt(key.replace('kind:', ''), 10);
      if (!isNaN(kind) && indexData) {
        this.kindIndex.set(kind, this.deserializeIndex(indexData));
      }
    }

    console.log(
      `EventShardDO loaded: ${this.eventCount} events, ` +
      `${this.kindIndex.size} kind indices, ` +
      `${this.deletedEvents.size} deletions, ` +
      `${this.replaceableIndex.size} replaceable, ${this.addressableIndex.size} addressable, ` +
      `${this.channelMetadataIndex.size} channel metadata, ${this.expirationIndex.size} expiring ` +
      `in ${Date.now() - startTime}ms`
    );
  }

  private deserializeIndex(stored: any): SortedIndex {
    return {
      ...stored,
      eventIdSet: new Set(stored.entries.map((e: IndexEntry) => e.eventId))
    };
  }

  private async ensureKindIndexLoaded(kind: number): Promise<void> {
    if (!this.kindIndex.has(kind)) {
      const stored = await this.state.storage.get<SortedIndex>(`kind:${kind}`);
      if (stored) {
        this.kindIndex.set(kind, this.deserializeIndex(stored));
      }
    }
  }

  private async ensureAuthorIndexLoaded(pubkey: string): Promise<void> {
    if (!this.authorIndex.has(pubkey)) {
      const stored = await this.state.storage.get<SortedIndex>(`author:${pubkey}`);
      if (stored) {
        this.authorIndex.set(pubkey, this.deserializeIndex(stored));
      }
    }
  }

  private async ensureTagIndexLoaded(tagKey: string): Promise<void> {
    if (!this.tagIndex.has(tagKey)) {
      const stored = await this.state.storage.get<SortedIndex>(`tag:${tagKey}`);
      if (stored) {
        this.tagIndex.set(tagKey, this.deserializeIndex(stored));
      }
    }
  }

  private async ensurePubkeyKindIndexLoaded(pubkey: string, kind: number): Promise<void> {
    if (!this.pubkeyKindIndex.has(pubkey)) {
      this.pubkeyKindIndex.set(pubkey, new Map());
    }

    const kindMap = this.pubkeyKindIndex.get(pubkey)!;
    if (!kindMap.has(kind)) {
      const stored = await this.state.storage.get<SortedIndex>(`pubkeykind:${pubkey}:${kind}`);
      if (stored) {
        kindMap.set(kind, this.deserializeIndex(stored));
      }
    }
  }

  private async ensureTagKindIndexLoaded(tagKey: string, kind: number): Promise<void> {
    if (!this.tagKindIndex.has(tagKey)) {
      this.tagKindIndex.set(tagKey, new Map());
    }

    const kindMap = this.tagKindIndex.get(tagKey)!;
    if (!kindMap.has(kind)) {
      const stored = await this.state.storage.get<SortedIndex>(`tagkind:${tagKey}:${kind}`);
      if (stored) {
        kindMap.set(kind, this.deserializeIndex(stored));
      }
    }
  }

  private async saveMetadata(): Promise<void> {
    await this.state.storage.put('metadata', {
      shardStartTime: this.shardStartTime,
      shardEndTime: this.shardEndTime,
      eventCount: this.eventCount,
      isStale: this.isStale
    });
  }

  private async triggerBackfillFromReplica0(): Promise<void> {
    const currentId = this.state.id.toString();
    const baseShardId = currentId.replace(/-r\d+$/, '');
    const replica0Id = `${baseShardId}-r0`;

    console.log(`Backfill: Copying data from ${replica0Id} to ${currentId}`);

    try {
      const replica0Stub = this.env.EVENT_SHARD_DO.get(this.env.EVENT_SHARD_DO.idFromName(replica0Id));

      const response = await replica0Stub.fetch('https://internal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/msgpack' },
        body: pack({
          kinds: undefined,
          authors: undefined,
          limit: 500000
        })
      });

      if (!response.ok) {
        throw new Error(`Replica 0 query failed: HTTP ${response.status}`);
      }

      const result = unpack(new Uint8Array(await response.arrayBuffer())) as any;

      if (result.events && result.events.length > 0) {
        console.log(`Backfill: Found ${result.events.length} events in ${replica0Id}, inserting...`);

        for (const event of result.events) {
          await this.queueInsert(event);
        }

        console.log(`Backfill: Successfully backfilled ${result.events.length} events to ${currentId}`);
      } else {
        console.log(`Backfill: Replica 0 is empty, no backfill needed`);
      }

      await this.state.storage.put('backfill_completed', true);
    } catch (error: any) {
      console.error(`Backfill failed for ${currentId}:`, error.message);
      throw error;
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/insert' && request.method === 'POST') {
        return await this.handleInsert(request);
      }

      if (path === '/query' && request.method === 'POST') {
        return await this.handleQuery(request);
      }

      if (path === '/get-events' && request.method === 'POST') {
        return await this.handleGetEvents(request);
      }

      if (path === '/delete-events' && request.method === 'POST') {
        return await this.handleDeleteEvents(request);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error: any) {
      console.error('EventShardDO error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  private async handleInsert(request: Request): Promise<Response> {
    let events: NostrEvent[];

    try {
      events = unpack(new Uint8Array(await request.arrayBuffer())) as NostrEvent[];
    } catch (error: any) {
      if (error.message?.includes('client disconnected')) {
        console.log('Client disconnected during insert request');
        return new Response('Client disconnected', { status: 499 });
      }
      throw error;
    }

    const wasEmpty = this.eventCount === 0;

    const promises = events.map(event => this.queueInsert(event));
    const results = await Promise.all(promises);

    const inserted = results.filter(r => r).length;

    if (wasEmpty && inserted > 0 && !await this.state.storage.get('backfill_completed')) {
      const replicaId = this.env.DO_NAME || '';
      if (replicaId && !replicaId.endsWith('-r0')) {
        this.triggerBackfillFromReplica0().catch(err =>
          console.error(`Background backfill failed for ${replicaId}:`, err.message)
        );
      }
    }

    const response: ShardInsertResponse = {
      inserted,
      eventCount: this.eventCount,
      isStale: this.isStale
    };

    return new Response(pack(response), {
      headers: { 'Content-Type': 'application/msgpack' }
    });
  }

  private async queueInsert(event: NostrEvent): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.queueResolvers.set(event.id, { resolve, reject });

      this.insertQueue.push(event);

      if (!this.isProcessingQueue) {
        this.processInsertQueue();
      }
    });
  }

  private async processInsertQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (this.insertQueue.length > 0) {
        const batch = this.insertQueue.splice(0, this.MAX_BATCH_SIZE);

        await this.processBatchInsert(batch);

        if (this.insertQueue.length === 0) {
          await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY_MS));
        }
      }
    } finally {
      this.isProcessingQueue = false;

      if (this.insertQueue.length > 0) {
        this.processInsertQueue();
      }
    }
  }

  private async processBatchInsert(events: NostrEvent[]): Promise<void> {
    const insertedIds: Set<string> = new Set();
    const skippedIds: Set<string> = new Set();

    const storageBatch: Record<string, any> = {};

    for (const event of events) {
      try {
        const exists = await this.state.storage.get(`event:${event.id}`);
        if (exists) {
          const isFullyIndexed = this.isEventFullyIndexed(event);

          if (isFullyIndexed) {
            skippedIds.add(event.id);
            continue;
          }

          console.log(`Re-indexing existing event ${event.id} (found in storage but missing from indices)`);
          this.indexEventInBatch(event, storageBatch);
          insertedIds.add(event.id);
          continue;
        }
      } catch (error) {
        console.error(`Error checking existence for event ${event.id}:`, error);
        skippedIds.add(event.id);
        continue;
      }

      if (this.isReplaceableKind(event.kind)) {
        const replaceableKey = this.getReplaceableKey(event.kind, event.pubkey);
        const existingEventId = this.replaceableIndex.get(replaceableKey);

        if (existingEventId) {
          const existingData = await this.state.storage.get<Uint8Array>(`event:${existingEventId}`);

          if (existingData) {
            try {
              const existingEvent = unpack(existingData) as NostrEvent;
              const existingCreatedAt = existingEvent.created_at;

              if (existingCreatedAt >= event.created_at) {
                continue;
              }

              await this.deleteEventById(existingEventId);
            } catch (err) {
              console.warn(`MessagePack read failed for ${existingEventId}:`, err);
            }
          }
        }

        this.replaceableIndex.set(replaceableKey, event.id);
        storageBatch[`replaceable:${replaceableKey}`] = event.id;
      }

      if (this.isAddressableKind(event.kind)) {
        const dTag = this.getDTag(event);
        const addressableKey = this.getAddressableKey(event.kind, event.pubkey, dTag);
        const existingEventId = this.addressableIndex.get(addressableKey);

        if (existingEventId) {
          const existingData = await this.state.storage.get<Uint8Array>(`event:${existingEventId}`);

          if (existingData) {
            try {
              const existingEvent = unpack(existingData) as NostrEvent;
              const existingCreatedAt = existingEvent.created_at;

              if (existingCreatedAt >= event.created_at) {
                continue;
              }

              await this.deleteEventById(existingEventId);
            } catch (err) {
              console.warn(`MessagePack read failed for ${existingEventId}:`, err);
            }
          }
        }

        this.addressableIndex.set(addressableKey, event.id);
        storageBatch[`addressable:${addressableKey}`] = event.id;
      }

      if (this.isChannelMetadataKind(event.kind)) {
        const eTag = this.getETag(event);
        const channelMetadataKey = this.getChannelMetadataKey(event.pubkey, eTag);
        const existingEventId = this.channelMetadataIndex.get(channelMetadataKey);

        if (existingEventId) {
          const existingData = await this.state.storage.get<Uint8Array>(`event:${existingEventId}`);

          if (existingData) {
            try {
              const existingEvent = unpack(existingData) as NostrEvent;
              const existingCreatedAt = existingEvent.created_at;

              if (existingCreatedAt >= event.created_at) {
                continue;
              }

              await this.deleteEventById(existingEventId);
            } catch (err) {
              console.warn(`MessagePack read failed for ${existingEventId}:`, err);
            }
          }
        }

        this.channelMetadataIndex.set(channelMetadataKey, event.id);
        storageBatch[`channelmeta:${channelMetadataKey}`] = event.id;
      }

      const eventData = pack(event);
      storageBatch[`event:${event.id}`] = eventData;

      this.indexEventInBatch(event, storageBatch);

      this.addToEventCache(event);

      this.eventCount++;
      if (!this.shardStartTime || event.created_at * 1000 < this.shardStartTime) {
        this.shardStartTime = event.created_at * 1000;
      }
      if (!this.shardEndTime || event.created_at * 1000 > this.shardEndTime) {
        this.shardEndTime = event.created_at * 1000;
      }

      insertedIds.add(event.id);
    }

    try {
      if (Object.keys(storageBatch).length > 0) {
        await this.state.storage.put(storageBatch);
      }

      if (insertedIds.size > 0) {
        await this.saveMetadata();

        if (this.eventCount > this.MAX_EVENTS_PER_SHARD) {
          this.isStale = true;
          await this.saveMetadata();
        }
      }

      for (const event of events) {
        const resolver = this.queueResolvers.get(event.id);
        if (resolver) {
          const success = insertedIds.has(event.id) || skippedIds.has(event.id);
          resolver.resolve(success);
          this.queueResolvers.delete(event.id);
        }
      }
    } catch (error) {
      for (const event of events) {
        const resolver = this.queueResolvers.get(event.id);
        if (resolver) {
          resolver.reject(error);
          this.queueResolvers.delete(event.id);
        }
      }
      console.error('Batch insert error:', error);
      throw error;
    }
  }

  private indexEventInBatch(event: NostrEvent, storageBatch: Record<string, any>): void {
    const entry: IndexEntry = {
      eventId: event.id,
      created_at: event.created_at,
      kind: event.kind,
      pubkey: event.pubkey
    };

    this.updateIndexInBatch(this.kindIndex, `kind:${event.kind}`, event.kind, entry, storageBatch);

    this.updateIndexInBatch(this.authorIndex, `author:${event.pubkey}`, event.pubkey, entry, storageBatch);

    for (const tag of event.tags) {
      if (tag.length >= 2) {
        const tagType = tag[0];
        const tagValue = tag[1];
        const tagKey = `${tagType}:${tagValue}`;
        this.updateIndexInBatch(this.tagIndex, `tag:${tagKey}`, tagKey, entry, storageBatch);
      }
    }

    this.updateCompositeIndexInBatch(
      this.pubkeyKindIndex,
      event.pubkey,
      event.kind,
      `pubkeykind:${event.pubkey}:${event.kind}`,
      entry,
      storageBatch
    );

    for (const tag of event.tags) {
      if (tag.length >= 2) {
        const tagKey = `${tag[0]}:${tag[1]}`;
        this.updateCompositeIndexInBatch(
          this.tagKindIndex,
          tagKey,
          event.kind,
          `tagkind:${tagKey}:${event.kind}`,
          entry,
          storageBatch
        );
      }
    }

    this.updateGlobalCreatedIndexInBatch(entry, storageBatch);

    if (event.kind === 1 && event.content) {
      this.indexContentInBatch(event, storageBatch);
    }

    const expirationTimestamp = this.getExpirationTimestamp(event);
    if (expirationTimestamp !== null) {
      this.expirationIndex.set(event.id, expirationTimestamp);
      storageBatch['expiration_index'] = Array.from(this.expirationIndex.entries());
    }
  }

  private findInsertPosition(entries: IndexEntry[], timestamp: number): number {
    let left = 0;
    let right = entries.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (entries[mid].created_at > timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  private trimIndexIfNeeded(index: SortedIndex, indexName: string, isCreatedIndex: boolean = false): { untrimmedForStorage: SortedIndex | null, wasTrimmed: boolean } {
    const maxSize = isCreatedIndex ? this.MAX_CREATED_INDEX_SIZE : this.MAX_INDEX_SIZE;
    const warningThreshold = isCreatedIndex ? this.CREATED_INDEX_WARNING_THRESHOLD : this.INDEX_WARNING_THRESHOLD;

    if (index.count === warningThreshold) {
      console.warn(
        `INDEX CAPACITY WARNING: Index "${indexName}" has ${index.count} entries ` +
        `(${Math.round(index.count / maxSize * 100)}% of ${maxSize} limit). ` +
        `Consider increasing index size limit or implementing index archival.`
      );
    }

    if (index.count > maxSize) {
      const untrimmedForStorage: SortedIndex = {
        entries: [...index.entries],
        eventIdSet: new Set(index.eventIdSet),
        count: index.count,
        minTime: index.minTime,
        maxTime: index.maxTime,
        lastUpdate: index.lastUpdate
      };

      const removed = index.entries.splice(maxSize);
      for (const r of removed) {
        index.eventIdSet.delete(r.eventId);
      }
      index.count = index.entries.length;

      this.trimmedIndices.add(indexName);

      console.warn(
        `INDEX TRIMMED: Index "${indexName}" exceeded ${maxSize} in-memory limit. ` +
        `Trimmed ${removed.length} oldest entries from memory. ` +
        `Full index (${untrimmedForStorage.count} entries) remains in storage for fallback queries.`
      );

      return { untrimmedForStorage, wasTrimmed: true };
    }

    return { untrimmedForStorage: null, wasTrimmed: false };
  }

  private updateIndexInBatch(
    indexMap: Map<string | number, SortedIndex>,
    storageKey: string,
    mapKey: string | number,
    entry: IndexEntry,
    storageBatch: Record<string, any>
  ): void {
    let index = indexMap.get(mapKey);

    if (!index) {
      index = {
        entries: [],
        eventIdSet: new Set(),
        count: 0,
        minTime: entry.created_at,
        maxTime: entry.created_at,
        lastUpdate: Date.now()
      };
      indexMap.set(mapKey, index);
    }

    if (index.eventIdSet.has(entry.eventId)) {
      return;
    }

    const insertPos = this.findInsertPosition(index.entries, entry.created_at);
    index.entries.splice(insertPos, 0, entry);
    index.eventIdSet.add(entry.eventId);
    index.count++;
    index.minTime = Math.min(index.minTime, entry.created_at);
    index.maxTime = Math.max(index.maxTime, entry.created_at);
    index.lastUpdate = Date.now();

    const { untrimmedForStorage, wasTrimmed } = this.trimIndexIfNeeded(index, storageKey);

    const indexToStore = wasTrimmed ? untrimmedForStorage! : index;
    const serialized = {
      entries: indexToStore.entries,
      count: indexToStore.count,
      minTime: indexToStore.minTime,
      maxTime: indexToStore.maxTime,
      lastUpdate: indexToStore.lastUpdate
    };
    storageBatch[storageKey] = serialized;
  }

  private updateCompositeIndexInBatch(
    compositeMap: Map<string, Map<number, SortedIndex>>,
    firstKey: string,
    kind: number,
    storageKey: string,
    entry: IndexEntry,
    storageBatch: Record<string, any>
  ): void {
    if (!compositeMap.has(firstKey)) {
      compositeMap.set(firstKey, new Map());
    }

    const kindMap = compositeMap.get(firstKey)!;
    let index = kindMap.get(kind);

    if (!index) {
      index = {
        entries: [],
        eventIdSet: new Set(),
        count: 0,
        minTime: entry.created_at,
        maxTime: entry.created_at,
        lastUpdate: Date.now()
      };
      kindMap.set(kind, index);
    }

    if (index.eventIdSet.has(entry.eventId)) {
      return;
    }

    const insertPos = this.findInsertPosition(index.entries, entry.created_at);
    index.entries.splice(insertPos, 0, entry);
    index.eventIdSet.add(entry.eventId);
    index.count++;
    index.minTime = Math.min(index.minTime, entry.created_at);
    index.maxTime = Math.max(index.maxTime, entry.created_at);
    index.lastUpdate = Date.now();

    const { untrimmedForStorage, wasTrimmed } = this.trimIndexIfNeeded(index, storageKey);

    const indexToStore = wasTrimmed ? untrimmedForStorage! : index;
    const serialized = {
      entries: indexToStore.entries,
      count: indexToStore.count,
      minTime: indexToStore.minTime,
      maxTime: indexToStore.maxTime,
      lastUpdate: indexToStore.lastUpdate
    };
    storageBatch[storageKey] = serialized;
  }

  private updateGlobalCreatedIndexInBatch(entry: IndexEntry, storageBatch: Record<string, any>): void {
    if (!this.createdIndex) {
      this.createdIndex = {
        entries: [],
        eventIdSet: new Set(),
        count: 0,
        minTime: entry.created_at,
        maxTime: entry.created_at,
        lastUpdate: Date.now()
      };
    }

    if (this.createdIndex.eventIdSet.has(entry.eventId)) {
      return;
    }

    const insertPos = this.findInsertPosition(this.createdIndex.entries, entry.created_at);
    this.createdIndex.entries.splice(insertPos, 0, entry);
    this.createdIndex.eventIdSet.add(entry.eventId);
    this.createdIndex.count++;
    this.createdIndex.minTime = Math.min(this.createdIndex.minTime, entry.created_at);
    this.createdIndex.maxTime = Math.max(this.createdIndex.maxTime, entry.created_at);
    this.createdIndex.lastUpdate = Date.now();

    const { untrimmedForStorage, wasTrimmed } = this.trimIndexIfNeeded(this.createdIndex, 'created_index', true);

    const indexToStore = wasTrimmed ? untrimmedForStorage! : this.createdIndex;
    const serialized = {
      entries: indexToStore.entries,
      count: indexToStore.count,
      minTime: indexToStore.minTime,
      maxTime: indexToStore.maxTime,
      lastUpdate: indexToStore.lastUpdate
    };
    storageBatch['created_index'] = serialized;
  }

  private indexContentInBatch(event: NostrEvent, storageBatch: Record<string, any>): void {
    if (!event.content || event.content.trim().length === 0) {
      return;
    }

    const tokens = this.tokenizeContent(event.content);

    for (const token of tokens) {
      let eventSet = this.contentIndex.get(token);
      if (!eventSet) {
        eventSet = new Set();
        this.contentIndex.set(token, eventSet);
      }
      eventSet.add(event.id);

      storageBatch[`content:${token}`] = Array.from(eventSet);
    }

    const truncatedContent = event.content.substring(0, this.MAX_CONTENT_LENGTH);
    this.eventContent.set(event.id, truncatedContent);
    storageBatch[`eventcontent:${event.id}`] = truncatedContent;
  }

  private searchContent(searchQuery: string, candidateIds?: Set<string>): string[] {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return [];
    }

    const queryTokens = this.tokenizeContent(searchQuery);

    if (queryTokens.length === 0) {
      return [];
    }

    const eventScores = new Map<string, number>();

    for (const token of queryTokens) {
      const matchingEvents = this.contentIndex.get(token);
      if (!matchingEvents) continue;

      for (const eventId of matchingEvents) {
        if (candidateIds && !candidateIds.has(eventId)) {
          continue;
        }

        const currentScore = eventScores.get(eventId) || 0;
        eventScores.set(eventId, currentScore + 1);
      }
    }

    const rankedEvents = Array.from(eventScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([eventId]) => eventId);

    return rankedEvents;
  }

  private async handleQuery(request: Request): Promise<Response> {
    let filter: ShardQueryRequest;

    try {
      filter = unpack(new Uint8Array(await request.arrayBuffer())) as ShardQueryRequest;
    } catch (error: any) {
      if (error.message?.includes('client disconnected')) {
        console.log('Client disconnected during query request');
        return new Response('Client disconnected', { status: 499 });
      }
      throw error;
    }

    const eventIds = await this.executeQuery(filter);

    const events: NostrEvent[] = [];

    if (eventIds.length > 0) {
      const eventMap = new Map<string, NostrEvent>();
      const missingIds: string[] = [];

      for (const id of eventIds) {
        const cached = this.eventCache.get(id);
        if (cached) {
          eventMap.set(id, cached);
        } else {
          missingIds.push(id);
        }
      }

      if (missingIds.length > 0) {
        const storageKeys = missingIds.map(id => `event:${id}`);
        const eventDataMap = await this.state.storage.get<Uint8Array>(storageKeys);

        for (const id of missingIds) {
          const eventData = eventDataMap.get(`event:${id}`);
          if (eventData) {
            try {
              const event = unpack(eventData) as NostrEvent;
              eventMap.set(id, event);
              this.addToEventCache(event);
            } catch (err) {
              console.warn(`Failed to unpack event ${id}:`, err);
            }
          }
        }
      }

      for (const id of eventIds) {
        const event = eventMap.get(id);
        if (event) {
          events.push(event);
        }
      }
    }

    const response: ShardQueryResponse = {
      eventIds,
      events,
      count: eventIds.length,
      latencyMs: 0,
      shardInfo: {
        startTime: this.shardStartTime,
        endTime: this.shardEndTime,
        eventCount: this.eventCount,
        isStale: this.isStale
      }
    };

    return new Response(pack(response), {
      headers: { 'Content-Type': 'application/msgpack' }
    });
  }

  private addToEventCache(event: NostrEvent): void {
    if (this.eventCache.size >= this.MAX_EVENT_CACHE_SIZE) {
      const firstKey = this.eventCache.keys().next().value;
      if (firstKey) {
        this.eventCache.delete(firstKey);
      }
    }
    this.eventCache.set(event.id, event);
  }

  private async executeQuery(filter: ShardQueryRequest): Promise<string[]> {
    const since = filter.since ?? 0;
    const until = filter.until ?? Math.floor(Date.now() / 1000);
    const limit = filter.limit ?? 5000;

    if (filter.ids && filter.ids.length > 0) {
      const results: string[] = [];

      for (const id of filter.ids) {
        if (this.deletedEvents.has(id)) {
          continue;
        }

        const eventData = await this.state.storage.get<Uint8Array>(`event:${id}`);
        if (!eventData) {
          continue;
        }

        try {
          const event = unpack(eventData) as NostrEvent;

          if (event.created_at < since || event.created_at > until) {
            continue;
          }
        } catch (err) {
          console.warn(`MessagePack read failed for ${id}, skipping:`, err);
          continue;
        }

        results.push(id);

        if (results.length >= limit) {
          break;
        }
      }

      return results;
    }

    if (filter.kinds?.length === 0 || filter.authors?.length === 0) {
      return [];
    }

    if (filter.tags) {
      for (const tagValues of Object.values(filter.tags)) {
        if (tagValues.length === 0) {
          return [];
        }
      }
    }

    const hasKinds = filter.kinds && filter.kinds.length > 0;
    const hasAuthors = filter.authors && filter.authors.length > 0;
    const hasTags = filter.tags && Object.keys(filter.tags).length > 0;
    const hasSearch = filter.search && filter.search.trim().length > 0;

    if (hasAuthors && filter.authors!.length === 1 && hasKinds && !hasTags && !hasSearch) {
      const inMemoryResults = await this.queryPubkeyKind(filter.authors![0], filter.kinds!, since, until, limit);
      return await this.queryStorageIndices(filter, inMemoryResults);
    }

    if (hasTags && hasKinds && !hasAuthors && !hasSearch) {
      const tagEntries = Object.entries(filter.tags!);
      if (tagEntries.length === 1 && tagEntries[0][1].length === 1) {
        const [tagType, tagValues] = tagEntries[0];
        const tagKey = `${tagType}:${tagValues[0]}`;
        const inMemoryResults = await this.queryTagKind(tagKey, filter.kinds!, since, until, limit);
        return await this.queryStorageIndices(filter, inMemoryResults);
      }
    }

    if (!hasKinds && !hasAuthors && !hasTags && !hasSearch) {
      const inMemoryResults = this.queryGlobalCreated(since, until, limit);
      return await this.queryStorageIndices(filter, inMemoryResults);
    }

    if (hasSearch) {
      let candidates: Set<string> | null = null;

      if (hasTags) {
        for (const [tagType, tagValues] of Object.entries(filter.tags!)) {
          const tagCandidates = await this.queryCandidatesByTag(tagType, tagValues, since, until);
          candidates = candidates
            ? this.intersectSets(candidates, tagCandidates)
            : tagCandidates;
        }
      }

      if (hasAuthors) {
        const authorCandidates = await this.queryCandidatesByAuthor(filter.authors!, since, until);
        candidates = candidates
          ? this.intersectSets(candidates, authorCandidates)
          : authorCandidates;
      }

      if (hasKinds) {
        const kindCandidates = await this.queryCandidatesByKind(filter.kinds!, since, until);
        candidates = candidates
          ? this.intersectSets(candidates, kindCandidates)
          : kindCandidates;
      }

      if (!candidates) {
        candidates = await this.queryCandidatesByKind([1], since, until);
      }

      const rankedResults = this.searchContent(filter.search || '', candidates);
      const inMemoryResults = rankedResults.slice(0, limit);
      return await this.queryStorageIndices(filter, inMemoryResults);
    }

    if (!hasKinds && !hasAuthors && !hasTags) {
      const candidates = await this.getAllEventsInTimeRange(since, until);
      const inMemoryResults = this.sortAndLimit(Array.from(candidates), limit);
      return await this.queryStorageIndices(filter, inMemoryResults);
    }

    let candidates: Set<string> | null = null;

    if (hasTags) {
      for (const [tagType, tagValues] of Object.entries(filter.tags!)) {
        const tagCandidates = await this.queryCandidatesByTag(tagType, tagValues, since, until);
        candidates = candidates
          ? this.intersectSets(candidates, tagCandidates)
          : tagCandidates;
      }
    }

    if (hasAuthors) {
      const authorCandidates = await this.queryCandidatesByAuthor(filter.authors!, since, until);
      candidates = candidates
        ? this.intersectSets(candidates, authorCandidates)
        : authorCandidates;
    }

    if (hasKinds) {
      const kindCandidates = await this.queryCandidatesByKind(filter.kinds!, since, until);
      candidates = candidates
        ? this.intersectSets(candidates, kindCandidates)
        : kindCandidates;
    }

    const inMemoryResults = this.sortAndLimit(Array.from(candidates || []), limit);
    return await this.queryStorageIndices(filter, inMemoryResults);
  }

  private async queryStorageIndices(filter: ShardQueryRequest, inMemoryResults: string[]): Promise<string[]> {
    const since = filter.since ?? 0;
    const until = filter.until ?? Math.floor(Date.now() / 1000);
    const limit = filter.limit ?? 5000;

    const hasKinds = filter.kinds && filter.kinds.length > 0;
    const hasAuthors = filter.authors && filter.authors.length > 0;
    const hasTags = filter.tags && Object.keys(filter.tags).length > 0;

    let needsFallback = false;
    const storageKeysToLoad: string[] = [];

    if (hasKinds) {
      for (const kind of filter.kinds!) {
        const storageKey = `kind:${kind}`;
        if (this.trimmedIndices.has(storageKey)) {
          needsFallback = true;
          storageKeysToLoad.push(storageKey);
        }
      }
    }

    if (hasAuthors) {
      for (const author of filter.authors!) {
        const storageKey = `author:${author}`;
        if (this.trimmedIndices.has(storageKey)) {
          needsFallback = true;
          storageKeysToLoad.push(storageKey);
        }
      }
    }

    if (hasTags) {
      for (const [tagType, tagValues] of Object.entries(filter.tags!)) {
        for (const tagValue of tagValues) {
          const storageKey = `tag:${tagType}:${tagValue}`;
          if (this.trimmedIndices.has(storageKey)) {
            needsFallback = true;
            storageKeysToLoad.push(storageKey);
          }
        }
      }
    }

    if (this.trimmedIndices.has('created_index')) {
      needsFallback = true;
      storageKeysToLoad.push('created_index');
    }

    if (!needsFallback || inMemoryResults.length >= limit) {
      return inMemoryResults;
    }

    console.log(`Storage fallback query: loading ${storageKeysToLoad.length} full indices from storage`);

    const storageResults = await this.state.storage.get(storageKeysToLoad);

    let candidates: Set<string> | null = null;

    if (hasKinds) {
      for (const kind of filter.kinds!) {
        const storageKey = `kind:${kind}`;
        const storedIndex = storageResults.get(storageKey) as { entries: IndexEntry[], count: number, minTime: number, maxTime: number } | undefined;
        if (storedIndex && storedIndex.entries) {
          const indexCandidates = this.queryCandidatesFromStoredIndex(storedIndex, since, until);
          candidates = candidates ? this.unionSets(candidates, indexCandidates) : indexCandidates;
        }
      }
    }

    if (hasAuthors) {
      const authorCandidates = new Set<string>();
      for (const author of filter.authors!) {
        const storageKey = `author:${author}`;
        const storedIndex = storageResults.get(storageKey) as { entries: IndexEntry[], count: number, minTime: number, maxTime: number } | undefined;
        if (storedIndex && storedIndex.entries) {
          const indexCandidates = this.queryCandidatesFromStoredIndex(storedIndex, since, until);
          for (const id of indexCandidates) {
            authorCandidates.add(id);
          }
        }
      }
      candidates = candidates ? this.intersectSets(candidates, authorCandidates) : authorCandidates;
    }

    if (hasTags) {
      for (const [tagType, tagValues] of Object.entries(filter.tags!)) {
        const tagCandidates = new Set<string>();
        for (const tagValue of tagValues) {
          const storageKey = `tag:${tagType}:${tagValue}`;
          const storedIndex = storageResults.get(storageKey) as { entries: IndexEntry[], count: number, minTime: number, maxTime: number } | undefined;
          if (storedIndex && storedIndex.entries) {
            const indexCandidates = this.queryCandidatesFromStoredIndex(storedIndex, since, until);
            for (const id of indexCandidates) {
              tagCandidates.add(id);
            }
          }
        }
        candidates = candidates ? this.intersectSets(candidates, tagCandidates) : tagCandidates;
      }
    }

    const inMemorySet = new Set(inMemoryResults);
    if (candidates) {
      for (const id of candidates) {
        inMemorySet.add(id);
      }
    }

    return this.sortAndLimit(Array.from(inMemorySet), limit);
  }

  private queryCandidatesFromStoredIndex(
    storedIndex: { entries: IndexEntry[], count: number, minTime: number, maxTime: number },
    since: number,
    until: number
  ): Set<string> {
    const results = new Set<string>();

    if (!storedIndex.entries) {
      return results;
    }

    for (const entry of storedIndex.entries) {
      if (entry.created_at >= since && entry.created_at <= until) {
        if (!this.deletedEvents.has(entry.eventId)) {
          results.add(entry.eventId);
        }
      }
    }

    return results;
  }

  private unionSets(setA: Set<string>, setB: Set<string>): Set<string> {
    const result = new Set(setA);
    for (const item of setB) {
      result.add(item);
    }
    return result;
  }

  private async queryCandidatesByKind(
    kinds: number[],
    since: number,
    until: number
  ): Promise<Set<string>> {
    const results = new Set<string>();

    await Promise.all(kinds.map(k => this.ensureKindIndexLoaded(k)));

    for (const kind of kinds) {
      const index = this.kindIndex.get(kind);
      if (!index) continue;

      for (const entry of index.entries) {
        if (entry.created_at >= since && entry.created_at <= until) {
          results.add(entry.eventId);
        }
      }
    }

    return results;
  }

  private async queryCandidatesByAuthor(
    authors: string[],
    since: number,
    until: number
  ): Promise<Set<string>> {
    const results = new Set<string>();

    await Promise.all(authors.map(a => this.ensureAuthorIndexLoaded(a)));

    for (const author of authors) {
      const index = this.authorIndex.get(author);
      if (!index) continue;

      for (const entry of index.entries) {
        if (entry.created_at >= since && entry.created_at <= until) {
          results.add(entry.eventId);
        }
      }
    }

    return results;
  }

  private async queryCandidatesByTag(
    tagType: string,
    tagValues: string[],
    since: number,
    until: number
  ): Promise<Set<string>> {
    const results = new Set<string>();

    const tagKeys = tagValues.map(v => `${tagType}:${v}`);
    await Promise.all(tagKeys.map(tk => this.ensureTagIndexLoaded(tk)));

    for (const tagValue of tagValues) {
      const tagKey = `${tagType}:${tagValue}`;
      const index = this.tagIndex.get(tagKey);
      if (!index) continue;

      for (const entry of index.entries) {
        if (entry.created_at >= since && entry.created_at <= until) {
          results.add(entry.eventId);
        }
      }
    }

    return results;
  }

  private async getAllEventsInTimeRange(since: number, until: number): Promise<Set<string>> {
    const results = new Set<string>();

    for (const [_, index] of this.kindIndex) {
      for (const entry of index.entries) {
        if (entry.created_at >= since && entry.created_at <= until) {
          results.add(entry.eventId);
        }
      }
    }

    return results;
  }

  private intersectSets(set1: Set<string>, set2: Set<string>): Set<string> {
    const result = new Set<string>();
    const smaller = set1.size < set2.size ? set1 : set2;
    const larger = set1.size < set2.size ? set2 : set1;

    for (const item of smaller) {
      if (larger.has(item)) {
        result.add(item);
      }
    }

    return result;
  }

  private async queryPubkeyKind(
    pubkey: string,
    kinds: number[],
    since: number,
    until: number,
    limit: number
  ): Promise<string[]> {
    const results: string[] = [];

    await Promise.all(kinds.map(k => this.ensurePubkeyKindIndexLoaded(pubkey, k)));

    const kindMap = this.pubkeyKindIndex.get(pubkey);
    if (!kindMap) {
      return [];
    }

    for (const kind of kinds) {
      const index = kindMap.get(kind);
      if (!index) continue;

      for (const entry of index.entries) {
        if (entry.created_at >= since && entry.created_at <= until) {
          results.push(entry.eventId);
          if (results.length >= limit) {
            return results;
          }
        }
      }
    }

    return results;
  }

  private async queryTagKind(
    tagKey: string,
    kinds: number[],
    since: number,
    until: number,
    limit: number
  ): Promise<string[]> {
    const results: string[] = [];

    await Promise.all(kinds.map(k => this.ensureTagKindIndexLoaded(tagKey, k)));

    const kindMap = this.tagKindIndex.get(tagKey);
    if (!kindMap) {
      return [];
    }

    for (const kind of kinds) {
      const index = kindMap.get(kind);
      if (!index) continue;

      for (const entry of index.entries) {
        if (entry.created_at >= since && entry.created_at <= until) {
          results.push(entry.eventId);
          if (results.length >= limit) {
            return results;
          }
        }
      }
    }

    return results;
  }

  private queryGlobalCreated(
    since: number,
    until: number,
    limit: number
  ): string[] {
    if (!this.createdIndex) {
      return [];
    }

    const results: string[] = [];
    for (const entry of this.createdIndex.entries) {
      if (entry.created_at >= since && entry.created_at <= until) {
        results.push(entry.eventId);
        if (results.length >= limit) {
          break;
        }
      }
    }

    return results;
  }

  private sortAndLimit(eventIds: string[], limit: number): string[] {
    if (eventIds.length === 0) return [];

    const timestampMap = new Map<string, number>();

    if (this.createdIndex) {
      const eventIdSet = new Set(eventIds);

      for (const entry of this.createdIndex.entries) {
        if (eventIdSet.has(entry.eventId)) {
          timestampMap.set(entry.eventId, entry.created_at);
        }
      }
    }

    const sorted = eventIds.sort((a, b) => {
      const timeA = timestampMap.get(a) ?? 0;
      const timeB = timestampMap.get(b) ?? 0;
      return timeB - timeA;
    });

    return sorted.slice(0, limit);
  }

  private async handleGetEvents(request: Request): Promise<Response> {
    let eventIds: string[];

    try {
      const payload = unpack(new Uint8Array(await request.arrayBuffer())) as ShardGetEventsRequest;
      eventIds = payload.eventIds;
    } catch (error: any) {
      if (error.message?.includes('client disconnected')) {
        console.log('Client disconnected during get-events request');
        return new Response('Client disconnected', { status: 499 });
      }
      throw error;
    }

    if (!eventIds || !Array.isArray(eventIds)) {
      const error: ErrorResponse = { error: 'eventIds array required' };
      return new Response(pack(error), {
        status: 400,
        headers: { 'Content-Type': 'application/msgpack' }
      });
    }

    const events: NostrEvent[] = [];
    const missing: string[] = [];

    for (const eventId of eventIds) {
      if (this.deletedEvents.has(eventId)) {
        missing.push(eventId);
        continue;
      }

      const eventData = await this.state.storage.get<Uint8Array>(`event:${eventId}`);
      if (eventData) {
        try {
          const event = unpack(eventData) as NostrEvent;
          events.push(event);
        } catch (err) {
          console.warn(`MessagePack deserialization failed for ${eventId}:`, err);
          missing.push(eventId);
        }
      } else {
        missing.push(eventId);
      }
    }

    const response: ShardGetEventsResponse = {
      events,
      count: events.length,
      missing: missing.length > 0 ? missing : undefined
    };

    return new Response(pack(response), {
      headers: { 'Content-Type': 'application/msgpack' }
    });
  }

  private async deleteEventById(eventId: string): Promise<void> {
    const eventData = await this.state.storage.get<Uint8Array>(`event:${eventId}`);
    if (!eventData) return;

    let event: NostrEvent;
    try {
      event = unpack(eventData) as NostrEvent;
    } catch (err) {
      console.warn(`MessagePack read failed for ${eventId}:`, err);
      return;
    }

    const storageBatch: Record<string, any> = {};
    const keysToDelete: string[] = [];

    const kindIdx = this.kindIndex.get(event.kind);
    if (kindIdx) {
      const entryIndex = kindIdx.entries.findIndex(e => e.eventId === eventId);
      if (entryIndex >= 0) {
        kindIdx.entries.splice(entryIndex, 1);
        kindIdx.eventIdSet.delete(eventId);
        kindIdx.count--;
        storageBatch[`kind:${event.kind}`] = {
          entries: kindIdx.entries,
          count: kindIdx.count,
          minTime: kindIdx.minTime,
          maxTime: kindIdx.maxTime,
          lastUpdate: kindIdx.lastUpdate
        };
      }
    }

    const authorIdx = this.authorIndex.get(event.pubkey);
    if (authorIdx) {
      const entryIndex = authorIdx.entries.findIndex(e => e.eventId === eventId);
      if (entryIndex >= 0) {
        authorIdx.entries.splice(entryIndex, 1);
        authorIdx.eventIdSet.delete(eventId);
        authorIdx.count--;
        storageBatch[`author:${event.pubkey}`] = {
          entries: authorIdx.entries,
          count: authorIdx.count,
          minTime: authorIdx.minTime,
          maxTime: authorIdx.maxTime,
          lastUpdate: authorIdx.lastUpdate
        };
      }
    }

    for (const tag of event.tags) {
      if (tag.length >= 2) {
        const tagKey = `${tag[0]}:${tag[1]}`;
        const tagIdx = this.tagIndex.get(tagKey);
        if (tagIdx) {
          const entryIndex = tagIdx.entries.findIndex(e => e.eventId === eventId);
          if (entryIndex >= 0) {
            tagIdx.entries.splice(entryIndex, 1);
            tagIdx.eventIdSet.delete(eventId);
            tagIdx.count--;
            storageBatch[`tag:${tagKey}`] = {
              entries: tagIdx.entries,
              count: tagIdx.count,
              minTime: tagIdx.minTime,
              maxTime: tagIdx.maxTime,
              lastUpdate: tagIdx.lastUpdate
            };
          }
        }
      }
    }

    if (event.kind === 1 && this.eventContent.has(eventId)) {
      const content = this.eventContent.get(eventId);
      if (content) {
        const tokens = this.tokenizeContent(content);
        for (const token of tokens) {
          const eventSet = this.contentIndex.get(token);
          if (eventSet) {
            eventSet.delete(eventId);
            if (eventSet.size === 0) {
              this.contentIndex.delete(token);
              keysToDelete.push(`content:${token}`);
            } else {
              storageBatch[`content:${token}`] = Array.from(eventSet);
            }
          }
        }
      }
      this.eventContent.delete(eventId);
      keysToDelete.push(`eventcontent:${eventId}`);
    }

    if (this.isReplaceableKind(event.kind)) {
      const replaceableKey = this.getReplaceableKey(event.kind, event.pubkey);
      if (this.replaceableIndex.get(replaceableKey) === eventId) {
        this.replaceableIndex.delete(replaceableKey);
        keysToDelete.push(`replaceable:${replaceableKey}`);
      }
    }

    if (this.isAddressableKind(event.kind)) {
      const dTag = this.getDTag(event);
      const addressableKey = this.getAddressableKey(event.kind, event.pubkey, dTag);
      if (this.addressableIndex.get(addressableKey) === eventId) {
        this.addressableIndex.delete(addressableKey);
        keysToDelete.push(`addressable:${addressableKey}`);
      }
    }

    if (this.isChannelMetadataKind(event.kind)) {
      const eTag = this.getETag(event);
      const channelMetadataKey = this.getChannelMetadataKey(event.pubkey, eTag);
      if (this.channelMetadataIndex.get(channelMetadataKey) === eventId) {
        this.channelMetadataIndex.delete(channelMetadataKey);
        keysToDelete.push(`channelmeta:${channelMetadataKey}`);
      }
    }

    const pubkeyKindMap = this.pubkeyKindIndex.get(event.pubkey);
    if (pubkeyKindMap) {
      const pkIndex = pubkeyKindMap.get(event.kind);
      if (pkIndex) {
        const entryIndex = pkIndex.entries.findIndex(e => e.eventId === eventId);
        if (entryIndex >= 0) {
          pkIndex.entries.splice(entryIndex, 1);
          pkIndex.eventIdSet.delete(eventId);
          pkIndex.count--;

          if (pkIndex.count === 0) {
            pubkeyKindMap.delete(event.kind);
            keysToDelete.push(`pubkeykind:${event.pubkey}:${event.kind}`);
          } else {
            storageBatch[`pubkeykind:${event.pubkey}:${event.kind}`] = {
              entries: pkIndex.entries,
              count: pkIndex.count,
              minTime: pkIndex.minTime,
              maxTime: pkIndex.maxTime,
              lastUpdate: pkIndex.lastUpdate
            };
          }
        }
      }
    }

    for (const tag of event.tags) {
      if (tag.length >= 2) {
        const tagKey = `${tag[0]}:${tag[1]}`;
        const tagKindMap = this.tagKindIndex.get(tagKey);
        if (tagKindMap) {
          const tkIndex = tagKindMap.get(event.kind);
          if (tkIndex) {
            const entryIndex = tkIndex.entries.findIndex(e => e.eventId === eventId);
            if (entryIndex >= 0) {
              tkIndex.entries.splice(entryIndex, 1);
              tkIndex.eventIdSet.delete(eventId);
              tkIndex.count--;

              if (tkIndex.count === 0) {
                tagKindMap.delete(event.kind);
                keysToDelete.push(`tagkind:${tagKey}:${event.kind}`);
              } else {
                storageBatch[`tagkind:${tagKey}:${event.kind}`] = {
                  entries: tkIndex.entries,
                  count: tkIndex.count,
                  minTime: tkIndex.minTime,
                  maxTime: tkIndex.maxTime,
                  lastUpdate: tkIndex.lastUpdate
                };
              }
            }
          }
        }
      }
    }

    if (this.createdIndex) {
      const entryIndex = this.createdIndex.entries.findIndex(e => e.eventId === eventId);
      if (entryIndex >= 0) {
        this.createdIndex.entries.splice(entryIndex, 1);
        this.createdIndex.eventIdSet.delete(eventId);
        this.createdIndex.count--;

        storageBatch['created_index'] = {
          entries: this.createdIndex.entries,
          count: this.createdIndex.count,
          minTime: this.createdIndex.minTime,
          maxTime: this.createdIndex.maxTime,
          lastUpdate: this.createdIndex.lastUpdate
        };
      }
    }

    if (this.expirationIndex.has(eventId)) {
      this.expirationIndex.delete(eventId);
      storageBatch['expiration_index'] = Array.from(this.expirationIndex.entries());
    }

    this.deletedEvents.add(eventId);

    keysToDelete.push(`event:${eventId}`);

    if (Object.keys(storageBatch).length > 0) {
      await this.state.storage.put(storageBatch);
    }
    if (keysToDelete.length > 0) {
      await this.state.storage.delete(keysToDelete);
    }

    this.eventCount--;
  }

  private async handleDeleteEvents(request: Request): Promise<Response> {
    let eventIds: string[];

    try {
      const payload = unpack(new Uint8Array(await request.arrayBuffer())) as { eventIds: string[] };
      eventIds = payload.eventIds;
    } catch (error: any) {
      if (error.message?.includes('client disconnected')) {
        console.log('Client disconnected during delete-events request');
        return new Response('Client disconnected', { status: 499 });
      }
      throw error;
    }

    if (!eventIds || !Array.isArray(eventIds)) {
      return new Response(
        pack({ error: 'eventIds array required' }),
        { status: 400, headers: { 'Content-Type': 'application/msgpack' } }
      );
    }

    let deletedCount = 0;

    for (const eventId of eventIds) {
      const eventData = await this.state.storage.get<Uint8Array>(`event:${eventId}`);

      if (eventData) {
        await this.deleteEventById(eventId);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      await this.state.storage.put('deleted_events', Array.from(this.deletedEvents));
      await this.saveMetadata();
    }

    return new Response(
      pack({
        deleted: deletedCount,
        total: eventIds.length
      }),
      { headers: { 'Content-Type': 'application/msgpack' } }
    );
  }
}