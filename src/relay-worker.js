//     _   _  ___  ____  _____ _        _    ____  _____ 
//    | \ | |/ _ \/ ___||  ___| |      / \  |  _ \| ____|
//    |  \| | | | \___ \| |_  | |     / _ \ | |_) |  _|  
//    | |\  | |_| |___) |  _| | |___ / ___ \|  _ <| |___ 
//    |_| \_|\___/|____/|_|   |_____/_/   \_\_| \_\_____|
//    ═══════════════════(v6.0.4)═══════════════════════

import { schnorr } from "@noble/curves/secp256k1";

// ***************************** //
// ** BEGIN EDITABLE SETTINGS ** //
// ***************************** //

// Settings below can be configured to your preferences

// Pay to relay
const relayNpub = "npub16jdfqgazrkapk0yrqm9rdxlnys7ck39c7zmdzxtxqlmmpxg04r0sd733sv"; // Use your npub
const PAY_TO_RELAY_ENABLED = true; // Set to false to disable pay to relay
const RELAY_ACCESS_PRICE_SATS = 2121; // Price in SATS for relay access

// Relay info
const relayInfo = {
    name: "Nosflare",
    description: "A serverless Nostr relay through Cloudflare Worker and D1 database",
    pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
    contact: "lux@fed.wtf",
    supported_nips: [1, 2, 4, 5, 9, 11, 12, 15, 16, 17, 20, 22, 33, 40],
    software: "https://github.com/Spl0itable/nosflare",
    version: "6.0.4",
    icon: "https://raw.githubusercontent.com/Spl0itable/nosflare/main/images/flare.png",

    // Optional fields (uncomment as needed):
    // banner: "https://example.com/banner.jpg",
    // privacy_policy: "https://example.com/privacy-policy.html",
    // terms_of_service: "https://example.com/terms.html",

    // Relay limitations
    limitation: {
        // max_message_length: 524288, // 512KB
        // max_subscriptions: 300,
        // max_limit: 10000,
        // max_subid_length: 256,
        // max_event_tags: 2000,
        // max_content_length: 70000,
        // min_pow_difficulty: 0,
        // auth_required: false,
        payment_required: PAY_TO_RELAY_ENABLED,
        restricted_writes: PAY_TO_RELAY_ENABLED,
        // created_at_lower_limit: 0,
        // created_at_upper_limit: 2147483647,
        // default_limit: 10000
    },

    // Event retention policies (uncomment and configure as needed):
    // retention: [
    //     { kinds: [0, 1, [5, 7], [40, 49]], time: 3600 },
    //     { kinds: [[40000, 49999]], time: 100 },
    //     { kinds: [[30000, 39999]], count: 1000 },
    //     { time: 3600, count: 10000 }
    // ],

    // Content limitations by country (uncomment as needed):
    // relay_countries: ["*"], // Use ["US", "CA", "EU"] for specific countries, ["*"] for global

    // Community preferences (uncomment as needed):
    // language_tags: ["en", "en-419"], // IETF language tags, use ["*"] for all languages
    // tags: ["sfw-only", "bitcoin-only", "anime"], // Community/content tags
    // posting_policy: "https://example.com/posting-policy.html",

    // Payment configuration (added dynamically in handleRelayInfoRequest if PAY_TO_RELAY_ENABLED):
    // payments_url: "https://my-relay/payments",
    // fees: {
    //     admission: [{ amount: 1000000, unit: "msats" }],
    //     subscription: [{ amount: 5000000, unit: "msats", period: 2592000 }],
    //     publication: [{ kinds: [4], amount: 100, unit: "msats" }],
    // }
};

// Nostr address NIP-05 verified users (for verified checkmark like username@your-relay.com)
const nip05Users = {
    "Luxas": "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
    // ... more NIP-05 verified users
};

// Anti-spam settings
const enableAntiSpam = false; // Set to true to enable hashing and duplicate content checking
const enableGlobalDuplicateCheck = false; // When anti-spam is enabled, set to true for global hash (across all pubkeys and not individually)

// Kinds subjected to duplicate checks (only when anti-spam is enabled)
const antiSpamKinds = new Set([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 40, 41, 42, 43, 44, 64, 818, 1021, 1022, 1040, 1059, 1063, 1311, 1617, 1621, 1622, 1630, 1633, 1971, 1984, 1985, 1986, 1987, 2003, 2004, 2022, 4550, 5000, 5999, 6000, 6999, 7000, 9000, 9030, 9041, 9467, 9734, 9735, 9802, 10000, 10001, 10002, 10003, 10004, 10005, 10006, 10007, 10009, 10015, 10030, 10050, 10063, 10096, 13194, 21000, 22242, 23194, 23195, 24133, 24242, 27235, 30000, 30001, 30002, 30003, 30004, 30005, 30007, 30008, 30009, 30015, 30017, 30018, 30019, 30020, 30023, 30024, 30030, 30040, 30041, 30063, 30078, 30311, 30315, 30402, 30403, 30617, 30618, 30818, 30819, 31890, 31922, 31923, 31924, 31925, 31989, 31990, 34235, 34236, 34237, 34550, 39000, 39001, 39002, 39003, 39004, 39005, 39006, 39007, 39008, 39009
    // Add other kinds you want to check for duplicates
]);

// Blocked pubkeys
// Add pubkeys in hex format to block write access
const blockedPubkeys = new Set([
    "3c7f5948b5d80900046a67d8e3bf4971d6cba013abece1dd542eca223cf3dd3f",
    "fed5c0c3c8fe8f51629a0b39951acdf040fd40f53a327ae79ee69991176ba058",
    "e810fafa1e89cdf80cced8e013938e87e21b699b24c8570537be92aec4b12c18",
    "05aee96dd41429a3ae97a9dac4dfc6867fdfacebca3f3bdc051e5004b0751f01",
    "53a756bb596055219d93e888f71d936ec6c47d960320476c955efd8941af4362"
]);

// Allowed pubkeys
// Add pubkeys in hex format to allow write access
const allowedPubkeys = new Set([
    // ... pubkeys that are explicitly allowed
]);

// Blocked event kinds
// Add comma-separated kinds Ex: 1064, 4, 22242
const blockedEventKinds = new Set([
    1064
]);

// Allowed event kinds
// Add comma-separated kinds Ex: 1, 2, 3
const allowedEventKinds = new Set([
    // ... kinds that are explicitly allowed
]);

// Blocked words or phrases (case-insensitive)
const blockedContent = new Set([
    "~~ hello world! ~~"
    // ... more blocked content
]);

// NIP-05 validation
const checkValidNip05 = false; // Set to true to enable NIP-05 validation (this requires users to have a valid NIP-05 in order to publish events to the relay as part of anti-spam)

// Blocked NIP-05 domains
// This prevents users with NIP-05's from specified domains from publishing events to the relay
const blockedNip05Domains = new Set([
    // Add domains that are explicitly blocked
    // "primal.net"
]);

// Allowed NIP-05 domains
const allowedNip05Domains = new Set([
    // Add domains that are explicitly allowed
    // Leave empty to allow all domains (unless blocked)
]);

// Blocked tags
// Add comma-separated tags Ex: t, e, p
const blockedTags = new Set([
    // ... tags that are explicitly blocked
]);

// Allowed tags
// Add comma-separated tags Ex: p, e, t
const allowedTags = new Set([
    // "p", "e", "t"
    // ... tags that are explicitly allowed
]);

// Rate limit thresholds
const PUBKEY_RATE_LIMIT = { rate: 100 / 60000, capacity: 100 }; // 100 EVENT messages per min
const REQ_RATE_LIMIT = { rate: 10000 / 60000, capacity: 10000 }; // 10,000 REQ messages per min
const excludedRateLimitKinds = new Set([
    // ... kinds to exclude from EVENT rate limiting Ex: 1, 2, 3
]);

// *************************** //
// ** END EDITABLE SETTINGS ** //
// *************************** //

// Database initialization function
async function initializeDatabase(db) {
    try {
        // Use session with read replica for checking initialization status
        const session = db.withSession('first-unconstrained');

        // Always check the database directly
        const initCheck = await session.prepare(
            "SELECT value FROM system_config WHERE key = 'db_initialized' LIMIT 1"
        ).first().catch(() => null); // Catch error if table doesn't exist

        if (initCheck && initCheck.value === '1') {
            console.log("Database already initialized, skipping schema creation");
            return;
        }
    } catch (error) {
        console.log("Database not initialized or error checking status:", error.message);
        // Continue with initialization
    }

    // Use primary for writes during initialization
    const session = db.withSession('first-primary');

    try {
        console.log("Initializing D1 database schema...");

        // Create system config table first
        await session.prepare(`
            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `).run();

        const statements = [
            // Main events table
            `CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                pubkey TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                kind INTEGER NOT NULL,
                tags TEXT NOT NULL,
                content TEXT NOT NULL,
                sig TEXT NOT NULL,
                deleted INTEGER DEFAULT 0,
                created_timestamp INTEGER DEFAULT (strftime('%s', 'now'))
            )`,

            // Indexes for events table
            `CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey)`,
            `CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind)`,
            `CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_events_pubkey_kind ON events(pubkey, kind)`,
            `CREATE INDEX IF NOT EXISTS idx_events_deleted ON events(deleted)`,
            `CREATE INDEX IF NOT EXISTS idx_events_kind_created_at ON events(kind, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_events_deleted_kind ON events(deleted, kind)`,

            // Tags table for efficient tag queries
            `CREATE TABLE IF NOT EXISTS tags (
                event_id TEXT NOT NULL,
                tag_name TEXT NOT NULL,
                tag_value TEXT NOT NULL,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            )`,

            // Indexes for tags table
            `CREATE INDEX IF NOT EXISTS idx_tags_name_value ON tags(tag_name, tag_value)`,
            `CREATE INDEX IF NOT EXISTS idx_tags_event_id ON tags(event_id)`,

            // Table for paid pubkeys
            `CREATE TABLE IF NOT EXISTS paid_pubkeys (
                pubkey TEXT PRIMARY KEY,
                paid_at INTEGER NOT NULL,
                amount_sats INTEGER,
                created_timestamp INTEGER DEFAULT (strftime('%s', 'now'))
            )`,

            // Table for content hashes (anti-spam)
            `CREATE TABLE IF NOT EXISTS content_hashes (
                hash TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                pubkey TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            )`,

            // Index for content hashes
            `CREATE INDEX IF NOT EXISTS idx_content_hashes_pubkey ON content_hashes(pubkey)`
        ];

        // Execute each statement
        for (const statement of statements) {
            try {
                await session.prepare(statement).run();
                console.log(`Executed: ${statement.substring(0, 50)}...`);
            } catch (error) {
                console.error(`Error executing statement: ${error.message}`);
                console.error(`Statement: ${statement}`);
                throw error;
            }
        }

        // Enable foreign keys
        await session.prepare("PRAGMA foreign_keys = ON").run();

        // Mark database as initialized
        await session.prepare(
            "INSERT OR REPLACE INTO system_config (key, value) VALUES ('db_initialized', '1')"
        ).run();

        // Store schema version for future migrations
        await session.prepare(
            "INSERT OR REPLACE INTO system_config (key, value) VALUES ('schema_version', '1')"
        ).run();

        console.log("Database initialization completed successfully!");

    } catch (error) {
        console.error("Failed to initialize database:", error);
        throw error;
    }
}

// Handle in-memory caching
const relayCache = {
    _cache: {},

    get(key) {
        try {
            const item = this._cache[key];
            if (item && item.expires > Date.now()) {
                return item.value;
            }
            delete this._cache[key];
        } catch (e) {
            console.error("Error in cache get:", e);
        }
        return null;
    },

    set(key, value, ttl = 60000) {
        try {
            this._cache[key] = {
                value,
                expires: Date.now() + ttl,
            };
        } catch (e) {
            console.error("Error in cache set:", e);
        }
    },

    delete(key) {
        try {
            delete this._cache[key];
        } catch (e) {
            console.error("Error in cache delete:", e);
        }
    }
};

// Rate limit messages
class rateLimiter {
    constructor(rate, capacity) {
        this.tokens = capacity;
        this.lastRefillTime = Date.now();
        this.capacity = capacity;
        this.fillRate = rate; // tokens per millisecond
    }
    removeToken() {
        this.refill();
        if (this.tokens < 1) {
            return false; // no tokens available, rate limit exceeded
        }
        this.tokens -= 1;
        return true;
    }
    refill() {
        const now = Date.now();
        const elapsedTime = now - this.lastRefillTime;
        const tokensToAdd = Math.floor(elapsedTime * this.fillRate);
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefillTime = now;
    }
}

// Check if anti-spam should be applied to this event kind
function shouldCheckForDuplicates(kind) {
    return enableAntiSpam && antiSpamKinds.has(kind);
}

// Helper function to serve relay info
function handleRelayInfoRequest(request) {
    const responseInfo = { ...relayInfo };

    // Add payment information if pay-to-relay is enabled
    if (PAY_TO_RELAY_ENABLED) {
        const url = new URL(request.url);
        const paymentUrl = `${url.protocol}//${url.host}`;

        responseInfo.payments_url = paymentUrl;
        responseInfo.fees = {
            admission: [{
                amount: RELAY_ACCESS_PRICE_SATS * 1000, // Convert SATS to millisats
                unit: "msats"
            }],
            // Additional fee structures (uncomment as needed):
            // subscription: [{
            //     amount: 5000000,
            //     unit: "msats",
            //     period: 2592000 // 30 days in seconds
            // }],
            // publication: [{
            //     kinds: [4], // DM kind
            //     amount: 100,
            //     unit: "msats"
            // }]
        };
    }

    const headers = new Headers({
        "Content-Type": "application/nostr+json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
        "Access-Control-Allow-Methods": "GET",
    });

    return new Response(JSON.stringify(responseInfo), { status: 200, headers: headers });
}

// Helper function to serve relay icon
async function serveFavicon() {
    const response = await fetch(relayInfo.icon);
    if (response.ok) {
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "max-age=3600");
        return new Response(response.body, {
            status: response.status,
            headers: headers,
        });
    }
    return new Response(null, { status: 404 });
}

// Helper function to handle serving NIP-05
function handleNIP05Request(url) {
    const name = url.searchParams.get("name");
    if (!name) {
        return new Response(JSON.stringify({ error: "Missing 'name' parameter" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
    const pubkey = nip05Users[name.toLowerCase()];
    if (!pubkey) {
        return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }
    const response = {
        names: {
            [name]: pubkey,
        },
        relays: {
            [pubkey]: [
                // ... add relays for NIP-05 users
            ],
        },
    };
    return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    });
}

// Helper function for allowed pubkeys
function isPubkeyAllowed(pubkey) {
    if (allowedPubkeys.size > 0 && !allowedPubkeys.has(pubkey)) {
        return false;
    }
    return !blockedPubkeys.has(pubkey);
}

// Helper function for allowed kinds
function isEventKindAllowed(kind) {
    if (allowedEventKinds.size > 0 && !allowedEventKinds.has(kind)) {
        return false;
    }
    return !blockedEventKinds.has(kind);
}

// Helper function for blocked content
function containsBlockedContent(event) {
    const lowercaseContent = (event.content || "").toLowerCase();
    const lowercaseTags = event.tags.map(tag => tag.join("").toLowerCase());

    for (const blocked of blockedContent) {
        const blockedLower = blocked.toLowerCase(); // Checks case-insensitively
        if (
            lowercaseContent.includes(blockedLower) ||
            lowercaseTags.some(tag => tag.includes(blockedLower))
        ) {
            return true;
        }
    }
    return false;
}

// Helper function for allowed tags
function isTagAllowed(tag) {
    if (allowedTags.size > 0 && !allowedTags.has(tag)) {
        return false;
    }
    return !blockedTags.has(tag);
}

// Handle websocket messages
function handleWebSocketUpgrade(request, env) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();

    server.host = request.headers.get('host');

    // Create rate limiters for this connection instance
    server.pubkeyRateLimiter = new rateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity);
    server.reqRateLimiter = new rateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity);

    // Set up idle timeout
    let idleTimeout;
    const IDLE_TIMEOUT_MS = 30000; // 30 seconds of inactivity

    const resetIdleTimeout = () => {
        if (idleTimeout) clearTimeout(idleTimeout);
        idleTimeout = setTimeout(() => {
            console.log("Closing WebSocket due to inactivity");
            if (server.readyState === WebSocket.OPEN) {
                server.close(1000, "Idle timeout");
            }
        }, IDLE_TIMEOUT_MS);
    };

    // Start the idle timer
    resetIdleTimeout();

    server.addEventListener("message", async (messageEvent) => {
        // Reset idle timeout on any message
        resetIdleTimeout();

        try {
            let messageData;

            if (messageEvent.data instanceof ArrayBuffer) {
                const textDecoder = new TextDecoder("utf-8");
                const decodedText = textDecoder.decode(messageEvent.data);
                messageData = JSON.parse(decodedText);
            } else {
                messageData = JSON.parse(messageEvent.data);
            }

            if (!Array.isArray(messageData)) {
                sendError(server, "Invalid message format: expected JSON array");
                return;
            }

            const messageType = messageData[0];
            switch (messageType) {
                case "EVENT":
                    await processEvent(messageData[1], server, env);
                    break;
                case "REQ":
                    await processReq(messageData, server, env);
                    break;
                case "CLOSE":
                    const subscriptionId = messageData[1];
                    server.send(JSON.stringify(["CLOSED", subscriptionId, "Subscription closed"]));
                    break;
                default:
                    sendError(server, `Unknown message type: ${messageType}`);
            }
        } catch (e) {
            console.error("Failed to process message:", e);
            sendError(server, "Failed to process the message");
        }
    });

    // Clean up on close
    server.addEventListener("close", () => {
        if (idleTimeout) clearTimeout(idleTimeout);
    });

    return new Response(null, {
        status: 101,
        webSocket: client,
    });
}

// Handle serving landing page for HTTP requests
function serveLandingPage() {
    const payToRelaySection = PAY_TO_RELAY_ENABLED ? `
        <div class="pay-section" id="paySection">
            <p style="margin-bottom: 1rem;">Pay to access this relay:</p>
            <button id="payButton" class="pay-button" data-npub="${relayNpub}" data-relays="wss://relay.damus.io,wss://relay.primal.net,wss://sendit.nosflare.com" data-sats-amount="${RELAY_ACCESS_PRICE_SATS}">
                <img src="https://raw.githubusercontent.com/Spl0itable/nosflare/main/images/pwb-button-min.png" alt="Pay with Bitcoin" style="height: 60px;">
            </button>
            <p class="price-info">${RELAY_ACCESS_PRICE_SATS.toLocaleString()} sats</p>
        </div>
        <div class="info-box" id="accessSection" style="display: none;">
            <p style="margin-bottom: 1rem;">Connect your Nostr client to:</p>
            <div class="url-display" onclick="copyToClipboard()" id="relay-url">
                <!-- URL will be inserted by JavaScript -->
            </div>
            <p class="copy-hint">Click to copy</p>
        </div>
    ` : `
        <div class="info-box">
            <p style="margin-bottom: 1rem;">Connect your Nostr client to:</p>
            <div class="url-display" onclick="copyToClipboard()" id="relay-url">
                <!-- URL will be inserted by JavaScript -->
            </div>
            <p class="copy-hint">Click to copy</p>
        </div>
    `;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="A serverless Nostr relay through Cloudflare Worker and D1 database" />
    <title>Nosflare - Nostr Relay</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #0a0a0a;
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        }
        
        /* Animated background */
        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at 20% 50%, rgba(255, 69, 0, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 80% 50%, rgba(255, 140, 0, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 50% 100%, rgba(255, 0, 0, 0.05) 0%, transparent 50%);
            animation: pulse 10s ease-in-out infinite;
            z-index: -1;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }
        
        .container {
            text-align: center;
            padding: 2rem;
            max-width: 600px;
            z-index: 1;
        }
        
        .logo-container {
            display: inline-block;
        }

        .logo {
            width: 400px;
            height: auto;
            filter: drop-shadow(0 0 30px rgba(255, 69, 0, 0.5));
        }
        
        .tagline {
            font-size: 1.2rem;
            color: #999;
            margin-bottom: 3rem;
        }
        
        .info-box {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
        }
        
        .pay-section {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
        }
        
        .pay-button {
            background: none;
            border: none;
            cursor: pointer;
            padding: 0;
            margin: 1rem 0;
            transition: transform 0.3s ease;
        }
        
        .pay-button:hover {
            transform: scale(1.05);
        }
        
        .price-info {
            font-size: 1.2rem;
            color: #ff8c00;
            font-weight: 600;
        }
        
        .url-display {
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 69, 0, 0.3);
            border-radius: 8px;
            padding: 1rem;
            font-family: 'Courier New', monospace;
            font-size: 1.1rem;
            color: #ff8c00;
            margin: 1rem 0;
            word-break: break-all;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .url-display:hover {
            border-color: #ff4500;
            background: rgba(255, 69, 0, 0.1);
        }
        
        .copy-hint {
            font-size: 0.9rem;
            color: #666;
            margin-top: 0.5rem;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-top: 2rem;
        }
        
        .stat-item {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 1rem;
        }
        
        .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #ff4500;
        }
        
        .stat-label {
            font-size: 0.9rem;
            color: #999;
            margin-top: 0.25rem;
        }
        
        .links {
            margin-top: 3rem;
            display: flex;
            gap: 2rem;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .link {
            color: #ff8c00;
            text-decoration: none;
            font-size: 1rem;
            transition: color 0.3s ease;
        }
        
        .link:hover {
            color: #ff4500;
        }
        
        .toast {
            position: fixed;
            bottom: 2rem;
            background: #ff4500;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            transform: translateY(100px);
            transition: transform 0.3s ease;
            z-index: 1000;
        }
        
        .toast.show {
            transform: translateY(0);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo-container">
            <img src="https://raw.githubusercontent.com/Spl0itable/nosflare/main/images/nosflare.png" alt="Nosflare Logo" class="logo">
        </div>
    
        <p class="tagline">A serverless Nostr relay powered by Cloudflare</p>
        
        ${payToRelaySection}
        
        <div class="stats">
            <div class="stat-item">
                <div class="stat-value">${relayInfo.supported_nips.length}</div>
                <div class="stat-label">Supported NIPs</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${relayInfo.version}</div>
                <div class="stat-label">Version</div>
            </div>
        </div>
        
        <div class="links">
            <a href="https://github.com/Spl0itable/nosflare" class="link" target="_blank">GitHub</a>
            <a href="https://nostr.info" class="link" target="_blank">Learn about Nostr</a>
        </div>
    </div>
    
    <div class="toast" id="toast">Copied to clipboard!</div>
    
    <script src="https://unpkg.com/nostr-tools/lib/nostr.bundle.js"></script>
    <script>
        // Set the relay URL dynamically
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const relayUrl = protocol + '//' + window.location.host;
        
        // Set relay URL in the display element
        const relayUrlElement = document.getElementById('relay-url');
        if (relayUrlElement) {
            relayUrlElement.textContent = relayUrl;
        }
        
        function copyToClipboard() {
            const relayUrl = document.getElementById('relay-url').textContent;
            navigator.clipboard.writeText(relayUrl).then(() => {
                const toast = document.getElementById('toast');
                toast.classList.add('show');
                setTimeout(() => {
                    toast.classList.remove('show');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        }
        
        ${PAY_TO_RELAY_ENABLED ? `
        // Pay to relay functionality
        let paymentCheckInterval;

        // Check if user has already paid
        async function checkPaymentStatus() {
            if (!window.nostr || !window.nostr.getPublicKey) return false;
            
            try {
                const pubkey = await window.nostr.getPublicKey();
                const response = await fetch('/api/check-payment?pubkey=' + pubkey);
                const data = await response.json();
                
                if (data.paid) {
                    showRelayAccess();
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Error checking payment status:', error);
                return false;
            }
        }

        function showRelayAccess() {
            const paySection = document.getElementById('paySection');
            const accessSection = document.getElementById('accessSection');
            
            if (paySection && accessSection) {
                // Smooth transition
                paySection.style.transition = 'opacity 0.3s ease-out';
                paySection.style.opacity = '0';
                
                setTimeout(() => {
                    paySection.style.display = 'none';
                    accessSection.style.display = 'block';
                    accessSection.style.opacity = '0';
                    accessSection.style.transition = 'opacity 0.3s ease-in';
                    
                    // Force reflow
                    void accessSection.offsetHeight;
                    
                    accessSection.style.opacity = '1';
                }, 300);
            }
            
            if (paymentCheckInterval) {
                clearInterval(paymentCheckInterval);
                paymentCheckInterval = null;
            }
        }

        // Listen for payment success from the zap dialog
        window.addEventListener('payment-success', async (event) => {
            console.log('Payment success event received');
            // Give the backend a moment to process
            setTimeout(() => {
                showRelayAccess();
            }, 500);
        });

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = \`
            @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
            @keyframes slideOut {
                from { transform: translateX(0); }
                to { transform: translateX(100%); }
            }
        \`;
        document.head.appendChild(style);

        // Initialize payment handling
        async function initPayment() {
            // Import the zap functionality
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/gh/Spl0itable/nosflare@main/nostr-zap.js';
            script.onload = () => {
                if (window.nostrZap) {
                    window.nostrZap.initTargets('#payButton');
                    
                    // Start checking when payment button is clicked
                    document.getElementById('payButton').addEventListener('click', () => {
                        if (!paymentCheckInterval) {
                            paymentCheckInterval = setInterval(async () => {
                                await checkPaymentStatus();
                            }, 3000);
                        }
                    });
                }
            };
            document.head.appendChild(script);
            
            // Check initial payment status
            await checkPaymentStatus();
        }

        // Wait for page to load and Nostr extension
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initPayment);
        } else {
            initPayment();
        }
        ` : ''}
    </script>
    ${PAY_TO_RELAY_ENABLED ? '<script src="https://unpkg.com/nostr-login@latest/dist/unpkg.js" data-perms="sign_event:1" data-methods="connect,extension,local" data-dark-mode="true"></script>' : ''}
</body>
</html>
    `;

    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}

// Handle EVENT messages
async function processEvent(event, server, env) {
    try {
        // Ensure event is valid JSON
        if (typeof event !== "object" || event === null || Array.isArray(event)) {
            console.error(`Invalid JSON format for event: ${JSON.stringify(event)}. Expected a JSON object.`);
            sendOK(server, null, false, "invalid: expected JSON object");
            return;
        }

        // Log event processing start
        console.log(`Processing event ${event.id}`);

        // Check cache for duplicate event ID
        const cacheKey = `event:${event.id}`;
        const cachedEvent = relayCache.get(cacheKey);
        if (cachedEvent) {
            console.log(`Duplicate event detected: ${event.id}. Dropping event.`);
            sendOK(server, event.id, true, "duplicate: already have this event");
            return;
        }

        // Verify event signature
        const isValidSignature = await verifyEventSignature(event);
        if (!isValidSignature) {
            console.error(`Signature verification failed for event ${event.id}`);
            sendOK(server, event.id, false, "invalid: signature verification failed");
            return;
        } else {
            console.log(`Signature verification passed for event ${event.id}`);
        }

        // Check if pay to relay is enabled and if the pubkey has paid
        if (PAY_TO_RELAY_ENABLED) {
            const hasPaid = await hasPaidForRelay(event.pubkey, env);
            if (!hasPaid) {
                const protocol = 'https:';
                const relayUrl = `${protocol}//${server.host}`;
                console.error(`Event denied. Pubkey ${event.pubkey} has not paid for relay access.`);
                sendOK(server, event.id, false, `blocked: payment required. Visit ${relayUrl} to pay for relay access.`);
                return;
            }
        }

        // Check if the pubkey is allowed
        if (!isPubkeyAllowed(event.pubkey)) {
            console.error(`Event denied. Pubkey ${event.pubkey} is not allowed.`);
            sendOK(server, event.id, false, `blocked: pubkey not allowed`);
            return;
        }

        // Check if the event kind is allowed
        if (!isEventKindAllowed(event.kind)) {
            console.error(`Event denied. Event kind ${event.kind} is not allowed.`);
            sendOK(server, event.id, false, `blocked: event kind ${event.kind} not allowed`);
            return;
        }

        // Check for blocked content
        if (containsBlockedContent(event)) {
            console.error(`Event denied. Content contains blocked phrases.`);
            sendOK(server, event.id, false, "blocked: content contains blocked phrases");
            return;
        }

        // Check if the tags are allowed or blocked
        for (const tag of event.tags) {
            const tagKey = tag[0];

            // If the tag is not allowed, reject the event
            if (!isTagAllowed(tagKey)) {
                console.error(`Event denied. Tag '${tagKey}' is not allowed.`);
                sendOK(server, event.id, false, `blocked: tag '${tagKey}' not allowed`);
                return;
            }

            // If the tag is blocked, reject the event
            if (blockedTags.has(tagKey)) {
                console.error(`Event denied. Tag '${tagKey}' is blocked.`);
                sendOK(server, event.id, false, `blocked: tag '${tagKey}' is blocked`);
                return;
            }
        }

        // NIP-05 validation (only if enabled)
        if (checkValidNip05 && event.kind !== 0) {
            const isValidNIP05 = await validateNIP05FromKind0(event.pubkey, env);
            if (!isValidNIP05) {
                console.error(`Event denied. NIP-05 validation failed for pubkey ${event.pubkey}.`);
                sendOK(server, event.id, false, `invalid: NIP-05 validation failed`);
                return;
            }
        }

        // Rate limit all event kinds except excluded kinds
        if (!excludedRateLimitKinds.has(event.kind)) {
            if (!server.pubkeyRateLimiter.removeToken()) {
                console.error(`Event denied. Rate limit exceeded for pubkey ${event.pubkey}.`);
                sendOK(server, event.id, false, "rate-limited: slow down there chief");
                return;
            }
        }

        // Check if deletion event (kind 5)
        if (event.kind === 5) {
            console.log(`Processing deletion event for event ID: ${event.id}`);

            // Process the deletion and wait for the result
            const deletionResults = await processDeletionEvent(event, env);

            // Check if any deletions were successful
            if (deletionResults.success && deletionResults.deletedCount > 0) {
                // Add event to cache with a TTL of 60 seconds
                relayCache.set(cacheKey, event, 60000);
                console.log(`Event ${event.id} cached with a TTL of 60 seconds`);

                sendOK(server, event.id, true, "Event successfully deleted");
                console.log(`Deletion event ${event.id} processed successfully. Deleted ${deletionResults.deletedCount} events.`);
            } else if (deletionResults.errors.length > 0) {
                // Some or all deletions failed
                sendOK(server, event.id, false, `error: ${deletionResults.errors[0]}`);
                console.error(`Failed to process deletion event ${event.id}: ${deletionResults.errors.join(', ')}`);
            } else {
                // No events to delete
                sendOK(server, event.id, true, "No matching events found to delete");
                console.log(`Deletion event ${event.id} processed but no matching events found to delete.`);
            }
            return;
        }

        // Save event to database
        console.log(`Saving event with ID: ${event.id} to D1...`);
        const saveResult = await saveEventToD1(event, env);

        if (!saveResult.success) {
            console.error(`Failed to save event with ID: ${event.id}`);
            sendOK(server, event.id, false, saveResult.error);
            return;
        }

        // Add event to cache with a TTL of 60 seconds
        relayCache.set(cacheKey, event, 60000);
        console.log(`Event ${event.id} cached with a TTL of 60 seconds`);

        // Acknowledge the event to the client
        sendOK(server, event.id, true, "Event received successfully for processing");
        console.log(`Event with ID: ${event.id} processed successfully.`);

    } catch (error) {
        console.error(`Error in processing event ${event.id}:`, error);
        sendOK(server, event.id, false, `error: ${error.message}`);
    }
}

// Handle saving event to D1 database
async function saveEventToD1(event, env) {
    try {
        const session = env.relayDb.withSession('first-primary');

        // Check for duplicate event ID
        const existingEvent = await session.prepare("SELECT id FROM events WHERE id = ? LIMIT 1")
            .bind(event.id)
            .first();

        if (existingEvent) {
            console.log(`Duplicate event: ${event.id}. Event dropped.`);
            return { success: false, error: "duplicate: already have this event" };
        }

        // Check for duplicate content if anti-spam is enabled
        if (shouldCheckForDuplicates(event.kind)) {
            console.log(`Checking for duplicate content for kind ${event.kind}`);

            const contentHash = await hashContent(event);

            let duplicateCheckQuery;
            if (enableGlobalDuplicateCheck) {
                duplicateCheckQuery = session.prepare(
                    "SELECT event_id FROM content_hashes WHERE hash = ? LIMIT 1"
                ).bind(contentHash);
            } else {
                duplicateCheckQuery = session.prepare(
                    "SELECT event_id FROM content_hashes WHERE hash = ? AND pubkey = ? LIMIT 1"
                ).bind(contentHash, event.pubkey);
            }

            const existingHash = await duplicateCheckQuery.first();

            if (existingHash) {
                console.log(`Duplicate content detected for event: ${event.id}`);
                return { success: false, error: `duplicate: content already exists` };
            }
        }

        // Start a transaction for saving the event and its related data
        const batch = [];

        // Insert the main event
        batch.push(
            session.prepare(`
                INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
                event.id,
                event.pubkey,
                event.created_at,
                event.kind,
                JSON.stringify(event.tags),
                event.content,
                event.sig
            )
        );

        // Insert tags
        for (const tag of event.tags) {
            const [tagName, tagValue] = tag;
            if (tagName && tagValue) {
                batch.push(
                    session.prepare(`
                        INSERT INTO tags (event_id, tag_name, tag_value)
                        VALUES (?, ?, ?)
                    `).bind(event.id, tagName, tagValue)
                );
            }
        }

        // Insert content hash if anti-spam is enabled
        if (shouldCheckForDuplicates(event.kind)) {
            const contentHash = await hashContent(event);
            batch.push(
                session.prepare(`
                    INSERT INTO content_hashes (hash, event_id, pubkey, created_at)
                    VALUES (?, ?, ?, ?)
                `).bind(contentHash, event.id, event.pubkey, event.created_at)
            );
        }

        // Execute all queries in a batch
        await session.batch(batch);

        console.log(`Event ${event.id} saved successfully to D1.`);
        return { success: true };

    } catch (error) {
        console.error(`Error saving event data in D1 for event ID: ${event.id}: ${error.message}`);
        return { success: false, error: `error: could not save event` };
    }
}

// Handle event deletion
async function processDeletionEvent(deletionEvent, env) {
    console.log(`Processing deletion event with ID: ${deletionEvent.id}`);
    const deletedEventIds = deletionEvent.tags.filter((tag) => tag[0] === "e").map((tag) => tag[1]);

    const results = {
        success: true,
        deletedCount: 0,
        errors: []
    };

    if (deletedEventIds.length === 0) {
        console.log(`No event IDs found in deletion event ${deletionEvent.id}`);
        return results;
    }

    // Use session with primary for writes
    const session = env.relayDb.withSession('first-primary');

    for (const eventId of deletedEventIds) {
        try {
            console.log(`Attempting to delete event with ID: ${eventId}`);

            // Check if the event exists and belongs to the same pubkey
            const existingEvent = await session.prepare("SELECT pubkey FROM events WHERE id = ? LIMIT 1")
                .bind(eventId)
                .first();

            if (!existingEvent) {
                console.warn(`Event with ID: ${eventId} not found. Nothing to delete.`);
                continue;
            }

            if (existingEvent.pubkey !== deletionEvent.pubkey) {
                console.warn(`Event ${eventId} does not belong to pubkey ${deletionEvent.pubkey}. Skipping deletion.`);
                results.errors.push(`unauthorized: cannot delete event ${eventId} - wrong pubkey`);
                results.success = false;
                continue;
            }

            // Mark the event as deleted (soft delete)
            const deleteResult = await session.prepare("UPDATE events SET deleted = 1 WHERE id = ?")
                .bind(eventId)
                .run();

            if (deleteResult.meta.changes > 0) {
                console.log(`Event ${eventId} marked as deleted successfully.`);
                results.deletedCount++;
            } else {
                console.error(`Failed to mark event ${eventId} as deleted.`);
                results.errors.push(`failed to delete event ${eventId}`);
                results.success = false;
            }
        } catch (error) {
            console.error(`Error processing deletion for event ${eventId}: ${error.message}`);
            results.errors.push(`error deleting ${eventId}: ${error.message}`);
            results.success = false;
        }
    }

    return results;
}

// Handle REQ messages
async function processReq(message, server, env) {
    // Validate message format
    if (!Array.isArray(message) || message.length < 3) {
        sendError(server, "Invalid REQ message format");
        return;
    }

    const subscriptionId = message[1];

    // Validate subscription ID
    if (typeof subscriptionId !== 'string' || subscriptionId === '' || subscriptionId.length > 64) {
        sendError(server, "Invalid subscription ID: must be non-empty string of max 64 chars");
        return;
    }

    // Extract all filters
    const filters = message.slice(2);

    // Validate filters
    if (filters.length === 0) {
        sendClosed(server, subscriptionId, "error: at least one filter required");
        return;
    }

    // Check the REQ rate limiter
    if (!server.reqRateLimiter.removeToken()) {
        console.error(`REQ rate limit exceeded for subscriptionId: ${subscriptionId}`);
        sendClosed(server, subscriptionId, "rate-limited: slow down there chief");
        return;
    }

    // Validate each filter
    for (const filter of filters) {
        if (typeof filter !== 'object' || filter === null) {
            sendClosed(server, subscriptionId, "invalid: filter must be an object");
            return;
        }

        // Validate event IDs if present in filters
        try {
            if (filter.ids) {
                validateIds(filter.ids);
            }
        } catch (error) {
            console.error(`Invalid event ID format in subscriptionId: ${subscriptionId} - ${error.message}`);
            sendClosed(server, subscriptionId, `invalid: ${error.message}`);
            return;
        }

        // Validate author(s) pubkey(s) if present in filters
        try {
            if (filter.authors) {
                validateAuthors(filter.authors);
            }
        } catch (error) {
            console.error(`Invalid author public key format in subscriptionId: ${subscriptionId} - ${error.message}`);
            sendClosed(server, subscriptionId, `invalid: ${error.message}`);
            return;
        }

        // Check if event kinds are allowed
        if (filter.kinds) {
            const invalidKinds = filter.kinds.filter(kind => !isEventKindAllowed(kind));
            if (invalidKinds.length > 0) {
                console.error(`Blocked kinds in subscriptionId: ${subscriptionId} - ${invalidKinds.join(', ')}`);
                sendClosed(server, subscriptionId, `blocked: kinds ${invalidKinds.join(', ')} not allowed`);
                return;
            }
        }

        // Allow up to 10,000 event IDs
        if (filter.ids && filter.ids.length > 10000) {
            console.error(`Too many event IDs in subscriptionId: ${subscriptionId} - Maximum is 10000`);
            sendClosed(server, subscriptionId, "invalid: too many event IDs (max 10000)");
            return;
        }

        // Allow up to a limit of 10,000 events
        if (filter.limit && filter.limit > 10000) {
            console.error(`REQ limit exceeded in subscriptionId: ${subscriptionId} - Maximum allowed is 10000`);
            sendClosed(server, subscriptionId, "invalid: limit too high (max 10000)");
            return;
        }

        // If no limit is provided, set it to 10,000
        if (!filter.limit) {
            filter.limit = 10000;
        }
    }

    // Check total parameter count across all filters
    let totalParams = 0;
    for (const filter of filters) {
        totalParams += countQueryParameters(filter);
    }

    if (totalParams > 5000) { // Set a reasonable upper limit
        console.error(`Too many total parameters in request: ${totalParams}`);
        sendClosed(server, subscriptionId, "invalid: filter too complex (too many parameters)");
        return;
    }

    // Generate a unique cache key based on the filters
    const cacheKey = `req:${JSON.stringify(filters)}`;
    const cachedEvents = relayCache.get(cacheKey);

    let allEvents = [];

    if (cachedEvents && cachedEvents.length > 0) {
        console.log(`Serving cached events for subscriptionId: ${subscriptionId}`);
        allEvents = cachedEvents;
    } else {
        try {
            // Query database
            const eventSet = new Map();

            for (const filter of filters) {
                const result = await queryDatabase(subscriptionId, filter, env);

                for (const event of result.events) {
                    eventSet.set(event.id, event);
                }
            }

            allEvents = Array.from(eventSet.values());

            // Sort by created_at DESC, then by ID for ties
            allEvents.sort((a, b) => {
                if (b.created_at !== a.created_at) {
                    return b.created_at - a.created_at;
                }
                return a.id.localeCompare(b.id);
            });

            // Cache the results if we have any
            if (allEvents.length > 0) {
                relayCache.set(cacheKey, allEvents, 60000); // Cache for 60 seconds
            }
        } catch (error) {
            console.error(`Error fetching events for subscriptionId: ${subscriptionId} - ${error.message}`);
            sendClosed(server, subscriptionId, `error: could not connect to the database`);
            return;
        }
    }

    // Apply global limit across all filters
    const limit = Math.min(...filters.map(f => f.limit || 10000));
    const eventsToSend = allEvents.slice(0, limit);

    // Send the events to the client
    for (const event of eventsToSend) {
        server.send(JSON.stringify(["EVENT", subscriptionId, event]));
    }

    // Send EOSE to indicate end of stored events
    sendEOSE(server, subscriptionId);
}

// Query database with Session API
async function queryDatabase(subscriptionId, filters, env) {
    console.log(`Processing request for subscription ID: ${subscriptionId}`);

    try {
        const session = env.relayDb.withSession('first-unconstrained');

        // Check if we need to split the query due to too many parameters
        const paramCount = countQueryParameters(filters);

        if (paramCount > 900) { // Leave some margin below SQLite's 999 limit
            console.log(`Query has ${paramCount} parameters, splitting into chunks...`);
            return await queryDatabaseChunked(subscriptionId, filters, env);
        }

        // Original query logic for smaller queries
        const query = buildQuery(filters);

        console.log(`Executing query: ${query.sql}`);
        console.log(`Query parameters: ${JSON.stringify(query.params)}`);

        const result = await session.prepare(query.sql)
            .bind(...query.params)
            .all();

        // Log where the query was served from (for debugging)
        if (result.meta) {
            console.log({
                servedByRegion: result.meta.served_by_region ?? "",
                servedByPrimary: result.meta.served_by_primary ?? false,
            });
        }

        const events = result.results.map(row => ({
            id: row.id,
            pubkey: row.pubkey,
            created_at: row.created_at,
            kind: row.kind,
            tags: JSON.parse(row.tags),
            content: row.content,
            sig: row.sig
        }));

        console.log(`Found ${events.length} events for subscription ID: ${subscriptionId}`);

        return { events };

    } catch (error) {
        console.error(`Error fetching events for subscriptionId: ${subscriptionId} - ${error.message}`);
        return { events: [] };
    }
}

// Helper function to count query parameters
function countQueryParameters(filters) {
    let count = 0;

    if (filters.ids) count += filters.ids.length;
    if (filters.authors) count += filters.authors.length;
    if (filters.kinds) count += filters.kinds.length;
    if (filters.since) count += 1;
    if (filters.until) count += 1;

    // Count tag filter parameters
    for (const [key, values] of Object.entries(filters)) {
        if (key.startsWith('#') && values && values.length > 0) {
            count += 1 + values.length; // 1 for tag name + number of values
        }
    }

    if (filters.limit) count += 1;

    return count;
}

// Helper function to handle chunked queries
async function queryDatabaseChunked(subscriptionId, filters, env) {
    const session = env.relayDb.withSession('first-unconstrained');
    const allEvents = new Map(); // Use Map to deduplicate

    // Determine what needs chunking
    const needsChunking = {
        ids: filters.ids && filters.ids.length > 200,
        authors: filters.authors && filters.authors.length > 200,
        kinds: filters.kinds && filters.kinds.length > 200,
        tags: {}
    };

    // Check tag filters for chunking needs
    for (const [key, values] of Object.entries(filters)) {
        if (key.startsWith('#') && values && values.length > 200) {
            needsChunking.tags[key] = true;
        }
    }

    // If IDs need chunking, process in batches
    if (needsChunking.ids) {
        const idChunks = chunkArray(filters.ids, 200);

        for (const idChunk of idChunks) {
            const chunkFilters = { ...filters, ids: idChunk };
            const query = buildQuery(chunkFilters);

            try {
                const result = await session.prepare(query.sql)
                    .bind(...query.params)
                    .all();

                for (const row of result.results) {
                    const event = {
                        id: row.id,
                        pubkey: row.pubkey,
                        created_at: row.created_at,
                        kind: row.kind,
                        tags: JSON.parse(row.tags),
                        content: row.content,
                        sig: row.sig
                    };
                    allEvents.set(event.id, event);
                }
            } catch (error) {
                console.error(`Error in chunk query: ${error.message}`);
            }
        }
    }
    // If authors need chunking
    else if (needsChunking.authors) {
        const authorChunks = chunkArray(filters.authors, 200);

        for (const authorChunk of authorChunks) {
            const chunkFilters = { ...filters, authors: authorChunk };
            const query = buildQuery(chunkFilters);

            try {
                const result = await session.prepare(query.sql)
                    .bind(...query.params)
                    .all();

                for (const row of result.results) {
                    const event = {
                        id: row.id,
                        pubkey: row.pubkey,
                        created_at: row.created_at,
                        kind: row.kind,
                        tags: JSON.parse(row.tags),
                        content: row.content,
                        sig: row.sig
                    };
                    allEvents.set(event.id, event);
                }
            } catch (error) {
                console.error(`Error in chunk query: ${error.message}`);
            }
        }
    }
    // Handle tag chunking if needed
    else if (Object.keys(needsChunking.tags).length > 0) {
        // For tag filters, we need a different approach
        // Process each large tag filter separately
        for (const [tagKey, _] of Object.entries(needsChunking.tags)) {
            const tagValues = filters[tagKey];
            const tagChunks = chunkArray(tagValues, 200);

            for (const tagChunk of tagChunks) {
                const chunkFilters = { ...filters };
                // Replace the large tag filter with the chunk
                chunkFilters[tagKey] = tagChunk;

                const query = buildQuery(chunkFilters);

                try {
                    const result = await session.prepare(query.sql)
                        .bind(...query.params)
                        .all();

                    for (const row of result.results) {
                        const event = {
                            id: row.id,
                            pubkey: row.pubkey,
                            created_at: row.created_at,
                            kind: row.kind,
                            tags: JSON.parse(row.tags),
                            content: row.content,
                            sig: row.sig
                        };
                        allEvents.set(event.id, event);
                    }
                } catch (error) {
                    console.error(`Error in chunk query: ${error.message}`);
                }
            }
        }
    }
    // If no specific chunking needed but still too many params, execute as-is
    else {
        const query = buildQuery(filters);

        try {
            const result = await session.prepare(query.sql)
                .bind(...query.params)
                .all();

            for (const row of result.results) {
                const event = {
                    id: row.id,
                    pubkey: row.pubkey,
                    created_at: row.created_at,
                    kind: row.kind,
                    tags: JSON.parse(row.tags),
                    content: row.content,
                    sig: row.sig
                };
                allEvents.set(event.id, event);
            }
        } catch (error) {
            console.error(`Error in query: ${error.message}`);
        }
    }

    const events = Array.from(allEvents.values());
    console.log(`Found ${events.length} events (chunked) for subscription ID: ${subscriptionId}`);

    return { events };
}

// Helper function to chunk arrays
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

// Build SQL query from filters
function buildQuery(filters) {
    let sql = "SELECT * FROM events WHERE deleted = 0";
    const params = [];
    const conditions = [];

    // Handle ID filter
    if (filters.ids && filters.ids.length > 0) {
        const placeholders = filters.ids.map(() => '?').join(',');
        conditions.push(`id IN (${placeholders})`);
        params.push(...filters.ids);
    }

    // Handle author filter
    if (filters.authors && filters.authors.length > 0) {
        const placeholders = filters.authors.map(() => '?').join(',');
        conditions.push(`pubkey IN (${placeholders})`);
        params.push(...filters.authors);
    }

    // Handle kind filter
    if (filters.kinds && filters.kinds.length > 0) {
        const placeholders = filters.kinds.map(() => '?').join(',');
        conditions.push(`kind IN (${placeholders})`);
        params.push(...filters.kinds);
    }

    // Handle time filters
    if (filters.since) {
        conditions.push("created_at >= ?");
        params.push(filters.since);
    }

    if (filters.until) {
        conditions.push("created_at <= ?");
        params.push(filters.until);
    }

    // Handle tag filters (#e, #p, #a, #t, etc.)
    const tagConditions = [];
    for (const [key, values] of Object.entries(filters)) {
        if (key.startsWith('#') && values && values.length > 0) {
            const tagName = key.substring(1);
            const tagSubquery = `
                id IN (
                    SELECT event_id FROM tags 
                    WHERE tag_name = ? AND tag_value IN (${values.map(() => '?').join(',')})
                )
            `;
            tagConditions.push(tagSubquery);
            params.push(tagName, ...values);
        }
    }

    if (tagConditions.length > 0) {
        conditions.push(`(${tagConditions.join(' OR ')})`);
    }

    // Add conditions to query
    if (conditions.length > 0) {
        sql += " AND " + conditions.join(" AND ");
    }

    // Add ordering and limit
    sql += " ORDER BY created_at DESC";

    if (filters.limit) {
        sql += " LIMIT ?";
        params.push(Math.min(filters.limit, 10000));
    } else {
        sql += " LIMIT 10000";
    }

    return { sql, params };
}

// Fetches NIP-05 from kind 0 event
async function validateNIP05FromKind0(pubkey, env) {
    try {
        // Check if we have a kind 0 event cached for the pubkey
        let metadataEvent = relayCache.get(`metadata:${pubkey}`);

        if (!metadataEvent) {
            // If not cached, fetch the kind 0 event from the database
            metadataEvent = await fetchKind0EventForPubkey(pubkey, env);

            if (!metadataEvent) {
                console.error(`No kind 0 metadata event found for pubkey: ${pubkey}`);
                return false;
            }

            // Cache the event for future reference
            relayCache.set(`metadata:${pubkey}`, metadataEvent, 3600000); // Cache for 1 hour
        }

        // Parse the content field of the kind 0 event
        const metadata = JSON.parse(metadataEvent.content);
        const nip05Address = metadata.nip05;

        if (!nip05Address) {
            console.error(`No NIP-05 address found in kind 0 for pubkey: ${pubkey}`);
            return false;
        }

        // Validate the NIP-05 address
        const isValid = await validateNIP05(nip05Address, pubkey);
        return isValid;

    } catch (error) {
        console.error(`Error validating NIP-05 for pubkey ${pubkey}: ${error.message}`);
        return false;
    }
}

// Fetch kind 0 event for pubkey
async function fetchKind0EventForPubkey(pubkey, env) {
    try {
        const filters = { kinds: [0], authors: [pubkey], limit: 1 };
        const result = await queryDatabase(null, filters, env);

        if (result.events && result.events.length > 0) {
            return result.events[0];
        }

        // If no event found from local database, use fallback relay
        console.log(`No kind 0 event found locally, trying fallback relay: wss://relay.nostr.band`);
        const fallbackEvent = await fetchEventFromFallbackRelay(pubkey);
        if (fallbackEvent) {
            return fallbackEvent;
        }
    } catch (error) {
        console.error(`Error fetching kind 0 event for pubkey ${pubkey}: ${error.message}`);
    }

    return null;
}

// Helper function to check if a pubkey has paid
async function hasPaidForRelay(pubkey, env) {
    if (!PAY_TO_RELAY_ENABLED) return true; // If pay to relay is disabled allow all

    try {
        const session = env.relayDb.withSession('first-unconstrained');
        const query = `SELECT pubkey, paid_at FROM paid_pubkeys WHERE pubkey = ? LIMIT 1`;
        const result = await session.prepare(query).bind(pubkey).first();

        if (result) {
            console.log(`Payment found for ${pubkey}, paid at: ${result.paid_at}`);
        } else {
            console.log(`No payment found for ${pubkey}`);
        }

        return result !== null;
    } catch (error) {
        console.error(`Error checking paid status for ${pubkey}:`, error);
        return false;
    }
}

// Helper function to save paid pubkey to D1 database
async function savePaidPubkey(pubkey, env) {
    try {
        const session = env.relayDb.withSession('first-primary');
        const query = `
            INSERT INTO paid_pubkeys (pubkey, paid_at, amount_sats)
            VALUES (?, ?, ?)
            ON CONFLICT(pubkey) DO UPDATE SET
                paid_at = excluded.paid_at,
                amount_sats = excluded.amount_sats
        `;

        await session.prepare(query)
            .bind(pubkey, Math.floor(Date.now() / 1000), RELAY_ACCESS_PRICE_SATS)
            .run();

        console.log(`Successfully saved paid pubkey: ${pubkey}`);
        return true;
    } catch (error) {
        console.error(`Error saving paid pubkey ${pubkey}:`, error);
        return false;
    }
}

// Handle zap payment status check
async function handleCheckPayment(request, env) {
    const url = new URL(request.url);
    const pubkey = url.searchParams.get('pubkey');

    if (!pubkey) {
        return new Response(JSON.stringify({ error: 'Missing pubkey' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const paid = await hasPaidForRelay(pubkey, env);

    return new Response(JSON.stringify({ paid }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

// Handle zap payment notification
async function handlePaymentNotification(request, env) {
    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const url = new URL(request.url);
        const pubkey = url.searchParams.get('npub');

        if (!pubkey) {
            return new Response(JSON.stringify({ error: 'Missing pubkey' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // Save the paid pubkey to D1 database
        const success = await savePaidPubkey(pubkey, env);

        if (success) {
            return new Response(JSON.stringify({
                success: true,
                message: 'Payment recorded successfully'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } else {
            return new Response(JSON.stringify({
                error: 'Failed to save payment'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    } catch (error) {
        console.error('Error processing payment notification:', error);
        return new Response(JSON.stringify({
            error: 'Invalid request'
        }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// Checks if NIP-05 is valid
async function validateNIP05(nip05Address, pubkey) {
    try {
        // Extract the domain and username
        const [name, domain] = nip05Address.split('@');

        if (!domain) {
            throw new Error(`Invalid NIP-05 address format: ${nip05Address}`);
        }

        // Check if the domain is in the blocked list
        if (blockedNip05Domains.has(domain)) {
            console.error(`NIP-05 domain is blocked: ${domain}`);
            return false;
        }

        // If allowed domains are defined, check if the domain is in the allowed list
        if (allowedNip05Domains.size > 0 && !allowedNip05Domains.has(domain)) {
            console.error(`NIP-05 domain is not allowed: ${domain}`);
            return false;
        }

        // Fetch the NIP-05 .well-known/nostr.json file
        const url = `https://${domain}/.well-known/nostr.json?name=${name}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Failed to fetch NIP-05 data from ${url}: ${response.statusText}`);
            return false;
        }

        const nip05Data = await response.json();

        if (!nip05Data.names || !nip05Data.names[name]) {
            console.error(`NIP-05 data does not contain a matching public key for ${name}`);
            return false;
        }

        // Compare the pubkey from NIP-05 with the event's pubkey
        const nip05Pubkey = nip05Data.names[name];
        return nip05Pubkey === pubkey;

    } catch (error) {
        console.error(`Error validating NIP-05 address: ${error.message}`);
        return false;
    }
}

// Fetches kind 0 event from other relay
function fetchEventFromFallbackRelay(pubkey) {
    return new Promise((resolve, reject) => {
        const fallbackRelayUrl = 'wss://relay.nostr.band';
        const ws = new WebSocket(fallbackRelayUrl);
        let hasClosed = false;

        const closeWebSocket = (subscriptionId) => {
            if (!hasClosed && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(["CLOSE", subscriptionId]));
                ws.close();
                hasClosed = true;
                console.log('WebSocket connection to fallback relay closed');
            }
        };

        ws.onopen = () => {
            console.log("WebSocket connection to fallback relay opened.");
            const subscriptionId = Math.random().toString(36).substr(2, 9);
            const filters = {
                kinds: [0],
                authors: [pubkey], // Only for the specified pubkey
                limit: 1 // We only need one event (the latest kind 0 event)
            };
            const reqMessage = JSON.stringify(["REQ", subscriptionId, filters]);
            ws.send(reqMessage);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                // Handle EVENT message
                if (message[0] === "EVENT" && message[1]) {
                    const eventData = message[2];
                    if (eventData.kind === 0 && eventData.pubkey === pubkey) {
                        console.log("Received kind 0 event from fallback relay.");
                        closeWebSocket(message[1]);
                        resolve(eventData);
                    }
                }

                // Handle EOSE message
                else if (message[0] === "EOSE") {
                    console.log("EOSE received from fallback relay, no kind 0 event found.");
                    closeWebSocket(message[1]);
                    resolve(null);
                }
            } catch (error) {
                console.error(`Error processing fallback relay event for pubkey ${pubkey}: ${error.message}`);
                reject(error);
            }
        };

        ws.onerror = (error) => {
            console.error(`WebSocket error with fallback relay: ${error.message}`);
            ws.close();
            hasClosed = true;
            reject(error);
        };

        ws.onclose = () => {
            hasClosed = true;
            console.log('Fallback relay WebSocket connection closed.');
        };

        // Timeout if no response is received within 10 seconds
        setTimeout(() => {
            if (!hasClosed) {
                console.log('Timeout reached. Closing WebSocket connection to fallback relay.');
                closeWebSocket(null);
                reject(new Error(`No response from fallback relay for pubkey ${pubkey}`));
            }
        }, 10000);
    });
}

// Validate event IDs
function validateIds(ids) {
    for (const id of ids) {
        if (!/^[a-f0-9]{64}$/.test(id)) {
            throw new Error(`Invalid event ID format: ${id}`);
        }
    }
}

// Validate author pubkeys
function validateAuthors(authors) {
    for (const author of authors) {
        if (!/^[a-f0-9]{64}$/.test(author)) {
            throw new Error(`Invalid author pubkey format: ${author}`);
        }
    }
}

// Verify event sig
async function verifyEventSignature(event) {
    try {
        const signatureBytes = hexToBytes(event.sig);
        const serializedEventData = serializeEventForSigning(event);
        const messageHashBuffer = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(serializedEventData)
        );
        const messageHash = new Uint8Array(messageHashBuffer);
        const publicKeyBytes = hexToBytes(event.pubkey);
        const signatureIsValid = schnorr.verify(signatureBytes, messageHash, publicKeyBytes);
        return signatureIsValid;
    } catch (error) {
        console.error("Error verifying event signature:", error);
        return false;
    }
}

function serializeEventForSigning(event) {
    const serializedEvent = JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content,
    ]);
    return serializedEvent;
}

function hexToBytes(hexString) {
    if (hexString.length % 2 !== 0) throw new Error("Invalid hex string");
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
    }
    return bytes;
}

// Hash content (only called when anti-spam is enabled)
async function hashContent(event) {
    const contentToHash = enableGlobalDuplicateCheck
        ? JSON.stringify({ kind: event.kind, tags: event.tags, content: event.content })
        : JSON.stringify({ pubkey: event.pubkey, kind: event.kind, tags: event.tags, content: event.content });

    const buffer = new TextEncoder().encode(contentToHash);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hash = bytesToHex(new Uint8Array(hashBuffer));
    console.log(`Generated hash for event ID: ${event.id}: ${hash}`);
    return hash;
}

function bytesToHex(bytes) {
    return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// Sends event response to client
function sendOK(server, eventId, status, message) {
    if (server.readyState === WebSocket.OPEN) {
        const formattedMessage = message || "";
        server.send(JSON.stringify(["OK", eventId, status, formattedMessage]));
    }
}

function sendError(server, message) {
    if (server.readyState === WebSocket.OPEN) {
        server.send(JSON.stringify(["NOTICE", message]));
    }
}

function sendEOSE(server, subscriptionId) {
    if (server.readyState === WebSocket.OPEN) {
        server.send(JSON.stringify(["EOSE", subscriptionId]));
    }
}

function sendClosed(server, subscriptionId, message) {
    if (server.readyState === WebSocket.OPEN) {
        server.send(JSON.stringify(["CLOSED", subscriptionId, message]));
    }
}

// ES Module export
export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);

            // Handle payment notification from zap
            if (request.method === 'POST' && url.searchParams.has('notify-zap') && PAY_TO_RELAY_ENABLED) {
                return await handlePaymentNotification(request, env);
            }

            // API endpoint for checking payment status
            if (url.pathname === "/api/check-payment" && PAY_TO_RELAY_ENABLED) {
                return await handleCheckPayment(request, env);
            }

            // Serves landing page, websocket upgrade, etc
            if (url.pathname === "/") {
                if (request.headers.get("Upgrade") === "websocket") {
                    return handleWebSocketUpgrade(request, env);
                } else if (request.headers.get("Accept") === "application/nostr+json") {
                    return handleRelayInfoRequest(request);
                } else {
                    // Initialize DB in background
                    ctx.waitUntil(
                        initializeDatabase(env.relayDb)
                            .catch(e => console.error("DB init error:", e))
                    );

                    // Return the landing page
                    return serveLandingPage();
                }
            } else if (url.pathname === "/.well-known/nostr.json") {
                return handleNIP05Request(url);
            } else if (url.pathname === "/favicon.ico") {
                return await serveFavicon();
            } else {
                return new Response("Invalid request", { status: 400 });
            }
        } catch (error) {
            console.error("Error in fetch handler:", error);
            return new Response("Internal Server Error", { status: 500 });
        }
    }
};