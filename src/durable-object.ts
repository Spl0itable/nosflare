import { NostrEvent, NostrFilter, RateLimiter, WebSocketSession, Env, BroadcastEventRequest, PeerInfo, DOBroadcastRequest } from './types';
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
  private region: string;
  private doId: string;
  private doName: string;
  private knownPeers: Map<string, PeerInfo> = new Map();
  private processedEvents: Map<string, number> = new Map(); // eventId -> timestamp
  private peerDiscoveryInterval?: number;

  // Define allowed endpoints - 6 DOs per region (54 total)
  private static readonly ALLOWED_ENDPOINTS = [
    // Western North America (6 instances)
    'relay-WNAM-1', 'relay-WNAM-2', 'relay-WNAM-3', 'relay-WNAM-4', 'relay-WNAM-5', 'relay-WNAM-6',
    // Eastern North America (6 instances)
    'relay-ENAM-1', 'relay-ENAM-2', 'relay-ENAM-3', 'relay-ENAM-4', 'relay-ENAM-5', 'relay-ENAM-6',
    // Western Europe (6 instances)
    'relay-WEUR-1', 'relay-WEUR-2', 'relay-WEUR-3', 'relay-WEUR-4', 'relay-WEUR-5', 'relay-WEUR-6',
    // Eastern Europe (6 instances)
    'relay-EEUR-1', 'relay-EEUR-2', 'relay-EEUR-3', 'relay-EEUR-4', 'relay-EEUR-5', 'relay-EEUR-6',
    // Asia-Pacific (6 instances)
    'relay-APAC-1', 'relay-APAC-2', 'relay-APAC-3', 'relay-APAC-4', 'relay-APAC-5', 'relay-APAC-6',
    // Oceania (6 instances)
    'relay-OC-1', 'relay-OC-2', 'relay-OC-3', 'relay-OC-4', 'relay-OC-5', 'relay-OC-6',
    // South America (6 instances)
    'relay-SAM-1', 'relay-SAM-2', 'relay-SAM-3', 'relay-SAM-4', 'relay-SAM-5', 'relay-SAM-6',
    // Africa (6 instances)
    'relay-AFR-1', 'relay-AFR-2', 'relay-AFR-3', 'relay-AFR-4', 'relay-AFR-5', 'relay-AFR-6',
    // Middle East (6 instances)
    'relay-ME-1', 'relay-ME-2', 'relay-ME-3', 'relay-ME-4', 'relay-ME-5', 'relay-ME-6'
  ];

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.sessions = new Map();
    this.env = env;
    this.doId = crypto.randomUUID();
    this.region = 'unknown';
    this.doName = 'unknown'; // Initialize with 'unknown' instead of undefined

    // Restore state including DO name
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get(['knownPeers', 'region', 'doId', 'doName']);
      // @ts-ignore
      if (stored.knownPeers) {
        // @ts-ignore
        this.knownPeers = new Map(stored.knownPeers as any);
      }
      // @ts-ignore
      if (stored.region) {
        // @ts-ignore
        this.region = stored.region as string;
      }
      // @ts-ignore
      if (stored.doId) {
        // @ts-ignore
        this.doId = stored.doId as string;
      }
      // @ts-ignore
      if (stored.doName) {
        // @ts-ignore
        this.doName = stored.doName as string;
      }
    });

    // Clean up old processed events every hour
    this.state.storage.setAlarm(Date.now() + 3600000);
  }

  async alarm() {
    // Clean up events older than 5 minutes
    const fiveMinutesAgo = Date.now() - 300000;
    for (const [eventId, timestamp] of this.processedEvents) {
      if (timestamp < fiveMinutesAgo) {
        this.processedEvents.delete(eventId);
      }
    }

    // Clean up stale peers (not seen in 10 minutes)
    const tenMinutesAgo = Date.now() - 600000;
    for (const [peerId, peerInfo] of this.knownPeers) {
      if (peerInfo.lastSeen < tenMinutesAgo) {
        this.knownPeers.delete(peerId);
      }
    }

    // Save updated peer list
    await this.state.storage.put('knownPeers', Array.from(this.knownPeers.entries()));

    // Reset alarm
    this.state.storage.setAlarm(Date.now() + 3600000);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Extract and set DO name from URL if provided
    const urlDoName = url.searchParams.get('doName');
    if (urlDoName && urlDoName !== 'unknown' && RelayWebSocket.ALLOWED_ENDPOINTS.includes(urlDoName)) {
      this.doName = urlDoName;
      // Persist it
      await this.state.storage.put('doName', this.doName);
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        doName: this.doName,
        sessions: this.sessions.size,
        peers: this.knownPeers.size
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // DO-to-DO broadcast endpoint
    if (url.pathname === '/do-broadcast') {
      return await this.handleDOBroadcast(request);
    }

    // Peer discovery endpoint
    if (url.pathname === '/discover-peers') {
      return await this.handlePeerDiscovery(request);
    }

    // Peer exchange endpoint
    if (url.pathname === '/exchange-peers') {
      return await this.handlePeerExchange(request);
    }

    // Handle internal RPC calls from the worker (legacy support)
    if (url.pathname === '/broadcast-event' && request.method === 'POST') {
      const data = await request.json() as BroadcastEventRequest;
      const { event } = data;
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

    // Extract region info and DO name
    this.region = url.searchParams.get('region') || this.region || 'unknown';
    const colo = url.searchParams.get('colo') || 'default';

    // Store our identity
    await this.state.storage.put({
      region: this.region,
      doId: this.doId,
      doName: this.doName
    });

    console.log(`WebSocket connection to DO: ${this.doName} (region: ${this.region}, colo: ${colo})`);

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    await this.handleSession(server, request);

    // Start peer discovery when first client connects
    if (this.sessions.size === 1 && !this.peerDiscoveryInterval) {
      await this.startPeerDiscovery();
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleDOBroadcast(request: Request): Promise<Response> {
    try {
      const data: DOBroadcastRequest = await request.json();
      const { event, sourceDoId, sourcePeers, hopCount = 0 } = data;

      // Prevent infinite loops
      if (hopCount > 3) {
        return new Response(JSON.stringify({ success: true, dropped: true }));
      }

      // Prevent duplicate processing
      if (this.processedEvents.has(event.id)) {
        return new Response(JSON.stringify({ success: true, duplicate: true }));
      }

      this.processedEvents.set(event.id, Date.now());

      // Update known peers from the source
      for (const peer of sourcePeers) {
        const [region, doId] = peer.split(':');
        if (doId && doId !== this.doId) {
          this.knownPeers.set(peer, {
            region,
            doId,
            lastSeen: Date.now()
          });
        }
      }

      console.log(`DO ${this.doName} received event ${event.id} from ${sourceDoId} (hop ${hopCount})`);

      // Broadcast to local sessions
      await this.broadcastToLocalSessions(event);

      // Gossip to other DOs with incremented hop count
      await this.gossipToOtherDOs(event, sourceDoId, hopCount + 1);

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

  private async handlePeerDiscovery(request: Request): Promise<Response> {
    // @ts-ignore
    const { doId, region } = await request.json();
    const peerId = `${region}:${doId}`;

    this.knownPeers.set(peerId, {
      region,
      doId,
      lastSeen: Date.now()
    });

    console.log(`DO ${this.doName} discovered peer: ${peerId}`);

    // Save peer list
    await this.state.storage.put('knownPeers', Array.from(this.knownPeers.entries()));

    return new Response(JSON.stringify({
      success: true,
      peers: Array.from(this.knownPeers.keys()).filter(p => p !== peerId)
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handlePeerExchange(request: Request): Promise<Response> {
    // @ts-ignore
    const { myPeers, myId } = await request.json();

    // Add the requesting peer
    if (myId) {
      const [region, doId] = myId.split(':');
      this.knownPeers.set(myId, {
        region,
        doId,
        lastSeen: Date.now()
      });
    }

    // Add their known peers
    for (const peer of myPeers) {
      const [region, doId] = peer.split(':');
      if (doId && doId !== this.doId && !this.knownPeers.has(peer)) {
        this.knownPeers.set(peer, {
          region,
          doId,
          lastSeen: Date.now() - 60000 // Mark as slightly old
        });
      }
    }

    console.log(`DO ${this.doName} exchanged peers, now has ${this.knownPeers.size} peers`);

    // Return our peers
    return new Response(JSON.stringify({
      success: true,
      peers: Array.from(this.knownPeers.keys()).slice(0, 50) // Limit response size
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async startPeerDiscovery(): Promise<void> {
    console.log(`DO ${this.doName} starting peer discovery`);

    // Initial discovery
    await this.discoverPeers();

    // Periodic discovery every 5 minutes
    this.peerDiscoveryInterval = setInterval(() => {
      this.discoverPeers().catch(console.error);
    }, 300000);
  }

  private async discoverPeers(): Promise<void> {
    // Store the current state to detect changes
    const previousPeers = new Map(this.knownPeers);

    // Use the predefined allowed endpoints
    const discoveryEndpoints = RelayWebSocket.ALLOWED_ENDPOINTS;

    const discoveryPromises = discoveryEndpoints
      .filter(endpoint => endpoint !== this.doName)
      .map(async (endpoint) => {
        try {
          const id = this.env.RELAY_WEBSOCKET.idFromName(endpoint);
          const stub = this.env.RELAY_WEBSOCKET.get(id);

          // Include the target DO name in the URL
          const url = new URL('https://internal/exchange-peers');
          url.searchParams.set('doName', endpoint);

          const response = await Promise.race([
            stub.fetch(new Request(url.toString(), {
              method: 'POST',
              body: JSON.stringify({
                myPeers: Array.from(this.knownPeers.keys()).slice(0, 20),
                myId: `${this.region}:${this.doId}`
              })
            })),
            new Promise<Response>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 2000)
            )
          ]);

          if (response.ok) {
            // @ts-ignore
            const { peers } = await response.json();
            for (const peer of peers || []) {
              const [region, doId] = peer.split(':');
              if (doId && doId !== this.doId) {
                this.knownPeers.set(peer, {
                  region,
                  doId,
                  lastSeen: Date.now()
                });
              }
            }
          }
        } catch (error) {
          // Ignore discovery failures
        }
      });

    await Promise.allSettled(discoveryPromises);

    // Clean up stale peers (not seen in 15 minutes)
    const staleThreshold = Date.now() - 900000; // 15 minutes
    const stalePeers: string[] = [];

    for (const [peerId, peerInfo] of this.knownPeers) {
      if (peerInfo.lastSeen < staleThreshold) {
        stalePeers.push(peerId);
        this.knownPeers.delete(peerId);
      }
    }

    if (stalePeers.length > 0) {
      console.log(`Removed ${stalePeers.length} stale peers: ${stalePeers.join(', ')}`);
    }

    // Check if peers actually changed
    let peersChanged = false;

    // Different size = definitely changed
    if (previousPeers.size !== this.knownPeers.size) {
      peersChanged = true;
    } else {
      // Same size - check if any peer data is different
      for (const [peerId, peerInfo] of this.knownPeers) {
        const previousPeer = previousPeers.get(peerId);
        if (!previousPeer ||
          previousPeer.region !== peerInfo.region ||
          previousPeer.doId !== peerInfo.doId) {
          peersChanged = true;
          break;
        }
      }
    }

    // Only write to storage if peers actually changed
    if (peersChanged) {
      console.log(`DO ${this.doName} peers changed from ${previousPeers.size} to ${this.knownPeers.size}, updating storage`);
      await this.state.storage.put('knownPeers', Array.from(this.knownPeers.entries()));
    }
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
    console.log(`New WebSocket session: ${sessionId} on DO ${this.doName} (Total: ${this.sessions.size})`);

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
      console.log(`WebSocket session closed: ${sessionId} on DO ${this.doName}`);
      this.handleClose(sessionId);
    });

    webSocket.addEventListener('error', (error) => {
      console.error(`WebSocket error for session ${sessionId} on DO ${this.doName}:`, error);
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

        // Mark as processed
        this.processedEvents.set(event.id, Date.now());

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

    // Store subscription
    session.subscriptions.set(subscriptionId, filters);
    console.log(`New subscription ${subscriptionId} for session ${session.id} on DO ${this.doName}`);

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
      console.log(`Closed subscription ${subscriptionId} for session ${session.id} on DO ${this.doName}`);
      this.sendClosed(session.webSocket, subscriptionId, 'Subscription closed');
    } else {
      this.sendClosed(session.webSocket, subscriptionId, 'Subscription not found');
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
      console.log(`Event ${event.id} broadcast to ${broadcastCount} local subscriptions on DO ${this.doName}`);
    }
  }

  private async broadcastToOtherDOs(event: NostrEvent): Promise<void> {
    const broadcasts: Promise<Response>[] = [];
    const processedPeers = new Set<string>();

    // Broadcast to ALL other DOs (53 others)
    for (const endpoint of RelayWebSocket.ALLOWED_ENDPOINTS) {
      if (endpoint === this.doName) continue;

      processedPeers.add(endpoint);
      broadcasts.push(this.sendToSpecificDO(endpoint, endpoint, event, 0));
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

  // Helper to get region from DO name (e.g., "relay-WNAM-3" -> "WNAM")
  private getRegionFromDoName(doName: string): string {
    const parts = doName.split('-');
    return parts.length >= 2 ? parts[1] : 'unknown';
  }

  private async sendToSpecificDO(region: string, doName: string, event: NostrEvent, hopCount: number): Promise<Response> {
    try {
      // Ensure we're only using allowed endpoints
      if (!RelayWebSocket.ALLOWED_ENDPOINTS.includes(doName)) {
        throw new Error(`Invalid DO name: ${doName}`);
      }

      const id = this.env.RELAY_WEBSOCKET.idFromName(doName);
      const stub = this.env.RELAY_WEBSOCKET.get(id);

      // Include the target DO name in the URL
      const url = new URL('https://internal/do-broadcast');
      url.searchParams.set('doName', doName);

      return await stub.fetch(new Request(url.toString(), {
        method: 'POST',
        body: JSON.stringify({
          event,
          sourceDoId: this.doId,
          sourcePeers: Array.from(this.knownPeers.keys()).slice(0, 20), // Limit peer list size
          hopCount
        } as DOBroadcastRequest)
      }));
    } catch (error) {
      console.error(`Failed to broadcast to ${doName}:`, error);
      throw error;
    }
  }

  private async gossipToOtherDOs(event: NostrEvent, sourceDoId: string, hopCount: number): Promise<void> {
    // Only gossip if hop count is low
    if (hopCount >= 3) return;

    // Select a subset of allowed endpoints for gossip (excluding ourselves and source)
    const eligibleEndpoints = RelayWebSocket.ALLOWED_ENDPOINTS
      .filter(endpoint => endpoint !== this.doName)
      .sort(() => Math.random() - 0.5) // Randomize order
      .slice(0, 3); // Gossip to max 3 peers

    const gossipPromises = eligibleEndpoints.map(endpoint =>
      this.sendToSpecificDO(this.getRegionFromDoName(endpoint), endpoint, event, hopCount)
        .catch(() => {/* Ignore gossip failures */ })
    );

    await Promise.allSettled(gossipPromises);
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
      console.log(`Cleaning up session ${sessionId} with ${session.subscriptions.size} subscriptions on DO ${this.doName}`);
    }
    this.sessions.delete(sessionId);

    // Stop peer discovery if no more sessions
    if (this.sessions.size === 0 && this.peerDiscoveryInterval) {
      clearInterval(this.peerDiscoveryInterval);
      this.peerDiscoveryInterval = undefined;
      console.log(`Stopped peer discovery on DO ${this.doName} (no active sessions)`);
    }
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
  async getStats(): Promise<{ sessions: number; subscriptions: number; peers: number }> {
    let totalSubscriptions = 0;
    for (const session of this.sessions.values()) {
      totalSubscriptions += session.subscriptions.size;
    }
    return {
      sessions: this.sessions.size,
      subscriptions: totalSubscriptions,
      peers: this.knownPeers.size
    };
  }
}