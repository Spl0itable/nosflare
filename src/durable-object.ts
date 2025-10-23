import { NostrEvent, NostrFilter, RateLimiter, WebSocketSession, Env, DOBroadcastRequest } from './types';
import {
  PUBKEY_RATE_LIMIT,
  REQ_RATE_LIMIT,
  PAY_TO_RELAY_ENABLED,
  isPubkeyAllowed,
  isEventKindAllowed,
  containsBlockedContent,
  isTagAllowed,
  excludedRateLimitKinds
} from './config';
import { verifyEventSignature, hasPaidForRelay, processEvent, queryEventsWithArchive } from './relay-worker';

// Session attachment data
interface SessionAttachment {
  sessionId: string;
  bookmark: string;
  host: string;
  doName: string;
}

export class RelayWebSocket implements DurableObject {
  private sessions: Map<string, WebSocketSession>;
  private env: Env;
  private state: DurableObjectState;
  private region: string;
  private doId: string;
  private doName: string;
  private processedEvents: Map<string, number> = new Map();

  // Define allowed endpoints
  private static readonly ALLOWED_ENDPOINTS = [
    'relay-WNAM-primary',
    'relay-ENAM-primary',
    'relay-WEUR-primary',
    'relay-EEUR-primary',
    'relay-APAC-primary',
    'relay-OC-primary',
    'relay-SAM-primary',
    'relay-AFR-primary',
    'relay-ME-primary'
  ];

  // Map endpoints to their proper location hints
  private static readonly ENDPOINT_HINTS: Record<string, string> = {
    'relay-WNAM-primary': 'wnam',
    'relay-ENAM-primary': 'enam',
    'relay-WEUR-primary': 'weur',
    'relay-EEUR-primary': 'eeur',
    'relay-APAC-primary': 'apac',
    'relay-OC-primary': 'oc',
    'relay-SAM-primary': 'enam',
    'relay-AFR-primary': 'weur',
    'relay-ME-primary': 'eeur'
  };

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.sessions = new Map();
    this.env = env;
    this.doId = crypto.randomUUID();
    this.region = 'unknown';
    this.doName = 'unknown';
    this.processedEvents = new Map();

    // Set up periodic cleanup alarm
    this.state.storage.getAlarm().then(scheduledTime => {
      if (scheduledTime === null) {
        // No alarm set, schedule first cleanup in 5 minutes
        this.state.storage.setAlarm(Date.now() + 300000);
      }
    });
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

  // Alarm handler for cleanup
  async alarm(): Promise<void> {
    await this.cleanupStaleConnections();
    
    // Clean up old processed events (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 300000;
    for (const [eventId, timestamp] of this.processedEvents) {
      if (timestamp < fiveMinutesAgo) {
        this.processedEvents.delete(eventId);
      }
    }

    // Schedule next cleanup in 5 minutes
    await this.state.storage.setAlarm(Date.now() + 300000);
  }

  // Cleanup stale connections
  private async cleanupStaleConnections(): Promise<void> {
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      try {
        // Check if WebSocket is still alive
        if (session.webSocket.readyState !== WebSocket.OPEN && 
            session.webSocket.readyState !== WebSocket.CONNECTING) {
          this.sessions.delete(sessionId);
          await this.deleteSubscriptions(sessionId);
          cleanedCount++;
        }
      } catch (error) {
        // WebSocket is dead, clean it up
        this.sessions.delete(sessionId);
        await this.deleteSubscriptions(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} stale sessions on DO ${this.doName}`);
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

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Extract region info and DO name
    this.region = url.searchParams.get('region') || this.region || 'unknown';
    const colo = url.searchParams.get('colo') || 'default';
    const host = request.headers.get('host') || url.host;

    console.log(`WebSocket connection to DO: ${this.doName} (region: ${this.region}, colo: ${colo})`);

    const sessionId = crypto.randomUUID();
    
    // Accept WebSocket immediately
    this.state.acceptWebSocket(server);

    // Attach minimal metadata
    const attachment: SessionAttachment = {
      sessionId,
      bookmark: 'first-unconstrained',
      host,
      doName: this.doName
    };
    server.serializeAttachment(attachment);

    // Create session asynchronously (don't await)
    const session: WebSocketSession = {
      id: sessionId,
      webSocket: server,
      subscriptions: new Map(),
      pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
      reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
      bookmark: 'first-unconstrained',
      host
    };

    this.sessions.set(sessionId, session);

    console.log(`New WebSocket session: ${sessionId} on DO ${this.doName}`);

    // Return immediately - session is ready
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // WebSocket Hibernation API handler methods
  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const attachment = ws.deserializeAttachment() as SessionAttachment | null;
    if (!attachment) {
      console.error('No session attachment found');
      ws.close(1011, 'Session not found');
      return;
    }

    // Try to get existing session from memory first
    let session = this.sessions.get(attachment.sessionId);
    
    // Only restore from storage if session doesn't exist in memory (DO was evicted)
    if (!session) {
      console.log(`Session ${attachment.sessionId} not in memory, restoring from storage`);
      
      // Restore DO name from attachment if needed
      if (attachment.doName && this.doName === 'unknown') {
        this.doName = attachment.doName;
      }
      
      // Load subscriptions from storage
      const subscriptions = await this.loadSubscriptions(attachment.sessionId);

      // Recreate session from attachment
      session = {
        id: attachment.sessionId,
        webSocket: ws,
        subscriptions,
        pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
        reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
        bookmark: attachment.bookmark,
        host: attachment.host
      };
      
      // Store restored session back in memory
      this.sessions.set(attachment.sessionId, session);
    } else {
      // Session exists in memory, just update the WebSocket reference in case it changed
      session.webSocket = ws;
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

      // Only update attachment if bookmark changed
      if (session.bookmark !== attachment.bookmark) {
        const updatedAttachment: SessionAttachment = {
          sessionId: session.id,
          bookmark: session.bookmark,
          host: session.host,
          doName: this.doName
        };
        ws.serializeAttachment(updatedAttachment);
      }

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
      
      // Remove from memory
      this.sessions.delete(attachment.sessionId);

      // Clean up stored subscriptions
      await this.deleteSubscriptions(attachment.sessionId);
    }
  }

  async webSocketError(ws: WebSocket, error: any): Promise<void> {
    const attachment = ws.deserializeAttachment() as SessionAttachment | null;
    if (attachment) {
      console.error(`WebSocket error for session ${attachment.sessionId}:`, error);
      this.sessions.delete(attachment.sessionId);
      await this.deleteSubscriptions(attachment.sessionId);
    }
  }

  private async handleDOBroadcast(request: Request): Promise<Response> {
    try {
      const data: DOBroadcastRequest = await request.json();
      const { event, sourceDoId } = data;

      // Prevent duplicate processing
      if (this.processedEvents.has(event.id)) {
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      this.processedEvents.set(event.id, Date.now());

      console.log(`DO ${this.doName} received event ${event.id} from ${sourceDoId}`);

      // Broadcast to local sessions
      await this.broadcastToLocalSessions(event);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error handling DO broadcast:', error);
      return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
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

      // Check required fields
      if (!event.id || !event.pubkey || !event.sig || !event.created_at ||
        event.kind === undefined || !Array.isArray(event.tags) ||
        event.content === undefined) {
        this.sendOK(session.webSocket, event.id || '', false, 'invalid: missing required fields');
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
        const hasPaid = await hasPaidForRelay(event.pubkey, this.env);
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

      if (result.success) {
        // Send OK to the sender
        this.sendOK(session.webSocket, event.id, true, result.message);

        // Mark as processed
        this.processedEvents.set(event.id, Date.now());

        // Broadcast to all (local + remote) - fire and forget
        console.log(`DO ${this.doName} broadcasting event ${event.id}`);
        this.broadcastEvent(event).catch(err => 
          console.error(`Broadcast error for event ${event.id}:`, err)
        );
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

      if (filter.limit && filter.limit > 5000) {
        this.sendClosed(session.webSocket, subscriptionId, 'invalid: limit too high (max 5000)');
        return;
      }

      // Set default limit if not provided
      if (!filter.limit) {
        filter.limit = 5000;
      }
    }

    // Store subscription in memory
    session.subscriptions.set(subscriptionId, filters);

    // Persist to storage for recovery after DO eviction
    await this.saveSubscriptions(session.id, session.subscriptions);

    console.log(`New subscription ${subscriptionId} for session ${session.id} on DO ${this.doName}`);

    try {
      // Query events from database (including archive if needed)
      const result = await queryEventsWithArchive(filters, session.bookmark, this.env);

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

  private async broadcastEvent(event: NostrEvent): Promise<void> {
    // Broadcast to local sessions first
    await this.broadcastToLocalSessions(event);

    // Broadcast to other DOs (fire and forget with aggressive timeout)
    this.broadcastToOtherDOs(event).catch(err =>
      console.error(`Error broadcasting to other DOs:`, err)
    );
  }

  private async broadcastToLocalSessions(event: NostrEvent): Promise<void> {
    let broadcastCount = 0;

    // Iterate through in-memory sessions first (active connections)
    for (const [sessionId, session] of this.sessions) {
      for (const [subscriptionId, filters] of session.subscriptions) {
        if (this.matchesFilters(event, filters)) {
          try {
            this.sendEvent(session.webSocket, subscriptionId, event);
            broadcastCount++;
          } catch (error) {
            console.error(`Error broadcasting to subscription ${subscriptionId}:`, error);
          }
        }
      }
    }

    // Also check hibernated WebSockets (might not be in sessions Map)
    const activeWebSockets = this.state.getWebSockets();
    for (const ws of activeWebSockets) {
      const attachment = ws.deserializeAttachment() as SessionAttachment | null;
      if (!attachment) continue;

      // Skip if already processed in the sessions loop
      if (this.sessions.has(attachment.sessionId)) continue;

      // Wake up hibernated session
      let session = this.sessions.get(attachment.sessionId);
      if (!session) {
        const subscriptions = await this.loadSubscriptions(attachment.sessionId);
        
        session = {
          id: attachment.sessionId,
          webSocket: ws,
          subscriptions,
          pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
          reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
          bookmark: attachment.bookmark,
          host: attachment.host
        };
        
        this.sessions.set(attachment.sessionId, session);
      }

      for (const [subscriptionId, filters] of session.subscriptions) {
        if (this.matchesFilters(event, filters)) {
          try {
            this.sendEvent(ws, subscriptionId, event);
            broadcastCount++;
          } catch (error) {
            console.error(`Error broadcasting to hibernated subscription ${subscriptionId}:`, error);
          }
        }
      }
    }

    if (broadcastCount > 0) {
      console.log(`Event ${event.id} broadcast to ${broadcastCount} local subscriptions on DO ${this.doName}`);
    }
  }

  private async broadcastToOtherDOs(event: NostrEvent): Promise<void> {
    const broadcasts: Promise<void>[] = [];

    // Broadcast to all allowed endpoints except ourselves
    for (const endpoint of RelayWebSocket.ALLOWED_ENDPOINTS) {
      if (endpoint === this.doName) continue;

      // Fire and forget - don't await individual broadcasts
      broadcasts.push(
        this.sendToSpecificDO(endpoint, event)
          .catch(err => console.error(`Broadcast to ${endpoint} failed:`, err))
          .then(() => {}) // Convert Response to void
      );
    }

    // Set very aggressive timeout for broadcasts (1 second max)
    await Promise.race([
      Promise.all(broadcasts),
      new Promise<void>(resolve => setTimeout(resolve, 1000))
    ]);

    console.log(`Event ${event.id} broadcast initiated from DO ${this.doName} to other DOs`);
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
        headers: {
          'Content-Type': 'application/json'
        },
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