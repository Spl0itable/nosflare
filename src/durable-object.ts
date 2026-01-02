import { NostrEvent, NostrFilter, RateLimiter, WebSocketSession, Env, DOBroadcastRequest, QueryResult } from './types';
import {
  PUBKEY_RATE_LIMIT,
  REQ_RATE_LIMIT,
  PAY_TO_RELAY_ENABLED,
  AUTH_REQUIRED,
  AUTH_TIMEOUT_MS,
  isPubkeyAllowed,
  isEventKindAllowed,
  containsBlockedContent,
  isTagAllowed,
  excludedRateLimitKinds
} from './config';
import { verifyEventSignature, hasPaidForRelay, processEvent, queryEvents } from './relay-worker';

// Session attachment data structure (minimal - auth state stored in session)
interface SessionAttachment {
  sessionId: string;
  bookmark: string;
  host: string;
  doName: string;
  hasPaid?: boolean;
}

// Cache entry interface with access tracking
interface CacheEntry {
  result: QueryResult;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

// Payment cache entry
interface PaymentCacheEntry {
  hasPaid: boolean;
  timestamp: number;
}

export class RelayWebSocket implements DurableObject {
  private sessions: Map<string, WebSocketSession>;
  private env: Env;
  private state: DurableObjectState;
  private region: string;
  private doId: string;
  private doName: string;
  private processedEvents: Map<string, number> = new Map(); // eventId -> timestamp

  // Query cache for REQ messages
  private queryCache: Map<string, CacheEntry> = new Map();
  private readonly QUERY_CACHE_TTL = 60000;
  private readonly MAX_CACHE_SIZE = 100;

  // Query cache index for efficient invalidation (kind:X, author:Y, etc.)
  private queryCacheIndex: Map<string, Set<string>> = new Map();

  // Active queries for deduplication (prevent duplicate work)
  private activeQueries: Map<string, Promise<QueryResult>> = new Map();

  // Payment status cache
  private paymentCache: Map<string, PaymentCacheEntry> = new Map();
  private readonly PAYMENT_CACHE_TTL = 60000;

  // Alarm and cleanup configuration
  private readonly IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private lastActivityTime: number = Date.now();

  // Define allowed endpoints
  private static readonly ALLOWED_ENDPOINTS = [
    'relay-WNAM-primary',  // Western North America
    'relay-ENAM-primary',  // Eastern North America
    'relay-WEUR-primary',  // Western Europe
    'relay-EEUR-primary',  // Eastern Europe
    'relay-APAC-primary',  // Asia-Pacific
    'relay-OC-primary',    // Oceania
    'relay-SAM-primary',   // South America (redirects to enam)
    'relay-AFR-primary',   // Africa (redirects to weur)
    'relay-ME-primary'     // Middle East (redirects to eeur)
  ];

  // Map endpoints to their proper location hints
  private static readonly ENDPOINT_HINTS: Record<string, string> = {
    'relay-WNAM-primary': 'wnam',
    'relay-ENAM-primary': 'enam',
    'relay-WEUR-primary': 'weur',
    'relay-EEUR-primary': 'eeur',
    'relay-APAC-primary': 'apac',
    'relay-OC-primary': 'oc',
    'relay-SAM-primary': 'enam',  // SAM redirects to ENAM
    'relay-AFR-primary': 'weur',   // AFR redirects to WEUR
    'relay-ME-primary': 'eeur'     // ME redirects to EEUR
  };

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.sessions = new Map();
    this.env = env;
    this.doId = crypto.randomUUID();
    this.region = 'unknown';
    this.doName = 'unknown';
    this.processedEvents = new Map();
    this.queryCache = new Map();
    this.queryCacheIndex = new Map();
    this.activeQueries = new Map();
    this.paymentCache = new Map();
    this.lastActivityTime = Date.now();
  }

  // Alarm handler - called when scheduled alarm fires
  async alarm(): Promise<void> {
    console.log(`Alarm triggered for DO ${this.doName}`);

    const now = Date.now();
    const idleTime = now - this.lastActivityTime;

    // Get active WebSocket count
    const activeWebSockets = this.state.getWebSockets();
    const activeCount = activeWebSockets.length;

    console.log(`DO ${this.doName} - Active WebSockets: ${activeCount}, Idle time: ${idleTime}ms`);

    // If no active connections, clean up and don't reschedule
    if (activeCount === 0) {
      console.log(`Cleaning up DO ${this.doName} - no active connections`);
      await this.cleanup();
      // Don't set another alarm - let the DO be evicted
      return;
    }

    // If still active, schedule next cleanup check
    const nextAlarm = now + this.IDLE_TIMEOUT;
    await this.state.storage.setAlarm(nextAlarm);
    console.log(`Next alarm scheduled for DO ${this.doName} in ${this.IDLE_TIMEOUT}ms`);
  }

  // Cleanup method to clear caches and sessions
  private async cleanup(): Promise<void> {
    console.log(`Running cleanup for DO ${this.doName}`);

    // Clear in-memory caches
    this.queryCache.clear();
    this.queryCacheIndex.clear();
    this.activeQueries.clear();
    this.paymentCache.clear();
    this.processedEvents.clear();

    // Clear sessions
    this.sessions.clear();

    // Clean up orphaned subscription storage data
    await this.cleanupOrphanedSubscriptions();

    console.log(`Cleanup complete for DO ${this.doName}`);
  }

  // Remove orphaned subscription data from storage
  private async cleanupOrphanedSubscriptions(): Promise<void> {
    try {
      // Get all keys from storage
      const allKeys = await this.state.storage.list();

      // Get current active WebSocket sessions
      const activeWebSockets = this.state.getWebSockets();
      const activeSessionIds = new Set<string>();

      for (const ws of activeWebSockets) {
        const attachment = ws.deserializeAttachment() as SessionAttachment | null;
        if (attachment) {
          activeSessionIds.add(attachment.sessionId);
        }
      }

      // Find and delete orphaned subscription keys
      const keysToDelete: string[] = [];
      for (const [key] of allKeys) {
        if (key.startsWith('subs:')) {
          const sessionId = key.substring(5);
          if (!activeSessionIds.has(sessionId)) {
            keysToDelete.push(key);
          }
        }
      }

      if (keysToDelete.length > 0) {
        await this.state.storage.delete(keysToDelete);
        console.log(`Cleaned up ${keysToDelete.length} orphaned subscription entries`);
      }
    } catch (error) {
      console.error('Error cleaning up orphaned subscriptions:', error);
    }
  }

  // Schedule alarm if one doesn't exist
  private async scheduleAlarmIfNeeded(): Promise<void> {
    const existingAlarm = await this.state.storage.getAlarm();

    // Only schedule if no alarm exists
    if (existingAlarm === null) {
      const alarmTime = Date.now() + this.IDLE_TIMEOUT;
      await this.state.storage.setAlarm(alarmTime);
      console.log(`Scheduled first alarm for DO ${this.doName}`);
    }
  }

  // Storage helper methods for subscriptions
  private async saveSubscriptions(sessionId: string, subscriptions: Map<string, NostrFilter[]>): Promise<void> {
    const key = `subs:${sessionId}`;
    const data = Array.from(subscriptions.entries());
    await this.state.storage.put(key, data);
  }

  private async loadSubscriptions(sessionId: string): Promise<Map<string, NostrFilter[]>> {
    const key = `subs:${sessionId}`;
    const data = await this.state.storage.get<[string, NostrFilter[]][]>(key);
    return new Map(data || []);
  }

  private async deleteSubscriptions(sessionId: string): Promise<void> {
    const key = `subs:${sessionId}`;
    await this.state.storage.delete(key);
  }

  // Payment cache methods
  private async getCachedPaymentStatus(pubkey: string): Promise<boolean | null> {
    const cached = this.paymentCache.get(pubkey);
    if (cached && Date.now() - cached.timestamp < this.PAYMENT_CACHE_TTL) {
      return cached.hasPaid;
    }
    // Remove expired entry
    if (cached) {
      this.paymentCache.delete(pubkey);
    }
    return null;
  }

  private setCachedPaymentStatus(pubkey: string, hasPaid: boolean): void {
    this.paymentCache.set(pubkey, {
      hasPaid,
      timestamp: Date.now()
    });

    // Clean up old payment cache entries if too large
    if (this.paymentCache.size > 1000) {
      const sortedEntries = Array.from(this.paymentCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest 20%
      const toRemove = Math.floor(this.paymentCache.size * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.paymentCache.delete(sortedEntries[i][0]);
      }
    }
  }

  // Helper to generate global cache key
  private async generateGlobalCacheKey(filters: NostrFilter[], bookmark: string): Promise<string> {
    const cacheData = JSON.stringify({ filters, bookmark });
    const buffer = new TextEncoder().encode(cacheData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `https://nosflare-query-cache/${hashHex}`;
  }

  // Query cache methods with deduplication and global caching
  private async getCachedOrQuery(filters: NostrFilter[], bookmark: string): Promise<QueryResult> {
    // Create cache key from filters and bookmark
    const cacheKey = JSON.stringify({ filters, bookmark });

    // Check if identical query is in flight (deduplication)
    if (this.activeQueries.has(cacheKey)) {
      console.log('Returning in-flight query result (deduplication)');
      return await this.activeQueries.get(cacheKey)!;
    }

    // Check Cloudflare global cache first
    try {
      const globalCache = caches.default;
      const globalCacheKey = await this.generateGlobalCacheKey(filters, bookmark);
      const globalCached = await globalCache.match(globalCacheKey);

      if (globalCached) {
        console.log('Returning globally cached query result');
        const result = await globalCached.json() as QueryResult;

        // Also update local cache for faster subsequent access
        this.queryCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
          accessCount: 1,
          lastAccessed: Date.now()
        });
        this.addToCacheIndex(cacheKey, filters);

        return result;
      }
    } catch (error) {
      console.error('Error checking global cache:', error);
      // Continue to local cache/query if global cache fails
    }

    // Check local cache
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.QUERY_CACHE_TTL) {
      console.log('Returning locally cached query result');
      // Update access tracking
      cached.accessCount++;
      cached.lastAccessed = Date.now();
      return cached.result;
    }

    // Execute query and track as active
    const queryPromise = queryEvents(filters, bookmark, this.env);
    this.activeQueries.set(cacheKey, queryPromise);

    try {
      const result = await queryPromise;

      // Cache the result locally
      this.queryCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now()
      });

      // Index this cache entry for efficient invalidation
      this.addToCacheIndex(cacheKey, filters);

      // Clean up old cache entries if cache is too large
      if (this.queryCache.size > this.MAX_CACHE_SIZE) {
        this.cleanupQueryCache();
      }

      // Store in Cloudflare global cache
      try {
        const globalCache = caches.default;
        const globalCacheKey = await this.generateGlobalCacheKey(filters, bookmark);
        const response = new Response(JSON.stringify(result), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300' // 5 minute TTL
          }
        });
        await globalCache.put(globalCacheKey, response);
        console.log('Stored query result in global cache');
      } catch (error) {
        console.error('Error storing in global cache:', error);
        // Continue even if global cache storage fails
      }

      return result;
    } finally {
      // Remove from active queries
      this.activeQueries.delete(cacheKey);
    }
  }

  private cleanupQueryCache(): void {
    // Remove expired entries first
    const now = Date.now();
    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > this.QUERY_CACHE_TTL) {
        this.queryCache.delete(key);
        this.removeFromCacheIndex(key);
      }
    }

    // If still too large, use frequency-weighted eviction
    if (this.queryCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.queryCache.entries());
      const scoredEntries = entries.map(([key, entry]) => {
        const recencyScore = (now - entry.lastAccessed) / 1000;
        const frequencyScore = entry.accessCount * 10;
        const evictionScore = frequencyScore - (recencyScore / 60);

        return { key, score: evictionScore };
      });

      // Sort by score (ascending) to evict lowest-scoring entries
      scoredEntries.sort((a, b) => a.score - b.score);

      // Remove lowest 20% scoring entries
      const toRemove = Math.floor(this.MAX_CACHE_SIZE * 0.2);
      for (let i = 0; i < toRemove; i++) {
        const key = scoredEntries[i].key;
        this.queryCache.delete(key);
        this.removeFromCacheIndex(key);
      }

      console.log(`Evicted ${toRemove} low-scoring cache entries (LFU)`);
    }
  }

  // Add cache entry to index for efficient invalidation
  private addToCacheIndex(cacheKey: string, filters: NostrFilter[]): void {
    for (const filter of filters) {
      // Index by kinds
      if (filter.kinds) {
        for (const kind of filter.kinds) {
          const indexKey = `kind:${kind}`;
          if (!this.queryCacheIndex.has(indexKey)) {
            this.queryCacheIndex.set(indexKey, new Set());
          }
          this.queryCacheIndex.get(indexKey)!.add(cacheKey);
        }
      }

      // Index by authors
      if (filter.authors) {
        for (const author of filter.authors) {
          const indexKey = `author:${author}`;
          if (!this.queryCacheIndex.has(indexKey)) {
            this.queryCacheIndex.set(indexKey, new Set());
          }
          this.queryCacheIndex.get(indexKey)!.add(cacheKey);
        }
      }

      // Index by tag filters (#p, #e, #a, etc.)
      for (const [key, values] of Object.entries(filter)) {
        if (key.startsWith('#') && Array.isArray(values)) {
          const tagName = key.substring(1);
          for (const value of values) {
            const indexKey = `tag:${tagName}:${value}`;
            if (!this.queryCacheIndex.has(indexKey)) {
              this.queryCacheIndex.set(indexKey, new Set());
            }
            this.queryCacheIndex.get(indexKey)!.add(cacheKey);
          }
        }
      }
    }
  }

  // Remove cache entry from index
  private removeFromCacheIndex(cacheKey: string): void {
    // Remove this cache key from all index entries
    for (const [indexKey, cacheKeys] of this.queryCacheIndex.entries()) {
      cacheKeys.delete(cacheKey);
      // Clean up empty index entries
      if (cacheKeys.size === 0) {
        this.queryCacheIndex.delete(indexKey);
      }
    }
  }

  private invalidateRelevantCaches(event: NostrEvent): void {
    // Optimized cache invalidation using index (for local cache only)
    const keysToInvalidate = new Set<string>();

    // O(1) lookup by kind
    const kindKey = `kind:${event.kind}`;
    if (this.queryCacheIndex.has(kindKey)) {
      for (const cacheKey of this.queryCacheIndex.get(kindKey)!) {
        keysToInvalidate.add(cacheKey);
      }
    }

    // O(1) lookup by author
    const authorKey = `author:${event.pubkey}`;
    if (this.queryCacheIndex.has(authorKey)) {
      for (const cacheKey of this.queryCacheIndex.get(authorKey)!) {
        keysToInvalidate.add(cacheKey);
      }
    }

    // O(1) lookup by tags (p, e, a, etc.)
    for (const tag of event.tags) {
      if (tag.length >= 2) {
        const tagKey = `tag:${tag[0]}:${tag[1]}`;
        if (this.queryCacheIndex.has(tagKey)) {
          for (const cacheKey of this.queryCacheIndex.get(tagKey)!) {
            keysToInvalidate.add(cacheKey);
          }
        }
      }
    }

    // Invalidate collected keys from local cache
    for (const key of keysToInvalidate) {
      this.queryCache.delete(key);
      this.removeFromCacheIndex(key);
    }

    if (keysToInvalidate.size > 0) {
      console.log(`Invalidated ${keysToInvalidate.size} local cache entries for event ${event.id} (kind:${event.kind}, author:${event.pubkey.substring(0, 8)}...)`);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Extract and set DO name from URL if provided
    const urlDoName = url.searchParams.get('doName');
    if (urlDoName && urlDoName !== 'unknown' && RelayWebSocket.ALLOWED_ENDPOINTS.includes(urlDoName)) {
      this.doName = urlDoName;
    }

    // DO-to-DO broadcast endpoint
    if (url.pathname === '/do-broadcast') {
      return await this.handleDOBroadcast(request);
    }

    // Handle WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // Extract region info and DO name
    this.region = url.searchParams.get('region') || this.region || 'unknown';
    const colo = url.searchParams.get('colo') || 'default';

    console.log(`WebSocket connection to DO: ${this.doName} (region: ${this.region}, colo: ${colo})`);

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Create session data
    const sessionId = crypto.randomUUID();
    const host = request.headers.get('host') || url.host;

    // Create session object with NIP-42 auth state
    const session: WebSocketSession = {
      id: sessionId,
      webSocket: server,
      subscriptions: new Map(),
      pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
      reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
      bookmark: 'first-unconstrained',
      host,
      challenge: AUTH_REQUIRED ? this.generateAuthChallenge() : undefined,
      authenticatedPubkeys: new Set()
    };
    this.sessions.set(sessionId, session);

    // Serialize minimal attachment to the WebSocket
    const attachment: SessionAttachment = {
      sessionId,
      bookmark: session.bookmark,
      host,
      doName: this.doName
    };
    server.serializeAttachment(attachment);

    // Use hibernatable WebSocket accept
    this.state.acceptWebSocket(server);

    // NIP-42: Send AUTH challenge immediately if required
    if (AUTH_REQUIRED && session.challenge) {
      this.sendAuth(server, session.challenge);
    }

    // Update activity time and schedule alarm
    this.lastActivityTime = Date.now();
    await this.scheduleAlarmIfNeeded();

    console.log(`New WebSocket session: ${sessionId} on DO ${this.doName}`);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // WebSocket Hibernation API handler methods
  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    // Track activity
    this.lastActivityTime = Date.now();

    const attachment = ws.deserializeAttachment() as SessionAttachment | null;
    if (!attachment) {
      console.error('No session attachment found');
      ws.close(1011, 'Session not found');
      return;
    }

    // Get or recreate session
    let session = this.sessions.get(attachment.sessionId);
    if (!session) {
      // Restore DO name from attachment
      if (attachment.doName && this.doName === 'unknown') {
        this.doName = attachment.doName;
      }
      // Load subscriptions from storage
      const subscriptions = await this.loadSubscriptions(attachment.sessionId);

      // Recreate session from attachment (after hibernation)
      session = {
        id: attachment.sessionId,
        webSocket: ws,
        subscriptions,
        pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
        reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
        bookmark: attachment.bookmark,
        host: attachment.host,
        // NIP-42: Generate new challenge after hibernation (old one is lost)
        challenge: AUTH_REQUIRED ? this.generateAuthChallenge() : undefined,
        authenticatedPubkeys: new Set()
      };
      this.sessions.set(attachment.sessionId, session);

      // Send new AUTH challenge after hibernation recovery
      if (AUTH_REQUIRED && session.challenge) {
        this.sendAuth(ws, session.challenge);
      }
    }

    try {
      let parsedMessage: any;

      if (typeof message === 'string') {
        parsedMessage = JSON.parse(message);
      } else {
        const decoder = new TextDecoder();
        const text = decoder.decode(message);
        parsedMessage = JSON.parse(text);
      }

      await this.handleMessage(session, parsedMessage);

      // Update attachment with latest session state
      const updatedAttachment: SessionAttachment = {
        sessionId: session.id,
        bookmark: session.bookmark,
        host: session.host,
        doName: this.doName,
        hasPaid: attachment.hasPaid
      };
      ws.serializeAttachment(updatedAttachment);

    } catch (error) {
      console.error('Error handling message:', error);
      if (error instanceof SyntaxError) {
        this.sendError(ws, 'Invalid JSON format');
      } else {
        this.sendError(ws, 'Failed to process message');
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const attachment = ws.deserializeAttachment() as SessionAttachment | null;
    if (attachment) {
      console.log(`WebSocket closed: ${attachment.sessionId} on DO ${this.doName}`);
      this.sessions.delete(attachment.sessionId);

      // Clean up stored subscriptions
      await this.deleteSubscriptions(attachment.sessionId);

      // If no more active WebSockets, delete the alarm to allow DO eviction
      const activeWebSockets = this.state.getWebSockets();
      if (activeWebSockets.length === 0) {
        await this.state.storage.deleteAlarm();
        console.log(`Deleted alarm for DO ${this.doName} - no active connections remaining`);
      }
    }
  }

  async webSocketError(ws: WebSocket, error: any): Promise<void> {
    const attachment = ws.deserializeAttachment() as SessionAttachment | null;
    if (attachment) {
      console.error(`WebSocket error for session ${attachment.sessionId}:`, error);
      this.sessions.delete(attachment.sessionId);
    }
  }

  private async handleDOBroadcast(request: Request): Promise<Response> {
    try {
      const data: DOBroadcastRequest = await request.json();
      const { event, sourceDoId } = data;

      // Prevent duplicate processing
      if (this.processedEvents.has(event.id)) {
        return new Response(JSON.stringify({ success: true, duplicate: true }));
      }

      this.processedEvents.set(event.id, Date.now());

      console.log(`DO ${this.doName} received event ${event.id} from ${sourceDoId}`);

      // Broadcast to local sessions
      await this.broadcastToLocalSessions(event);

      // Clean up old processed events periodically
      const fiveMinutesAgo = Date.now() - 300000;
      let cleaned = 0;
      for (const [eventId, timestamp] of this.processedEvents) {
        if (timestamp < fiveMinutesAgo) {
          this.processedEvents.delete(eventId);
          cleaned++;
        }
      }

      return new Response(JSON.stringify({ success: true }));
    } catch (error) {
      console.error('Error handling DO broadcast:', error);
      // @ts-ignore
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleMessage(session: WebSocketSession, message: any[]): Promise<void> {
    if (!Array.isArray(message)) {
      this.sendError(session.webSocket, 'Invalid message format: expected JSON array');
      return;
    }

    const [type, ...args] = message;

    try {
      switch (type) {
        case 'EVENT':
          await this.handleEvent(session, args[0]);
          break;
        case 'REQ':
          await this.handleReq(session, message);
          break;
        case 'CLOSE':
          await this.handleCloseSubscription(session, args[0]);
          break;
        case 'AUTH':
          await this.handleAuth(session, args[0]);
          break;
        default:
          this.sendError(session.webSocket, `Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error(`Error handling ${type} message:`, error);
      this.sendError(session.webSocket, `Failed to process ${type} message`);
    }
  }

  private async handleEvent(session: WebSocketSession, event: NostrEvent): Promise<void> {
    try {
      // Validate event object
      if (!event || typeof event !== 'object') {
        this.sendOK(session.webSocket, '', false, 'invalid: event object required');
        return;
      }

      // Check required fields (content can be empty string but not null/undefined)
      if (!event.id || !event.pubkey || !event.sig || !event.created_at ||
        event.kind === undefined || !Array.isArray(event.tags) ||
        event.content === undefined || event.content === null) {
        this.sendOK(session.webSocket, event.id || '', false, 'invalid: missing required fields');
        return;
      }

      // NIP-42: Reject kind 22242 events - they are for authentication only, not publishing
      if (event.kind === 22242) {
        this.sendOK(session.webSocket, event.id, false, 'invalid: kind 22242 events are for authentication only');
        return;
      }

      // NIP-42: Check if the event's pubkey is authenticated
      if (AUTH_REQUIRED && !session.authenticatedPubkeys.has(event.pubkey)) {
        this.sendOK(session.webSocket, event.id, false, 'auth-required: authenticate to publish events');
        return;
      }

      // Rate limiting (skip for excluded kinds)
      if (!excludedRateLimitKinds.has(event.kind)) {
        if (!session.pubkeyRateLimiter.removeToken()) {
          console.log(`Rate limit exceeded for pubkey ${event.pubkey}`);
          this.sendOK(session.webSocket, event.id, false, 'rate-limited: slow down there chief');
          return;
        }
      }

      // Verify signature
      const isValidSignature = await verifyEventSignature(event);
      if (!isValidSignature) {
        console.error(`Signature verification failed for event ${event.id}`);
        this.sendOK(session.webSocket, event.id, false, 'invalid: signature verification failed');
        return;
      }

      // Check if pay to relay is enabled
      if (PAY_TO_RELAY_ENABLED) {
        // Check cache first
        let hasPaid = await this.getCachedPaymentStatus(event.pubkey);

        if (hasPaid === null) {
          // Not in cache, check database
          hasPaid = await hasPaidForRelay(event.pubkey, this.env);
          // Cache the result
          this.setCachedPaymentStatus(event.pubkey, hasPaid);
        }

        if (!hasPaid) {
          const protocol = 'https:';
          const relayUrl = `${protocol}//${session.host}`;
          console.error(`Event denied. Pubkey ${event.pubkey} has not paid for relay access.`);
          this.sendOK(session.webSocket, event.id, false, `blocked: payment required. Visit ${relayUrl} to pay for relay access.`);
          return;
        }
      }

      // Check if pubkey is allowed (bypassed for kind 1059)
      if (event.kind !== 1059 && !isPubkeyAllowed(event.pubkey)) {
        console.error(`Event denied. Pubkey ${event.pubkey} is not allowed.`);
        this.sendOK(session.webSocket, event.id, false, 'blocked: pubkey not allowed');
        return;
      }

      // Check if event kind is allowed
      if (!isEventKindAllowed(event.kind)) {
        console.error(`Event denied. Event kind ${event.kind} is not allowed.`);
        this.sendOK(session.webSocket, event.id, false, `blocked: event kind ${event.kind} not allowed`);
        return;
      }

      // Check for blocked content
      if (containsBlockedContent(event)) {
        console.error('Event denied. Content contains blocked phrases.');
        this.sendOK(session.webSocket, event.id, false, 'blocked: content contains blocked phrases');
        return;
      }

      // Check tags
      for (const tag of event.tags) {
        if (!isTagAllowed(tag[0])) {
          console.error(`Event denied. Tag '${tag[0]}' is not allowed.`);
          this.sendOK(session.webSocket, event.id, false, `blocked: tag '${tag[0]}' not allowed`);
          return;
        }
      }

      // Process the event (save to database)
      const result = await processEvent(event, session.id, this.env);

      // Update session bookmark for read-after-write consistency
      if (result.bookmark) {
        session.bookmark = result.bookmark;
      }

      if (result.success) {
        // Send OK to the sender
        this.sendOK(session.webSocket, event.id, true, result.message);

        // Mark as processed
        this.processedEvents.set(event.id, Date.now());

        // Invalidate relevant query caches
        this.invalidateRelevantCaches(event);

        // Broadcast to all (local + remote)
        console.log(`DO ${this.doName} broadcasting event ${event.id}`);
        await this.broadcastEvent(event);
      } else {
        this.sendOK(session.webSocket, event.id, false, result.message);
      }

    } catch (error: any) {
      console.error('Error handling event:', error);
      this.sendOK(session.webSocket, event?.id || '', false, `error: ${error.message}`);
    }
  }

  private async handleReq(session: WebSocketSession, message: any[]): Promise<void> {
    const [_, subscriptionId, ...filters] = message;

    if (!subscriptionId || typeof subscriptionId !== 'string' || subscriptionId === '' || subscriptionId.length > 64) {
      this.sendError(session.webSocket, 'Invalid subscription ID: must be non-empty string of max 64 chars');
      return;
    }

    // NIP-42: Check authentication if required
    if (AUTH_REQUIRED && session.authenticatedPubkeys.size === 0) {
      this.sendClosed(session.webSocket, subscriptionId, 'auth-required: authentication required to subscribe');
      return;
    }

    // Rate limiting
    if (!session.reqRateLimiter.removeToken()) {
      console.error(`REQ rate limit exceeded for subscription: ${subscriptionId}`);
      this.sendClosed(session.webSocket, subscriptionId, 'rate-limited: slow down there chief');
      return;
    }

    // Validate filters
    if (filters.length === 0) {
      this.sendClosed(session.webSocket, subscriptionId, 'error: at least one filter required');
      return;
    }

    // Validate each filter
    for (const filter of filters) {
      if (typeof filter !== 'object' || filter === null) {
        this.sendClosed(session.webSocket, subscriptionId, 'invalid: filter must be an object');
        return;
      }

      // Validate IDs format
      if (filter.ids) {
        for (const id of filter.ids) {
          if (!/^[a-f0-9]{64}$/.test(id)) {
            this.sendClosed(session.webSocket, subscriptionId, `invalid: Invalid event ID format: ${id}`);
            return;
          }
        }
      }

      // Validate authors format
      if (filter.authors) {
        for (const author of filter.authors) {
          if (!/^[a-f0-9]{64}$/.test(author)) {
            this.sendClosed(session.webSocket, subscriptionId, `invalid: Invalid author pubkey format: ${author}`);
            return;
          }
        }
      }

      // Check blocked kinds
      if (filter.kinds) {
        const blockedKinds = filter.kinds.filter((kind: number) => !isEventKindAllowed(kind));
        if (blockedKinds.length > 0) {
          console.error(`Blocked kinds in subscription: ${blockedKinds.join(', ')}`);
          this.sendClosed(session.webSocket, subscriptionId, `blocked: kinds ${blockedKinds.join(', ')} not allowed`);
          return;
        }
      }

      // Validate limits
      if (filter.ids && filter.ids.length > 5000) {
        this.sendClosed(session.webSocket, subscriptionId, 'invalid: too many event IDs (max 5000)');
        return;
      }

      // Cap limit at 5000 if it's too high or set default if not provided
      if (filter.limit && filter.limit > 500) {
        filter.limit = 500;
      } else if (!filter.limit) {
        filter.limit = 500;
      }
    }

    // Store subscription
    session.subscriptions.set(subscriptionId, filters);

    // Save to storage
    await this.saveSubscriptions(session.id, session.subscriptions);

    console.log(`New subscription ${subscriptionId} for session ${session.id} on DO ${this.doName}`);

    try {
      // Query events with caching
      const result = await this.getCachedOrQuery(filters, session.bookmark);

      // Update session bookmark
      if (result.bookmark) {
        session.bookmark = result.bookmark;
      }

      // Send events to client
      for (const event of result.events) {
        this.sendEvent(session.webSocket, subscriptionId, event);
      }

      // Send EOSE
      this.sendEOSE(session.webSocket, subscriptionId);

    } catch (error: any) {
      console.error(`Error processing REQ for subscription ${subscriptionId}:`, error);
      this.sendClosed(session.webSocket, subscriptionId, 'error: could not connect to the database');
    }
  }

  private async handleCloseSubscription(session: WebSocketSession, subscriptionId: string): Promise<void> {
    if (!subscriptionId) {
      this.sendError(session.webSocket, 'Invalid subscription ID for CLOSE');
      return;
    }

    const deleted = session.subscriptions.delete(subscriptionId);
    if (deleted) {
      // Save updated subscriptions to storage
      await this.saveSubscriptions(session.id, session.subscriptions);

      console.log(`Closed subscription ${subscriptionId} for session ${session.id} on DO ${this.doName}`);
      this.sendClosed(session.webSocket, subscriptionId, 'Subscription closed');
    } else {
      this.sendClosed(session.webSocket, subscriptionId, 'Subscription not found');
    }
  }

  // NIP-42: Handle AUTH message from client
  private async handleAuth(session: WebSocketSession, authEvent: NostrEvent): Promise<void> {
    try {
      // Validate auth event object
      if (!authEvent || typeof authEvent !== 'object') {
        this.sendOK(session.webSocket, '', false, 'invalid: auth event object required');
        return;
      }

      // Check required fields
      if (!authEvent.id || !authEvent.pubkey || !authEvent.sig || !authEvent.created_at ||
        authEvent.kind === undefined || !Array.isArray(authEvent.tags) ||
        authEvent.content === undefined) {
        this.sendOK(session.webSocket, authEvent.id || '', false, 'invalid: missing required fields');
        return;
      }

      // Verify kind is 22242
      if (authEvent.kind !== 22242) {
        this.sendOK(session.webSocket, authEvent.id, false, 'invalid: auth event must be kind 22242');
        return;
      }

      // Verify signature
      const isValidSignature = await verifyEventSignature(authEvent);
      if (!isValidSignature) {
        this.sendOK(session.webSocket, authEvent.id, false, 'invalid: signature verification failed');
        return;
      }

      // Check created_at is within timeout of current time
      const now = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(now - authEvent.created_at);
      const timeoutSeconds = AUTH_TIMEOUT_MS / 1000;
      if (timeDiff > timeoutSeconds) {
        this.sendOK(session.webSocket, authEvent.id, false, 'invalid: auth event created_at is too far from current time');
        return;
      }

      // Find challenge tag
      const challengeTag = authEvent.tags.find(tag => tag[0] === 'challenge');
      if (!challengeTag || !challengeTag[1]) {
        this.sendOK(session.webSocket, authEvent.id, false, 'invalid: missing challenge tag');
        return;
      }

      // Verify challenge matches
      if (!session.challenge) {
        this.sendOK(session.webSocket, authEvent.id, false, 'invalid: no challenge was issued');
        return;
      }

      if (challengeTag[1] !== session.challenge) {
        this.sendOK(session.webSocket, authEvent.id, false, 'invalid: challenge mismatch');
        return;
      }

      // Find relay tag
      const relayTag = authEvent.tags.find(tag => tag[0] === 'relay');
      if (!relayTag || !relayTag[1]) {
        this.sendOK(session.webSocket, authEvent.id, false, 'invalid: missing relay tag');
        return;
      }

      // Verify relay URL matches (check domain at minimum)
      try {
        const authRelayUrl = new URL(relayTag[1]);
        const sessionHost = session.host.toLowerCase().replace(/:\d+$/, '');
        const authHost = authRelayUrl.host.toLowerCase().replace(/:\d+$/, '');

        if (authHost !== sessionHost) {
          this.sendOK(session.webSocket, authEvent.id, false, `invalid: relay URL mismatch (expected ${sessionHost})`);
          return;
        }
      } catch {
        this.sendOK(session.webSocket, authEvent.id, false, 'invalid: malformed relay URL');
        return;
      }

      // All checks passed - add pubkey to authenticated list
      session.authenticatedPubkeys.add(authEvent.pubkey);

      this.sendOK(session.webSocket, authEvent.id, true, '');

    } catch (error: any) {
      console.error('Error handling AUTH:', error);
      this.sendOK(session.webSocket, authEvent?.id || '', false, `error: ${error.message}`);
    }
  }

  private async broadcastEvent(event: NostrEvent): Promise<void> {
    // Broadcast to local sessions
    await this.broadcastToLocalSessions(event);

    // Broadcast to other DOs
    await this.broadcastToOtherDOs(event);
  }

  private async broadcastToLocalSessions(event: NostrEvent): Promise<void> {
    let broadcastCount = 0;

    // Get all active WebSockets (including hibernated ones)
    const activeWebSockets = this.state.getWebSockets();

    for (const ws of activeWebSockets) {
      const attachment = ws.deserializeAttachment() as SessionAttachment | null;
      if (!attachment) continue;

      // Get or recreate session
      let session = this.sessions.get(attachment.sessionId);
      if (!session) {
        // Load subscriptions from storage
        const subscriptions = await this.loadSubscriptions(attachment.sessionId);

        // Recreate minimal session for broadcast
        session = {
          id: attachment.sessionId,
          webSocket: ws,
          subscriptions,
          pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
          reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
          bookmark: attachment.bookmark,
          host: attachment.host,
          challenge: AUTH_REQUIRED ? this.generateAuthChallenge() : undefined,
          authenticatedPubkeys: new Set()
        };
        this.sessions.set(attachment.sessionId, session);
      }

      for (const [subscriptionId, filters] of session.subscriptions) {
        if (this.matchesFilters(event, filters)) {
          try {
            this.sendEvent(ws, subscriptionId, event);
            broadcastCount++;
          } catch (error) {
            console.error(`Error broadcasting to subscription ${subscriptionId}:`, error);
          }
        }
      }
    }

    if (broadcastCount > 0) {
      console.log(`Event ${event.id} broadcast to ${broadcastCount} local subscriptions on DO ${this.doName}`);
    }
  }

  private async broadcastToOtherDOs(event: NostrEvent): Promise<void> {
    const broadcasts: Promise<Response>[] = [];

    // Broadcast to all allowed endpoints except ourselves
    for (const endpoint of RelayWebSocket.ALLOWED_ENDPOINTS) {
      if (endpoint === this.doName) continue;

      broadcasts.push(this.sendToSpecificDO(endpoint, event));
    }

    // Execute broadcasts in parallel with timeout
    const results = await Promise.allSettled(
      broadcasts.map(p => Promise.race([
        p,
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Broadcast timeout')), 3000)
        )
      ]))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`Event ${event.id} broadcast from DO ${this.doName} to ${successful}/${broadcasts.length} remote DOs`);
  }

  private async sendToSpecificDO(doName: string, event: NostrEvent): Promise<Response> {
    try {
      // Ensure we're only using allowed endpoints
      if (!RelayWebSocket.ALLOWED_ENDPOINTS.includes(doName)) {
        throw new Error(`Invalid DO name: ${doName}`);
      }

      const id = this.env.RELAY_WEBSOCKET.idFromName(doName);
      const locationHint = RelayWebSocket.ENDPOINT_HINTS[doName] || 'auto';
      const stub = this.env.RELAY_WEBSOCKET.get(id, { locationHint });

      // Include the target DO name in the URL
      const url = new URL('https://internal/do-broadcast');
      url.searchParams.set('doName', doName);

      return await stub.fetch(new Request(url.toString(), {
        method: 'POST',
        body: JSON.stringify({
          event,
          sourceDoId: this.doId
        } as DOBroadcastRequest)
      }));
    } catch (error) {
      console.error(`Failed to broadcast to ${doName}:`, error);
      throw error;
    }
  }

  private matchesFilters(event: NostrEvent, filters: NostrFilter[]): boolean {
    return filters.some(filter => this.matchesFilter(event, filter));
  }

  private matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
    // Check IDs
    if (filter.ids && filter.ids.length > 0 && !filter.ids.includes(event.id)) {
      return false;
    }

    // Check authors
    if (filter.authors && filter.authors.length > 0 && !filter.authors.includes(event.pubkey)) {
      return false;
    }

    // Check kinds
    if (filter.kinds && filter.kinds.length > 0 && !filter.kinds.includes(event.kind)) {
      return false;
    }

    // Check time bounds
    if (filter.since && event.created_at < filter.since) {
      return false;
    }
    if (filter.until && event.created_at > filter.until) {
      return false;
    }

    // Check tag filters
    for (const [key, values] of Object.entries(filter)) {
      if (key.startsWith('#') && Array.isArray(values) && values.length > 0) {
        const tagName = key.substring(1);
        const eventTagValues = event.tags
          .filter(tag => tag[0] === tagName)
          .map(tag => tag[1]);

        // Check if any of the filter values match any of the event's tag values
        const hasMatch = values.some(v => eventTagValues.includes(v));
        if (!hasMatch) {
          return false;
        }
      }
    }

    return true;
  }

  // NIP-42: Send AUTH challenge to client
  private sendAuth(ws: WebSocket, challenge: string): void {
    try {
      const authMessage = ['AUTH', challenge];
      ws.send(JSON.stringify(authMessage));
    } catch (error) {
      console.error('Error sending AUTH:', error);
    }
  }

  // NIP-42: Generate a cryptographically secure challenge string
  private generateAuthChallenge(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private sendOK(ws: WebSocket, eventId: string, status: boolean, message: string): void {
    try {
      const okMessage = ['OK', eventId, status, message || ''];
      ws.send(JSON.stringify(okMessage));
    } catch (error) {
      console.error('Error sending OK:', error);
    }
  }

  private sendError(ws: WebSocket, message: string): void {
    try {
      const noticeMessage = ['NOTICE', message];
      ws.send(JSON.stringify(noticeMessage));
    } catch (error) {
      console.error('Error sending NOTICE:', error);
    }
  }

  private sendEOSE(ws: WebSocket, subscriptionId: string): void {
    try {
      const eoseMessage = ['EOSE', subscriptionId];
      ws.send(JSON.stringify(eoseMessage));
    } catch (error) {
      console.error('Error sending EOSE:', error);
    }
  }

  private sendClosed(ws: WebSocket, subscriptionId: string, message: string): void {
    try {
      const closedMessage = ['CLOSED', subscriptionId, message];
      ws.send(JSON.stringify(closedMessage));
    } catch (error) {
      console.error('Error sending CLOSED:', error);
    }
  }

  private sendEvent(ws: WebSocket, subscriptionId: string, event: NostrEvent): void {
    try {
      const eventMessage = ['EVENT', subscriptionId, event];
      ws.send(JSON.stringify(eventMessage));
    } catch (error) {
      console.error('Error sending EVENT:', error);
    }
  }
}