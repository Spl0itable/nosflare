/**
 * ConnectionDO - One Durable Object per WebSocket connection
 */

import {
  NostrEvent,
  NostrFilter,
  RateLimiter,
  Env,
  QueryResult,
  DurableObject,
  DurableObjectState,
  ConnectionBroadcastRequest
} from './types';
import { pack, unpack } from 'msgpackr';
import {
  PUBKEY_RATE_LIMIT,
  REQ_RATE_LIMIT,
  PAY_TO_RELAY_ENABLED,
  isPubkeyAllowed,
  isEventKindAllowed,
  containsBlockedContent,
  isTagAllowed,
  excludedRateLimitKinds,
  validateGroupEvent,
  CREATED_AT_LOWER_LIMIT,
  CREATED_AT_UPPER_LIMIT,
  AUTH_REQUIRED
} from './config';
import { verifyEventSignature, hasPaidForRelay, processEvent, queryEvents } from './relay-worker';

const DEBUG = false;

function isEventExpired(event: NostrEvent): boolean {
  const expirationTag = event.tags.find(tag => tag[0] === 'expiration');
  if (!expirationTag || !expirationTag[1]) {
    return false;
  }
  const expirationTimestamp = parseInt(expirationTag[1], 10);
  if (isNaN(expirationTimestamp)) {
    return false;
  }
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return expirationTimestamp < currentTimestamp;
}

function shouldFilterForPrivacy(event: NostrEvent, authenticatedPubkeys: Set<string>): boolean {
  if (event.kind !== 1059) {
    return false;
  }

  if (authenticatedPubkeys.size === 0) {
    return true;
  }

  const pTags = event.tags.filter(tag => tag[0] === 'p' && tag[1]);
  const taggedPubkeys = new Set(pTags.map(tag => tag[1]));

  for (const pubkey of authenticatedPubkeys) {
    if (taggedPubkeys.has(pubkey)) {
      return false;
    }
  }

  return true;
}

interface ConnectionAttachment {
  sessionId: string;
  bookmark: string;
  host: string;
  connectedAt: number;
}

interface PaymentCacheEntry {
  hasPaid: boolean;
  timestamp: number;
}

export class ConnectionDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessionId: string;

  private subscriptions: Map<string, NostrFilter[]> = new Map();

  private registeredShards: Set<number> = new Set();

  private pubkeyRateLimiter: RateLimiter;
  private reqRateLimiter: RateLimiter;

  private paymentCache: Map<string, PaymentCacheEntry> = new Map();
  private readonly PAYMENT_CACHE_TTL = 10000;

  private bookmark: string = 'first-unconstrained';
  private host: string = '';

  private challenge?: string;
  private authenticatedPubkeys: Set<string> = new Set();

  private subscriptionsDirty: boolean = false;
  private pendingSubscriptionWrite: ReturnType<typeof setTimeout> | null = null;
  private pendingSubscriptionUpdate: ReturnType<typeof setTimeout> | null = null;
  private readonly SUBSCRIPTION_WRITE_DELAY_MS = 500;
  private readonly SUBSCRIPTION_UPDATE_DELAY_MS = 500;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessionId = crypto.randomUUID();
    this.pubkeyRateLimiter = new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity);
    this.reqRateLimiter = new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity);

    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<any>(['subscriptions', 'sessionId', 'authenticatedPubkeys']);
      if (stored.get('subscriptions')) {
        this.subscriptions = new Map(stored.get('subscriptions') as Array<[string, NostrFilter[]]>);
      }
      if (stored.get('sessionId')) {
        this.sessionId = stored.get('sessionId') as string;
      }
      if (stored.get('authenticatedPubkeys')) {
        this.authenticatedPubkeys = new Set(stored.get('authenticatedPubkeys') as string[]);
      }

      if (this.subscriptions.size > 0) {
        this.updateSubscriptions().catch(err =>
          console.error('Failed to re-sync subscriptions on wake:', err)
        );
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/broadcast' && request.method === 'POST') {
      return await this.handleBroadcast(request);
    }

    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    this.host = request.headers.get('host') || url.host;

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const attachment: ConnectionAttachment = {
      sessionId: this.sessionId,
      bookmark: this.bookmark,
      host: this.host,
      connectedAt: Date.now()
    };
    server.serializeAttachment(attachment);

    this.state.acceptWebSocket(server);

    await this.state.storage.put('sessionId', this.sessionId);

    this.challenge = crypto.randomUUID();
    this.sendAuth(server, this.challenge);

    if (DEBUG) console.log(`ConnectionDO: New session ${this.sessionId}`);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
    if (!attachment) {
      console.error('No attachment found');
      ws.close(1011, 'Session not found');
      return;
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

      await this.handleMessage(ws, parsedMessage);

      const updatedAttachment: ConnectionAttachment = {
        sessionId: attachment.sessionId,
        bookmark: this.bookmark,
        host: this.host,
        connectedAt: attachment.connectedAt
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
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
    if (attachment) {
      if (DEBUG) console.log(`ConnectionDO: Session ${attachment.sessionId} closed`);

      if (this.pendingSubscriptionWrite) {
        clearTimeout(this.pendingSubscriptionWrite);
        this.pendingSubscriptionWrite = null;
      }
      if (this.pendingSubscriptionUpdate) {
        clearTimeout(this.pendingSubscriptionUpdate);
        this.pendingSubscriptionUpdate = null;
      }
      await this.flushSubscriptionWrite();

      this.unregisterSession().catch(err =>
        console.error('Failed to unregister session:', err)
      );
    }
  }

  async webSocketError(ws: WebSocket, error: any): Promise<void> {
    console.error('WebSocket error:', error);
  }

  private scheduleSubscriptionWrite(): void {
    this.subscriptionsDirty = true;

    if (this.pendingSubscriptionWrite) {
      return;
    }

    this.pendingSubscriptionWrite = setTimeout(async () => {
      this.pendingSubscriptionWrite = null;
      await this.flushSubscriptionWrite();
    }, this.SUBSCRIPTION_WRITE_DELAY_MS);
  }

  private async flushSubscriptionWrite(): Promise<void> {
    if (!this.subscriptionsDirty) {
      return;
    }

    this.subscriptionsDirty = false;
    try {
      await this.state.storage.put('subscriptions', Array.from(this.subscriptions.entries()));
    } catch (err) {
      console.error('Failed to persist subscriptions to storage:', err);
      this.subscriptionsDirty = true;
    }
  }

  private scheduleSubscriptionUpdate(): void {
    if (this.pendingSubscriptionUpdate) {
      return;
    }

    this.pendingSubscriptionUpdate = setTimeout(async () => {
      this.pendingSubscriptionUpdate = null;
      await this.updateSubscriptions().catch(err =>
        console.error('Failed to update subscriptions:', err)
      );
    }, this.SUBSCRIPTION_UPDATE_DELAY_MS);
  }

  private getRequiredShards(): Set<number> {
    const requiredShards = new Set<number>();

    for (const [subscriptionId, filters] of this.subscriptions) {
      for (const filter of filters) {
        if (!filter.kinds || filter.kinds.length === 0) {
          requiredShards.add(49);
        } else {
          for (const kind of filter.kinds) {
            requiredShards.add(kind % 50);
          }
        }
      }
    }

    return requiredShards;
  }

  private async unregisterSession(): Promise<void> {
    const unregisterPromises = Array.from(this.registeredShards).map(async (shardNum) => {
      try {
        const id = this.env.SESSION_MANAGER_DO.idFromName(`manager-${shardNum}`);
        const stub = this.env.SESSION_MANAGER_DO.get(id);

        await stub.fetch('https://internal/unregister', {
          method: 'POST',
          headers: { 'Content-Type': 'application/msgpack' },
          body: pack({
            sessionId: this.sessionId
          })
        });
      } catch (error) {
        console.error(`Failed to unregister from shard ${shardNum}:`, error);
      }
    });

    await Promise.all(unregisterPromises);
    this.registeredShards.clear();
  }

  private async updateSubscriptions(): Promise<void> {
    const requiredShards = this.getRequiredShards();

    const subsArray = Array.from(this.subscriptions.entries());

    const updatePromises = Array.from(requiredShards).map(async (shardNum) => {
      try {
        const id = this.env.SESSION_MANAGER_DO.idFromName(`manager-${shardNum}`);
        const stub = this.env.SESSION_MANAGER_DO.get(id);

        await stub.fetch('https://internal/update-subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/msgpack' },
          body: pack({
            sessionId: this.sessionId,
            connectionDoId: this.state.id.toString(),
            subscriptions: subsArray
          })
        });

        this.registeredShards.add(shardNum);
      } catch (error) {
        console.error(`Failed to update subscriptions on shard ${shardNum}:`, error);
      }
    });

    const shardsToUnregister = Array.from(this.registeredShards).filter(
      shard => !requiredShards.has(shard)
    );

    const unregisterPromises = shardsToUnregister.map(async (shardNum) => {
      try {
        const id = this.env.SESSION_MANAGER_DO.idFromName(`manager-${shardNum}`);
        const stub = this.env.SESSION_MANAGER_DO.get(id);

        await stub.fetch('https://internal/unregister', {
          method: 'POST',
          headers: { 'Content-Type': 'application/msgpack' },
          body: pack({
            sessionId: this.sessionId
          })
        });

        this.registeredShards.delete(shardNum);
      } catch (error) {
        console.error(`Failed to unregister from shard ${shardNum}:`, error);
      }
    });

    await Promise.all([...updatePromises, ...unregisterPromises]);

    if (DEBUG) console.log(
      `Session ${this.sessionId} registered with shards: [${Array.from(this.registeredShards).sort().join(', ')}]`
    );
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const buffer = await request.arrayBuffer();
      const data: ConnectionBroadcastRequest = unpack(new Uint8Array(buffer));
      const { events } = data;

      const webSockets = this.state.getWebSockets();
      if (webSockets.length === 0) {
        return new Response(pack({ success: false, error: 'No active WebSocket' }), {
          status: 400,
          headers: { 'Content-Type': 'application/msgpack' }
        });
      }

      const ws = webSockets[0];

      let sentCount = 0;

      for (const preSerializedEvent of events) {
        if (isEventExpired(preSerializedEvent.event)) {
          continue;
        }

        if (shouldFilterForPrivacy(preSerializedEvent.event, this.authenticatedPubkeys)) {
          continue;
        }

        for (const [subscriptionId, filters] of this.subscriptions) {
          if (this.matchesFilters(preSerializedEvent.event, filters)) {
            this.sendPreSerializedEvent(ws, subscriptionId, preSerializedEvent.serializedJson);
            sentCount++;
          }
        }
      }

      return new Response(pack({ success: true, sentCount }), {
        headers: { 'Content-Type': 'application/msgpack' }
      });
    } catch (error: any) {
      console.error('Error handling broadcast:', error);
      return new Response(pack({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/msgpack' }
      });
    }
  }

  private async handleMessage(ws: WebSocket, message: any[]): Promise<void> {
    if (!Array.isArray(message)) {
      this.sendError(ws, 'Invalid message format: expected JSON array');
      return;
    }

    const [type, ...args] = message;

    try {
      switch (type) {
        case 'EVENT':
          await this.handleEvent(ws, args[0]);
          break;
        case 'REQ':
          await this.handleReq(ws, message);
          break;
        case 'CLOSE':
          await this.handleCloseSubscription(ws, args[0]);
          break;
        case 'AUTH':
          await this.handleAuth(ws, args[0]);
          break;
        default:
          this.sendError(ws, `Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error(`Error handling ${type} message:`, error);
      this.sendError(ws, `Failed to process ${type} message`);
    }
  }

  private async handleEvent(ws: WebSocket, event: NostrEvent): Promise<void> {
    try {
      if (!event || typeof event !== 'object') {
        this.sendOK(ws, '', false, 'invalid: event object required');
        return;
      }

      if (!event.id || !event.pubkey || !event.sig || !event.created_at ||
        event.kind === undefined || !Array.isArray(event.tags) ||
        event.content === undefined) {
        this.sendOK(ws, event.id || '', false, 'invalid: missing required fields');
        return;
      }

      if (AUTH_REQUIRED && !this.authenticatedPubkeys.has(event.pubkey)) {
        this.sendOK(ws, event.id, false, 'auth-required: please AUTH to publish events');
        return;
      }

      if (!excludedRateLimitKinds.has(event.kind)) {
        if (!this.pubkeyRateLimiter.removeToken()) {
          if (DEBUG) console.log(`Rate limit exceeded for pubkey ${event.pubkey}`);
          this.sendOK(ws, event.id, false, 'rate-limited: slow down there chief');
          return;
        }
      }

      const isValidSignature = await verifyEventSignature(event);
      if (!isValidSignature) {
        console.error(`Signature verification failed for event ${event.id}`);
        this.sendOK(ws, event.id, false, 'invalid: signature verification failed');
        return;
      }

      if (event.created_at < CREATED_AT_LOWER_LIMIT) {
        console.error(`Event denied. created_at ${event.created_at} is too far in the past (min: ${CREATED_AT_LOWER_LIMIT})`);
        this.sendOK(ws, event.id, false, `invalid: created_at too far in the past`);
        return;
      }
      if (event.created_at > CREATED_AT_UPPER_LIMIT) {
        console.error(`Event denied. created_at ${event.created_at} is too far in the future (max: ${CREATED_AT_UPPER_LIMIT})`);
        this.sendOK(ws, event.id, false, `invalid: created_at too far in the future`);
        return;
      }

      const expirationTag = event.tags.find(tag => tag[0] === 'expiration');
      if (expirationTag && expirationTag[1]) {
        const expirationTimestamp = parseInt(expirationTag[1], 10);
        const currentTimestamp = Math.floor(Date.now() / 1000);
        if (!isNaN(expirationTimestamp) && expirationTimestamp < currentTimestamp) {
          console.error(`Event denied. Event expired at ${expirationTimestamp} (current: ${currentTimestamp})`);
          this.sendOK(ws, event.id, false, 'invalid: event has expired');
          return;
        }
      }

      if (PAY_TO_RELAY_ENABLED) {
        let hasPaid = await this.getCachedPaymentStatus(event.pubkey);
        if (hasPaid === null) {
          hasPaid = await hasPaidForRelay(event.pubkey, this.env);
          this.setCachedPaymentStatus(event.pubkey, hasPaid);
        }

        if (!hasPaid) {
          console.error(`Event denied. Pubkey ${event.pubkey} has not paid for relay access.`);
          const host = this.host;
          const message = host
            ? `blocked: payment required. Visit https://${host} to pay for relay access.`
            : 'blocked: payment required. Please visit the relay website to pay for access.';
          this.sendOK(ws, event.id, false, message);
          return;
        }
      }

      if (event.kind !== 1059 && !isPubkeyAllowed(event.pubkey)) {
        console.error(`Event denied. Pubkey ${event.pubkey} is not allowed.`);
        this.sendOK(ws, event.id, false, 'blocked: pubkey not allowed');
        return;
      }

      if (!isEventKindAllowed(event.kind)) {
        console.error(`Event denied. Event kind ${event.kind} is not allowed.`);
        this.sendOK(ws, event.id, false, `blocked: event kind ${event.kind} not allowed`);
        return;
      }

      if (containsBlockedContent(event)) {
        console.error('Event denied. Content contains blocked phrases.');
        this.sendOK(ws, event.id, false, 'blocked: content contains blocked phrases');
        return;
      }

      for (const tag of event.tags) {
        if (!isTagAllowed(tag[0])) {
          console.error(`Event denied. Tag '${tag[0]}' is not allowed.`);
          this.sendOK(ws, event.id, false, `blocked: tag '${tag[0]}' not allowed`);
          return;
        }
      }

      const groupValidation = validateGroupEvent(event);
      if (!groupValidation.valid) {
        console.error(`Event denied. ${groupValidation.reason}`);
        this.sendOK(ws, event.id, false, `invalid: ${groupValidation.reason}`);
        return;
      }

      if (event.kind === 22242) {
        if (DEBUG) console.log(`Rejected kind 22242 event ${event.id}`);
        this.sendOK(ws, event.id, false, 'invalid: kind 22242 events are for authentication only');
        return;
      }

      const result = await processEvent(event, this.sessionId, this.env);

      if (result.success) {
        this.sendOK(ws, event.id, true, result.message);

        const shardNum = event.kind % 50;
        (this.env as any)[`BROADCAST_QUEUE_${shardNum}`].send({
          event,
          timestamp: Date.now()
        }).catch((err: Error) => console.error(`Failed to queue broadcast to shard ${shardNum}:`, err));
      } else {
        this.sendOK(ws, event.id, false, result.message);
      }

    } catch (error: any) {
      console.error('Error handling event:', error);
      this.sendOK(ws, event?.id || '', false, `error: ${error.message}`);
    }
  }

  private async handleReq(ws: WebSocket, message: any[]): Promise<void> {
    const [_, subscriptionId, ...filters] = message;

    if (!subscriptionId || typeof subscriptionId !== 'string' || subscriptionId === '' || subscriptionId.length > 64) {
      this.sendError(ws, 'Invalid subscription ID: must be non-empty string of max 64 chars');
      return;
    }

    if (AUTH_REQUIRED && this.authenticatedPubkeys.size === 0) {
      this.sendClosed(ws, subscriptionId, 'auth-required: please AUTH to subscribe');
      return;
    }

    if (!this.reqRateLimiter.removeToken()) {
      console.error(`REQ rate limit exceeded for subscription: ${subscriptionId}`);
      this.sendClosed(ws, subscriptionId, 'rate-limited: slow down there chief');
      return;
    }

    if (filters.length === 0) {
      this.sendClosed(ws, subscriptionId, 'error: at least one filter required');
      return;
    }

    for (const filter of filters) {
      if (typeof filter !== 'object' || filter === null) {
        this.sendClosed(ws, subscriptionId, 'invalid: filter must be an object');
        return;
      }

      if (filter.ids) {
        for (const id of filter.ids) {
          if (!/^[a-f0-9]{64}$/.test(id)) {
            this.sendClosed(ws, subscriptionId, `invalid: Invalid event ID format: ${id}`);
            return;
          }
        }
      }

      if (filter.authors) {
        for (const author of filter.authors) {
          if (!/^[a-f0-9]{64}$/.test(author)) {
            this.sendClosed(ws, subscriptionId, `invalid: Invalid author pubkey format: ${author}`);
            return;
          }
        }
      }

      if (filter.kinds) {
        const blockedKinds = filter.kinds.filter((kind: number) => !isEventKindAllowed(kind));
        if (blockedKinds.length > 0) {
          console.error(`Blocked kinds in subscription: ${blockedKinds.join(', ')}`);
          this.sendClosed(ws, subscriptionId, `blocked: kinds ${blockedKinds.join(', ')} not allowed`);
          return;
        }
      }

      if (filter.ids && filter.ids.length > 5000) {
        this.sendClosed(ws, subscriptionId, 'invalid: too many event IDs (max 5000)');
        return;
      }

      if (filter.limit && filter.limit > 5000) {
        filter.limit = 5000;
      } else if (!filter.limit) {
        filter.limit = 5000;
      }
    }

    this.subscriptions.set(subscriptionId, filters);

    this.scheduleSubscriptionWrite();
    this.scheduleSubscriptionUpdate();

    if (DEBUG) console.log(`New subscription ${subscriptionId} for session ${this.sessionId}`);

    try {
      const result = await this.getCachedOrQuery(filters, subscriptionId);

      if (result.bookmark) {
        this.bookmark = result.bookmark;
      }

      for (const event of result.events) {
        if (!isEventExpired(event) && !shouldFilterForPrivacy(event, this.authenticatedPubkeys)) {
          this.sendEvent(ws, subscriptionId, event);
        }
      }

      this.sendEOSE(ws, subscriptionId);

    } catch (error: any) {
      console.error(`Error processing REQ for subscription ${subscriptionId}:`, error);
      this.sendClosed(ws, subscriptionId, 'error: could not connect to the database');
    }
  }

  private async handleCloseSubscription(ws: WebSocket, subscriptionId: string): Promise<void> {
    if (!subscriptionId) {
      this.sendError(ws, 'Invalid subscription ID for CLOSE');
      return;
    }

    const deleted = this.subscriptions.delete(subscriptionId);
    if (deleted) {
      this.scheduleSubscriptionWrite();
      this.scheduleSubscriptionUpdate();

      if (DEBUG) console.log(`Closed subscription ${subscriptionId} for session ${this.sessionId}`);
      this.sendClosed(ws, subscriptionId, 'Subscription closed');
    } else {
      this.sendClosed(ws, subscriptionId, 'Subscription not found');
    }
  }

  private async handleAuth(ws: WebSocket, event: NostrEvent): Promise<void> {
    try {
      if (!event || typeof event !== 'object') {
        this.sendOK(ws, '', false, 'invalid: auth event object required');
        return;
      }

      if (event.kind !== 22242) {
        this.sendOK(ws, event.id, false, 'invalid: auth event must be kind 22242');
        return;
      }

      const isValidSignature = await verifyEventSignature(event);
      if (!isValidSignature) {
        this.sendOK(ws, event.id, false, 'invalid: signature verification failed');
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(now - event.created_at);
      if (timeDiff > 600) {
        this.sendOK(ws, event.id, false, 'invalid: created_at must be within 10 minutes');
        return;
      }

      const challengeTag = event.tags.find(tag => tag[0] === 'challenge');
      if (!challengeTag || challengeTag.length < 2) {
        this.sendOK(ws, event.id, false, 'invalid: missing challenge tag');
        return;
      }

      if (!this.challenge) {
        this.sendOK(ws, event.id, false, 'invalid: no challenge was issued');
        return;
      }

      if (challengeTag[1] !== this.challenge) {
        this.sendOK(ws, event.id, false, 'invalid: challenge mismatch');
        return;
      }

      const relayTag = event.tags.find(tag => tag[0] === 'relay');
      if (!relayTag || relayTag.length < 2) {
        this.sendOK(ws, event.id, false, 'invalid: missing relay tag');
        return;
      }

      try {
        const relayUrl = new URL(relayTag[1]);
        const relayHost = relayUrl.host.toLowerCase();
        const expectedHost = this.host.toLowerCase();

        if (relayHost !== expectedHost) {
          this.sendOK(ws, event.id, false, `invalid: relay tag must match this relay (expected ${expectedHost}, got ${relayHost})`);
          return;
        }
      } catch (error) {
        this.sendOK(ws, event.id, false, 'invalid: relay tag must be a valid URL');
        return;
      }

      this.authenticatedPubkeys.add(event.pubkey);
      await this.state.storage.put('authenticatedPubkeys', Array.from(this.authenticatedPubkeys));
      if (DEBUG) console.log(`NIP-42: Authenticated pubkey ${event.pubkey} for session ${this.sessionId}`);

      this.sendOK(ws, event.id, true, '');

    } catch (error: any) {
      console.error('Error handling AUTH:', error);
      this.sendOK(ws, event?.id || '', false, `error: ${error.message}`);
    }
  }

  private async getCachedPaymentStatus(pubkey: string): Promise<boolean | null> {
    const cached = this.paymentCache.get(pubkey);
    if (cached && Date.now() - cached.timestamp < this.PAYMENT_CACHE_TTL) {
      return cached.hasPaid;
    }
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
  }

  private async getCachedOrQuery(filters: NostrFilter[], subscriptionId?: string): Promise<QueryResult> {
    return await queryEvents(filters, this.bookmark, this.env, subscriptionId);
  }

  private matchesFilters(event: NostrEvent, filters: NostrFilter[]): boolean {
    return filters.some(filter => this.matchesFilter(event, filter));
  }

  private matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
    if (filter.ids && filter.ids.length > 0 && !filter.ids.includes(event.id)) {
      return false;
    }

    if (filter.authors && filter.authors.length > 0 && !filter.authors.includes(event.pubkey)) {
      return false;
    }

    if (filter.kinds && filter.kinds.length > 0 && !filter.kinds.includes(event.kind)) {
      return false;
    }

    if (filter.since && event.created_at < filter.since) {
      return false;
    }
    if (filter.until && event.created_at > filter.until) {
      return false;
    }

    for (const [key, values] of Object.entries(filter)) {
      if (key.startsWith('#') && Array.isArray(values) && values.length > 0) {
        const tagName = key.substring(1);
        const eventTagValues = event.tags
          .filter(tag => tag[0] === tagName)
          .map(tag => tag[1]);

        const hasMatch = values.some(v => eventTagValues.includes(v));
        if (!hasMatch) {
          return false;
        }
      }
    }

    return true;
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

  private sendPreSerializedEvent(ws: WebSocket, subscriptionId: string, preSerializedEventJson: string): void {
    try {
      const fullMessage = `["EVENT",${JSON.stringify(subscriptionId)},${preSerializedEventJson}]`;
      ws.send(fullMessage);
    } catch (error) {
      console.error('Error sending pre-serialized EVENT:', error);
    }
  }

  private sendAuth(ws: WebSocket, challenge: string): void {
    try {
      const authMessage = ['AUTH', challenge];
      ws.send(JSON.stringify(authMessage));
      if (DEBUG) console.log(`Sent AUTH challenge: ${challenge}`);
    } catch (error) {
      console.error('Error sending AUTH:', error);
    }
  }
}
