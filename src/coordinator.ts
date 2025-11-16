import { Env } from './types';

// Shard metadata tracked by coordinator
export interface ShardMetrics {
    shardId: string;
    region: string;
    connectionCount: number;
    messagesPerSecond: number;
    lastHeartbeat: number;
    status: 'active' | 'draining' | 'inactive';
}

// Auto-scaling configuration
export interface AutoScaleConfig {
    // Connection thresholds per shard
    minConnectionsPerShard: number;
    maxConnectionsPerShard: number;
    targetConnectionsPerShard: number;

    // Scaling behavior
    scaleUpThreshold: number;
    scaleDownThreshold: number;
    minShardsPerRegion: number;
    maxShardsPerRegion: number;

    // Cooldown periods (ms)
    scaleUpCooldown: number;
    scaleDownCooldown: number;

    // Health check
    heartbeatTimeout: number;
}

// Default configuration
const DEFAULT_CONFIG: AutoScaleConfig = {
    minConnectionsPerShard: 1000,
    maxConnectionsPerShard: 9000,
    targetConnectionsPerShard: 8000,

    scaleUpThreshold: 0.8,
    scaleDownThreshold: 0.2,
    minShardsPerRegion: 1,
    maxShardsPerRegion: Infinity,

    scaleUpCooldown: 60000,
    scaleDownCooldown: 300000,
    heartbeatTimeout: 120000
};

// Region definitions
const REGIONS = ['WNAM', 'ENAM', 'WEUR', 'EEUR', 'APAC', 'OC', 'SAM', 'AFR', 'ME'];

// Location hints for each region
const REGION_HINTS: Record<string, string> = {
    'WNAM': 'wnam',
    'ENAM': 'enam',
    'WEUR': 'weur',
    'EEUR': 'eeur',
    'APAC': 'apac',
    'OC': 'oc',
    'SAM': 'enam',  // SAM redirects to ENAM
    'AFR': 'weur',  // AFR redirects to WEUR
    'ME': 'eeur'    // ME redirects to EEUR
};

export class CoordinatorDO implements DurableObject {
    private state: DurableObjectState;
    private env: Env;
    private config: AutoScaleConfig;

    // In-memory cache of shard metrics
    private shardMetrics: Map<string, ShardMetrics> = new Map();

    // Last scaling action timestamp per region
    private lastScaleUp: Map<string, number> = new Map();
    private lastScaleDown: Map<string, number> = new Map();

    // Response cache (reduces load during traffic bursts)
    private responseCache: Map<string, { data: any; timestamp: number }> = new Map();
    private readonly RESPONSE_CACHE_TTL = 30000; // 30 seconds

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;
        this.config = DEFAULT_CONFIG;

        // Set up periodic cleanup and health checks every 30 seconds
        this.state.blockConcurrencyWhile(async () => {
            await this.loadState();
        });

        // Schedule periodic health checks
        this.scheduleHealthCheck();
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        try {
            switch (path) {
                case '/heartbeat':
                    return await this.handleHeartbeat(request);

                case '/get-shard':
                    return await this.handleGetShard(request);

                case '/list-shards':
                    return await this.handleListShards(request);

                case '/get-all-shards':
                    return await this.handleGetAllShards();

                case '/metrics':
                    return await this.handleMetrics();

                case '/config':
                    return await this.handleConfig(request);

                case '/health':
                    return new Response(JSON.stringify({ status: 'healthy' }), {
                        headers: { 'Content-Type': 'application/json' }
                    });

                default:
                    return new Response('Not Found', { status: 404 });
            }
        } catch (error: any) {
            console.error('Coordinator error:', error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // Handle heartbeat from relay shards
    private async handleHeartbeat(request: Request): Promise<Response> {
        const data = await request.json() as {
            shardId: string;
            region: string;
            connectionCount: number;
            messagesPerSecond: number;
        };

        const metrics: ShardMetrics = {
            ...data,
            lastHeartbeat: Date.now(),
            status: 'active'
        };

        // Update in-memory cache
        this.shardMetrics.set(data.shardId, metrics);

        // Persist to storage (batched writes via DO storage)
        await this.state.storage.put(`shard:${data.shardId}`, metrics);

        // Check if auto-scaling is needed
        await this.evaluateAutoScaling(data.region);

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Get optimal shard for a region
    private async handleGetShard(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const region = url.searchParams.get('region');
        const strategy = url.searchParams.get('strategy') || 'least-connections';
        const sessionHash = url.searchParams.get('sessionHash'); // For consistent hashing

        if (!region || !REGIONS.includes(region)) {
            return new Response(JSON.stringify({ error: 'Invalid region' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const shard = await this.selectShard(region, strategy, sessionHash);

        return new Response(JSON.stringify(shard), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // List all active shards in a region (with caching)
    private async handleListShards(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const region = url.searchParams.get('region');

        if (!region) {
            return new Response(JSON.stringify({ error: 'Missing region' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check response cache
        const cacheKey = `list-shards:${region}`;
        const cached = this.responseCache.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < this.RESPONSE_CACHE_TTL) {
            return new Response(JSON.stringify(cached.data), {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Cache': 'HIT'
                }
            });
        }

        // Cache miss - generate response
        const shards = await this.getRegionShards(region);
        const data = { shards };

        // Cache the response
        this.responseCache.set(cacheKey, { data, timestamp: now });

        return new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'X-Cache': 'MISS'
            }
        });
    }

    // Get all active shards across all regions (for broadcasting) - with caching
    private async handleGetAllShards(): Promise<Response> {
        // Check response cache
        const cacheKey = 'get-all-shards';
        const cached = this.responseCache.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < this.RESPONSE_CACHE_TTL) {
            return new Response(JSON.stringify(cached.data), {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Cache': 'HIT'
                }
            });
        }

        // Cache miss - generate response
        const allShards: string[] = [];

        for (const region of REGIONS) {
            const shards = await this.getRegionShards(region);
            allShards.push(...shards.map(s => s.shardId));
        }

        const data = { shards: allShards };

        // Cache the response
        this.responseCache.set(cacheKey, { data, timestamp: now });

        return new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'X-Cache': 'MISS'
            }
        });
    }

    // Get coordinator metrics
    private async handleMetrics(): Promise<Response> {
        const metrics = {
            totalShards: this.shardMetrics.size,
            totalConnections: Array.from(this.shardMetrics.values())
                .reduce((sum, m) => sum + m.connectionCount, 0),
            byRegion: {} as Record<string, any>
        };

        for (const region of REGIONS) {
            const shards = await this.getRegionShards(region);
            metrics.byRegion[region] = {
                shardCount: shards.length,
                totalConnections: shards.reduce((sum, s) => sum + s.connectionCount, 0),
                avgConnectionsPerShard: shards.length > 0
                    ? Math.round(shards.reduce((sum, s) => sum + s.connectionCount, 0) / shards.length)
                    : 0
            };
        }

        return new Response(JSON.stringify(metrics), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Update configuration
    private async handleConfig(request: Request): Promise<Response> {
        if (request.method === 'GET') {
            return new Response(JSON.stringify(this.config), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (request.method === 'POST') {
            const newConfig = await request.json() as Partial<AutoScaleConfig>;
            this.config = { ...this.config, ...newConfig };
            await this.state.storage.put('config', this.config);

            return new Response(JSON.stringify(this.config), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Method not allowed', { status: 405 });
    }

    // Select optimal shard for a region
    private async selectShard(
        region: string,
        strategy: string,
        sessionHash?: string | null
    ): Promise<{ shardId: string; locationHint: string }> {
        const shards = await this.getRegionShards(region);

        // If no active shards, create the first one
        if (shards.length === 0) {
            const shardId = `relay-${region}-0`;
            await this.initializeShard(shardId, region);
            return { shardId, locationHint: REGION_HINTS[region] || 'auto' };
        }

        let selectedShard: ShardMetrics;

        switch (strategy) {
            case 'consistent-hash':
                // Use consistent hashing for sticky sessions
                if (sessionHash) {
                    const hash = this.hashString(sessionHash);
                    const index = hash % shards.length;
                    selectedShard = shards[index];
                } else {
                    // Fallback to least-connections
                    selectedShard = shards.reduce((min, s) =>
                        s.connectionCount < min.connectionCount ? s : min
                    );
                }
                break;

            case 'round-robin':
                // Simple round-robin (use timestamp-based selection)
                const rrIndex = Date.now() % shards.length;
                selectedShard = shards[rrIndex];
                break;

            case 'least-connections':
            default:
                // Route to shard with least connections
                selectedShard = shards.reduce((min, s) =>
                    s.connectionCount < min.connectionCount ? s : min
                );
                break;
        }

        return {
            shardId: selectedShard.shardId,
            locationHint: REGION_HINTS[region] || 'auto'
        };
    }

    // Get all active shards for a region
    private async getRegionShards(region: string): Promise<ShardMetrics[]> {
        const now = Date.now();
        const activeShards: ShardMetrics[] = [];

        // Check in-memory cache first
        for (const [shardId, metrics] of this.shardMetrics.entries()) {
            if (metrics.region === region &&
                metrics.status === 'active' &&
                now - metrics.lastHeartbeat < this.config.heartbeatTimeout) {
                activeShards.push(metrics);
            }
        }

        return activeShards.sort((a, b) => a.shardId.localeCompare(b.shardId));
    }

    // Evaluate if auto-scaling is needed for a region
    private async evaluateAutoScaling(region: string): Promise<void> {
        const shards = await this.getRegionShards(region);

        if (shards.length === 0) {
            // Initialize first shard
            await this.scaleUp(region);
            return;
        }

        const totalConnections = shards.reduce((sum, s) => sum + s.connectionCount, 0);
        const avgConnectionsPerShard = totalConnections / shards.length;
        const maxConnections = Math.max(...shards.map(s => s.connectionCount));

        // Check for scale-up condition (scale proactively before hitting target)
        const scaleUpNeeded =
            maxConnections >= this.config.targetConnectionsPerShard * this.config.scaleUpThreshold &&
            shards.length < this.config.maxShardsPerRegion;

        // Check for scale-down condition
        const scaleDownNeeded =
            avgConnectionsPerShard <= this.config.minConnectionsPerShard * this.config.scaleDownThreshold &&
            shards.length > this.config.minShardsPerRegion;

        const now = Date.now();

        if (scaleUpNeeded) {
            const lastScaleUp = this.lastScaleUp.get(region) || 0;
            if (now - lastScaleUp > this.config.scaleUpCooldown) {
                console.log(`Auto-scaling UP region ${region}: ${shards.length} → ${shards.length + 1} shards (max connections: ${maxConnections})`);
                await this.scaleUp(region);
                this.lastScaleUp.set(region, now);
            }
        } else if (scaleDownNeeded) {
            const lastScaleDown = this.lastScaleDown.get(region) || 0;
            if (now - lastScaleDown > this.config.scaleDownCooldown) {
                console.log(`Auto-scaling DOWN region ${region}: ${shards.length} → ${shards.length - 1} shards (avg connections: ${avgConnectionsPerShard})`);
                await this.scaleDown(region);
                this.lastScaleDown.set(region, now);
            }
        }
    }

    // Scale up: add new shard to region
    private async scaleUp(region: string): Promise<void> {
        const shards = await this.getRegionShards(region);
        const nextIndex = shards.length;

        const newShardId = `relay-${region}-${nextIndex}`;
        await this.initializeShard(newShardId, region);

        console.log(`Scaled up ${region}: created shard ${newShardId} (total shards: ${nextIndex + 1})`);
    }

    // Scale down: remove least-loaded shard from region
    private async scaleDown(region: string): Promise<void> {
        const shards = await this.getRegionShards(region);

        if (shards.length <= this.config.minShardsPerRegion) {
            console.warn(`Cannot scale down ${region}: already at min shards (${this.config.minShardsPerRegion})`);
            return;
        }

        // Find shard with least connections
        const shardToRemove = shards.reduce((min, s) =>
            s.connectionCount < min.connectionCount ? s : min
        );

        // Mark as draining (new connections won't route here)
        shardToRemove.status = 'draining';
        this.shardMetrics.set(shardToRemove.shardId, shardToRemove);
        await this.state.storage.put(`shard:${shardToRemove.shardId}`, shardToRemove);

        console.log(`Scaled down ${region}: draining shard ${shardToRemove.shardId} (${shardToRemove.connectionCount} connections)`);
    }

    // Initialize a new shard (create metadata)
    private async initializeShard(shardId: string, region: string): Promise<void> {
        const metrics: ShardMetrics = {
            shardId,
            region,
            connectionCount: 0,
            messagesPerSecond: 0,
            lastHeartbeat: Date.now(),
            status: 'active'
        };

        this.shardMetrics.set(shardId, metrics);
        await this.state.storage.put(`shard:${shardId}`, metrics);
    }

    // Load state from storage on initialization
    private async loadState(): Promise<void> {
        // Load config
        const savedConfig = await this.state.storage.get<AutoScaleConfig>('config');
        if (savedConfig) {
            this.config = savedConfig;
        }

        // Load all shard metrics
        const shardKeys = await this.state.storage.list({ prefix: 'shard:' });
        for (const [key, value] of shardKeys.entries()) {
            const metrics = value as ShardMetrics;
            this.shardMetrics.set(metrics.shardId, metrics);
        }

        console.log(`Coordinator loaded: ${this.shardMetrics.size} shards`);
    }

    // Schedule periodic health checks using DO alarms
    private scheduleHealthCheck(): void {
        const checkInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Every 30 seconds
    }

    // Remove dead shards
    private async performHealthCheck(): Promise<void> {
        const now = Date.now();
        const deadShards: string[] = [];

        for (const [shardId, metrics] of this.shardMetrics.entries()) {
            if (now - metrics.lastHeartbeat > this.config.heartbeatTimeout) {
                deadShards.push(shardId);
            }
        }

        if (deadShards.length > 0) {
            console.log(`Health check: removing ${deadShards.length} dead shards`);

            for (const shardId of deadShards) {
                this.shardMetrics.delete(shardId);
                await this.state.storage.delete(`shard:${shardId}`);
            }
        }
    }

    // Simple string hash function for consistent hashing
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
}