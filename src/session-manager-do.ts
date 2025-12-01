/**
 * SessionManagerDO - Centralized session and subscription management
 */

import {
  DurableObject,
  DurableObjectState,
  Env,
  NostrFilter,
  NostrEvent,
  PreSerializedEvent,
  ConnectionBroadcastRequest
} from './types';
import { pack, unpack } from 'msgpackr';

const DEBUG = false;

const MAX_BROADCAST_BATCH_SIZE = 900;
const SESSION_TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface SessionData {
  connectionDoId: string;
  subscriptions: Array<[string, NostrFilter[]]>;
  registeredAt: number;
  lastActiveAt: number;
}

export class SessionManagerDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  private sessions: Map<string, SessionData> = new Map();

  private kindIndex: Map<number, Set<string>> = new Map();
  private authorIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    this.state.storage.getAlarm().then(async (alarm) => {
      if (!alarm) {
        await this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
      }
    });

    console.log('SessionManagerDO: Started (ephemeral mode - no storage)');
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const staleThreshold = now - SESSION_TTL_MS;
    let cleanedCount = 0;

    for (const [sessionId, sessionData] of this.sessions) {
      if (sessionData.lastActiveAt < staleThreshold) {
        this.removeFromIndices(sessionId, sessionData.subscriptions);
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`SessionManagerDO: Cleaned up ${cleanedCount} stale sessions (TTL: ${SESSION_TTL_MS / 60000}min)`);
    }

    await this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/register' && request.method === 'POST') {
        return await this.handleRegister(request);
      }

      if (url.pathname === '/unregister' && request.method === 'POST') {
        return await this.handleUnregister(request);
      }

      if (url.pathname === '/update-subscriptions' && request.method === 'POST') {
        return await this.handleUpdateSubscriptions(request);
      }

      if (url.pathname === '/process-events' && request.method === 'POST') {
        return await this.handleProcessEvents(request);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error: any) {
      console.error('SessionManagerDO error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  private rebuildIndicesForSession(sessionId: string, subscriptions: Array<[string, NostrFilter[]]>): void {
    for (const [subscriptionId, filters] of subscriptions) {
      for (const filter of filters) {
        if (filter.kinds) {
          for (const kind of filter.kinds) {
            if (!this.kindIndex.has(kind)) {
              this.kindIndex.set(kind, new Set());
            }
            this.kindIndex.get(kind)!.add(sessionId);
          }
        }

        if (filter.authors) {
          for (const author of filter.authors) {
            if (!this.authorIndex.has(author)) {
              this.authorIndex.set(author, new Set());
            }
            this.authorIndex.get(author)!.add(sessionId);
          }
        }

        for (const [key, values] of Object.entries(filter)) {
          if (key.startsWith('#') && Array.isArray(values)) {
            const tagName = key.substring(1);
            if (['p', 'e', 'a', 't', 'd', 'h'].includes(tagName)) {
              for (const value of values) {
                const tagKey = `${tagName}:${value}`;
                if (!this.tagIndex.has(tagKey)) {
                  this.tagIndex.set(tagKey, new Set());
                }
                this.tagIndex.get(tagKey)!.add(sessionId);
              }
            }
          }
        }
      }
    }
  }

  private async handleRegister(request: Request): Promise<Response> {
    const buffer = await request.arrayBuffer();
    const { sessionId, connectionDoId } = unpack(new Uint8Array(buffer));

    const now = Date.now();
    const sessionData: SessionData = {
      connectionDoId,
      subscriptions: [],
      registeredAt: now,
      lastActiveAt: now
    };

    this.sessions.set(sessionId, sessionData);

    if (DEBUG) console.log(`Registered session ${sessionId}`);

    return new Response(pack({ success: true }), {
      headers: { 'Content-Type': 'application/msgpack' }
    });
  }

  private async handleUnregister(request: Request): Promise<Response> {
    const buffer = await request.arrayBuffer();
    const { sessionId } = unpack(new Uint8Array(buffer));

    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      return new Response(pack({ success: true, message: 'Session not found' }), {
        headers: { 'Content-Type': 'application/msgpack' }
      });
    }

    this.removeFromIndices(sessionId, sessionData.subscriptions);

    this.sessions.delete(sessionId);

    if (DEBUG) console.log(`Unregistered session ${sessionId}`);

    return new Response(pack({ success: true }), {
      headers: { 'Content-Type': 'application/msgpack' }
    });
  }

  private removeFromIndices(sessionId: string, subscriptions: Array<[string, NostrFilter[]]>): void {
    for (const [subscriptionId, filters] of subscriptions) {
      for (const filter of filters) {
        if (filter.kinds) {
          for (const kind of filter.kinds) {
            this.kindIndex.get(kind)?.delete(sessionId);
            if (this.kindIndex.get(kind)?.size === 0) {
              this.kindIndex.delete(kind);
            }
          }
        }

        if (filter.authors) {
          for (const author of filter.authors) {
            this.authorIndex.get(author)?.delete(sessionId);
            if (this.authorIndex.get(author)?.size === 0) {
              this.authorIndex.delete(author);
            }
          }
        }

        for (const [key, values] of Object.entries(filter)) {
          if (key.startsWith('#') && Array.isArray(values)) {
            const tagName = key.substring(1);
            if (['p', 'e', 'a', 't', 'd', 'h'].includes(tagName)) {
              for (const value of values) {
                const tagKey = `${tagName}:${value}`;
                this.tagIndex.get(tagKey)?.delete(sessionId);
                if (this.tagIndex.get(tagKey)?.size === 0) {
                  this.tagIndex.delete(tagKey);
                }
              }
            }
          }
        }
      }
    }
  }

  private async handleUpdateSubscriptions(request: Request): Promise<Response> {
    const buffer = await request.arrayBuffer();
    const { sessionId, connectionDoId, subscriptions } = unpack(new Uint8Array(buffer));

    const now = Date.now();
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      const newSessionData: SessionData = {
        connectionDoId,
        subscriptions,
        registeredAt: now,
        lastActiveAt: now
      };

      this.sessions.set(sessionId, newSessionData);

      this.rebuildIndicesForSession(sessionId, subscriptions);

      if (DEBUG) console.log(`Created session ${sessionId} with ${subscriptions.length} subscriptions`);

      return new Response(pack({ success: true }), {
        headers: { 'Content-Type': 'application/msgpack' }
      });
    }

    this.removeFromIndices(sessionId, sessionData.subscriptions);

    sessionData.subscriptions = subscriptions;
    sessionData.lastActiveAt = now;
    this.sessions.set(sessionId, sessionData);

    this.rebuildIndicesForSession(sessionId, subscriptions);

    if (DEBUG) console.log(`Updated session ${sessionId} with ${subscriptions.length} subscriptions`);

    return new Response(pack({ success: true }), {
      headers: { 'Content-Type': 'application/msgpack' }
      });
  }

  private async handleProcessEvents(request: Request): Promise<Response> {
    const buffer = await request.arrayBuffer();
    const { events } = unpack(new Uint8Array(buffer)) as { events: NostrEvent[] };

    if (events.length === 0) {
      return new Response(pack({ success: true, processed: 0 }), {
        headers: { 'Content-Type': 'application/msgpack' }
      });
    }

    const preSerializedEvents: PreSerializedEvent[] = events.map(event => ({
      event,
      serializedJson: JSON.stringify(event)
    }));

    const connectionToEvents = new Map<string, PreSerializedEvent[]>();

    for (const preSerializedEvent of preSerializedEvents) {
      const event = preSerializedEvent.event;
      const matchingConnectionIds = new Set<string>();

      const kindSessions = this.kindIndex.get(event.kind);
      if (kindSessions) {
        for (const sessionId of kindSessions) {
          const sessionData = this.sessions.get(sessionId);
          if (sessionData) {
            matchingConnectionIds.add(sessionData.connectionDoId);
          }
        }
      }

      const authorSessions = this.authorIndex.get(event.pubkey);
      if (authorSessions) {
        for (const sessionId of authorSessions) {
          const sessionData = this.sessions.get(sessionId);
          if (sessionData) {
            matchingConnectionIds.add(sessionData.connectionDoId);
          }
        }
      }

      for (const tag of event.tags) {
        if (tag.length >= 2 && ['p', 'e', 'a', 't', 'd', 'h'].includes(tag[0])) {
          const tagKey = `${tag[0]}:${tag[1]}`;
          const tagSessions = this.tagIndex.get(tagKey);
          if (tagSessions) {
            for (const sessionId of tagSessions) {
              const sessionData = this.sessions.get(sessionId);
              if (sessionData) {
                matchingConnectionIds.add(sessionData.connectionDoId);
              }
            }
          }
        }
      }

      for (const connectionDoId of matchingConnectionIds) {
        if (!connectionToEvents.has(connectionDoId)) {
          connectionToEvents.set(connectionDoId, []);
        }
        connectionToEvents.get(connectionDoId)!.push(preSerializedEvent);
      }
    }

    const connectionEntries = Array.from(connectionToEvents.entries());
    const totalConnections = connectionEntries.length;

    for (let batchStart = 0; batchStart < totalConnections; batchStart += MAX_BROADCAST_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + MAX_BROADCAST_BATCH_SIZE, totalConnections);
      const batch = connectionEntries.slice(batchStart, batchEnd);

      const batchPromises = batch.map(async ([connectionDoId, eventsForConnection]) => {
        try {
          const connectionId = this.env.CONNECTION_DO.idFromString(connectionDoId);
          const connectionStub = this.env.CONNECTION_DO.get(connectionId);

          const payload: ConnectionBroadcastRequest = { events: eventsForConnection };

          await connectionStub.fetch('https://internal/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/msgpack' },
            body: pack(payload)
          });
        } catch (error) {
          if (DEBUG) console.error(`Failed to broadcast to connection ${connectionDoId}:`, error);
        }
      });

      await Promise.all(batchPromises);
    }

    return new Response(pack({ success: true, processed: events.length, connections: connectionToEvents.size }), {
      headers: { 'Content-Type': 'application/msgpack' }
    });
  }

}
