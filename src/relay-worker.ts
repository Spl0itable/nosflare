import { schnorr } from "@noble/curves/secp256k1";
import { Env, NostrEvent, NostrFilter, QueryResult, NostrMessage, Nip05Response, PendingEventMetadata } from './types';
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
  KV_FIRST_WRITE_ENABLED,
  KV_BATCH_SIZE,
  KV_BATCH_TRANSACTION_SIZE,
  KV_TTL_SECONDS,
} = config;

// Archive configuration constants
const ARCHIVE_RETENTION_DAYS = 90;
const ARCHIVE_BATCH_SIZE = 10;

// Query optimization constants
const GLOBAL_MAX_EVENTS = 5000;
const DEFAULT_TIME_WINDOW_DAYS = 90;
const MAX_QUERY_COMPLEXITY = 1000;

// Archive index types
interface ArchiveManifest {
  lastUpdated: string;
  hoursWithEvents: string[];  // Format: "YYYY-MM-DD/HH"
  firstHour: string;
  lastHour: string;
  totalEvents: number;
  indices: {
    authors: Set<string>;
    kinds: Set<number>;
    tags: Record<string, Set<string>>;
  };
}

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
        created_timestamp INTEGER DEFAULT (strftime('%s', 'now'))
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
      `CREATE INDEX IF NOT EXISTS idx_content_hashes_pubkey ON content_hashes(pubkey)`
    ];

    for (const statement of statements) {
      await session.prepare(statement).run();
    }

    await session.prepare("PRAGMA foreign_keys = ON").run();
    await session.prepare(
      "INSERT OR REPLACE INTO system_config (key, value) VALUES ('db_initialized', '1')"
    ).run();
    await session.prepare(
      "INSERT OR REPLACE INTO system_config (key, value) VALUES ('schema_version', '2')"
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

    // Run ANALYZE to initialize statistics
    await session.prepare("ANALYZE events").run();
    await session.prepare("ANALYZE tags").run();
    await session.prepare("ANALYZE event_tags_cache").run();

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
async function processEvent(event: NostrEvent, sessionId: string, env: Env): Promise<{ success: boolean; message: string }> {
  try {
    // Check cache for duplicate event ID
    const existingEvent = await env.RELAY_DATABASE.withSession('first-unconstrained')
      .prepare("SELECT id FROM events WHERE id = ? LIMIT 1")
      .bind(event.id)
      .first();

    if (existingEvent) {
      console.log(`Duplicate event detected: ${event.id}`);
      return { success: false, message: "duplicate: already have this event" };
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

    // Save event
    const saveResult = KV_FIRST_WRITE_ENABLED
      ? await saveEventToKV(event, env)
      : await saveEventToD1(event, env);
    return saveResult;

  } catch (error: any) {
    console.error(`Error processing event: ${error.message}`);
    return { success: false, message: `error: ${error.message}` };
  }
}

// Save event to KV
async function saveEventToKV(event: NostrEvent, env: Env): Promise<{ success: boolean; message: string }> {
  try {
    // Check worker cache first for duplicate event ID
    const cache = caches.default;
    const cacheKey = new Request(`https://event-cache/${event.id}`);
    const cached = await cache.match(cacheKey);
    if (cached) {
      return { success: false, message: "duplicate: event already exists" };
    }

    // Check D1 for duplicate event ID
    const session = env.RELAY_DATABASE.withSession('first-primary');
    const existingEvent = await session.prepare("SELECT id FROM events WHERE id = ? LIMIT 1").bind(event.id).first();
    if (existingEvent) {
      return { success: false, message: "duplicate: event already exists" };
    }

    // Check for duplicate content (only if anti-spam is enabled)
    if (shouldCheckForDuplicates(event.kind)) {
      const contentHash = await hashContent(event);

      // Check D1 for existing content hash
      const duplicateContent = enableGlobalDuplicateCheck
        ? await session.prepare("SELECT event_id FROM content_hashes WHERE hash = ? LIMIT 1").bind(contentHash).first()
        : await session.prepare("SELECT event_id FROM content_hashes WHERE hash = ? AND pubkey = ? LIMIT 1").bind(contentHash, event.pubkey).first();

      if (duplicateContent) {
        return { success: false, message: "duplicate: content already exists" };
      }
    }

    // Process tags and extract common tag values for cache
    const tagInserts = [];
    let tagP = null, tagE = null, tagA = null;

    for (const tag of event.tags) {
      if (tag[0] && tag[1]) {
        tagInserts.push({ name: tag[0], value: tag[1] });

        // Capture common tags for cache
        if (tag[0] === 'p' && !tagP) tagP = tag[1];
        if (tag[0] === 'e' && !tagE) tagE = tag[1];
        if (tag[0] === 'a' && !tagA) tagA = tag[1];
      }
    }

    // Create content hash if needed
    const contentHash = shouldCheckForDuplicates(event.kind) ? await hashContent(event) : null;

    // Create metadata structure
    const metadata: PendingEventMetadata = {
      event,
      timestamp: Date.now(),
      tags: tagInserts,
      eventTagsCache: {
        tag_p: tagP,
        tag_e: tagE,
        tag_a: tagA,
      },
      contentHash,
    };

    // Store event in KV with single key containing full metadata
    const pendingKey = `pending:${metadata.timestamp}:${event.id}`;
    const metadataJson = JSON.stringify(metadata);

    // Store in pending queue for batch processing
    await env.PENDING_EVENTS.put(pendingKey, metadataJson, {
      expirationTtl: KV_TTL_SECONDS,
    });

    // Cache the event ID in worker cache to prevent duplicates during KV buffer period
    await cache.put(cacheKey, new Response('cached', {
      headers: {
        'Cache-Control': `max-age=${KV_TTL_SECONDS}`
      }
    }));

    console.log(`Event ${event.id} saved to KV write buffer.`);
    return { success: true, message: "Event received successfully for processing" };

  } catch (error: any) {
    console.error(`Error saving event to KV: ${error.message}`);
    console.error(`Event details: ID=${event.id}, Tags count=${event.tags.length}`);
    return { success: false, message: "error: could not save event to write buffer" };
  }
}

async function saveEventToD1(event: NostrEvent, env: Env): Promise<{ success: boolean; message: string }> {
  try {
    // Check worker cache first for recently published events (fastest check)
    const cache = caches.default;
    const cacheKey = new Request(`https://event-cache/${event.id}`);
    const cached = await cache.match(cacheKey);
    if (cached) {
      return { success: false, message: "duplicate: event already exists" };
    }

    // Check D1 for duplicate event ID
    const session = env.RELAY_DATABASE.withSession('first-primary');
    const existingEvent = await session.prepare("SELECT id FROM events WHERE id = ? LIMIT 1").bind(event.id).first();
    if (existingEvent) {
      return { success: false, message: "duplicate: event already exists" };
    }

    // Check for duplicate content (only if anti-spam is enabled)
    if (shouldCheckForDuplicates(event.kind)) {
      const contentHash = await hashContent(event);
      const duplicateContent = enableGlobalDuplicateCheck
        ? await session.prepare("SELECT event_id FROM content_hashes WHERE hash = ? LIMIT 1").bind(contentHash).first()
        : await session.prepare("SELECT event_id FROM content_hashes WHERE hash = ? AND pubkey = ? LIMIT 1").bind(contentHash, event.pubkey).first();

      if (duplicateContent) {
        return { success: false, message: "duplicate: content already exists" };
      }
    }

    // Insert the main event first
    await session.prepare(`
      INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(event.id, event.pubkey, event.created_at, event.kind, JSON.stringify(event.tags), event.content, event.sig).run();

    // Process tags in chunks
    const tagInserts = [];
    let tagP = null, tagE = null, tagA = null;

    for (const tag of event.tags) {
      if (tag[0] && tag[1]) {
        tagInserts.push({ tag_name: tag[0], tag_value: tag[1] });

        // Capture common tags for cache
        if (tag[0] === 'p' && !tagP) tagP = tag[1];
        if (tag[0] === 'e' && !tagE) tagE = tag[1];
        if (tag[0] === 'a' && !tagA) tagA = tag[1];
      }
    }

    // Insert tags in chunks of 50
    for (let i = 0; i < tagInserts.length; i += 50) {
      const chunk = tagInserts.slice(i, i + 50);
      const batch = chunk.map(t =>
        session.prepare(`
          INSERT INTO tags (event_id, tag_name, tag_value)
          VALUES (?, ?, ?)
        `).bind(event.id, t.tag_name, t.tag_value)
      );

      if (batch.length > 0) {
        await session.batch(batch);
      }
    }

    // Update event tags cache for common tags
    if (tagP || tagE || tagA) {
      await session.prepare(`
        INSERT INTO event_tags_cache (event_id, pubkey, kind, created_at, tag_p, tag_e, tag_a)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id) DO UPDATE SET
          tag_p = excluded.tag_p,
          tag_e = excluded.tag_e,
          tag_a = excluded.tag_a
      `).bind(event.id, event.pubkey, event.kind, event.created_at, tagP, tagE, tagA).run();
    }

    // Insert content hash separately (only if anti-spam is enabled)
    if (shouldCheckForDuplicates(event.kind)) {
      const contentHash = await hashContent(event);
      await session.prepare(`
        INSERT INTO content_hashes (hash, event_id, pubkey, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(contentHash, event.id, event.pubkey, event.created_at).run();
    }

    // Cache the event ID in worker cache to prevent duplicates
    await cache.put(cacheKey, new Response('cached', {
      headers: {
        'Cache-Control': `max-age=${KV_TTL_SECONDS}`
      }
    }));

    console.log(`Event ${event.id} saved successfully to D1.`);
    return { success: true, message: "Event received successfully for processing" };

  } catch (error: any) {
    console.error(`Error saving event: ${error.message}`);
    console.error(`Event details: ID=${event.id}, Tags count=${event.tags.length}`);
    return { success: false, message: "error: could not save event" };
  }
}

// Helper function for kind 5
async function processDeletionEvent(event: NostrEvent, env: Env): Promise<{ success: boolean; message: string }> {
  console.log(`Processing deletion event ${event.id}`);
  const deletedEventIds = event.tags.filter(tag => tag[0] === "e").map(tag => tag[1]);

  if (deletedEventIds.length === 0) {
    return { success: true, message: "No events to delete" };
  }

  const session = env.RELAY_DATABASE.withSession('first-primary');
  let deletedCount = 0;
  const errors: string[] = [];

  for (const eventId of deletedEventIds) {
    try {
      // Check if the event exists in D1
      const existing = await session.prepare(
        "SELECT pubkey FROM events WHERE id = ? LIMIT 1"
      ).bind(eventId).first();

      // Also check if the event exists in KV (if KV-first is enabled)
      let kvMetadata: PendingEventMetadata | null = null;
      let kvPendingKey: string | null = null;
      if (KV_FIRST_WRITE_ENABLED) {
        // Find the pending key for this event
        const pendingKeys = await env.PENDING_EVENTS.list({ prefix: `pending:` });
        const foundKey = pendingKeys.keys.find(key => key.name.endsWith(`:${eventId}`));

        if (foundKey) {
          kvPendingKey = foundKey.name;
          const kvData = await env.PENDING_EVENTS.get(foundKey.name, 'text');
          if (kvData) {
            try {
              kvMetadata = JSON.parse(kvData) as PendingEventMetadata;
            } catch (parseError) {
              console.error(`Failed to parse KV metadata for event ${eventId}:`, parseError);
            }
          }
        }
      }

      // If event doesn't exist in either location, skip
      if (!existing && !kvMetadata) {
        console.warn(`Event ${eventId} not found in D1 or KV. Nothing to delete.`);
        continue;
      }

      // Check ownership - use D1 pubkey if available, otherwise KV
      const eventPubkey = existing ? existing.pubkey : kvMetadata!.event.pubkey;
      if (eventPubkey !== event.pubkey) {
        console.warn(`Event ${eventId} does not belong to pubkey ${event.pubkey}. Skipping deletion.`);
        errors.push(`unauthorized: cannot delete event ${eventId} - wrong pubkey`);
        continue;
      }

      // Delete from D1 if it exists there
      if (existing) {
        // Delete associated tags first (due to foreign key constraint)
        await session.prepare(
          "DELETE FROM tags WHERE event_id = ?"
        ).bind(eventId).run();

        // Delete from content_hashes if exists
        await session.prepare(
          "DELETE FROM content_hashes WHERE event_id = ?"
        ).bind(eventId).run();

        // Delete from event_tags_cache
        await session.prepare(
          "DELETE FROM event_tags_cache WHERE event_id = ?"
        ).bind(eventId).run();

        // Now delete the event
        const result = await session.prepare(
          "DELETE FROM events WHERE id = ?"
        ).bind(eventId).run();

        if (result.meta.changes > 0) {
          console.log(`Event ${eventId} deleted from D1.`);
          deletedCount++;
        }
      }

      // Delete from KV if it exists there
      if (kvMetadata && kvPendingKey) {
        await env.PENDING_EVENTS.delete(kvPendingKey);
        console.log(`Event ${eventId} deleted from KV.`);
        if (!existing) {
          deletedCount++; // Only increment if we didn't already count it from D1
        }
      }
    } catch (error) {
      console.error(`Error deleting event ${eventId}:`, error);
      errors.push(`error deleting ${eventId}`);
    }
  }

  // Save the deletion event itself (use appropriate save method based on KV-first setting)
  const saveResult = KV_FIRST_WRITE_ENABLED
    ? await saveEventToKV(event, env)
    : await saveEventToD1(event, env);

  if (errors.length > 0) {
    return { success: false, message: errors[0] };
  }

  return {
    success: true,
    message: deletedCount > 0 ? `Successfully deleted ${deletedCount} event(s)` : "No matching events found to delete"
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

// Query builder
function buildQuery(filter: NostrFilter): { sql: string; params: any[] } {
  const params: any[] = [];
  const conditions: string[] = [];

  // Count and categorize tag filters
  let tagCount = 0;
  const cacheableTags: Array<{ name: string; values: string[] }> = [];
  const otherTags: Array<{ name: string; values: string[] }> = [];

  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith('#') && Array.isArray(values) && values.length > 0) {
      tagCount += values.length;
      const tagName = key.substring(1);

      // Check if this is a cacheable tag (p, e, or a)
      if (['p', 'e', 'a'].includes(tagName)) {
        cacheableTags.push({ name: tagName, values });
      } else {
        otherTags.push({ name: tagName, values });
      }
    }
  }

  // Only cacheable tags (p, e, a) - use event_tags_cache
  if (cacheableTags.length > 0 && otherTags.length === 0) {
    let sql = "SELECT e.* FROM events e INNER JOIN event_tags_cache c ON e.id = c.event_id";
    const whereConditions: string[] = [];

    for (const tagFilter of cacheableTags) {
      const tagColumn = `tag_${tagFilter.name}`;
      whereConditions.push(`c.${tagColumn} IN (${tagFilter.values.map(() => '?').join(',')})`);
      params.push(...tagFilter.values);
    }

    if (filter.ids && filter.ids.length > 0) {
      whereConditions.push(`e.id IN (${filter.ids.map(() => '?').join(',')})`);
      params.push(...filter.ids);
    }

    if (filter.authors && filter.authors.length > 0) {
      whereConditions.push(`c.pubkey IN (${filter.authors.map(() => '?').join(',')})`);
      params.push(...filter.authors);
    }

    if (filter.kinds && filter.kinds.length > 0) {
      whereConditions.push(`c.kind IN (${filter.kinds.map(() => '?').join(',')})`);
      params.push(...filter.kinds);
    }

    if (filter.since) {
      whereConditions.push("c.created_at >= ?");
      params.push(filter.since);
    }

    if (filter.until) {
      whereConditions.push("c.created_at <= ?");
      params.push(filter.until);
    }

    if (whereConditions.length > 0) {
      sql += " WHERE " + whereConditions.join(" AND ");
    }

    sql += " ORDER BY c.created_at DESC";
    sql += " LIMIT ?";
    params.push(Math.min(filter.limit || 1000, 5000));

    return { sql, params };
  }

  // Has any non-cacheable tags - use CTE with tags table
  if (tagCount > 0) {
    const tagConditions: string[] = [];
    const cteParams: any[] = [];

    // Include ALL tags in the CTE (both cacheable and non-cacheable)
    for (const tagFilter of [...cacheableTags, ...otherTags]) {
      tagConditions.push(`(tag_name = ? AND tag_value IN (${tagFilter.values.map(() => '?').join(',')}))`);
      cteParams.push(tagFilter.name, ...tagFilter.values);
    }

    let sql = `WITH matching_events AS (
      SELECT DISTINCT event_id 
      FROM tags 
      WHERE ${tagConditions.join(' OR ')}
    )
    SELECT e.* FROM events e
    INNER JOIN matching_events m ON e.id = m.event_id`;

    params.push(...cteParams);

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

    if (whereConditions.length > 0) {
      sql += " WHERE " + whereConditions.join(" AND ");
    }

    sql += " ORDER BY e.created_at DESC";
    sql += " LIMIT ?";
    params.push(Math.min(filter.limit || 1000, 5000));

    return { sql, params };
  }

  // No tag filters - standard query with index hints
  let indexHint = "";

  const hasAuthors = filter.authors && filter.authors.length > 0;
  const hasKinds = filter.kinds && filter.kinds.length > 0;
  const hasTimeRange = filter.since || filter.until;
  const authorCount = filter.authors?.length || 0;
  const kindCount = filter.kinds?.length || 0;

  // Choose index based on query pattern
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

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY created_at DESC";
  sql += " LIMIT ?";
  params.push(Math.min(filter.limit || 1000, 5000));

  return { sql, params };
}

// Helper function to handle chunked queries
async function queryDatabaseChunked(filter: NostrFilter, bookmark: string, env: Env): Promise<{ events: NostrEvent[] }> {
  const session = env.RELAY_DATABASE.withSession(bookmark);
  const allEvents = new Map<string, NostrEvent>();

  const CHUNK_SIZE = 50;

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
          const event: NostrEvent = {
            id: row.id as string,
            pubkey: row.pubkey as string,
            created_at: row.created_at as number,
            kind: row.kind as number,
            tags: JSON.parse(row.tags as string),
            content: row.content as string,
            sig: row.sig as string
          };
          allEvents.set(event.id, event);
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
          const event: NostrEvent = {
            id: row.id as string,
            pubkey: row.pubkey as string,
            created_at: row.created_at as number,
            kind: row.kind as number,
            tags: JSON.parse(row.tags as string),
            content: row.content as string,
            sig: row.sig as string
          };
          allEvents.set(event.id, event);
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
        const event: NostrEvent = {
          id: row.id as string,
          pubkey: row.pubkey as string,
          created_at: row.created_at as number,
          kind: row.kind as number,
          tags: JSON.parse(row.tags as string),
          content: row.content as string,
          sig: row.sig as string
        };
        allEvents.set(event.id, event);
      }
    } catch (error) {
      console.error(`Error in query: ${error}`);
    }
  }

  const events = Array.from(allEvents.values());
  console.log(`Found ${events.length} events (chunked)`);

  return { events };
}

// Query handling
async function queryEvents(filters: NostrFilter[], bookmark: string, env: Env): Promise<QueryResult> {
  try {
    console.log(`Processing query with ${filters.length} filters and bookmark: ${bookmark}`);
    const session = env.RELAY_DATABASE.withSession(bookmark);
    const eventSet = new Map<string, NostrEvent>();

    let totalEventsRead = 0;

    for (const filter of filters) {
      // Skip if we've already hit the global limit
      if (totalEventsRead >= GLOBAL_MAX_EVENTS) {
        console.warn(`Global event limit reached (${GLOBAL_MAX_EVENTS}), stopping query`);
        break;
      }

      // Check query complexity
      const complexity = calculateQueryComplexity(filter);
      if (complexity > MAX_QUERY_COMPLEXITY) {
        console.warn(`Query too complex (complexity: ${complexity}), skipping filter`);
        continue;
      }

      // For filters with no time bounds and broad criteria, add default time window
      if (!filter.since && !filter.until) {
        // Default to last 90 days for unbounded queries
        const sevenDaysAgo = Math.floor(Date.now() / 1000) - (DEFAULT_TIME_WINDOW_DAYS * 24 * 60 * 60);
        filter.since = sevenDaysAgo;
        console.log(`Added default ${DEFAULT_TIME_WINDOW_DAYS}-day time bound to unbounded query`);
      }

      // Check if any array in the filter exceeds chunk size
      const needsChunking = (
        (filter.ids && filter.ids.length > 50) ||
        (filter.authors && filter.authors.length > 50) ||
        (filter.kinds && filter.kinds.length > 50) ||
        Object.entries(filter).some(([key, values]) =>
          key.startsWith('#') && Array.isArray(values) && values.length > 50
        )
      );

      if (needsChunking) {
        console.log(`Filter has arrays >50 items, using chunked query...`);
        const chunkedResult = await queryDatabaseChunked(filter, bookmark, env);
        for (const event of chunkedResult.events) {
          if (totalEventsRead >= GLOBAL_MAX_EVENTS) break;
          eventSet.set(event.id, event);
          totalEventsRead++;
        }
        continue;
      }

      // Build and execute the query
      const query = buildQuery(filter);

      try {
        const result = await session.prepare(query.sql).bind(...query.params).all();

        // Log query metadata
        if (result.meta) {
          console.log({
            servedByRegion: result.meta.served_by_region ?? "",
            servedByPrimary: result.meta.served_by_primary ?? false,
            rowsRead: result.results.length
          });
        }

        for (const row of result.results) {
          if (totalEventsRead >= GLOBAL_MAX_EVENTS) break;

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
          totalEventsRead++;
        }
      } catch (error: any) {
        console.error(`Query execution error: ${error.message}`);
        throw error;
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

// Batch process pending events from KV to D1
async function batchEventsFromKVToD1(env: Env): Promise<void> {
  if (!KV_FIRST_WRITE_ENABLED) {
    console.log('KV-first write strategy is disabled, skipping batch processing');
    return;
  }

  console.log('Starting KV to D1 batch processing...');

  try {
    // List pending events from KV
    const listResult = await env.PENDING_EVENTS.list({ prefix: 'pending:', limit: KV_BATCH_SIZE });

    if (listResult.keys.length === 0) {
      console.log('No pending events to process');
      return;
    }

    console.log(`Found ${listResult.keys.length} pending events to process`);

    // Retrieve all event metadata directly from pending keys
    const metadataPromises = listResult.keys.map(key =>
      env.PENDING_EVENTS.get(key.name, 'text')
    );

    const metadataResults = await Promise.all(metadataPromises);

    // Parse metadata and filter out nulls (events that may have been deleted)
    const pendingEvents: PendingEventMetadata[] = [];
    for (let i = 0; i < metadataResults.length; i++) {
      const metadataJson = metadataResults[i];
      if (metadataJson) {
        try {
          const metadata = JSON.parse(metadataJson) as PendingEventMetadata;
          pendingEvents.push(metadata);
        } catch (parseError) {
          const eventId = listResult.keys[i].name.split(':')[2];
          console.error(`Failed to parse metadata for event ${eventId}:`, parseError);
        }
      }
    }

    if (pendingEvents.length === 0) {
      console.log('No valid pending events after parsing metadata');
      return;
    }

    console.log(`Processing ${pendingEvents.length} valid pending events`);

    // Process events in smaller transaction batches
    const session = env.RELAY_DATABASE.withSession('first-primary');
    const processedEventIds: string[] = [];
    const failedEventIds: string[] = [];

    for (let i = 0; i < pendingEvents.length; i += KV_BATCH_TRANSACTION_SIZE) {
      const batch = pendingEvents.slice(i, i + KV_BATCH_TRANSACTION_SIZE);
      console.log(`Processing batch ${Math.floor(i / KV_BATCH_TRANSACTION_SIZE) + 1} with ${batch.length} events`);

      try {
        // Process each event in the batch
        for (const metadata of batch) {
          const event = metadata.event;

          try {
            // Insert the main event
            await session.prepare(`
              INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING
            `).bind(event.id, event.pubkey, event.created_at, event.kind, JSON.stringify(event.tags), event.content, event.sig).run();

            // Insert tags in chunks
            if (metadata.tags.length > 0) {
              for (let j = 0; j < metadata.tags.length; j += 50) {
                const tagChunk = metadata.tags.slice(j, j + 50);
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

            // Update event tags cache for common tags
            if (metadata.eventTagsCache.tag_p || metadata.eventTagsCache.tag_e || metadata.eventTagsCache.tag_a) {
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
                metadata.eventTagsCache.tag_p,
                metadata.eventTagsCache.tag_e,
                metadata.eventTagsCache.tag_a
              ).run();
            }

            // Insert content hash if present
            if (metadata.contentHash) {
              await session.prepare(`
                INSERT INTO content_hashes (hash, event_id, pubkey, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(hash) DO NOTHING
              `).bind(metadata.contentHash, event.id, event.pubkey, event.created_at).run();
            }

            processedEventIds.push(event.id);
            console.log(`Successfully processed event ${event.id}`);

          } catch (eventError: any) {
            console.error(`Failed to process event ${event.id}:`, eventError.message);
            failedEventIds.push(event.id);
          }
        }

      } catch (batchError: any) {
        console.error(`Failed to process batch:`, batchError.message);
        // Mark all events in this batch as failed
        batch.forEach(metadata => {
          if (!processedEventIds.includes(metadata.event.id)) {
            failedEventIds.push(metadata.event.id);
          }
        });
      }
    }

    console.log(`Processed ${processedEventIds.length} events successfully, ${failedEventIds.length} failed`);

    // Delete successfully processed events from KV
    if (processedEventIds.length > 0) {
      const deletePromises: Promise<void>[] = [];

      for (const eventId of processedEventIds) {
        // Find and delete the pending key
        const pendingKey = listResult.keys.find(key => key.name.endsWith(`:${eventId}`));
        if (pendingKey) {
          deletePromises.push(env.PENDING_EVENTS.delete(pendingKey.name));
        }
      }

      await Promise.all(deletePromises);
      console.log(`Deleted ${processedEventIds.length} events from KV`);
    }

    console.log('KV to D1 batch processing completed');

  } catch (error: any) {
    console.error(`Error in batch processing: ${error.message}`);
    throw error;
  }
}

// Archive functions with hourly partitions
async function archiveOldEvents(db: D1Database, r2: R2Bucket): Promise<void> {
  const cutoffTime = Math.floor(Date.now() / 1000) - (ARCHIVE_RETENTION_DAYS * 24 * 60 * 60);

  console.log(`Archiving events older than ${new Date(cutoffTime * 1000).toISOString()}`);

  // Load existing manifest
  let manifest: ArchiveManifest;
  try {
    const manifestObj = await r2.get('manifest.json');
    if (manifestObj) {
      const data = JSON.parse(await manifestObj.text());
      // Convert arrays back to Sets when loading
      manifest = {
        ...data,
        indices: {
          authors: new Set(data.indices?.authors || []),
          kinds: new Set(data.indices?.kinds || []),
          tags: {} // Initialize empty, will populate below
        }
      };

      // Convert tag arrays back to Sets
      if (data.indices?.tags) {
        for (const [tagName, tagValues] of Object.entries(data.indices.tags)) {
          manifest.indices.tags[tagName] = new Set(tagValues as string[]);
        }
      }
    } else {
      manifest = {
        lastUpdated: new Date().toISOString(),
        hoursWithEvents: [],
        firstHour: '',
        lastHour: '',
        totalEvents: 0,
        indices: {
          authors: new Set(),
          kinds: new Set(),
          tags: {}
        }
      };
    }
  } catch (e) {
    console.log('Creating new manifest...');
    manifest = {
      lastUpdated: new Date().toISOString(),
      hoursWithEvents: [],
      firstHour: '',
      lastHour: '',
      totalEvents: 0,
      indices: {
        authors: new Set(),
        kinds: new Set(),
        tags: {}
      }
    };
  }

  let offset = 0;
  let hasMore = true;
  let totalArchived = 0;

  while (hasMore) {
    const session = db.withSession('first-unconstrained');

    // Get batch of old events
    const oldEvents = await session.prepare(`
      SELECT * FROM events 
      WHERE created_at < ?
      ORDER BY created_at
      LIMIT ?
      OFFSET ?
    `).bind(cutoffTime, ARCHIVE_BATCH_SIZE, offset).all();

    if (!oldEvents.results || oldEvents.results.length === 0) {
      hasMore = false;
      break;
    }

    // Process events for archiving
    const eventsByHour = new Map<string, NostrEvent[]>();
    const eventsByAuthorHour = new Map<string, NostrEvent[]>();
    const eventsByKindHour = new Map<string, NostrEvent[]>();
    const eventsByTagHour = new Map<string, NostrEvent[]>();

    for (const event of oldEvents.results) {
      const date = new Date(event.created_at as number * 1000);
      const hourKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCHours()).padStart(2, '0')}`;

      // Get tags for this event
      const tags = await session.prepare(
        'SELECT tag_name, tag_value FROM tags WHERE event_id = ?'
      ).bind(event.id as string).all();

      const formattedTags: string[][] = [];
      const tagMap: Record<string, string[]> = {};

      for (const tag of tags.results || []) {
        if (!tagMap[tag.tag_name as string]) {
          tagMap[tag.tag_name as string] = [];
        }
        tagMap[tag.tag_name as string].push(tag.tag_value as string);
      }

      for (const [name, values] of Object.entries(tagMap)) {
        formattedTags.push([name, ...values]);
      }

      const nostrEvent: NostrEvent = {
        id: event.id as string,
        pubkey: event.pubkey as string,
        created_at: event.created_at as number,
        kind: event.kind as number,
        tags: formattedTags,
        content: event.content as string,
        sig: event.sig as string
      };

      // Primary storage by hour
      if (!eventsByHour.has(hourKey)) {
        eventsByHour.set(hourKey, []);
      }
      eventsByHour.get(hourKey)!.push(nostrEvent);

      // Secondary index by author
      const authorHourKey = `${nostrEvent.pubkey}/${hourKey}`;
      if (!eventsByAuthorHour.has(authorHourKey)) {
        eventsByAuthorHour.set(authorHourKey, []);
      }
      eventsByAuthorHour.get(authorHourKey)!.push(nostrEvent);
      manifest.indices.authors.add(nostrEvent.pubkey);

      // Secondary index by kind
      const kindHourKey = `${nostrEvent.kind}/${hourKey}`;
      if (!eventsByKindHour.has(kindHourKey)) {
        eventsByKindHour.set(kindHourKey, []);
      }
      eventsByKindHour.get(kindHourKey)!.push(nostrEvent);
      manifest.indices.kinds.add(nostrEvent.kind);

      // Secondary indices by tags - FIXED SECTION
      for (const [tagName, ...tagValues] of formattedTags) {
        for (const tagValue of tagValues) {
          const tagKey = `${tagName}/${tagValue}/${hourKey}`;
          if (!eventsByTagHour.has(tagKey)) {
            eventsByTagHour.set(tagKey, []);
          }
          eventsByTagHour.get(tagKey)!.push(nostrEvent);

          // Update manifest - ensure it's a Set
          if (!manifest.indices.tags[tagName]) {
            manifest.indices.tags[tagName] = new Set();
          }
          // Now it's safe to use .add() because we know it's a Set
          (manifest.indices.tags[tagName] as Set<string>).add(tagValue);
        }
      }

      totalArchived++;
    }

    // Store primary data by hour
    for (const [hourKey, events] of eventsByHour) {
      const key = `events/${hourKey}.jsonl`;

      // Check if file exists
      let existingData = '';
      try {
        const existing = await r2.get(key);
        if (existing) {
          existingData = await existing.text() + '\n';
        }
      } catch (e) {
        // File doesn't exist
      }

      // Convert to JSON Lines
      const jsonLines = events.map(e => JSON.stringify(e)).join('\n');

      await r2.put(key, existingData + jsonLines, {
        customMetadata: {
          eventCount: String(events.length + (existingData ? existingData.split('\n').length - 1 : 0)),
          minCreatedAt: String(Math.min(...events.map(e => e.created_at))),
          maxCreatedAt: String(Math.max(...events.map(e => e.created_at)))
        }
      });

      if (!manifest.hoursWithEvents.includes(hourKey)) {
        manifest.hoursWithEvents.push(hourKey);
      }
    }

    // Store secondary indices
    // By author
    for (const [authorHourKey, events] of eventsByAuthorHour) {
      const [pubkey, hour] = authorHourKey.split('/');
      const key = `index/author/${pubkey}/${hour}.jsonl`;

      let existingData = '';
      try {
        const existing = await r2.get(key);
        if (existing) {
          existingData = await existing.text() + '\n';
        }
      } catch (e) { }

      const jsonLines = events.map(e => JSON.stringify(e)).join('\n');
      await r2.put(key, existingData + jsonLines);
    }

    // By kind
    for (const [kindHourKey, events] of eventsByKindHour) {
      const [kind, hour] = kindHourKey.split('/');
      const key = `index/kind/${kind}/${hour}.jsonl`;

      let existingData = '';
      try {
        const existing = await r2.get(key);
        if (existing) {
          existingData = await existing.text() + '\n';
        }
      } catch (e) { }

      const jsonLines = events.map(e => JSON.stringify(e)).join('\n');
      await r2.put(key, existingData + jsonLines);
    }

    // By tags
    for (const [tagKey, events] of eventsByTagHour) {
      const parts = tagKey.split('/');
      const tagName = parts[0];
      const tagValue = parts[1];
      const hour = `${parts[2]}/${parts[3]}`;
      const key = `index/tag/${tagName}/${tagValue}/${hour}.jsonl`;

      let existingData = '';
      try {
        const existing = await r2.get(key);
        if (existing) {
          existingData = await existing.text() + '\n';
        }
      } catch (e) { }

      const jsonLines = events.map(e => JSON.stringify(e)).join('\n');
      await r2.put(key, existingData + jsonLines);
    }

    // Store individual events by ID for direct lookups
    for (const event of oldEvents.results) {
      const eventId = event.id as string;
      const firstTwo = eventId.substring(0, 2);
      const key = `index/id/${firstTwo}/${eventId}.json`;

      // Get full event with tags
      const tags = await session.prepare(
        'SELECT tag_name, tag_value FROM tags WHERE event_id = ?'
      ).bind(eventId).all();

      const formattedTags: string[][] = [];
      const tagMap: Record<string, string[]> = {};

      for (const tag of tags.results || []) {
        if (!tagMap[tag.tag_name as string]) {
          tagMap[tag.tag_name as string] = [];
        }
        tagMap[tag.tag_name as string].push(tag.tag_value as string);
      }

      for (const [name, values] of Object.entries(tagMap)) {
        formattedTags.push([name, ...values]);
      }

      const nostrEvent: NostrEvent = {
        id: eventId,
        pubkey: event.pubkey as string,
        created_at: event.created_at as number,
        kind: event.kind as number,
        tags: formattedTags,
        content: event.content as string,
        sig: event.sig as string
      };

      await r2.put(key, JSON.stringify(nostrEvent));
    }

    // Delete from D1 (use primary session for writes)
    const writeSession = db.withSession('first-primary');
    const eventIds = oldEvents.results.map(e => e.id as string);

    for (let i = 0; i < eventIds.length; i += 100) {
      const chunk = eventIds.slice(i, i + 100);
      const placeholders = chunk.map(() => '?').join(',');

      await writeSession.prepare(`DELETE FROM tags WHERE event_id IN (${placeholders})`).bind(...chunk).run();
      await writeSession.prepare(`DELETE FROM event_tags_cache WHERE event_id IN (${placeholders})`).bind(...chunk).run();
      await writeSession.prepare(`DELETE FROM events WHERE id IN (${placeholders})`).bind(...chunk).run();
    }

    offset += ARCHIVE_BATCH_SIZE;
  }

  // Update manifest
  manifest.hoursWithEvents.sort();
  manifest.firstHour = manifest.hoursWithEvents[0] || '';
  manifest.lastHour = manifest.hoursWithEvents[manifest.hoursWithEvents.length - 1] || '';
  manifest.totalEvents += totalArchived;
  manifest.lastUpdated = new Date().toISOString();

  // Convert Sets to Arrays for JSON serialization
  const serializableManifest = {
    ...manifest,
    indices: {
      authors: Array.from(manifest.indices.authors),
      kinds: Array.from(manifest.indices.kinds),
      tags: Object.fromEntries(
        Object.entries(manifest.indices.tags).map(([k, v]) => [k, Array.from(v as Set<string>)])
      )
    }
  };

  await r2.put('manifest.json', JSON.stringify(serializableManifest, null, 2));

  console.log(`Archive process completed. Archived ${totalArchived} events.`);
}

// Query archive function with hourly partitions
async function queryArchive(filter: NostrFilter, hotDataCutoff: number, r2: R2Bucket): Promise<NostrEvent[]> {
  const results: NostrEvent[] = [];
  const processedEventIds = new Set<string>();

  // Load manifest
  let manifest: ArchiveManifest | null = null;
  try {
    const manifestObj = await r2.get('manifest.json');
    if (manifestObj) {
      const data = JSON.parse(await manifestObj.text());
      manifest = {
        ...data,
        indices: {
          authors: new Set(data.indices?.authors || []),
          kinds: new Set(data.indices?.kinds || []),
          tags: data.indices?.tags || {}
        }
      };
    }
  } catch (e) {
    console.warn('Failed to load archive manifest');
  }

  if (filter.ids && filter.ids.length > 0) {
    console.log(`Archive: Direct ID lookup for ${filter.ids.length} events`);

    for (const eventId of filter.ids) {
      const firstTwo = eventId.substring(0, 2);
      const key = `index/id/${firstTwo}/${eventId}.json`;

      try {
        const obj = await r2.get(key);
        if (obj) {
          const event = JSON.parse(await obj.text()) as NostrEvent;

          if (filter.since && event.created_at < filter.since) continue;
          if (filter.until && event.created_at > filter.until) continue;

          // Apply other filters
          if (filter.authors && !filter.authors.includes(event.pubkey)) continue;
          if (filter.kinds && !filter.kinds.includes(event.kind)) continue;

          // Apply tag filters
          let matchesTags = true;
          for (const [key, values] of Object.entries(filter)) {
            if (key.startsWith('#') && Array.isArray(values) && values.length > 0) {
              const tagName = key.substring(1);
              const eventTagValues = event.tags
                .filter(tag => tag[0] === tagName)
                .map(tag => tag[1]);

              if (!values.some(v => eventTagValues.includes(v))) {
                matchesTags = false;
                break;
              }
            }
          }

          if (!matchesTags) continue;

          results.push(event);
          processedEventIds.add(event.id);
          console.log(`Archive: Found event ${eventId} in archive`);
        } else {
          console.log(`Archive: Event ${eventId} not found in archive`);
        }
      } catch (e) {
        console.log(`Archive: Error fetching event ${eventId}: ${e}`);
      }
    }

    // If this was purely a direct ID lookup, return early
    if (!filter.since && !filter.until && !filter.authors && !filter.kinds &&
      !Object.keys(filter).some(k => k.startsWith('#'))) {
      console.log(`Archive: Direct ID lookup complete, found ${results.length} events`);
      return results;
    }
  }

  if (filter.since && filter.since >= hotDataCutoff && !filter.ids) {
    console.log('Archive query skipped - filter.since is newer than archive cutoff');
    return results;
  }

  const startDate = filter.since ? new Date(Math.max(filter.since * 1000, 0)) : new Date(0);
  const endDate = filter.until ?
    new Date(Math.min(filter.until * 1000, hotDataCutoff * 1000)) :
    new Date(hotDataCutoff * 1000);

  const cappedEndDate = filter.ids ? endDate : new Date(Math.min(endDate.getTime(), hotDataCutoff * 1000));

  if (startDate >= cappedEndDate && !filter.ids) {
    console.log('Archive query skipped - date range does not overlap with archive');
    return results;
  }

  console.log(`Archive query range: ${startDate.toISOString()} to ${cappedEndDate.toISOString()}`);

  // Determine the most efficient index to use
  const useAuthorIndex = filter.authors && filter.authors.length <= 10;
  const useKindIndex = filter.kinds && filter.kinds.length <= 5;
  const useTagIndex = Object.entries(filter).some(([k, v]) =>
    k.startsWith('#') && Array.isArray(v) && v.length <= 10
  );

  // Generate list of hours to query
  const getHourKeys = (): string[] => {
    const hourKeys: string[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= cappedEndDate) {
      for (let hour = 0; hour < 24; hour++) {
        const hourKey = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}/${String(hour).padStart(2, '0')}`;

        // Check if within our time range
        const hourTimestamp = new Date(currentDate);
        hourTimestamp.setUTCHours(hour);

        if (hourTimestamp >= startDate && hourTimestamp <= cappedEndDate) {
          if (!manifest || manifest.hoursWithEvents.includes(hourKey)) {
            hourKeys.push(hourKey);
          }
        }
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return hourKeys;
  };

  // Use secondary indices if available
  if (useAuthorIndex && filter.authors) {
    // Query by author index
    for (const author of filter.authors) {
      for (const hourKey of getHourKeys()) {
        const key = `index/author/${author}/${hourKey}.jsonl`;

        try {
          const obj = await r2.get(key);
          if (obj) {
            const content = await obj.text();
            const lines = content.split('\n').filter(line => line.trim());

            for (const line of lines) {
              try {
                const event = JSON.parse(line) as NostrEvent;

                if (processedEventIds.has(event.id)) continue;

                // For time-based queries, ensure event is in archive range
                if (!filter.ids && event.created_at >= hotDataCutoff) continue;

                // Apply remaining filters
                if (filter.ids && !filter.ids.includes(event.id)) continue;
                if (filter.kinds && !filter.kinds.includes(event.kind)) continue;
                if (filter.since && event.created_at < filter.since) continue;
                if (filter.until && event.created_at > filter.until) continue;

                // Apply tag filters
                let matchesTags = true;
                for (const [key, values] of Object.entries(filter)) {
                  if (key.startsWith('#') && Array.isArray(values) && values.length > 0) {
                    const tagName = key.substring(1);
                    const eventTagValues = event.tags
                      .filter(tag => tag[0] === tagName)
                      .map(tag => tag[1]);

                    if (!values.some(v => eventTagValues.includes(v))) {
                      matchesTags = false;
                      break;
                    }
                  }
                }

                if (!matchesTags) continue;

                results.push(event);
                processedEventIds.add(event.id);
              } catch (e) {
                console.error('Failed to parse archive event:', e);
              }
            }
          }
        } catch (e) {
          // File doesn't exist
        }
      }
    }
  } else if (useKindIndex && filter.kinds) {
    // Query by kind index
    for (const kind of filter.kinds) {
      for (const hourKey of getHourKeys()) {
        const key = `index/kind/${kind}/${hourKey}.jsonl`;

        try {
          const obj = await r2.get(key);
          if (obj) {
            const content = await obj.text();
            const lines = content.split('\n').filter(line => line.trim());

            for (const line of lines) {
              try {
                const event = JSON.parse(line) as NostrEvent;

                if (processedEventIds.has(event.id)) continue;

                // For time-based queries, ensure event is in archive range
                if (!filter.ids && event.created_at >= hotDataCutoff) continue;

                // Apply remaining filters
                if (filter.ids && !filter.ids.includes(event.id)) continue;
                if (filter.authors && !filter.authors.includes(event.pubkey)) continue;
                if (filter.since && event.created_at < filter.since) continue;
                if (filter.until && event.created_at > filter.until) continue;

                // Apply tag filters
                let matchesTags = true;
                for (const [key, values] of Object.entries(filter)) {
                  if (key.startsWith('#') && Array.isArray(values) && values.length > 0) {
                    const tagName = key.substring(1);
                    const eventTagValues = event.tags
                      .filter(tag => tag[0] === tagName)
                      .map(tag => tag[1]);

                    if (!values.some(v => eventTagValues.includes(v))) {
                      matchesTags = false;
                      break;
                    }
                  }
                }

                if (!matchesTags) continue;

                results.push(event);
                processedEventIds.add(event.id);
              } catch (e) {
                console.error('Failed to parse archive event:', e);
              }
            }
          }
        } catch (e) {
          // File doesn't exist
        }
      }
    }
  } else if (useTagIndex) {
    // Query by tag index
    for (const [filterKey, filterValues] of Object.entries(filter)) {
      if (filterKey.startsWith('#') && Array.isArray(filterValues) && filterValues.length > 0) {
        const tagName = filterKey.substring(1);

        for (const tagValue of filterValues) {
          for (const hourKey of getHourKeys()) {
            const key = `index/tag/${tagName}/${tagValue}/${hourKey}.jsonl`;

            try {
              const obj = await r2.get(key);
              if (obj) {
                const content = await obj.text();
                const lines = content.split('\n').filter(line => line.trim());

                for (const line of lines) {
                  try {
                    const event = JSON.parse(line) as NostrEvent;

                    if (processedEventIds.has(event.id)) continue;

                    // For time-based queries, ensure event is in archive range
                    if (!filter.ids && event.created_at >= hotDataCutoff) continue;

                    // Apply remaining filters
                    if (filter.ids && !filter.ids.includes(event.id)) continue;
                    if (filter.authors && !filter.authors.includes(event.pubkey)) continue;
                    if (filter.kinds && !filter.kinds.includes(event.kind)) continue;
                    if (filter.since && event.created_at < filter.since) continue;
                    if (filter.until && event.created_at > filter.until) continue;

                    // Check other tag filters
                    let matchesOtherTags = true;
                    for (const [otherKey, otherValues] of Object.entries(filter)) {
                      if (otherKey.startsWith('#') && otherKey !== filterKey &&
                        Array.isArray(otherValues) && otherValues.length > 0) {
                        const otherTagName = otherKey.substring(1);
                        const eventOtherTagValues = event.tags
                          .filter(tag => tag[0] === otherTagName)
                          .map(tag => tag[1]);

                        if (!otherValues.some(v => eventOtherTagValues.includes(v))) {
                          matchesOtherTags = false;
                          break;
                        }
                      }
                    }

                    if (!matchesOtherTags) continue;

                    results.push(event);
                    processedEventIds.add(event.id);
                  } catch (e) {
                    console.error('Failed to parse archive event:', e);
                  }
                }
              }
            } catch (e) {
              // File doesn't exist
            }
          }
        }
      }
    }
  } else {
    // Fall back to primary hourly storage
    const filesToQuery = getHourKeys().map(hourKey => `events/${hourKey}.jsonl`);

    // Limit files to query
    if (filesToQuery.length > 2160) { // 90 days * 24 hours
      console.warn(`Large archive query spanning ${filesToQuery.length} hours, limiting to most recent 2160`);
      filesToQuery.splice(0, filesToQuery.length - 2160);
    }

    // Query each file
    for (const file of filesToQuery) {
      try {
        const object = await r2.get(file);
        if (!object) continue;

        const content = await object.text();
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const event = JSON.parse(line) as NostrEvent;

            if (processedEventIds.has(event.id)) continue;

            // For time-based queries, ensure event is in archive range
            if (!filter.ids && event.created_at >= hotDataCutoff) continue;

            // Apply filters
            if (filter.ids && !filter.ids.includes(event.id)) continue;
            if (filter.authors && !filter.authors.includes(event.pubkey)) continue;
            if (filter.kinds && !filter.kinds.includes(event.kind)) continue;
            if (filter.since && event.created_at < filter.since) continue;
            if (filter.until && event.created_at > filter.until) continue;

            // Apply tag filters
            let matchesTags = true;
            for (const [key, values] of Object.entries(filter)) {
              if (key.startsWith('#') && Array.isArray(values) && values.length > 0) {
                const tagName = key.substring(1);
                const eventTagValues = event.tags
                  .filter(tag => tag[0] === tagName)
                  .map(tag => tag[1]);

                if (!values.some(v => eventTagValues.includes(v))) {
                  matchesTags = false;
                  break;
                }
              }
            }

            if (!matchesTags) continue;

            results.push(event);
            processedEventIds.add(event.id);
          } catch (e) {
            console.error('Failed to parse archive event:', e);
          }
        }
      } catch (e) {
        // File doesn't exist
        continue;
      }
    }
  }

  console.log(`Archive query returned ${results.length} events`);
  return results;
}

// Query events with archive support
async function queryEventsWithArchive(filters: NostrFilter[], bookmark: string, env: Env): Promise<QueryResult> {
  // First get results from D1
  const d1Result = await queryEvents(filters, bookmark, env);

  // Check if we need to query archive
  const hotDataCutoff = Math.floor(Date.now() / 1000) - (ARCHIVE_RETENTION_DAYS * 24 * 60 * 60);

  // Determine if we need archive access
  const needsArchive = filters.some(filter => {
    // Always check archive for direct ID lookups (no time constraints)
    if (filter.ids && filter.ids.length > 0) {
      return true;
    }

    // Check archive if the filter explicitly requests data older than 90 days
    if (!filter.since && !filter.until) {
      return false;
    }

    const queryStartsBeforeCutoff = filter.since && filter.since < hotDataCutoff;
    const queryEndsBeforeCutoff = filter.until && filter.until < hotDataCutoff;

    return queryStartsBeforeCutoff || queryEndsBeforeCutoff;
  });

  if (!needsArchive || !env.EVENT_ARCHIVE) {
    return d1Result;
  }

  console.log('Query requires archive access - checking for missing events or old data');

  // Query archive for each filter that needs it
  const archiveEvents: NostrEvent[] = [];
  for (const filter of filters) {
    // Check if this specific filter needs archive
    const hasDirectIds = filter.ids && filter.ids.length > 0;
    const queryStartsBeforeCutoff = filter.since && filter.since < hotDataCutoff;
    const queryEndsBeforeCutoff = filter.until && filter.until < hotDataCutoff;

    if (hasDirectIds || queryStartsBeforeCutoff || queryEndsBeforeCutoff) {
      // For direct ID lookups, check which IDs are missing from D1 results
      if (hasDirectIds) {
        const foundIds = new Set(d1Result.events.map(e => e.id));
        // @ts-ignore
        const missingIds = filter.ids.filter(id => !foundIds.has(id));

        if (missingIds.length > 0) {
          console.log(`Checking archive for ${missingIds.length} missing event IDs`);
          const archiveFilter = { ...filter, ids: missingIds };

          // Don't apply time constraints for direct ID lookups in archive
          delete archiveFilter.since;
          delete archiveFilter.until;

          const archived = await queryArchive(archiveFilter, hotDataCutoff, env.EVENT_ARCHIVE);
          archiveEvents.push(...archived);
        }
      } else {
        // For time-based queries, adjust the filter for archive query to avoid overlap
        const archiveFilter = { ...filter };

        // If querying archive, cap the `until` at the cutoff to avoid overlap with D1
        if (!archiveFilter.until || archiveFilter.until > hotDataCutoff) {
          archiveFilter.until = hotDataCutoff;
        }

        const archived = await queryArchive(archiveFilter, hotDataCutoff, env.EVENT_ARCHIVE);
        archiveEvents.push(...archived);
      }
    }
  }

  // Merge results from D1 and archive
  const allEvents = new Map<string, NostrEvent>();

  // Add D1 events
  for (const event of d1Result.events) {
    allEvents.set(event.id, event);
  }

  // Add archive events
  for (const event of archiveEvents) {
    allEvents.set(event.id, event);
  }

  // Sort by created_at descending and apply overall limit
  const sortedEvents = Array.from(allEvents.values()).sort((a, b) => {
    if (b.created_at !== a.created_at) {
      return b.created_at - a.created_at;
    }
    return a.id.localeCompare(b.id);
  });

  // Apply the most restrictive limit from filters
  const limit = Math.min(...filters.map(f => f.limit || 10000));
  const limitedEvents = sortedEvents.slice(0, limit);

  console.log(`Query returned ${d1Result.events.length} events from D1, ${archiveEvents.length} from archive`);

  return {
    events: limitedEvents,
    bookmark: d1Result.bookmark
  };
}

// HTTP endpoints
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

// Export functions for use by Durable Object
export {
  verifyEventSignature,
  hasPaidForRelay,
  processEvent,
  queryEvents,
  queryEventsWithArchive,
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

  // Scheduled handler for archiving and maintenance
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Running scheduled maintenance...');

    try {
      // Run KV to D1 batch processing every minute
      if (KV_FIRST_WRITE_ENABLED) {
        console.log('Starting KV to D1 batch processing...');
        await batchEventsFromKVToD1(env);
        console.log('KV to D1 batch processing completed');
      }

      // Run archive process and database optimization every 30 minutes
      const currentMinute = new Date().getMinutes();
      if (currentMinute % 30 === 0) {
        console.log('Running archive and optimization (30-minute interval)...');

        await archiveOldEvents(env.RELAY_DATABASE, env.EVENT_ARCHIVE);
        console.log('Archive process completed successfully');

        // Use PRAGMA optimize - much more efficient
        const session = env.RELAY_DATABASE.withSession('first-primary');
        await session.prepare('PRAGMA optimize').run();
        console.log('Database optimization completed');
      }
    } catch (error) {
      console.error('Scheduled maintenance failed:', error);
    }
  }
};

// Export the Durable Object class
export { RelayWebSocket };