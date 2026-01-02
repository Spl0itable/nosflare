import { schnorr } from "@noble/curves/secp256k1";
import { Env, NostrEvent, NostrFilter, QueryResult, NostrMessage, Nip05Response } from './types';
import * as config from './config';
import { RelayWebSocket } from './durable-object';

// Import config values
const {
  relayInfo,
  PAY_TO_RELAY_ENABLED,
  RELAY_ACCESS_PRICE_SATS,
  relayNpub,
  nip05Users,
  enableAntiSpam,
  enableGlobalDuplicateCheck,
  antiSpamKinds,
  checkValidNip05,
  blockedNip05Domains,
  allowedNip05Domains,
  DB_PRUNING_ENABLED,
  DB_SIZE_THRESHOLD_GB,
  DB_PRUNE_BATCH_SIZE,
  DB_PRUNE_TARGET_GB,
  pruneProtectedKinds,
} = config;

// Query optimization constants
const GLOBAL_MAX_EVENTS = 500;
const MAX_QUERY_COMPLEXITY = 1000;
const CHUNK_SIZE = 500;

// Database initialization
async function initializeDatabase(db: D1Database): Promise<void> {
  try {
    const session = db.withSession('first-unconstrained');
    const initCheck = await session.prepare(
      "SELECT value FROM system_config WHERE key = 'db_initialized' LIMIT 1"
    ).first().catch(() => null);

    if (initCheck && initCheck.value === '1') {
      console.log("Database already initialized");
      return;
    }
  } catch (error) {
    console.log("Database not initialized, creating schema...");
  }

  const session = db.withSession('first-primary');

  try {
    await session.prepare(`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `).run();

    const statements = [
      `CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        pubkey TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        kind INTEGER NOT NULL,
        tags TEXT NOT NULL,
        content TEXT NOT NULL,
        sig TEXT NOT NULL,
        created_timestamp INTEGER DEFAULT (strftime('%s', 'now')),
        tag_p TEXT,
        tag_e TEXT,
        tag_a TEXT,
        tag_t TEXT,
        tag_d TEXT,
        tag_r TEXT,
        tag_L TEXT,
        tag_s TEXT,
        tag_u TEXT,
        reply_to_event_id TEXT,
        root_event_id TEXT,
        content_preview TEXT
      )`,

      `CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey)`,
      `CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind)`,
      `CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_events_kind_created_at ON events(kind, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_events_pubkey_created_at ON events(pubkey, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_events_created_at_kind ON events(created_at DESC, kind)`,
      `CREATE INDEX IF NOT EXISTS idx_events_pubkey_kind_created_at ON events(pubkey, kind, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_events_kind_pubkey_created_at ON events(kind, pubkey, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_events_authors_kinds ON events(pubkey, kind) WHERE kind IN (0, 1, 3, 4, 6, 7, 1984, 9735, 10002)`,

      `CREATE INDEX IF NOT EXISTS idx_events_tag_p_created_at ON events(tag_p, created_at DESC) WHERE tag_p IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_tag_e_created_at ON events(tag_e, created_at DESC) WHERE tag_e IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_tag_a_created_at ON events(tag_a, created_at DESC) WHERE tag_a IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_tag_t_created_at ON events(tag_t, created_at DESC) WHERE tag_t IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_tag_d_created_at ON events(tag_d, created_at DESC) WHERE tag_d IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_tag_r_created_at ON events(tag_r, created_at DESC) WHERE tag_r IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_tag_L_created_at ON events(tag_L, created_at DESC) WHERE tag_L IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_tag_s_created_at ON events(tag_s, created_at DESC) WHERE tag_s IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_tag_u_created_at ON events(tag_u, created_at DESC) WHERE tag_u IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_kind_tag_p ON events(kind, tag_p, created_at DESC) WHERE tag_p IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_kind_tag_e ON events(kind, tag_e, created_at DESC) WHERE tag_e IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_kind_tag_a ON events(kind, tag_a, created_at DESC) WHERE tag_a IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_kind_tag_t ON events(kind, tag_t, created_at DESC) WHERE tag_t IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_kind_tag_L ON events(kind, tag_L, created_at DESC) WHERE tag_L IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_kind_tag_s ON events(kind, tag_s, created_at DESC) WHERE tag_s IS NOT NULL`,

      `CREATE INDEX IF NOT EXISTS idx_events_reply_to ON events(reply_to_event_id, created_at DESC) WHERE reply_to_event_id IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_events_root_thread ON events(root_event_id, created_at DESC) WHERE root_event_id IS NOT NULL`,

      `CREATE TABLE IF NOT EXISTS tags (
        event_id TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        tag_value TEXT NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tags_name_value ON tags(tag_name, tag_value)`,
      `CREATE INDEX IF NOT EXISTS idx_tags_name_value_event ON tags(tag_name, tag_value, event_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tags_event_id ON tags(event_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tags_value ON tags(tag_value)`,

      `CREATE INDEX IF NOT EXISTS idx_tags_name_value_event_created ON tags(tag_name, tag_value, event_id)`,

      `CREATE TABLE IF NOT EXISTS event_tags_cache (
        event_id TEXT NOT NULL,
        pubkey TEXT NOT NULL,
        kind INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        tag_p TEXT,
        tag_e TEXT,
        tag_a TEXT,
        PRIMARY KEY (event_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_event_tags_cache_p ON event_tags_cache(tag_p, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_event_tags_cache_e ON event_tags_cache(tag_e, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_event_tags_cache_kind_p ON event_tags_cache(kind, tag_p)`,
      `CREATE INDEX IF NOT EXISTS idx_event_tags_cache_p_e ON event_tags_cache(tag_p, tag_e) WHERE tag_p IS NOT NULL AND tag_e IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_event_tags_cache_kind_created_at ON event_tags_cache(kind, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_event_tags_cache_pubkey_kind_created_at ON event_tags_cache(pubkey, kind, created_at DESC)`,

      `CREATE TABLE IF NOT EXISTS event_tags_cache_multi (
        event_id TEXT NOT NULL,
        pubkey TEXT NOT NULL,
        kind INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        tag_type TEXT NOT NULL CHECK(tag_type IN ('p', 'e', 'a', 't', 'd', 'r', 'L', 's', 'u')),
        tag_value TEXT NOT NULL,
        PRIMARY KEY (event_id, tag_type, tag_value)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cache_multi_type_value_time ON event_tags_cache_multi(tag_type, tag_value, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_cache_multi_type_value_event ON event_tags_cache_multi(tag_type, tag_value, event_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cache_multi_kind_type_value ON event_tags_cache_multi(kind, tag_type, tag_value, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_cache_multi_event_id ON event_tags_cache_multi(event_id)`,

      `CREATE TABLE IF NOT EXISTS paid_pubkeys (
        pubkey TEXT PRIMARY KEY,
        paid_at INTEGER NOT NULL,
        amount_sats INTEGER,
        created_timestamp INTEGER DEFAULT (strftime('%s', 'now'))
      )`,

      `CREATE TABLE IF NOT EXISTS content_hashes (
        hash TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        pubkey TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_content_hashes_pubkey ON content_hashes(pubkey)`,
      `CREATE INDEX IF NOT EXISTS idx_content_hashes_created_at ON content_hashes(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_content_hashes_pubkey_created ON content_hashes(pubkey, created_at DESC)`,

      `CREATE TABLE IF NOT EXISTS mv_recent_notes (
        id TEXT PRIMARY KEY,
        pubkey TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        kind INTEGER NOT NULL,
        tags TEXT NOT NULL,
        content TEXT NOT NULL,
        sig TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_mv_recent_notes_created_at ON mv_recent_notes(created_at DESC)`,

      `CREATE TABLE IF NOT EXISTS mv_follow_graph (
        follower_pubkey TEXT NOT NULL,
        followed_pubkey TEXT NOT NULL,
        last_updated INTEGER NOT NULL,
        PRIMARY KEY (follower_pubkey, followed_pubkey)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_mv_follow_graph_follower ON mv_follow_graph(follower_pubkey)`,
      `CREATE INDEX IF NOT EXISTS idx_mv_follow_graph_followed ON mv_follow_graph(followed_pubkey)`,

      `CREATE TABLE IF NOT EXISTS mv_timeline_cache (
        follower_pubkey TEXT NOT NULL,
        event_id TEXT NOT NULL,
        event_pubkey TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        kind INTEGER NOT NULL,
        PRIMARY KEY (follower_pubkey, event_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_mv_timeline_follower_time ON mv_timeline_cache(follower_pubkey, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_mv_timeline_event ON mv_timeline_cache(event_id)`
    ];

    for (const statement of statements) {
      await session.prepare(statement).run();
    }

    await session.prepare("PRAGMA foreign_keys = ON").run();
    await session.prepare(
      "INSERT OR REPLACE INTO system_config (key, value) VALUES ('db_initialized', '1')"
    ).run();

    // Check current schema version
    const versionResult = await session.prepare(
      "SELECT value FROM system_config WHERE key = 'schema_version'"
    ).first() as { value: string } | null;
    const currentVersion = versionResult ? parseInt(versionResult.value) : 0;

    if (currentVersion < 5) {
      console.log('Migrating to schema version 5: populating tag columns in events table...');

      await session.prepare(`
        UPDATE events
        SET
          tag_p = (SELECT tag_value FROM tags WHERE event_id = events.id AND tag_name = 'p' LIMIT 1),
          tag_e = (SELECT tag_value FROM tags WHERE event_id = events.id AND tag_name = 'e' LIMIT 1),
          tag_a = (SELECT tag_value FROM tags WHERE event_id = events.id AND tag_name = 'a' LIMIT 1),
          tag_t = (SELECT tag_value FROM tags WHERE event_id = events.id AND tag_name = 't' LIMIT 1),
          tag_d = (SELECT tag_value FROM tags WHERE event_id = events.id AND tag_name = 'd' LIMIT 1),
          tag_r = (SELECT tag_value FROM tags WHERE event_id = events.id AND tag_name = 'r' LIMIT 1)
        WHERE EXISTS (
          SELECT 1 FROM tags t
          WHERE t.event_id = events.id
          AND t.tag_name IN ('p', 'e', 'a', 't', 'd', 'r')
        )
      `).run();

      console.log('Schema v5 migration completed');
    }

    if (currentVersion < 6) {
      console.log('Migrating to schema version 6: adding L/s/u tags and thread metadata...');

      await session.prepare(`
        UPDATE events
        SET
          tag_L = (SELECT tag_value FROM tags WHERE event_id = events.id AND tag_name = 'L' LIMIT 1),
          tag_s = (SELECT tag_value FROM tags WHERE event_id = events.id AND tag_name = 's' LIMIT 1),
          tag_u = (SELECT tag_value FROM tags WHERE event_id = events.id AND tag_name = 'u' LIMIT 1),
          reply_to_event_id = (SELECT tag_value FROM tags WHERE event_id = events.id AND tag_name = 'e' LIMIT 1),
          root_event_id = (
            SELECT tag_value FROM tags
            WHERE event_id = events.id AND tag_name = 'e'
            AND EXISTS (
              SELECT 1 FROM tags t2
              WHERE t2.event_id = events.id AND t2.tag_name = 'e'
              HAVING COUNT(*) > 1
            )
            ORDER BY ROWID DESC LIMIT 1
          ),
          content_preview = SUBSTR(content, 1, 100)
        WHERE EXISTS (
          SELECT 1 FROM tags t
          WHERE t.event_id = events.id
          AND t.tag_name IN ('L', 's', 'u', 'e')
        ) OR LENGTH(content) > 0
      `).run();

      console.log('Schema v6 migration completed');
    }

    await session.prepare(
      "INSERT OR REPLACE INTO system_config (key, value) VALUES ('schema_version', '6')"
    ).run();

    await session.prepare(`
      INSERT OR IGNORE INTO event_tags_cache (event_id, pubkey, kind, created_at, tag_p, tag_e, tag_a)
      SELECT
        e.id,
        e.pubkey,
        e.kind,
        e.created_at,
        (SELECT tag_value FROM tags WHERE event_id = e.id AND tag_name = 'p' LIMIT 1) as tag_p,
        (SELECT tag_value FROM tags WHERE event_id = e.id AND tag_name = 'e' LIMIT 1) as tag_e,
        (SELECT tag_value FROM tags WHERE event_id = e.id AND tag_name = 'a' LIMIT 1) as tag_a
      FROM events e
      WHERE EXISTS (
        SELECT 1 FROM tags t
        WHERE t.event_id = e.id
        AND t.tag_name IN ('p', 'e', 'a')
      )
    `).run();

    // Populate multi-value cache from existing data
    await session.prepare(`
      INSERT OR IGNORE INTO event_tags_cache_multi (event_id, pubkey, kind, created_at, tag_type, tag_value)
      SELECT
        e.id,
        e.pubkey,
        e.kind,
        e.created_at,
        t.tag_name,
        t.tag_value
      FROM events e
      INNER JOIN tags t ON e.id = t.event_id
      WHERE t.tag_name IN ('p', 'e', 'a', 't', 'd', 'r', 'L', 's', 'u')
    `).run();

    // Run ANALYZE to initialize statistics
    await session.prepare("ANALYZE events").run();
    await session.prepare("ANALYZE tags").run();
    await session.prepare("ANALYZE event_tags_cache").run();
    await session.prepare("ANALYZE event_tags_cache_multi").run();

    console.log("Database initialization completed!");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

// Event verification
async function verifyEventSignature(event: NostrEvent): Promise<boolean> {
  try {
    const signatureBytes = hexToBytes(event.sig);
    const serializedEventData = serializeEventForSigning(event);
    const messageHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(serializedEventData)
    );
    const messageHash = new Uint8Array(messageHashBuffer);
    const publicKeyBytes = hexToBytes(event.pubkey);
    return schnorr.verify(signatureBytes, messageHash, publicKeyBytes);
  } catch (error) {
    console.error("Error verifying event signature:", error);
    return false;
  }
}

function serializeEventForSigning(event: NostrEvent): string {
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

function hexToBytes(hexString: string): Uint8Array {
  if (hexString.length % 2 !== 0) throw new Error("Invalid hex string");
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// Content hashing for anti-spam
async function hashContent(event: NostrEvent): Promise<string> {
  const contentToHash = enableGlobalDuplicateCheck
    ? JSON.stringify({ kind: event.kind, tags: event.tags, content: event.content })
    : JSON.stringify({ pubkey: event.pubkey, kind: event.kind, tags: event.tags, content: event.content });

  const buffer = new TextEncoder().encode(contentToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return bytesToHex(new Uint8Array(hashBuffer));
}

function shouldCheckForDuplicates(kind: number): boolean {
  return enableAntiSpam && antiSpamKinds.has(kind);
}

// Payment handling
async function hasPaidForRelay(pubkey: string, env: Env): Promise<boolean> {
  if (!PAY_TO_RELAY_ENABLED) return true;

  try {
    const session = env.RELAY_DATABASE.withSession('first-unconstrained');
    const result = await session.prepare(
      "SELECT pubkey FROM paid_pubkeys WHERE pubkey = ? LIMIT 1"
    ).bind(pubkey).first();
    return result !== null;
  } catch (error) {
    console.error(`Error checking paid status for ${pubkey}:`, error);
    return false;
  }
}

async function savePaidPubkey(pubkey: string, env: Env): Promise<boolean> {
  try {
    const session = env.RELAY_DATABASE.withSession('first-primary');
    await session.prepare(`
      INSERT INTO paid_pubkeys (pubkey, paid_at, amount_sats)
      VALUES (?, ?, ?)
      ON CONFLICT(pubkey) DO UPDATE SET
        paid_at = excluded.paid_at,
        amount_sats = excluded.amount_sats
    `).bind(pubkey, Math.floor(Date.now() / 1000), RELAY_ACCESS_PRICE_SATS).run();
    return true;
  } catch (error) {
    console.error(`Error saving paid pubkey ${pubkey}:`, error);
    return false;
  }
}

// Fetches kind 0 event from fallback relay
function fetchEventFromFallbackRelay(pubkey: string): Promise<NostrEvent | null> {
  return new Promise((resolve, reject) => {
    const fallbackRelayUrl = 'wss://relay.nostr.band';
    const ws = new WebSocket(fallbackRelayUrl);
    let hasClosed = false;

    const closeWebSocket = (subscriptionId: string | null) => {
      if (!hasClosed && ws.readyState === WebSocket.OPEN) {
        if (subscriptionId) {
          ws.send(JSON.stringify(["CLOSE", subscriptionId]));
        }
        ws.close();
        hasClosed = true;
        console.log('WebSocket connection to fallback relay closed');
      }
    };

    ws.addEventListener('open', () => {
      console.log("WebSocket connection to fallback relay opened.");
      const subscriptionId = Math.random().toString(36).substr(2, 9);
      const filters = {
        kinds: [0],
        authors: [pubkey],
        limit: 1
      };
      const reqMessage = JSON.stringify(["REQ", subscriptionId, filters]);
      ws.send(reqMessage);
    });

    ws.addEventListener('message', event => {
      try {
        // @ts-ignore - Cloudflare Workers WebSocket event has data property
        const message = JSON.parse(event.data) as NostrMessage;

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
        console.error(`Error processing fallback relay event for pubkey ${pubkey}: ${error}`);
        reject(error);
      }
    });

    ws.addEventListener('error', (error: Event) => {
      console.error(`WebSocket error with fallback relay:`, error);
      ws.close();
      hasClosed = true;
      reject(error);
    });

    ws.addEventListener('close', () => {
      hasClosed = true;
      console.log('Fallback relay WebSocket connection closed.');
    });

    setTimeout(() => {
      if (!hasClosed) {
        console.log('Timeout reached. Closing WebSocket connection to fallback relay.');
        closeWebSocket(null);
        reject(new Error(`No response from fallback relay for pubkey ${pubkey}`));
      }
    }, 5000);
  });
}

// Fetch kind 0 event for pubkey
async function fetchKind0EventForPubkey(pubkey: string, env: Env): Promise<NostrEvent | null> {
  try {
    const filters = [{ kinds: [0], authors: [pubkey], limit: 1 }];
    const result = await queryEvents(filters, 'first-unconstrained', env);

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
    console.error(`Error fetching kind 0 event for pubkey ${pubkey}: ${error}`);
  }

  return null;
}

// NIP-05 validation
async function validateNIP05FromKind0(pubkey: string, env: Env): Promise<boolean> {
  try {
    // Fetch kind 0 event for the pubkey
    const metadataEvent = await fetchKind0EventForPubkey(pubkey, env);

    if (!metadataEvent) {
      console.error(`No kind 0 metadata event found for pubkey: ${pubkey}`);
      return false;
    }

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
    console.error(`Error validating NIP-05 for pubkey ${pubkey}: ${error}`);
    return false;
  }
}

async function validateNIP05(nip05Address: string, pubkey: string): Promise<boolean> {
  try {
    const [name, domain] = nip05Address.split('@');

    if (!domain) {
      throw new Error(`Invalid NIP-05 address format: ${nip05Address}`);
    }

    // Check blocked/allowed domains
    if (blockedNip05Domains.has(domain)) {
      console.error(`NIP-05 domain is blocked: ${domain}`);
      return false;
    }

    if (allowedNip05Domains.size > 0 && !allowedNip05Domains.has(domain)) {
      console.error(`NIP-05 domain is not allowed: ${domain}`);
      return false;
    }

    // Fetch the NIP-05 data
    const url = `https://${domain}/.well-known/nostr.json?name=${name}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch NIP-05 data from ${url}: ${response.statusText}`);
      return false;
    }

    const nip05Data = await response.json() as Nip05Response;

    if (!nip05Data.names || !nip05Data.names[name]) {
      console.error(`NIP-05 data does not contain a matching public key for ${name}`);
      return false;
    }

    const nip05Pubkey = nip05Data.names[name];
    return nip05Pubkey === pubkey;

  } catch (error) {
    console.error(`Error validating NIP-05 address: ${error}`);
    return false;
  }
}

// Query complexity calculation
function calculateQueryComplexity(filter: NostrFilter): number {
  let complexity = 0;

  // Base complexity
  complexity += (filter.ids?.length || 0) * 1;
  complexity += (filter.authors?.length || 0) * 2;
  complexity += (filter.kinds?.length || 0) * 5;

  // Tag filters are expensive
  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith('#') && Array.isArray(values)) {
      complexity += values.length * 10;
    }
  }

  // No time bounds is very expensive
  if (!filter.since && !filter.until) {
    complexity *= 2;
  }

  // Large limits are expensive
  if ((filter.limit || 0) > 1000) {
    complexity *= 1.5;
  }

  return complexity;
}

// Event processing
async function processEvent(event: NostrEvent, sessionId: string, env: Env): Promise<{ success: boolean; message: string; bookmark?: string }> {
  try {
    // Check cache for duplicate event ID using primary for consistency
    const session = env.RELAY_DATABASE.withSession('first-primary');
    const existingEvent = await session
      .prepare("SELECT id FROM events WHERE id = ? LIMIT 1")
      .bind(event.id)
      .first();

    if (existingEvent) {
      console.log(`Duplicate event detected: ${event.id}`);
      return { success: false, message: "duplicate: already have this event", bookmark: session.getBookmark() ?? undefined };
    }

    // NIP-05 validation if enabled (bypassed for kind 1059)
    if (event.kind !== 1059 && checkValidNip05 && event.kind !== 0) {
      const isValidNIP05 = await validateNIP05FromKind0(event.pubkey, env);
      if (!isValidNIP05) {
        console.error(`Event denied. NIP-05 validation failed for pubkey ${event.pubkey}.`);
        return { success: false, message: "invalid: NIP-05 validation failed" };
      }
    }

    // Handle deletion events
    if (event.kind === 5) {
      return await processDeletionEvent(event, env);
    }

    // Save event directly to database
    return await saveEventToDatabase(event, env);

  } catch (error: any) {
    console.error(`Error processing event: ${error.message}`);
    return { success: false, message: `error: ${error.message}` };
  }
}

// Save event directly to D1 database
async function saveEventToDatabase(event: NostrEvent, env: Env): Promise<{ success: boolean; message: string; bookmark?: string }> {
  try {
    // Check worker cache for duplicate event ID
    const cache = caches.default;
    const cacheKey = new Request(`https://event-cache/${event.id}`);
    const cached = await cache.match(cacheKey);
    if (cached) {
      return { success: false, message: "duplicate: event already exists" };
    }

    const session = env.RELAY_DATABASE.withSession('first-primary');

    // Check D1 for duplicate event ID
    const existingEvent = await session.prepare("SELECT id FROM events WHERE id = ? LIMIT 1").bind(event.id).first();
    if (existingEvent) {
      return { success: false, message: "duplicate: event already exists", bookmark: session.getBookmark() ?? undefined };
    }

    // Check for duplicate content (only if anti-spam is enabled)
    let contentHash: string | null = null;
    if (shouldCheckForDuplicates(event.kind)) {
      contentHash = await hashContent(event);

      // Check D1 for existing content hash
      const duplicateContent = enableGlobalDuplicateCheck
        ? await session.prepare("SELECT event_id FROM content_hashes WHERE hash = ? LIMIT 1").bind(contentHash).first()
        : await session.prepare("SELECT event_id FROM content_hashes WHERE hash = ? AND pubkey = ? LIMIT 1").bind(contentHash, event.pubkey).first();

      if (duplicateContent) {
        return { success: false, message: "duplicate: content already exists", bookmark: session.getBookmark() ?? undefined };
      }
    }

    // Process tags and extract common tag values
    const tagInserts: Array<{ name: string; value: string }> = [];
    let tagP: string | null = null;
    let tagE: string | null = null;
    let tagA: string | null = null;
    let tagT: string | null = null;
    let tagD: string | null = null;
    let tagR: string | null = null;
    let tagL: string | null = null;
    let tagS: string | null = null;
    let tagU: string | null = null;

    for (const tag of event.tags) {
      if (tag[0]) {
        tagInserts.push({
          name: tag[0],
          value: tag[1] || ''
        });

        // Capture first occurrence of common tags
        if (tag[0] === 'p' && !tagP) tagP = tag[1];
        if (tag[0] === 'e' && !tagE) tagE = tag[1];
        if (tag[0] === 'a' && !tagA) tagA = tag[1];
        if (tag[0] === 't' && !tagT) tagT = tag[1];
        if (tag[0] === 'd' && !tagD) tagD = tag[1];
        if (tag[0] === 'r' && !tagR) tagR = tag[1];
        if (tag[0] === 'L' && !tagL) tagL = tag[1];
        if (tag[0] === 's' && !tagS) tagS = tag[1];
        if (tag[0] === 'u' && !tagU) tagU = tag[1];
      }
    }

    // Extract thread metadata
    const eTags = tagInserts.filter(t => t.name === 'e').map(t => t.value);
    const replyToEventId = eTags.length > 0 ? eTags[0] : null;
    const rootEventId = eTags.length > 1 ? eTags[eTags.length - 1] : null;
    const contentPreview = event.content.substring(0, 100);

    // Insert the main event
    const insertResult = await session.prepare(`
      INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig, tag_p, tag_e, tag_a, tag_t, tag_d, tag_r, tag_L, tag_s, tag_u, reply_to_event_id, root_event_id, content_preview)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).bind(
      event.id,
      event.pubkey,
      event.created_at,
      event.kind,
      JSON.stringify(event.tags),
      event.content,
      event.sig,
      tagP,
      tagE,
      tagA,
      tagT,
      tagD,
      tagR,
      tagL,
      tagS,
      tagU,
      replyToEventId,
      rootEventId,
      contentPreview
    ).run();

    // Check if the event was actually inserted (not a duplicate that slipped through)
    if (insertResult.meta.changes === 0) {
      console.log(`Event ${event.id} already exists in database (race condition duplicate)`);
      return { success: false, message: "duplicate: event already exists", bookmark: session.getBookmark() ?? undefined };
    }

    // Only insert tags if the event was successfully inserted
    if (tagInserts.length > 0) {
      for (let j = 0; j < tagInserts.length; j += 50) {
        const tagChunk = tagInserts.slice(j, j + 50);
        const tagBatch = tagChunk.map(t =>
          session.prepare(`
            INSERT INTO tags (event_id, tag_name, tag_value)
            VALUES (?, ?, ?)
          `).bind(event.id, t.name, t.value)
        );

        if (tagBatch.length > 0) {
          await session.batch(tagBatch);
        }
      }
    }

    // Update event tags cache for common tags (legacy single-value cache)
    if (tagP || tagE || tagA) {
      await session.prepare(`
        INSERT INTO event_tags_cache (event_id, pubkey, kind, created_at, tag_p, tag_e, tag_a)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id) DO UPDATE SET
          tag_p = excluded.tag_p,
          tag_e = excluded.tag_e,
          tag_a = excluded.tag_a
      `).bind(
        event.id,
        event.pubkey,
        event.kind,
        event.created_at,
        tagP,
        tagE,
        tagA
      ).run();
    }

    // Insert ALL p/e/a/t/d/r/L/s/u tags into multi-value cache
    // Chunk in batches of 50 to stay well under D1's 100 statement batch limit
    const cacheableTags = tagInserts.filter(t => ['p', 'e', 'a', 't', 'd', 'r', 'L', 's', 'u'].includes(t.name));
    if (cacheableTags.length > 0) {
      for (let j = 0; j < cacheableTags.length; j += 50) {
        const cacheChunk = cacheableTags.slice(j, j + 50);
        const cacheBatch = cacheChunk.map(t =>
          session.prepare(`
            INSERT OR IGNORE INTO event_tags_cache_multi (event_id, pubkey, kind, created_at, tag_type, tag_value)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(event.id, event.pubkey, event.kind, event.created_at, t.name, t.value)
        );
        await session.batch(cacheBatch);
      }
    }

    // Insert content hash if present
    if (contentHash) {
      await session.prepare(`
        INSERT INTO content_hashes (hash, event_id, pubkey, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(hash) DO NOTHING
      `).bind(contentHash, event.id, event.pubkey, event.created_at).run();
    }

    // Cache the event ID in worker cache to prevent duplicates
    await cache.put(cacheKey, new Response('cached', {
      headers: {
        'Cache-Control': 'max-age=3600'
      }
    }));

    console.log(`Event ${event.id} saved directly to database`);
    return { success: true, message: "Event saved successfully", bookmark: session.getBookmark() ?? undefined };

  } catch (error: any) {
    console.error(`Error saving event to database: ${error.message}`);
    console.error(`Event details: ID=${event.id}, Kind=${event.kind}, Tags count=${event.tags.length}`);
    return { success: false, message: `error: ${error.message}` };
  }
}

// Helper function for kind 5
async function processDeletionEvent(event: NostrEvent, env: Env): Promise<{ success: boolean; message: string; bookmark?: string }> {
  console.log(`Processing deletion event ${event.id}`);
  const deletedEventIds = event.tags.filter(tag => tag[0] === "e").map(tag => tag[1]);

  const session = env.RELAY_DATABASE.withSession('first-primary');

  if (deletedEventIds.length === 0) {
    return { success: true, message: "No events to delete", bookmark: session.getBookmark() ?? undefined };
  }

  let deletedCount = 0;
  const errors: string[] = [];

  for (const eventId of deletedEventIds) {
    try {
      // Check if the event exists in D1
      const existing = await session.prepare(
        "SELECT pubkey FROM events WHERE id = ? LIMIT 1"
      ).bind(eventId).first();

      // If event doesn't exist in D1, skip (events in queue will be processed later)
      if (!existing) {
        console.warn(`Event ${eventId} not found in D1. Nothing to delete (may be in queue).`);
        continue;
      }

      // Check ownership
      if (existing.pubkey !== event.pubkey) {
        console.warn(`Event ${eventId} does not belong to pubkey ${event.pubkey}. Skipping deletion.`);
        errors.push(`unauthorized: cannot delete event ${eventId} - wrong pubkey`);
        continue;
      }

      // Delete from D1
      // Delete associated tags first (due to foreign key constraint)
      await session.prepare(
        "DELETE FROM tags WHERE event_id = ?"
      ).bind(eventId).run();

      // Delete from content_hashes if exists
      await session.prepare(
        "DELETE FROM content_hashes WHERE event_id = ?"
      ).bind(eventId).run();

      // Delete from event_tags_cache (both old and new)
      await session.prepare(
        "DELETE FROM event_tags_cache WHERE event_id = ?"
      ).bind(eventId).run();
      await session.prepare(
        "DELETE FROM event_tags_cache_multi WHERE event_id = ?"
      ).bind(eventId).run();

      // Now delete the event
      const result = await session.prepare(
        "DELETE FROM events WHERE id = ?"
      ).bind(eventId).run();

      if (result.meta.changes > 0) {
        console.log(`Event ${eventId} deleted from D1.`);
        deletedCount++;
      }
    } catch (error) {
      console.error(`Error deleting event ${eventId}:`, error);
      errors.push(`error deleting ${eventId}`);
    }
  }

  // Save the deletion event itself
  const saveResult = await saveEventToDatabase(event, env);

  if (errors.length > 0) {
    return { success: false, message: errors[0], bookmark: saveResult.bookmark ?? (session.getBookmark() ?? undefined) };
  }

  return {
    success: true,
    message: deletedCount > 0 ? `Successfully deleted ${deletedCount} event(s)` : "No matching events found to delete",
    bookmark: saveResult.bookmark ?? (session.getBookmark() ?? undefined)
  };
}

// Helper function to chunk arrays
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Build COUNT query for precheck
function buildCountQuery(filter: NostrFilter): { sql: string; params: any[] } {
  const params: any[] = [];
  const conditions: string[] = [];

  // Count and categorize tag filters
  const directTags: Array<{ name: string; values: string[] }> = []; // Tags with direct columns (p, e, a, t, d, r)
  const otherTags: Array<{ name: string; values: string[] }> = [];

  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith('#') && Array.isArray(values) && values.length > 0) {
      const tagName = key.substring(1);
      if (['p', 'e', 'a', 't', 'd', 'r', 'L', 's', 'u'].includes(tagName)) {
        directTags.push({ name: tagName, values });
      } else {
        otherTags.push({ name: tagName, values });
      }
    }
  }

  if (directTags.length > 0 && otherTags.length === 0) {
    if (directTags.length === 1) {
      const tagFilter = directTags[0];
      let sql = `SELECT COUNT(DISTINCT e.id) as count FROM events e
        INNER JOIN event_tags_cache_multi m ON e.id = m.event_id
        WHERE m.tag_type = ? AND m.tag_value IN (${tagFilter.values.map(() => '?').join(',')})`;
      params.push(tagFilter.name, ...tagFilter.values);

      if (filter.authors && filter.authors.length > 0) {
        sql += ` AND e.pubkey IN (${filter.authors.map(() => '?').join(',')})`;
        params.push(...filter.authors);
      }
      if (filter.kinds && filter.kinds.length > 0) {
        sql += ` AND e.kind IN (${filter.kinds.map(() => '?').join(',')})`;
        params.push(...filter.kinds);
      }
      if (filter.since) {
        sql += " AND e.created_at >= ?";
        params.push(filter.since);
      }
      if (filter.until) {
        sql += " AND e.created_at <= ?";
        params.push(filter.until);
      }
      return { sql, params };
    } else {
      const tagJoins = directTags.map((t, i) => {
        const alias = `m${i}`;
        const placeholders = t.values.map(() => '?').join(',');
        return `INNER JOIN event_tags_cache_multi ${alias} ON e.id = ${alias}.event_id AND ${alias}.tag_type = ? AND ${alias}.tag_value IN (${placeholders})`;
      }).join('\n        ');

      let sql = `SELECT COUNT(DISTINCT e.id) as count FROM events e
        ${tagJoins}
        WHERE 1=1`;

      for (const tagFilter of directTags) {
        params.push(tagFilter.name, ...tagFilter.values);
      }

      if (filter.authors && filter.authors.length > 0) {
        sql += ` AND e.pubkey IN (${filter.authors.map(() => '?').join(',')})`;
        params.push(...filter.authors);
      }
      if (filter.kinds && filter.kinds.length > 0) {
        sql += ` AND e.kind IN (${filter.kinds.map(() => '?').join(',')})`;
        params.push(...filter.kinds);
      }
      if (filter.since) {
        sql += " AND e.created_at >= ?";
        params.push(filter.since);
      }
      if (filter.until) {
        sql += " AND e.created_at <= ?";
        params.push(filter.until);
      }
      return { sql, params };
    }
  }

  // Has non-cacheable tags
  if (directTags.length > 0 || otherTags.length > 0) {
    const allTags = [...directTags, ...otherTags];

    if (allTags.length === 1) {
      const tagFilter = allTags[0];
      let sql = `SELECT COUNT(DISTINCT e.id) as count FROM events e
        INNER JOIN tags t ON e.id = t.event_id
        WHERE t.tag_name = ? AND t.tag_value IN (${tagFilter.values.map(() => '?').join(',')})`;
      params.push(tagFilter.name, ...tagFilter.values);

      if (filter.authors && filter.authors.length > 0) {
        sql += ` AND e.pubkey IN (${filter.authors.map(() => '?').join(',')})`;
        params.push(...filter.authors);
      }
      if (filter.kinds && filter.kinds.length > 0) {
        sql += ` AND e.kind IN (${filter.kinds.map(() => '?').join(',')})`;
        params.push(...filter.kinds);
      }
      if (filter.since) {
        sql += " AND e.created_at >= ?";
        params.push(filter.since);
      }
      if (filter.until) {
        sql += " AND e.created_at <= ?";
        params.push(filter.until);
      }
      return { sql, params };
    } else {
      // Multiple tags
      const tagConditions = allTags.map(t => {
        const placeholders = t.values.map(() => '?').join(',');
        return `(t.tag_name = ? AND t.tag_value IN (${placeholders}))`;
      }).join(' OR ');

      for (const tagFilter of allTags) {
        params.push(tagFilter.name, ...tagFilter.values);
      }

      let sql = `SELECT COUNT(DISTINCT e.id) as count FROM events e
        INNER JOIN tags t ON e.id = t.event_id
        WHERE ${tagConditions}`;

      if (filter.authors && filter.authors.length > 0) {
        sql += ` AND e.pubkey IN (${filter.authors.map(() => '?').join(',')})`;
        params.push(...filter.authors);
      }
      if (filter.kinds && filter.kinds.length > 0) {
        sql += ` AND e.kind IN (${filter.kinds.map(() => '?').join(',')})`;
        params.push(...filter.kinds);
      }
      if (filter.since) {
        sql += " AND e.created_at >= ?";
        params.push(filter.since);
      }
      if (filter.until) {
        sql += " AND e.created_at <= ?";
        params.push(filter.until);
      }

      sql += ` GROUP BY e.id HAVING COUNT(DISTINCT t.tag_name) = ?`;
      params.push(allTags.length);

      // Wrap in outer SELECT to count
      sql = `SELECT COUNT(*) as count FROM (${sql})`;
      return { sql, params };
    }
  }

  // No tag filters
  let sql = "SELECT COUNT(*) as count FROM events";

  if (filter.ids && filter.ids.length > 0) {
    conditions.push(`id IN (${filter.ids.map(() => '?').join(',')})`);
    params.push(...filter.ids);
  }
  if (filter.authors && filter.authors.length > 0) {
    conditions.push(`pubkey IN (${filter.authors.map(() => '?').join(',')})`);
    params.push(...filter.authors);
  }
  if (filter.kinds && filter.kinds.length > 0) {
    conditions.push(`kind IN (${filter.kinds.map(() => '?').join(',')})`);
    params.push(...filter.kinds);
  }
  if (filter.since) {
    conditions.push("created_at >= ?");
    params.push(filter.since);
  }
  if (filter.until) {
    conditions.push("created_at <= ?");
    params.push(filter.until);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  return { sql, params };
}

// Query builder
function buildQuery(filter: NostrFilter): { sql: string; params: any[] } {
  const params: any[] = [];
  const conditions: string[] = [];

  // Count and categorize tag filters
  let tagCount = 0;
  const directTags: Array<{ name: string; values: string[] }> = []; // Tags with direct columns (p, e, a, t, d, r, L, s, u)
  const otherTags: Array<{ name: string; values: string[] }> = [];

  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith('#') && Array.isArray(values) && values.length > 0) {
      tagCount += values.length;
      const tagName = key.substring(1);

      // Check if this tag has a direct column in events table (p, e, a, t, d, r, L, s, u)
      if (['p', 'e', 'a', 't', 'd', 'r', 'L', 's', 'u'].includes(tagName)) {
        directTags.push({ name: tagName, values });
      } else {
        otherTags.push({ name: tagName, values });
      }
    }
  }

  if (directTags.length > 0 && otherTags.length === 0) {
    let sql: string;
    const whereConditions: string[] = [];

    if (directTags.length === 1) {
      // Single tag type query - use optimized single join
      const tagFilter = directTags[0];
      const hasKinds = filter.kinds && filter.kinds.length > 0;

      // Choose optimal index based on query pattern
      let indexHint = "";
      if (hasKinds && filter.kinds!.length <= 10) {
        indexHint = " INDEXED BY idx_cache_multi_kind_type_value";
      } else {
        indexHint = " INDEXED BY idx_cache_multi_type_value_time";
      }

      sql = `SELECT DISTINCT e.* FROM events e
        INNER JOIN event_tags_cache_multi m${indexHint} ON e.id = m.event_id
        WHERE m.tag_type = ? AND m.tag_value IN (${tagFilter.values.map(() => '?').join(',')})`;
      params.push(tagFilter.name, ...tagFilter.values);
    } else {
      // Multiple tag types - need to match ALL tag conditions
      const tagConditions = directTags.map((t, i) => {
        const alias = `m${i}`;
        const placeholders = t.values.map(() => '?').join(',');
        return `INNER JOIN event_tags_cache_multi ${alias} ON e.id = ${alias}.event_id AND ${alias}.tag_type = ? AND ${alias}.tag_value IN (${placeholders})`;
      }).join('\n        ');

      sql = `SELECT DISTINCT e.* FROM events e
        ${tagConditions}
        WHERE 1=1`;

      for (const tagFilter of directTags) {
        params.push(tagFilter.name, ...tagFilter.values);
      }
    }

    if (filter.ids && filter.ids.length > 0) {
      whereConditions.push(`e.id IN (${filter.ids.map(() => '?').join(',')})`);
      params.push(...filter.ids);
    }

    if (filter.authors && filter.authors.length > 0) {
      whereConditions.push(`e.pubkey IN (${filter.authors.map(() => '?').join(',')})`);
      params.push(...filter.authors);
    }

    if (filter.kinds && filter.kinds.length > 0) {
      whereConditions.push(`e.kind IN (${filter.kinds.map(() => '?').join(',')})`);
      params.push(...filter.kinds);
    }

    if (filter.since) {
      whereConditions.push("e.created_at >= ?");
      params.push(filter.since);
    }

    if (filter.until) {
      whereConditions.push("e.created_at <= ?");
      params.push(filter.until);
    }

    if (filter.cursor) {
      const [timestamp, lastId] = filter.cursor.split(':');
      whereConditions.push("(e.created_at < ? OR (e.created_at = ? AND e.id > ?))");
      params.push(parseInt(timestamp), parseInt(timestamp), lastId);
    }

    if (whereConditions.length > 0) {
      sql += " AND " + whereConditions.join(" AND ");
    }

    sql += " ORDER BY e.created_at DESC LIMIT ?";
    params.push(Math.min(filter.limit || 500, 500));

    return { sql, params };
  }

  // Has any non-cacheable tags
  if (tagCount > 0) {
    const allTags = [...directTags, ...otherTags];

    // Single tag filter
    if (allTags.length === 1) {
      const tagFilter = allTags[0];
      let sql = `SELECT e.* FROM events e
        INNER JOIN tags t ON e.id = t.event_id
        WHERE t.tag_name = ? AND t.tag_value IN (${tagFilter.values.map(() => '?').join(',')})`;

      params.push(tagFilter.name, ...tagFilter.values);

      const whereConditions: string[] = [];

      if (filter.ids && filter.ids.length > 0) {
        whereConditions.push(`e.id IN (${filter.ids.map(() => '?').join(',')})`);
        params.push(...filter.ids);
      }

      if (filter.authors && filter.authors.length > 0) {
        whereConditions.push(`e.pubkey IN (${filter.authors.map(() => '?').join(',')})`);
        params.push(...filter.authors);
      }

      if (filter.kinds && filter.kinds.length > 0) {
        whereConditions.push(`e.kind IN (${filter.kinds.map(() => '?').join(',')})`);
        params.push(...filter.kinds);
      }

      if (filter.since) {
        whereConditions.push("e.created_at >= ?");
        params.push(filter.since);
      }

      if (filter.until) {
        whereConditions.push("e.created_at <= ?");
        params.push(filter.until);
      }

      // Cursor-based pagination support
      if (filter.cursor) {
        const [timestamp, lastId] = filter.cursor.split(':');
        whereConditions.push("(e.created_at < ? OR (e.created_at = ? AND e.id > ?))");
        params.push(parseInt(timestamp), parseInt(timestamp), lastId);
      }

      if (whereConditions.length > 0) {
        sql += " AND " + whereConditions.join(" AND ");
      }

      sql += " ORDER BY e.created_at DESC";
      sql += " LIMIT ?";
      params.push(Math.min(filter.limit || 500, 500));

      return { sql, params };
    }

    // Multiple tags
    const tagConditions = allTags.map(t => {
      const placeholders = t.values.map(() => '?').join(',');
      return `(t.tag_name = ? AND t.tag_value IN (${placeholders}))`;
    }).join(' OR ');

    // Add all parameters
    for (const tagFilter of allTags) {
      params.push(tagFilter.name, ...tagFilter.values);
    }

    let sql = `SELECT e.* FROM events e
      INNER JOIN tags t ON e.id = t.event_id
      WHERE ${tagConditions}`;

    const whereConditions: string[] = [];

    if (filter.ids && filter.ids.length > 0) {
      whereConditions.push(`e.id IN (${filter.ids.map(() => '?').join(',')})`);
      params.push(...filter.ids);
    }

    if (filter.authors && filter.authors.length > 0) {
      whereConditions.push(`e.pubkey IN (${filter.authors.map(() => '?').join(',')})`);
      params.push(...filter.authors);
    }

    if (filter.kinds && filter.kinds.length > 0) {
      whereConditions.push(`e.kind IN (${filter.kinds.map(() => '?').join(',')})`);
      params.push(...filter.kinds);
    }

    if (filter.since) {
      whereConditions.push("e.created_at >= ?");
      params.push(filter.since);
    }

    if (filter.until) {
      whereConditions.push("e.created_at <= ?");
      params.push(filter.until);
    }

    // Cursor-based pagination support
    if (filter.cursor) {
      const [timestamp, lastId] = filter.cursor.split(':');
      whereConditions.push("(e.created_at < ? OR (e.created_at = ? AND e.id > ?))");
      params.push(parseInt(timestamp), parseInt(timestamp), lastId);
    }

    if (whereConditions.length > 0) {
      sql += " AND " + whereConditions.join(" AND ");
    }

    sql += " GROUP BY e.id, e.pubkey, e.created_at, e.kind, e.tags, e.content, e.sig";
    sql += ` HAVING COUNT(DISTINCT t.tag_name) = ?`;
    params.push(allTags.length);

    sql += " ORDER BY e.created_at DESC";
    sql += " LIMIT ?";
    params.push(Math.min(filter.limit || 500, 500));

    return { sql, params };
  }

  // No tag filters - standard query with index hints
  let indexHint = "";

  const hasAuthors = filter.authors && filter.authors.length > 0;
  const hasKinds = filter.kinds && filter.kinds.length > 0;
  const hasTimeRange = filter.since || filter.until;
  const authorCount = filter.authors?.length || 0;
  const kindCount = filter.kinds?.length || 0;

  // Choose optimal index based on query pattern
  if (hasAuthors && hasKinds && authorCount <= 10 && kindCount <= 10) {
    if (authorCount <= kindCount) {
      indexHint = " INDEXED BY idx_events_pubkey_kind_created_at";
    } else {
      indexHint = " INDEXED BY idx_events_kind_pubkey_created_at";
    }
  } else if (hasAuthors && authorCount <= 5 && !hasKinds) {
    indexHint = " INDEXED BY idx_events_pubkey_created_at";
  } else if (hasKinds && kindCount <= 5 && !hasAuthors) {
    indexHint = " INDEXED BY idx_events_kind_created_at";
  } else if (hasAuthors && hasKinds && authorCount > 10) {
    indexHint = " INDEXED BY idx_events_kind_created_at";
  } else if (!hasAuthors && !hasKinds && hasTimeRange) {
    indexHint = " INDEXED BY idx_events_created_at";
  }

  let sql = `SELECT * FROM events${indexHint}`;

  if (filter.ids && filter.ids.length > 0) {
    conditions.push(`id IN (${filter.ids.map(() => '?').join(',')})`);
    params.push(...filter.ids);
  }

  if (filter.authors && filter.authors.length > 0) {
    conditions.push(`pubkey IN (${filter.authors.map(() => '?').join(',')})`);
    params.push(...filter.authors);
  }

  if (filter.kinds && filter.kinds.length > 0) {
    conditions.push(`kind IN (${filter.kinds.map(() => '?').join(',')})`);
    params.push(...filter.kinds);
  }

  if (filter.since) {
    conditions.push("created_at >= ?");
    params.push(filter.since);
  }

  if (filter.until) {
    conditions.push("created_at <= ?");
    params.push(filter.until);
  }

  // Cursor-based pagination support
  if (filter.cursor) {
    const [timestamp, lastId] = filter.cursor.split(':');
    conditions.push("(created_at < ? OR (created_at = ? AND id > ?))");
    params.push(parseInt(timestamp), parseInt(timestamp), lastId);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY created_at DESC";
  sql += " LIMIT ?";
  params.push(Math.min(filter.limit || 500, 500));

  return { sql, params };
}

// Helper function to handle chunked queries
async function queryDatabaseChunked(filter: NostrFilter, bookmark: string, env: Env): Promise<{ events: NostrEvent[] }> {
  const session = env.RELAY_DATABASE.withSession(bookmark);
  const allRows = new Map<string, any>(); // Collect rows first, dedupe by ID

  // Create a base filter with everything except the large arrays
  const baseFilter: NostrFilter = { ...filter };
  const needsChunking = {
    ids: false,
    authors: false,
    kinds: false,
    tags: {} as Record<string, boolean>
  };

  // Identify what needs chunking and remove from base filter
  if (filter.ids && filter.ids.length > CHUNK_SIZE) {
    needsChunking.ids = true;
    delete baseFilter.ids;
  }

  if (filter.authors && filter.authors.length > CHUNK_SIZE) {
    needsChunking.authors = true;
    delete baseFilter.authors;
  }

  if (filter.kinds && filter.kinds.length > CHUNK_SIZE) {
    needsChunking.kinds = true;
    delete baseFilter.kinds;
  }

  // Check tag filters
  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith('#') && Array.isArray(values) && values.length > CHUNK_SIZE) {
      needsChunking.tags[key] = true;
      delete baseFilter[key];
    }
  }

  // Helper function to process string array chunks
  const processStringChunks = async (filterType: 'ids' | 'authors' | string, values: string[]) => {
    const chunks = chunkArray(values, CHUNK_SIZE);

    for (const chunk of chunks) {
      const chunkFilter = { ...baseFilter };

      if (filterType === 'ids') {
        chunkFilter.ids = chunk;
      } else if (filterType === 'authors') {
        chunkFilter.authors = chunk;
      } else if (filterType.startsWith('#')) {
        chunkFilter[filterType] = chunk;
      }

      const query = buildQuery(chunkFilter);

      try {
        const result = await session.prepare(query.sql)
          .bind(...query.params)
          .all();

        for (const row of result.results) {
          allRows.set(row.id as string, row);
        }
      } catch (error) {
        console.error(`Error in chunk query: ${error}`);
      }
    }
  };

  // Helper function to process number array chunks
  const processNumberChunks = async (filterType: 'kinds', values: number[]) => {
    const chunks = chunkArray(values, CHUNK_SIZE);

    for (const chunk of chunks) {
      const chunkFilter = { ...baseFilter };
      chunkFilter.kinds = chunk;

      const query = buildQuery(chunkFilter);

      try {
        const result = await session.prepare(query.sql)
          .bind(...query.params)
          .all();

        for (const row of result.results) {
          allRows.set(row.id as string, row);
        }
      } catch (error) {
        console.error(`Error in chunk query: ${error}`);
      }
    }
  };

  // Process each filter type that needs chunking
  if (needsChunking.ids && filter.ids) {
    await processStringChunks('ids', filter.ids);
  }

  if (needsChunking.authors && filter.authors) {
    await processStringChunks('authors', filter.authors);
  }

  if (needsChunking.kinds && filter.kinds) {
    await processNumberChunks('kinds', filter.kinds);
  }

  // Process tag filters
  for (const [tagKey, _] of Object.entries(needsChunking.tags)) {
    const tagValues = filter[tagKey];
    if (Array.isArray(tagValues) && tagValues.every((v: any) => typeof v === 'string')) {
      await processStringChunks(tagKey, tagValues as string[]);
    }
  }

  // If nothing needed chunking, just run the query as-is
  if (!needsChunking.ids && !needsChunking.authors && !needsChunking.kinds && Object.keys(needsChunking.tags).length === 0) {
    const query = buildQuery(filter);

    try {
      const result = await session.prepare(query.sql)
        .bind(...query.params)
        .all();

      for (const row of result.results) {
        allRows.set(row.id as string, row);
      }
    } catch (error) {
      console.error(`Error in query: ${error}`);
    }
  }

  // Build events from collected rows
  const events = Array.from(allRows.values()).map(row => ({
    id: row.id as string,
    pubkey: row.pubkey as string,
    created_at: row.created_at as number,
    kind: row.kind as number,
    tags: JSON.parse(row.tags as string),
    content: row.content as string,
    sig: row.sig as string
  }));
  console.log(`Found ${events.length} events (chunked)`);

  return { events };
}

// Query handling
async function queryEvents(filters: NostrFilter[], bookmark: string, env: Env): Promise<QueryResult> {
  try {
    console.log(`Processing query with ${filters.length} filters and bookmark: ${bookmark}`);
    const session = env.RELAY_DATABASE.withSession(bookmark);
    const eventSet = new Map<string, NostrEvent>();

    // Separate filters into chunked vs batchable
    const chunkedFilters: NostrFilter[] = [];
    const batchableFilters: NostrFilter[] = [];

    for (const filter of filters) {
      // Check query complexity
      const complexity = calculateQueryComplexity(filter);
      if (complexity > MAX_QUERY_COMPLEXITY) {
        console.warn(`Query too complex (complexity: ${complexity}), skipping filter`);
        continue;
      }

      // Check if any array in the filter exceeds chunk size
      const needsChunking = (
        (filter.ids && filter.ids.length > CHUNK_SIZE) ||
        (filter.authors && filter.authors.length > CHUNK_SIZE) ||
        (filter.kinds && filter.kinds.length > CHUNK_SIZE) ||
        Object.entries(filter).some(([key, values]) =>
          key.startsWith('#') && Array.isArray(values) && values.length > CHUNK_SIZE
        )
      );

      if (needsChunking) {
        chunkedFilters.push(filter);
      } else {
        batchableFilters.push(filter);
      }
    }

    // Execute chunked filters sequentially
    let totalEventsRead = 0;
    for (const filter of chunkedFilters) {
      if (totalEventsRead >= GLOBAL_MAX_EVENTS) {
        console.warn(`Global event limit reached (${GLOBAL_MAX_EVENTS}), stopping query`);
        break;
      }

      console.log(`Filter has arrays >${CHUNK_SIZE} items, using chunked query...`);
      const chunkedResult = await queryDatabaseChunked(filter, bookmark, env);
      for (const event of chunkedResult.events) {
        if (totalEventsRead >= GLOBAL_MAX_EVENTS) break;
        eventSet.set(event.id, event);
        totalEventsRead++;
      }
    }

    // Execute batchable filters in parallel using D1 batch API
    if (batchableFilters.length > 0 && totalEventsRead < GLOBAL_MAX_EVENTS) {
      // Precheck expensive tag queries with COUNT
      const validFilters: NostrFilter[] = [];
      for (const filter of batchableFilters) {
        // Only precheck if filter has tag filters
        const hasTagFilters = Object.keys(filter).some(key => key.startsWith('#'));

        if (hasTagFilters) {
          const countQuery = buildCountQuery(filter);
          const countResult = await session.prepare(countQuery.sql).bind(...countQuery.params).first() as { count: number } | null;
          const estimatedRows = (countResult?.count as number) || 0;

          if (estimatedRows > 10000) {
            console.warn(`Query precheck: estimated ${estimatedRows} rows, skipping filter to prevent timeout`);
            continue;
          } else {
            console.log(`Query precheck: estimated ${estimatedRows} rows, proceeding`);
          }
        }

        validFilters.push(filter);
      }

      if (validFilters.length === 0) {
        console.warn('All filters were too expensive after COUNT precheck');
      } else {
        const queries = validFilters.map(filter => {
          const query = buildQuery(filter);
          return session.prepare(query.sql).bind(...query.params);
        });

        try {
          const results = await session.batch(queries);

          // Collect all rows first
          const allRows: any[] = [];

          // Process all batch results
          for (let i = 0; i < results.length; i++) {
            const result = results[i];

            // Log query metadata for first result
            if (i === 0 && result.meta) {
              console.log({
                servedByRegion: result.meta.served_by_region ?? "",
                servedByPrimary: result.meta.served_by_primary ?? false,
                batchSize: results.length
              });
            }

            if (result.success && result.results) {
              for (const row of result.results as any[]) {
                if (totalEventsRead >= GLOBAL_MAX_EVENTS) break;
                allRows.push(row);
                totalEventsRead++;
              }
            } else if (!result.success) {
              console.error(`Batch query ${i} failed:`, result.error);
            }
          }

          // Build events from collected rows
          for (const row of allRows) {
            const event: NostrEvent = {
              id: row.id as string,
              pubkey: row.pubkey as string,
              created_at: row.created_at as number,
              kind: row.kind as number,
              tags: JSON.parse(row.tags as string),
              content: row.content as string,
              sig: row.sig as string
            };
            eventSet.set(event.id, event);
          }
        } catch (error: any) {
          console.error(`Batch query execution error: ${error.message}`);
          throw error;
        }
      }
    }

    const events = Array.from(eventSet.values()).sort((a, b) => {
      if (b.created_at !== a.created_at) {
        return b.created_at - a.created_at;
      }
      return a.id.localeCompare(b.id);
    });

    const newBookmark = session.getBookmark();
    console.log(`Found ${events.length} events. New bookmark: ${newBookmark}`);
    return { events, bookmark: newBookmark };

  } catch (error: any) {
    console.error(`Error querying events: ${error.message}`);
    return { events: [], bookmark: null };
  }
}

function handleRelayInfoRequest(request: Request): Response {
  const responseInfo = { ...relayInfo };

  if (PAY_TO_RELAY_ENABLED) {
    const url = new URL(request.url);
    responseInfo.payments_url = `${url.protocol}//${url.host}`;
    responseInfo.fees = {
      admission: [{ amount: RELAY_ACCESS_PRICE_SATS * 1000, unit: "msats" }]
    };
  }

  return new Response(JSON.stringify(responseInfo), {
    status: 200,
    headers: {
      "Content-Type": "application/nostr+json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Allow-Methods": "GET",
    }
  });
}

function serveLandingPage(): Response {
  const payToRelaySection = PAY_TO_RELAY_ENABLED ? `
    <div class="pay-section" id="paySection">
      <p style="margin-bottom: 1rem;">Pay to access this relay:</p>
      <button id="payButton" class="pay-button" data-npub="${relayNpub}" data-relays="wss://relay.damus.io,wss://relay.primal.net,wss://sendit.nosflare.com" data-sats-amount="${RELAY_ACCESS_PRICE_SATS}">
        <img src="https://nosflare.com/images/pwb-button-min.png" alt="Pay with Bitcoin" style="height: 60px;">
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
        
        .info-box, .pay-section {
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
        <img src="https://nosflare.com/images/nosflare.png" alt="Nosflare Logo" class="logo">
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
            <a href="https://nostr.com" class="link" target="_blank">Learn about Nostr</a>
        </div>
    </div>
    
    <div class="toast" id="toast">Copied to clipboard!</div>
    
    <script>
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const relayUrl = protocol + '//' + window.location.host;
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
            });
        }
        
        ${PAY_TO_RELAY_ENABLED ? `
        // Payment handling code
        let paymentCheckInterval;

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
                paySection.style.transition = 'opacity 0.3s ease-out';
                paySection.style.opacity = '0';
                
                setTimeout(() => {
                    paySection.style.display = 'none';
                    accessSection.style.display = 'block';
                    accessSection.style.opacity = '0';
                    accessSection.style.transition = 'opacity 0.3s ease-in';
                    
                    void accessSection.offsetHeight;
                    
                    accessSection.style.opacity = '1';
                }, 300);
            }
            
            if (paymentCheckInterval) {
                clearInterval(paymentCheckInterval);
                paymentCheckInterval = null;
            }
        }

        window.addEventListener('payment-success', async (event) => {
            console.log('Payment success event received');
            setTimeout(() => {
                showRelayAccess();
            }, 500);
        });

        async function initPayment() {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/gh/Spl0itable/nosflare@main/nostr-zap.js';
            script.onload = () => {
                if (window.nostrZap) {
                    window.nostrZap.initTargets('#payButton');
                    
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
            
            await checkPaymentStatus();
        }

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

async function serveFavicon(): Promise<Response> {
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

function handleNIP05Request(url: URL): Response {
  const name = url.searchParams.get("name");
  if (!name) {
    return new Response(JSON.stringify({ error: "Missing 'name' parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const pubkey = nip05Users[name.toLowerCase()];
  if (!pubkey) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  const response = {
    names: { [name]: pubkey },
    relays: { [pubkey]: [] }
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

async function handleCheckPayment(request: Request, env: Env): Promise<Response> {
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

async function handlePaymentNotification(request: Request, env: Env): Promise<Response> {
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

    const success = await savePaidPubkey(pubkey, env);

    return new Response(JSON.stringify({
      success,
      message: success ? 'Payment recorded successfully' : 'Failed to save payment'
    }), {
      status: success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error processing payment notification:', error);
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Multi-region DO selection logic with location hints
async function getOptimalDO(cf: any, env: Env, url: URL): Promise<{ stub: DurableObjectStub; doName: string }> {
  const continent = cf?.continent || 'NA';
  const country = cf?.country || 'US';
  const region = cf?.region || 'unknown';
  const colo = cf?.colo || 'unknown';

  console.log(`User location: continent=${continent}, country=${country}, region=${region}, colo=${colo}`);

  // All 9 endpoints with their location hints
  const ALL_ENDPOINTS = [
    { name: 'relay-WNAM-primary', hint: 'wnam' },
    { name: 'relay-ENAM-primary', hint: 'enam' },
    { name: 'relay-WEUR-primary', hint: 'weur' },
    { name: 'relay-EEUR-primary', hint: 'eeur' },
    { name: 'relay-APAC-primary', hint: 'apac' },
    { name: 'relay-OC-primary', hint: 'oc' },
    { name: 'relay-SAM-primary', hint: 'sam' },
    { name: 'relay-AFR-primary', hint: 'afr' },
    { name: 'relay-ME-primary', hint: 'me' }
  ];

  // Country to hint mapping
  const countryToHint: Record<string, string> = {
    // North America
    'US': 'enam', 'CA': 'enam', 'MX': 'wnam',

    // Central America & Caribbean (route to WNAM)
    'GT': 'wnam', 'BZ': 'wnam', 'SV': 'wnam', 'HN': 'wnam', 'NI': 'wnam',
    'CR': 'wnam', 'PA': 'wnam', 'CU': 'wnam', 'DO': 'wnam', 'HT': 'wnam',
    'JM': 'wnam', 'PR': 'wnam', 'TT': 'wnam', 'BB': 'wnam',

    // South America
    'BR': 'sam', 'AR': 'sam', 'CL': 'sam', 'CO': 'sam', 'PE': 'sam',
    'VE': 'sam', 'EC': 'sam', 'BO': 'sam', 'PY': 'sam', 'UY': 'sam',
    'GY': 'sam', 'SR': 'sam', 'GF': 'sam',

    // Western Europe
    'GB': 'weur', 'FR': 'weur', 'DE': 'weur', 'ES': 'weur', 'IT': 'weur',
    'NL': 'weur', 'BE': 'weur', 'CH': 'weur', 'AT': 'weur', 'PT': 'weur',
    'IE': 'weur', 'LU': 'weur', 'MC': 'weur', 'AD': 'weur', 'SM': 'weur',
    'VA': 'weur', 'LI': 'weur', 'MT': 'weur',

    // Nordic countries (route to WEUR)
    'SE': 'weur', 'NO': 'weur', 'DK': 'weur', 'FI': 'weur', 'IS': 'weur',

    // Eastern Europe
    'PL': 'eeur', 'RU': 'eeur', 'UA': 'eeur', 'RO': 'eeur', 'CZ': 'eeur',
    'HU': 'eeur', 'GR': 'eeur', 'BG': 'eeur', 'SK': 'eeur', 'HR': 'eeur',
    'RS': 'eeur', 'SI': 'eeur', 'BA': 'eeur', 'AL': 'eeur', 'MK': 'eeur',
    'ME': 'eeur', 'XK': 'eeur', 'BY': 'eeur', 'MD': 'eeur', 'LT': 'eeur',
    'LV': 'eeur', 'EE': 'eeur', 'CY': 'eeur',

    // Asia-Pacific
    'JP': 'apac', 'CN': 'apac', 'KR': 'apac', 'IN': 'apac', 'SG': 'apac',
    'TH': 'apac', 'ID': 'apac', 'MY': 'apac', 'VN': 'apac', 'PH': 'apac',
    'TW': 'apac', 'HK': 'apac', 'MO': 'apac', 'KH': 'apac', 'LA': 'apac',
    'MM': 'apac', 'BD': 'apac', 'LK': 'apac', 'NP': 'apac', 'BT': 'apac',
    'MV': 'apac', 'PK': 'apac', 'AF': 'apac', 'MN': 'apac', 'KP': 'apac',
    'BN': 'apac', 'TL': 'apac', 'PG': 'apac', 'FJ': 'apac', 'SB': 'apac',
    'VU': 'apac', 'NC': 'apac', 'PF': 'apac', 'WS': 'apac', 'TO': 'apac',
    'KI': 'apac', 'PW': 'apac', 'MH': 'apac', 'FM': 'apac', 'NR': 'apac',
    'TV': 'apac', 'CK': 'apac', 'NU': 'apac', 'TK': 'apac', 'GU': 'apac',
    'MP': 'apac', 'AS': 'apac',

    // Oceania
    'AU': 'oc', 'NZ': 'oc',

    // Middle East
    'AE': 'me', 'SA': 'me', 'IL': 'me', 'TR': 'me', 'EG': 'me',
    'IQ': 'me', 'IR': 'me', 'SY': 'me', 'JO': 'me', 'LB': 'me',
    'KW': 'me', 'QA': 'me', 'BH': 'me', 'OM': 'me', 'YE': 'me',
    'PS': 'me', 'GE': 'me', 'AM': 'me', 'AZ': 'me',

    // Africa
    'ZA': 'afr', 'NG': 'afr', 'KE': 'afr', 'MA': 'afr', 'TN': 'afr',
    'DZ': 'afr', 'LY': 'afr', 'ET': 'afr', 'GH': 'afr', 'TZ': 'afr',
    'UG': 'afr', 'SD': 'afr', 'AO': 'afr', 'MZ': 'afr', 'MG': 'afr',
    'CM': 'afr', 'CI': 'afr', 'NE': 'afr', 'BF': 'afr', 'ML': 'afr',
    'MW': 'afr', 'ZM': 'afr', 'SN': 'afr', 'SO': 'afr', 'TD': 'afr',
    'ZW': 'afr', 'GN': 'afr', 'RW': 'afr', 'BJ': 'afr', 'BI': 'afr',
    'TG': 'afr', 'SL': 'afr', 'LR': 'afr', 'MR': 'afr', 'CF': 'afr',
    'ER': 'afr', 'GM': 'afr', 'BW': 'afr', 'NA': 'afr', 'GA': 'afr',
    'LS': 'afr', 'GW': 'afr', 'GQ': 'afr', 'MU': 'afr', 'SZ': 'afr',
    'DJ': 'afr', 'KM': 'afr', 'CV': 'afr', 'SC': 'afr', 'ST': 'afr',
    'SS': 'afr', 'EH': 'afr', 'CG': 'afr', 'CD': 'afr',

    // Central Asia (route to APAC)
    'KZ': 'apac', 'UZ': 'apac', 'TM': 'apac', 'TJ': 'apac', 'KG': 'apac',
  };

  // US state-level routing
  const usStateToHint: Record<string, string> = {
    // Western states -> WNAM
    'California': 'wnam', 'Oregon': 'wnam', 'Washington': 'wnam', 'Nevada': 'wnam', 'Arizona': 'wnam',
    'Utah': 'wnam', 'Idaho': 'wnam', 'Montana': 'wnam', 'Wyoming': 'wnam', 'Colorado': 'wnam',
    'New Mexico': 'wnam', 'Alaska': 'wnam', 'Hawaii': 'wnam',

    // Eastern states -> ENAM
    'New York': 'enam', 'Florida': 'enam', 'Texas': 'enam', 'Illinois': 'enam', 'Georgia': 'enam',
    'Pennsylvania': 'enam', 'Ohio': 'enam', 'Michigan': 'enam', 'North Carolina': 'enam', 'Virginia': 'enam',
    'Massachusetts': 'enam', 'New Jersey': 'enam', 'Maryland': 'enam', 'Connecticut': 'enam', 'Maine': 'enam',
    'New Hampshire': 'enam', 'Vermont': 'enam', 'Rhode Island': 'enam', 'South Carolina': 'enam', 'Tennessee': 'enam',
    'Alabama': 'enam', 'Mississippi': 'enam', 'Louisiana': 'enam', 'Arkansas': 'enam', 'Missouri': 'enam',
    'Iowa': 'enam', 'Minnesota': 'enam', 'Wisconsin': 'enam', 'Indiana': 'enam', 'Kentucky': 'enam',
    'West Virginia': 'enam', 'Delaware': 'enam', 'Oklahoma': 'enam', 'Kansas': 'enam', 'Nebraska': 'enam',
    'South Dakota': 'enam', 'North Dakota': 'enam',

    // DC
    'District of Columbia': 'enam',
  };

  // Continent to hint fallback
  const continentToHint: Record<string, string> = {
    'NA': 'enam',
    'SA': 'sam',
    'EU': 'weur',
    'AS': 'apac',
    'AF': 'afr',
    'OC': 'oc'
  };

  // Determine best hint 
  let bestHint: string;

  // Only check US states if country is actually US
  if (country === 'US' && region && region !== 'unknown') {
    bestHint = usStateToHint[region] || 'enam';
  } else {
    // First try country mapping, then continent fallback
    bestHint = countryToHint[country] || continentToHint[continent] || 'enam';
  }

  // Find the primary endpoint based on hint
  const primaryEndpoint = ALL_ENDPOINTS.find(ep => ep.hint === bestHint) || ALL_ENDPOINTS[1]; // Default to ENAM

  // Order endpoints by proximity (primary first, then others)
  const orderedEndpoints = [
    primaryEndpoint,
    ...ALL_ENDPOINTS.filter(ep => ep.name !== primaryEndpoint.name)
  ];

  // Try each endpoint
  for (const endpoint of orderedEndpoints) {
    try {
      const id = env.RELAY_WEBSOCKET.idFromName(endpoint.name);
      const stub = env.RELAY_WEBSOCKET.get(id, { locationHint: endpoint.hint });

      console.log(`Connected to DO: ${endpoint.name} (hint: ${endpoint.hint})`);
      // @ts-ignore
      return { stub, doName: endpoint.name };
    } catch (error) {
      console.log(`Failed to connect to ${endpoint.name}: ${error}`);
    }
  }

  // Fallback to ENAM
  const fallback = ALL_ENDPOINTS[1]; // ENAM
  const id = env.RELAY_WEBSOCKET.idFromName(fallback.name);
  const stub = env.RELAY_WEBSOCKET.get(id, { locationHint: fallback.hint });
  console.log(`Fallback to DO: ${fallback.name} (hint: ${fallback.hint})`);
  // @ts-ignore
  return { stub, doName: fallback.name };
}

// Database pruning helper functions

// Get the current database size in bytes using SQLite pragmas
async function getDatabaseSizeBytes(session: D1DatabaseSession): Promise<number> {
  try {
    const pageCountResult = await session.prepare('PRAGMA page_count').first() as { page_count: number } | null;
    const pageSizeResult = await session.prepare('PRAGMA page_size').first() as { page_size: number } | null;

    if (pageCountResult && pageSizeResult) {
      return pageCountResult.page_count * pageSizeResult.page_size;
    }
    return 0;
  } catch (error) {
    console.error('Error getting database size:', error);
    return 0;
  }
}

// Prune old events to reduce database size
// Returns the number of events deleted
async function pruneOldEvents(session: D1DatabaseSession, targetSizeBytes: number): Promise<{ eventsDeleted: number; finalSizeBytes: number }> {
  let totalEventsDeleted = 0;
  let currentSize = await getDatabaseSizeBytes(session);

  console.log(`Starting database pruning. Current size: ${(currentSize / (1024 * 1024 * 1024)).toFixed(2)} GB, Target: ${(targetSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`);

  // Build the protected kinds clause for SQL
  const protectedKindsArray = Array.from(pruneProtectedKinds);
  const protectedKindsClause = protectedKindsArray.length > 0
    ? `AND kind NOT IN (${protectedKindsArray.join(',')})`
    : '';

  // Keep pruning in batches until we reach target size
  while (currentSize > targetSizeBytes) {
    // Find the oldest events (excluding protected kinds)
    const oldestEvents = await session.prepare(`
      SELECT id FROM events
      WHERE 1=1 ${protectedKindsClause}
      ORDER BY created_at ASC
      LIMIT ?
    `).bind(DB_PRUNE_BATCH_SIZE).all();

    if (!oldestEvents.results || oldestEvents.results.length === 0) {
      console.log('No more events eligible for pruning');
      break;
    }

    const eventIds = oldestEvents.results.map((row: any) => row.id as string);
    const placeholders = eventIds.map(() => '?').join(',');

    // Delete from events table (CASCADE will handle tags and content_hashes)
    const deleteResult = await session.prepare(`
      DELETE FROM events WHERE id IN (${placeholders})
    `).bind(...eventIds).run();

    const deletedCount = deleteResult.meta?.changes || eventIds.length;
    totalEventsDeleted += deletedCount;

    // Clean up cache tables that don't have CASCADE delete
    await session.prepare(`
      DELETE FROM event_tags_cache WHERE event_id IN (${placeholders})
    `).bind(...eventIds).run();

    await session.prepare(`
      DELETE FROM event_tags_cache_multi WHERE event_id IN (${placeholders})
    `).bind(...eventIds).run();

    // Also clean up mv_recent_notes
    await session.prepare(`
      DELETE FROM mv_recent_notes WHERE id IN (${placeholders})
    `).bind(...eventIds).run();

    // Clean up mv_timeline_cache
    await session.prepare(`
      DELETE FROM mv_timeline_cache WHERE event_id IN (${placeholders})
    `).bind(...eventIds).run();

    console.log(`Pruned ${deletedCount} events (total: ${totalEventsDeleted})`);

    // Check current size after deletion
    currentSize = await getDatabaseSizeBytes(session);
    console.log(`Current database size: ${(currentSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);

    // Safety break - don't delete more than 100,000 events in a single maintenance run
    if (totalEventsDeleted >= 100000) {
      console.log('Reached maximum pruning limit for this run (100,000 events)');
      break;
    }
  }

  return { eventsDeleted: totalEventsDeleted, finalSizeBytes: currentSize };
}

// Export functions for use by Durable Object
export {
  verifyEventSignature,
  hasPaidForRelay,
  processEvent,
  queryEvents,
  calculateQueryComplexity
};

// Main worker export with Durable Object
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Payment endpoints
      if (request.method === 'POST' && url.searchParams.has('notify-zap') && PAY_TO_RELAY_ENABLED) {
        return await handlePaymentNotification(request, env);
      }

      if (url.pathname === "/api/check-payment" && PAY_TO_RELAY_ENABLED) {
        return await handleCheckPayment(request, env);
      }

      // Main endpoints
      if (url.pathname === "/") {
        if (request.headers.get("Upgrade") === "websocket") {
          // Get Cloudflare location info
          const cf = (request as any).cf;

          // Get optimal DO based on user location
          const { stub, doName } = await getOptimalDO(cf, env, url);

          // Add location info to the request
          const newUrl = new URL(request.url);
          newUrl.searchParams.set('region', cf?.region || 'unknown');
          newUrl.searchParams.set('colo', cf?.colo || 'unknown');
          newUrl.searchParams.set('continent', cf?.continent || 'unknown');
          newUrl.searchParams.set('country', cf?.country || 'unknown');
          newUrl.searchParams.set('doName', doName);

          return stub.fetch(new Request(newUrl, request));
        } else if (request.headers.get("Accept") === "application/nostr+json") {
          return handleRelayInfoRequest(request);
        } else {
          // Initialize database in background
          ctx.waitUntil(
            initializeDatabase(env.RELAY_DATABASE)
              .catch(e => console.error("DB init error:", e))
          );
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
  },

  // Scheduled handler for 24hr database maintenance (runs daily at 00:00 UTC)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Running scheduled 24hr database maintenance...');

    try {
      const session = env.RELAY_DATABASE.withSession('first-primary');

      // Check database size and prune if necessary (D1 has a 10GB limit)
      if (DB_PRUNING_ENABLED) {
        const currentSizeBytes = await getDatabaseSizeBytes(session);
        const currentSizeGB = currentSizeBytes / (1024 * 1024 * 1024);
        console.log(`Current database size: ${currentSizeGB.toFixed(2)} GB (threshold: ${DB_SIZE_THRESHOLD_GB} GB)`);

        if (currentSizeGB >= DB_SIZE_THRESHOLD_GB) {
          console.log(`Database size (${currentSizeGB.toFixed(2)} GB) exceeds threshold (${DB_SIZE_THRESHOLD_GB} GB). Starting pruning...`);
          const targetSizeBytes = DB_PRUNE_TARGET_GB * 1024 * 1024 * 1024;
          const pruneResult = await pruneOldEvents(session, targetSizeBytes);
          console.log(`Pruning completed. Deleted ${pruneResult.eventsDeleted} events. Final size: ${(pruneResult.finalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`);
        } else {
          console.log('Database size is within limits. No pruning needed.');
        }
      } else {
        console.log('Database pruning is disabled.');
      }

      // Run PRAGMA optimize (SQLite's intelligent optimization)
      console.log('Running PRAGMA optimize...');
      await session.prepare('PRAGMA optimize').run();
      console.log('PRAGMA optimize completed');

      // Run ANALYZE to update query planner statistics
      console.log('Running ANALYZE on all tables...');
      await session.prepare('ANALYZE events').run();
      await session.prepare('ANALYZE tags').run();
      await session.prepare('ANALYZE event_tags_cache').run();
      await session.prepare('ANALYZE event_tags_cache_multi').run();
      await session.prepare('ANALYZE content_hashes').run();
      console.log('ANALYZE completed - query planner statistics updated');

      console.log('Scheduled 24hr database maintenance completed successfully');
    } catch (error) {
      console.error('Scheduled maintenance failed:', error);
    }
  }
};

// Export the Durable Object class
export { RelayWebSocket };