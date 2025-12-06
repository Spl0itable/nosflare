export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface NostrFilter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  [key: string]: any;
}

export interface RelayInfo {
  name: string;
  description: string;
  pubkey: string;
  contact: string;
  supported_nips: number[];
  software: string;
  version: string;
  icon: string;
  limitation?: {
    payment_required?: boolean;
    restricted_writes?: boolean;
    auth_required?: boolean;
    created_at_lower_limit?: number;
    created_at_upper_limit?: number;
    [key: string]: any;
  };
  payments_url?: string;
  fees?: {
    admission?: Array<{ amount: number; unit: string }>;
    subscription?: Array<{ amount: number; unit: string; period: number }>;
    publication?: Array<{ kinds: number[]; amount: number; unit: string }>;
  };
}

export interface QueryResult {
  events: NostrEvent[];
}

export interface EventToIndex {
  event: NostrEvent;
  timestamp: number;
}

export interface ShardQueryRequest {
  kinds?: number[];
  authors?: string[];
  ids?: string[];
  tags?: Record<string, string[]>;
  since?: number;
  until?: number;
  limit?: number;
  search?: string;
}

export interface ShardInfo {
  startTime: number;
  endTime: number;
  eventCount: number;
  isStale: boolean;
}

export interface ShardQueryResponse {
  eventIds: string[];
  events?: NostrEvent[];
  count: number;
  latencyMs: number;
  shardInfo: ShardInfo;
}

export interface ShardInsertResponse {
  inserted: number;
  eventCount: number;
  isStale: boolean;
}

export interface ShardGetEventsRequest {
  eventIds: string[];
}

export interface ShardGetEventsResponse {
  events: NostrEvent[];
  count: number;
  missing?: string[];
}

export interface ShardStatsResponse {
  shardInfo: {
    startTime: number;
    endTime: number;
    windowMs: number;
    isStale: boolean;
  };
  eventCount: number;
  indices: {
    kinds: number;
    authors: number;
    tags: number;
  };
  indexSizes: {
    kinds: Array<{ kind: number; count: number }>;
    topAuthors: Array<{ author: string; count: number }>;
  };
  config: {
    maxEventsPerShard: number;
    maxIndexSize: number;
    shardWindowMs: number;
  };
}

export interface IndexEntry {
  eventId: string;
  created_at: number;
  kind: number;
  pubkey: string;
}

export interface SortedIndex {
  entries: IndexEntry[];
  eventIdSet: Set<string>;
  count: number;
  minTime: number;
  maxTime: number;
  lastUpdate: number;
}

export interface PaymentRecord {
  pubkey: string;
  paidAt: number;
  amountSats: number;
  expiresAt?: number;
}

export interface PaymentCheckRequest {
  pubkey: string;
}

export interface PaymentCheckResponse {
  hasPaid: boolean;
  reason?: string;
  record?: {
    paidAt: number;
    amountSats: number;
    expiresAt?: number;
  };
}

export interface PaymentAddResponse {
  success: boolean;
  message: string;
}

export interface PaymentRemoveRequest {
  pubkey: string;
}

export interface PaymentRemoveResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  error: string;
}

export interface Env {
  CONNECTION_DO: DurableObjectNamespace;

  SESSION_MANAGER_DO: DurableObjectNamespace;

  EVENT_SHARD_DO: DurableObjectNamespace;

  PAYMENT_DO: DurableObjectNamespace;

  NOSTR_ARCHIVE: R2Bucket;

  BROADCAST_QUEUE_0: Queue<BroadcastQueueMessage>;
  BROADCAST_QUEUE_1: Queue<BroadcastQueueMessage>;
  BROADCAST_QUEUE_2: Queue<BroadcastQueueMessage>;
  BROADCAST_QUEUE_3: Queue<BroadcastQueueMessage>;
  BROADCAST_QUEUE_4: Queue<BroadcastQueueMessage>;
  BROADCAST_QUEUE_5: Queue<BroadcastQueueMessage>;
  BROADCAST_QUEUE_6: Queue<BroadcastQueueMessage>;
  BROADCAST_QUEUE_7: Queue<BroadcastQueueMessage>;
  BROADCAST_QUEUE_8: Queue<BroadcastQueueMessage>;
  BROADCAST_QUEUE_9: Queue<BroadcastQueueMessage>;

  INDEXING_QUEUE_PRIMARY_0: Queue<EventToIndex>;
  INDEXING_QUEUE_PRIMARY_1: Queue<EventToIndex>;
  INDEXING_QUEUE_PRIMARY_2: Queue<EventToIndex>;
  INDEXING_QUEUE_PRIMARY_3: Queue<EventToIndex>;
  INDEXING_QUEUE_PRIMARY_4: Queue<EventToIndex>;
  INDEXING_QUEUE_PRIMARY_5: Queue<EventToIndex>;
  INDEXING_QUEUE_PRIMARY_6: Queue<EventToIndex>;
  INDEXING_QUEUE_PRIMARY_7: Queue<EventToIndex>;
  INDEXING_QUEUE_PRIMARY_8: Queue<EventToIndex>;
  INDEXING_QUEUE_PRIMARY_9: Queue<EventToIndex>;

  INDEXING_QUEUE_REPLICA_ENAM_0: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_ENAM_1: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_ENAM_2: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_ENAM_3: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_ENAM_4: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_ENAM_5: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_ENAM_6: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_ENAM_7: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_ENAM_8: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_ENAM_9: Queue<EventToIndex>;

  INDEXING_QUEUE_REPLICA_WEUR_0: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_WEUR_1: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_WEUR_2: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_WEUR_3: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_WEUR_4: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_WEUR_5: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_WEUR_6: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_WEUR_7: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_WEUR_8: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_WEUR_9: Queue<EventToIndex>;

  INDEXING_QUEUE_REPLICA_APAC_0: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_APAC_1: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_APAC_2: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_APAC_3: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_APAC_4: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_APAC_5: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_APAC_6: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_APAC_7: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_APAC_8: Queue<EventToIndex>;
  INDEXING_QUEUE_REPLICA_APAC_9: Queue<EventToIndex>;

  R2_ARCHIVE_QUEUE: Queue<R2ArchiveQueueMessage>;
}

export interface RateLimiterConfig {
  rate: number;
  capacity: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private capacity: number;
  private fillRate: number;

  constructor(rate: number, capacity: number) {
    this.tokens = capacity;
    this.lastRefillTime = Date.now();
    this.capacity = capacity;
    this.fillRate = rate;
  }

  removeToken(): boolean {
    this.refill();
    if (this.tokens < 1) {
      return false;
    }
    this.tokens -= 1;
    return true;
  }

  private refill(): void {
    const now = Date.now();
    const elapsedTime = now - this.lastRefillTime;
    const tokensToAdd = Math.floor(elapsedTime * this.fillRate);
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }
}

export interface Nip05Response {
  names: Record<string, string>;
  relays?: Record<string, string[]>;
}

export type NostrMessage =
  | ["EVENT", string, NostrEvent]
  | ["EOSE", string]
  | ["OK", string, boolean, string]
  | ["NOTICE", string]
  | ["REQ", string, ...NostrFilter[]]
  | ["CLOSE", string]
  | ["CLOSED", string, string]
  | ["AUTH", string | NostrEvent];

export interface BroadcastQueueMessage {
  event: NostrEvent;
  timestamp: number;
}

export interface R2ArchiveQueueMessage {
  event: NostrEvent;
  timestamp: number;
}

export interface PreSerializedEvent {
  event: NostrEvent;
  serializedJson: string;
}

export interface ConnectionBroadcastRequest {
  events: PreSerializedEvent[];
}

export interface DurableObject {
  fetch(request: Request): Promise<Response>;
  webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>;
  webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void>;
  webSocketError?(ws: WebSocket, error: any): void | Promise<void>;
}

export interface DurableObjectStub {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  newUniqueId(options?: { jurisdiction?: string }): DurableObjectId;
  get(id: DurableObjectId, options?: { locationHint?: string }): DurableObjectStub;
}

export interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

export interface DurableObjectState {
  id: DurableObjectId;
  storage: DurableObjectStorage;
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
  acceptWebSocket(ws: WebSocket): void;
  getWebSockets(): WebSocket[];
}

export interface DurableObjectStorage {
  get<T = any>(key: string): Promise<T | undefined>;
  get<T = any>(keys: string[]): Promise<Map<string, T>>;
  list<T = any>(options?: { start?: string; end?: string; reverse?: boolean; limit?: number; prefix?: string }): Promise<Map<string, T>>;
  put<T = any>(key: string, value: T): Promise<void>;
  put(entries: Record<string, any>): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  getAlarm(): Promise<number | null>;
  deleteAlarm(): Promise<void>;
}

declare global {
  interface WebSocket {
    serializeAttachment(value: any): void;
    deserializeAttachment(): any;
  }
}