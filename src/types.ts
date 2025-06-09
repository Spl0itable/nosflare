// Nostr protocol types
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
  [key: string]: any; // For tag filters like #e, #p, etc.
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
    [key: string]: any;
  };
  payments_url?: string;
  fees?: {
    admission?: Array<{ amount: number; unit: string }>;
    subscription?: Array<{ amount: number; unit: string; period: number }>;
    publication?: Array<{ kinds: number[]; amount: number; unit: string }>;
  };
}

export interface Subscription {
  id: string;
  filters: NostrFilter[];
}

export interface QueryResult {
  events: NostrEvent[];
  bookmark: string | null;
}

// Worker environment type
export interface Env {
  relayDb: D1Database;
  RELAY_WEBSOCKET: DurableObjectNamespace;
}

// Durable Object types
export interface RateLimiterConfig {
  rate: number;
  capacity: number;
}

export interface WebSocketSession {
  id: string;
  webSocket: WebSocket;
  subscriptions: Map<string, NostrFilter[]>;
  pubkeyRateLimiter: RateLimiter;
  reqRateLimiter: RateLimiter;
  bookmark: string;
  host?: string; // Add this line
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

// NIP-05 response type
export interface Nip05Response {
  names: Record<string, string>;
  relays?: Record<string, string[]>;
}

// WebSocket message types for Nostr protocol
export type NostrMessage = 
  | ["EVENT", string, NostrEvent]
  | ["EOSE", string]
  | ["OK", string, boolean, string]
  | ["NOTICE", string]
  | ["REQ", string, ...NostrFilter[]]
  | ["CLOSE", string];

// WebSocket event types (for Cloudflare Workers)
export interface WebSocketEventMap {
  "close": CloseEvent;
  "error": Event;
  "message": MessageEvent;
  "open": Event;
}