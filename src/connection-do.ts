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
  CREATED_AT_LOWER_LIMIT,
  CREATED_AT_UPPER_LIMIT,
  AUTH_REQUIRED,
  SESSION_MANAGER_SHARD_COUNT
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
  host: string;
  connectedAt: number;
}

interface PaymentCacheEntry {
  hasPaid: boolean;
  timestamp: number;
}

interface SessionState {
  subscriptions: Map<string, NostrFilter[]>;
  registeredShards: Set<number>;
  pubkeyRateLimiter: RateLimiter;
  reqRateLimiter: RateLimiter;
  authenticatedPubkeys: Set<string>;
  challenge?: string;
  host: string;
}

export class ConnectionDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  private sessions: Map<string, SessionState> = new Map();

  private paymentCache: Map<string, PaymentCacheEntry> = new Map();
  private readonly PAYMENT_CACHE_TTL = 10000;

  private sessionsDirty: Set<string> = new Set();
  private pendingSubscriptionWrites: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pendingSubscriptionUpdates: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly SUBSCRIPTION_WRITE_DELAY_MS = 500;
  private readonly SUBSCRIPTION_UPDATE_DELAY_MS = 500;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    this.state.blockConcurrencyWhile(async () => {
      try {
        const storedSessions = await this.state.storage.get<any>('sessions');
        if (storedSessions) {
          for (const [sessionId, sessionData] of storedSessions as Array<[string, any]>) {
            const sanitizedSubscriptions = new Map<string, NostrFilter[]>();
            if (sessionData.subscriptions) {
              for (const [subId, filters] of sessionData.subscriptions as Array<[string, NostrFilter[]]>) {
                sanitizedSubscriptions.set(subId, this.sanitizeFilters(filters));
              }
            }
            let authenticatedPubkeys = new Set<string>();
            if (sessionData.authenticatedPubkeys) {
              const pubkeys = sessionData.authenticatedPubkeys as string[];
              authenticatedPubkeys = new Set(pubkeys.slice(0, 100));
            }
            this.sessions.set(sessionId, {
              subscriptions: sanitizedSubscriptions,
              registeredShards: new Set(sessionData.registeredShards as number[]),
              pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
              reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
              authenticatedPubkeys,
              challenge: sessionData.challenge,
              host: sessionData.host || ''
            });
          }
        }
      } catch (err) {
        console.error('Failed to load sessions from storage, clearing all storage:', err);
        try {
          await (this.state.storage as any).deleteAll();
        } catch (deleteErr) {
          console.error('Failed to clear storage:', deleteErr);
        }
        console.error('Failed to load sessions from storage, clearing:', err);
        await this.state.storage.delete('sessions');
        this.sessions.clear();
      }

      for (const [sessionId, session] of this.sessions) {
        if (session.subscriptions.size > 0) {
          this.updateSubscriptionsForSession(sessionId).catch(err =>
            console.error(`Failed to re-sync subscriptions for session ${sessionId} on wake:`, err)
          );
        }
      }
    });
  }

  private getOrCreateSession(sessionId: string, host: string = ''): SessionState {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        subscriptions: new Map(),
        registeredShards: new Set(),
        pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
        reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
        authenticatedPubkeys: new Set(),
        challenge: undefined,
        host
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  private getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
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

    const host = request.headers.get('host') || url.host;

    const sessionId = crypto.randomUUID();

    const session = this.getOrCreateSession(sessionId, host);

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const attachment: ConnectionAttachment = {
      sessionId,
      host,
      connectedAt: Date.now()
    };
    server.serializeAttachment(attachment);

    this.state.acceptWebSocket(server);

    await this.persistSessions();

    if (AUTH_REQUIRED) {
      session.challenge = crypto.randomUUID();
      this.sendAuth(server, session.challenge);
    }

    if (DEBUG) console.log(`ConnectionDO: New session ${sessionId}`);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private sanitizeFilters(filters: NostrFilter[]): NostrFilter[] {
    return filters.map(filter => {
      const sanitized = { ...filter };
      if (sanitized.ids && sanitized.ids.length > 5000) {
        sanitized.ids = sanitized.ids.slice(0, 5000);
      }
      if (sanitized.authors && sanitized.authors.length > 5000) {
        sanitized.authors = sanitized.authors.slice(0, 5000);
      }
      if (sanitized.kinds && sanitized.kinds.length > 100) {
        sanitized.kinds = sanitized.kinds.slice(0, 100);
      }
      for (const key of Object.keys(sanitized)) {
        if (key.startsWith('#') && Array.isArray((sanitized as any)[key])) {
          if ((sanitized as any)[key].length > 2500) {
            (sanitized as any)[key] = (sanitized as any)[key].slice(0, 2500);
          }
        }
      }
      return sanitized;
    });
  }

  private async persistSessions(): Promise<void> {
    const activeSessionIds = new Set<string>();
    for (const ws of this.state.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as { sessionId: string } | null;
      if (attachment?.sessionId) {
        activeSessionIds.add(attachment.sessionId);
      }
    }

    const sessionsData: Array<[string, any]> = [];
    for (const [sessionId, session] of this.sessions) {
      if (!activeSessionIds.has(sessionId)) {
        continue;
      }
      const sanitizedSubscriptions: Array<[string, NostrFilter[]]> = [];
      for (const [subId, filters] of session.subscriptions) {
        if (sanitizedSubscriptions.length >= 50) break;
        sanitizedSubscriptions.push([subId, this.sanitizeFilters(filters)]);
      }
      const limitedAuthPubkeys = Array.from(session.authenticatedPubkeys).slice(0, 100);
      sessionsData.push([sessionId, {
        subscriptions: sanitizedSubscriptions,
        registeredShards: Array.from(session.registeredShards).slice(0, 100),
        authenticatedPubkeys: limitedAuthPubkeys,
        challenge: session.challenge,
        host: session.host
      }]);
      if (sessionsData.length >= 500) break;
    }
    await this.state.storage.put('sessions', sessionsData);
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
      const { sessionId } = attachment;
      if (DEBUG) console.log(`ConnectionDO: Session ${sessionId} closed`);

      const pendingWrite = this.pendingSubscriptionWrites.get(sessionId);
      if (pendingWrite) {
        clearTimeout(pendingWrite);
        this.pendingSubscriptionWrites.delete(sessionId);
      }
      const pendingUpdate = this.pendingSubscriptionUpdates.get(sessionId);
      if (pendingUpdate) {
        clearTimeout(pendingUpdate);
        this.pendingSubscriptionUpdates.delete(sessionId);
      }

      await this.flushSubscriptionWriteForSession(sessionId);

      await this.unregisterSessionFromShards(sessionId).catch(err =>
        console.error(`Failed to unregister session ${sessionId}:`, err)
      );

      this.sessions.delete(sessionId);
      this.sessionsDirty.delete(sessionId);

      await this.persistSessions();
    }
  }

  async webSocketError(ws: WebSocket, error: any): Promise<void> {
    console.error('WebSocket error:', error);
  }

  private scheduleSubscriptionWriteForSession(sessionId: string): void {
    this.sessionsDirty.add(sessionId);

    if (this.pendingSubscriptionWrites.has(sessionId)) {
      return;
    }

    const timer = setTimeout(async () => {
      this.pendingSubscriptionWrites.delete(sessionId);
      await this.flushSubscriptionWriteForSession(sessionId);
    }, this.SUBSCRIPTION_WRITE_DELAY_MS);
    this.pendingSubscriptionWrites.set(sessionId, timer);
  }

  private async flushSubscriptionWriteForSession(sessionId: string): Promise<void> {
    if (!this.sessionsDirty.has(sessionId)) {
      return;
    }

    this.sessionsDirty.delete(sessionId);
    try {
      await this.persistSessions();
    } catch (err) {
      console.error(`Failed to persist sessions to storage:`, err);
      this.sessionsDirty.add(sessionId);
    }
  }

  private scheduleSubscriptionUpdateForSession(sessionId: string): void {
    if (this.pendingSubscriptionUpdates.has(sessionId)) {
      return;
    }

    const timer = setTimeout(async () => {
      this.pendingSubscriptionUpdates.delete(sessionId);
      await this.updateSubscriptionsForSession(sessionId).catch(err =>
        console.error(`Failed to update subscriptions for session ${sessionId}:`, err)
      );
    }, this.SUBSCRIPTION_UPDATE_DELAY_MS);
    this.pendingSubscriptionUpdates.set(sessionId, timer);
  }

  private getRequiredShardsForSession(sessionId: string): Set<number> {
    const requiredShards = new Set<number>();
    const session = this.getSession(sessionId);
    if (!session) return requiredShards;

    for (const [subscriptionId, filters] of session.subscriptions) {
      for (const filter of filters) {
        if (filter.kinds && filter.kinds.length > 0) {
          for (const kind of filter.kinds) {
            requiredShards.add(kind % SESSION_MANAGER_SHARD_COUNT);
          }
        }
      }
    }

    return requiredShards;
  }

  private async unregisterSessionFromShards(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) return;

    const unregisterPromises = Array.from(session.registeredShards).map(async (shardNum) => {
      try {
        const id = this.env.SESSION_MANAGER_DO.idFromName(`manager-${shardNum}`);
        const stub = this.env.SESSION_MANAGER_DO.get(id);

        await stub.fetch('https://internal/unregister', {
          method: 'POST',
          headers: { 'Content-Type': 'application/msgpack' },
          body: pack({
            sessionId
          })
        });
      } catch (error) {
        console.error(`Failed to unregister session ${sessionId} from shard ${shardNum}:`, error);
      }
    });

    await Promise.all(unregisterPromises);
    session.registeredShards.clear();
  }

  private async updateSubscriptionsForSession(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) return;

    const requiredShards = this.getRequiredShardsForSession(sessionId);

    const shardToSubscriptions = new Map<number, Array<[string, NostrFilter[]]>>();

    for (const [subscriptionId, filters] of session.subscriptions) {
      for (const filter of filters) {
        if (filter.kinds && filter.kinds.length > 0) {
          for (const kind of filter.kinds) {
            const shardNum = kind % SESSION_MANAGER_SHARD_COUNT;
            if (!shardToSubscriptions.has(shardNum)) {
              shardToSubscriptions.set(shardNum, []);
            }
            const existing = shardToSubscriptions.get(shardNum)!;
            if (!existing.find(([id]) => id === subscriptionId)) {
              existing.push([subscriptionId, filters]);
            }
          }
        }
      }
    }

    const updatePromises = Array.from(requiredShards).map(async (shardNum) => {
      try {
        const id = this.env.SESSION_MANAGER_DO.idFromName(`manager-${shardNum}`);
        const stub = this.env.SESSION_MANAGER_DO.get(id);

        const relevantSubs = shardToSubscriptions.get(shardNum) || [];

        await stub.fetch('https://internal/update-subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/msgpack' },
          body: pack({
            sessionId,
            connectionDoId: this.state.id.toString(),
            subscriptions: relevantSubs
          })
        });

        session.registeredShards.add(shardNum);
      } catch (error) {
        console.error(`Failed to update subscriptions for session ${sessionId} on shard ${shardNum}:`, error);
      }
    });

    const shardsToUnregister = Array.from(session.registeredShards).filter(
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
            sessionId
          })
        });

        session.registeredShards.delete(shardNum);
      } catch (error) {
        console.error(`Failed to unregister session ${sessionId} from shard ${shardNum}:`, error);
      }
    });

    await Promise.all([...updatePromises, ...unregisterPromises]);

    if (DEBUG) console.log(
      `Session ${sessionId} registered with shards: [${Array.from(session.registeredShards).sort().join(', ')}]`
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

      let sentCount = 0;

      for (const ws of webSockets) {
        const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
        if (!attachment) continue;

        const session = this.getSession(attachment.sessionId);
        if (!session) continue;

        for (const preSerializedEvent of events) {
          if (isEventExpired(preSerializedEvent.event)) {
            continue;
          }

          if (shouldFilterForPrivacy(preSerializedEvent.event, session.authenticatedPubkeys)) {
            continue;
          }

          for (const [subscriptionId, filters] of session.subscriptions) {
            if (this.matchesFilters(preSerializedEvent.event, filters)) {
              this.sendPreSerializedEvent(ws, subscriptionId, preSerializedEvent.serializedJson);
              sentCount++;
            }
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
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
    if (!attachment) {
      this.sendOK(ws, '', false, 'error: session not found');
      return;
    }
    const { sessionId } = attachment;
    const session = this.getSession(sessionId);
    if (!session) {
      this.sendOK(ws, '', false, 'error: session not found');
      return;
    }

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

      if (AUTH_REQUIRED && !session.authenticatedPubkeys.has(event.pubkey)) {
        this.sendOK(ws, event.id, false, 'auth-required: please AUTH to publish events');
        return;
      }

      if (!excludedRateLimitKinds.has(event.kind)) {
        if (!session.pubkeyRateLimiter.removeToken()) {
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
          const host = session.host;
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

      if (event.kind === 22242) {
        if (DEBUG) console.log(`Rejected kind 22242 event ${event.id}`);
        this.sendOK(ws, event.id, false, 'invalid: kind 22242 events are for authentication only');
        return;
      }

      const result = await processEvent(event, sessionId, this.env);

      if (result.success) {
        this.sendOK(ws, event.id, true, result.message);

        const shardNum = event.kind % SESSION_MANAGER_SHARD_COUNT;
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
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
    if (!attachment) {
      this.sendError(ws, 'Session not found');
      return;
    }
    const { sessionId } = attachment;
    const session = this.getSession(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    const [_, subscriptionId, ...filters] = message;

    if (!subscriptionId || typeof subscriptionId !== 'string' || subscriptionId === '' || subscriptionId.length > 64) {
      this.sendError(ws, 'Invalid subscription ID: must be non-empty string of max 64 chars');
      return;
    }

    if (AUTH_REQUIRED && session.authenticatedPubkeys.size === 0) {
      this.sendClosed(ws, subscriptionId, 'auth-required: please AUTH to subscribe');
      return;
    }

    if (!session.reqRateLimiter.removeToken()) {
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

      if (!filter.kinds || filter.kinds.length === 0) {
        this.sendClosed(ws, subscriptionId, 'invalid: kinds filter is required');
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
        if (filter.authors.length > 5000) {
          this.sendClosed(ws, subscriptionId, 'invalid: too many authors (max 5000)');
          return;
        }
        for (const author of filter.authors) {
          if (!/^[a-f0-9]{64}$/.test(author)) {
            this.sendClosed(ws, subscriptionId, `invalid: Invalid author pubkey format: ${author}`);
            return;
          }
        }
      }

      if (filter.kinds) {
        if (filter.kinds.length > 100) {
          this.sendClosed(ws, subscriptionId, 'invalid: too many kinds (max 100)');
          return;
        }
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

      for (const [key, values] of Object.entries(filter)) {
        if (key.startsWith('#') && Array.isArray(values)) {
          if (values.length > 2500) {
            this.sendClosed(ws, subscriptionId, `invalid: too many values in ${key} filter (max 2500)`);
            return;
          }
        }
      }
    }

    session.subscriptions.set(subscriptionId, filters);

    this.scheduleSubscriptionWriteForSession(sessionId);
    this.scheduleSubscriptionUpdateForSession(sessionId);

    if (DEBUG) console.log(`New subscription ${subscriptionId} for session ${sessionId}`);

    try {
      const result = await this.getCachedOrQuery(filters, subscriptionId);

      for (const event of result.events) {
        if (!isEventExpired(event) && !shouldFilterForPrivacy(event, session.authenticatedPubkeys)) {
          this.sendEvent(ws, subscriptionId, event);
        }
      }

      this.sendEOSE(ws, subscriptionId);

    } catch (error: any) {
      console.error(`Error processing REQ for subscription ${subscriptionId}:`, error);
      this.sendClosed(ws, subscriptionId, 'error: could not query events');
    }
  }

  private async handleCloseSubscription(ws: WebSocket, subscriptionId: string): Promise<void> {
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
    if (!attachment) {
      this.sendError(ws, 'Session not found');
      return;
    }
    const { sessionId } = attachment;
    const session = this.getSession(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    if (!subscriptionId) {
      this.sendError(ws, 'Invalid subscription ID for CLOSE');
      return;
    }

    const deleted = session.subscriptions.delete(subscriptionId);
    if (deleted) {
      this.scheduleSubscriptionWriteForSession(sessionId);
      this.scheduleSubscriptionUpdateForSession(sessionId);

      if (DEBUG) console.log(`Closed subscription ${subscriptionId} for session ${sessionId}`);
      this.sendClosed(ws, subscriptionId, 'Subscription closed');
    } else {
      this.sendClosed(ws, subscriptionId, 'Subscription not found');
    }
  }

  private async handleAuth(ws: WebSocket, event: NostrEvent): Promise<void> {
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
    if (!attachment) {
      this.sendOK(ws, '', false, 'error: session not found');
      return;
    }
    const { sessionId } = attachment;
    const session = this.getSession(sessionId);
    if (!session) {
      this.sendOK(ws, '', false, 'error: session not found');
      return;
    }

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

      if (!session.challenge) {
        this.sendOK(ws, event.id, false, 'invalid: no challenge was issued');
        return;
      }

      if (challengeTag[1] !== session.challenge) {
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
        const expectedHost = session.host.toLowerCase();

        if (relayHost !== expectedHost) {
          this.sendOK(ws, event.id, false, `invalid: relay tag must match this relay (expected ${expectedHost}, got ${relayHost})`);
          return;
        }
      } catch (error) {
        this.sendOK(ws, event.id, false, 'invalid: relay tag must be a valid URL');
        return;
      }

      session.authenticatedPubkeys.add(event.pubkey);
      await this.persistSessions();
      if (DEBUG) console.log(`NIP-42: Authenticated pubkey ${event.pubkey} for session ${sessionId}`);

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
    return await queryEvents(filters, this.env, subscriptionId);
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