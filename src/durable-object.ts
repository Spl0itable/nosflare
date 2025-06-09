import { NostrEvent, NostrFilter, RateLimiter, WebSocketSession, Env } from './types';
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
import { verifyEventSignature, hasPaidForRelay, processEvent, queryEvents } from './relay-worker';

export class RelayWebSocket implements DurableObject {
  private sessions: Map<string, WebSocketSession>;
  private env: Env;
  private state: DurableObjectState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.sessions = new Map();
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle internal RPC calls from the worker
    if (url.pathname === '/broadcast-event' && request.method === 'POST') {
      const { event } = await request.json();
      await this.broadcastEvent(event);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    await this.handleSession(server, request);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleSession(webSocket: WebSocket, request: Request): Promise<void> {
    webSocket.accept();

    const sessionId = crypto.randomUUID();
    const url = new URL(request.url);
    const session: WebSocketSession = {
      id: sessionId,
      webSocket,
      subscriptions: new Map(),
      pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
      reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
      bookmark: 'first-unconstrained',
      host: request.headers.get('host') || url.host
    };

    this.sessions.set(sessionId, session);
    console.log(`New WebSocket session: ${sessionId}`);

    webSocket.addEventListener('message', async (event) => {
      try {
        let message: any;
        
        if (typeof event.data === 'string') {
          message = JSON.parse(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          const decoder = new TextDecoder();
          const text = decoder.decode(event.data);
          message = JSON.parse(text);
        } else {
          throw new Error('Unsupported message format');
        }
        
        await this.handleMessage(session, message);
      } catch (error) {
        console.error('Error handling message:', error);
        if (error instanceof SyntaxError) {
          this.sendError(webSocket, 'Invalid JSON format');
        } else {
          this.sendError(webSocket, 'Failed to process message');
        }
      }
    });

    webSocket.addEventListener('close', () => {
      console.log(`WebSocket session closed: ${sessionId}`);
      this.handleClose(sessionId);
    });

    webSocket.addEventListener('error', (error) => {
      console.error(`WebSocket error for session ${sessionId}:`, error);
      this.handleClose(sessionId);
    });
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
          this.handleCloseSubscription(session, args[0]);
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

      // Check if pubkey is allowed
      if (!isPubkeyAllowed(event.pubkey)) {
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
        
        // Broadcast to all matching subscriptions
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
        const blockedKinds = filter.kinds.filter(kind => !isEventKindAllowed(kind));
        if (blockedKinds.length > 0) {
          console.error(`Blocked kinds in subscription: ${blockedKinds.join(', ')}`);
          this.sendClosed(session.webSocket, subscriptionId, `blocked: kinds ${blockedKinds.join(', ')} not allowed`);
          return;
        }
      }

      // Validate limits
      if (filter.ids && filter.ids.length > 10000) {
        this.sendClosed(session.webSocket, subscriptionId, 'invalid: too many event IDs (max 10000)');
        return;
      }

      if (filter.limit && filter.limit > 10000) {
        this.sendClosed(session.webSocket, subscriptionId, 'invalid: limit too high (max 10000)');
        return;
      }

      // Set default limit if not provided
      if (!filter.limit) {
        filter.limit = 10000;
      }
    }

    // Store subscription
    session.subscriptions.set(subscriptionId, filters);
    console.log(`New subscription ${subscriptionId} for session ${session.id}`);

    try {
      // Query events from database
      const result = await queryEvents(filters, session.bookmark, this.env);
      
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

  private handleCloseSubscription(session: WebSocketSession, subscriptionId: string): void {
    if (!subscriptionId) {
      this.sendError(session.webSocket, 'Invalid subscription ID for CLOSE');
      return;
    }

    const deleted = session.subscriptions.delete(subscriptionId);
    if (deleted) {
      console.log(`Closed subscription ${subscriptionId} for session ${session.id}`);
      this.sendClosed(session.webSocket, subscriptionId, 'Subscription closed');
    } else {
      this.sendClosed(session.webSocket, subscriptionId, 'Subscription not found');
    }
  }

  private async broadcastEvent(event: NostrEvent): Promise<void> {
    let broadcastCount = 0;
    
    for (const [sessionId, session] of this.sessions) {
      for (const [subscriptionId, filters] of session.subscriptions) {
        if (this.matchesFilters(event, filters)) {
          try {
            this.sendEvent(session.webSocket, subscriptionId, event);
            broadcastCount++;
          } catch (error) {
            console.error(`Error broadcasting to session ${sessionId}, subscription ${subscriptionId}:`, error);
          }
        }
      }
    }
    
    if (broadcastCount > 0) {
      console.log(`Event ${event.id} broadcast to ${broadcastCount} subscriptions`);
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

  private handleClose(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`Cleaning up session ${sessionId} with ${session.subscriptions.size} subscriptions`);
    }
    this.sessions.delete(sessionId);
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

  // Public methods for monitoring
  async getStats(): Promise<{ sessions: number; subscriptions: number }> {
    let totalSubscriptions = 0;
    for (const session of this.sessions.values()) {
      totalSubscriptions += session.subscriptions.size;
    }
    return {
      sessions: this.sessions.size,
      subscriptions: totalSubscriptions
    };
  }
}