import { schnorr } from "@noble/curves/secp256k1";
import { Env, NostrEvent, NostrFilter, QueryResult } from './types';
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
} = config;

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
    const session = env.relayDb.withSession('first-unconstrained');
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
    const session = env.relayDb.withSession('first-primary');
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
        console.error(`Error processing fallback relay event for pubkey ${pubkey}: ${error}`);
        reject(error);
      }
    };

    ws.onerror = (error) => {
      console.error(`WebSocket error with fallback relay:`, error);
      ws.close();
      hasClosed = true;
      reject(error);
    };

    ws.onclose = () => {
      hasClosed = true;
      console.log('Fallback relay WebSocket connection closed.');
    };

    // Timeout if no response is received within 5 seconds
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

    const nip05Data = await response.json();

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

// Event processing
async function processEvent(event: NostrEvent, sessionId: string, env: Env): Promise<{ success: boolean; message: string }> {
  try {
    // Check for duplicate event ID
    const existingEvent = await env.relayDb.withSession('first-unconstrained')
      .prepare("SELECT id FROM events WHERE id = ? LIMIT 1")
      .bind(event.id)
      .first();

    if (existingEvent) {
      console.log(`Duplicate event detected: ${event.id}`);
      return { success: false, message: "duplicate: already have this event" };
    }

    // NIP-05 validation if enabled
    if (checkValidNip05 && event.kind !== 0) {
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
    const saveResult = await saveEventToD1(event, env);
    return saveResult;

  } catch (error: any) {
    console.error(`Error processing event: ${error.message}`);
    return { success: false, message: `error: ${error.message}` };
  }
}

async function saveEventToD1(event: NostrEvent, env: Env): Promise<{ success: boolean; message: string }> {
  try {
    const session = env.relayDb.withSession('first-primary');

    // Check for duplicate content (only if anti-spam is enabled)
    if (shouldCheckForDuplicates(event.kind)) {
      const contentHash = await hashContent(event);
      const duplicateCheck = enableGlobalDuplicateCheck
        ? await session.prepare("SELECT event_id FROM content_hashes WHERE hash = ? LIMIT 1").bind(contentHash).first()
        : await session.prepare("SELECT event_id FROM content_hashes WHERE hash = ? AND pubkey = ? LIMIT 1").bind(contentHash, event.pubkey).first();

      if (duplicateCheck) {
        return { success: false, message: "duplicate: content already exists" };
      }
    }

    // Insert event and related data
    const batch = [
      session.prepare(`
        INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(event.id, event.pubkey, event.created_at, event.kind, JSON.stringify(event.tags), event.content, event.sig)
    ];

    // Insert tags
    for (const tag of event.tags) {
      if (tag[0] && tag[1]) {
        batch.push(
          session.prepare(`
            INSERT INTO tags (event_id, tag_name, tag_value)
            VALUES (?, ?, ?)
          `).bind(event.id, tag[0], tag[1])
        );
      }
    }

    // Insert content hash (only if anti-spam is enabled)
    if (shouldCheckForDuplicates(event.kind)) {
      const contentHash = await hashContent(event);
      batch.push(
        session.prepare(`
          INSERT INTO content_hashes (hash, event_id, pubkey, created_at)
          VALUES (?, ?, ?, ?)
        `).bind(contentHash, event.id, event.pubkey, event.created_at)
      );
    }

    await session.batch(batch);
    console.log(`Event ${event.id} saved successfully to D1.`);
    return { success: true, message: "Event received successfully for processing" };

  } catch (error: any) {
    console.error(`Error saving event: ${error.message}`);
    return { success: false, message: "error: could not save event" };
  }
}

// Helper function to handle kind 5
async function processDeletionEvent(event: NostrEvent, env: Env): Promise<{ success: boolean; message: string }> {
  console.log(`Processing deletion event ${event.id}`);
  const deletedEventIds = event.tags.filter(tag => tag[0] === "e").map(tag => tag[1]);
  
  if (deletedEventIds.length === 0) {
    return { success: true, message: "No events to delete" };
  }

  const session = env.relayDb.withSession('first-primary');
  let deletedCount = 0;
  const errors: string[] = [];

  for (const eventId of deletedEventIds) {
    try {
      const existing = await session.prepare(
        "SELECT pubkey FROM events WHERE id = ? LIMIT 1"
      ).bind(eventId).first();

      if (!existing) {
        console.warn(`Event ${eventId} not found. Nothing to delete.`);
        continue;
      }

      if (existing.pubkey !== event.pubkey) {
        console.warn(`Event ${eventId} does not belong to pubkey ${event.pubkey}. Skipping deletion.`);
        errors.push(`unauthorized: cannot delete event ${eventId} - wrong pubkey`);
        continue;
      }

      const result = await session.prepare(
        "UPDATE events SET deleted = 1 WHERE id = ?"
      ).bind(eventId).run();

      if (result.meta.changes > 0) {
        console.log(`Event ${eventId} marked as deleted successfully.`);
        deletedCount++;
      }
    } catch (error) {
      console.error(`Error deleting event ${eventId}:`, error);
      errors.push(`error deleting ${eventId}`);
    }
  }

  if (errors.length > 0) {
    return { success: false, message: errors[0] };
  }

  return { 
    success: true, 
    message: deletedCount > 0 ? `Event successfully deleted` : "No matching events found to delete" 
  };
}

// Helper function to count query parameters
function countQueryParameters(filters: NostrFilter): number {
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

// Helper function to chunk arrays
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Helper function to handle chunked queries
async function queryDatabaseChunked(filters: NostrFilter, bookmark: string, env: Env): Promise<{ events: NostrEvent[] }> {
  const session = env.relayDb.withSession(bookmark);
  const allEvents = new Map<string, NostrEvent>();

  // Determine what needs chunking
  const needsChunking = {
    ids: filters.ids && filters.ids.length > 200,
    authors: filters.authors && filters.authors.length > 200,
    kinds: filters.kinds && filters.kinds.length > 200,
    tags: {} as Record<string, boolean>
  };

  // Check tag filters for chunking needs
  for (const [key, values] of Object.entries(filters)) {
    if (key.startsWith('#') && values && values.length > 200) {
      needsChunking.tags[key] = true;
    }
  }

  // If IDs need chunking, process in batches
  if (needsChunking.ids && filters.ids) {
    const idChunks = chunkArray(filters.ids, 200);

    for (const idChunk of idChunks) {
      const chunkFilters = { ...filters, ids: idChunk };
      const query = buildQuery(chunkFilters);

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
  }
  // If authors need chunking
  else if (needsChunking.authors && filters.authors) {
    const authorChunks = chunkArray(filters.authors, 200);

    for (const authorChunk of authorChunks) {
      const chunkFilters = { ...filters, authors: authorChunk };
      const query = buildQuery(chunkFilters);

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
  }
  // Handle tag chunking if needed
  else if (Object.keys(needsChunking.tags).length > 0) {
    // Process each large tag filter separately
    for (const [tagKey, _] of Object.entries(needsChunking.tags)) {
      const tagValues = filters[tagKey];
      if (Array.isArray(tagValues)) {
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
    const session = env.relayDb.withSession(bookmark);
    const eventSet = new Map<string, NostrEvent>();

    for (const filter of filters) {
      // Check if we need to use chunked query
      const paramCount = countQueryParameters(filter);
      
      if (paramCount > 900) { // Leave some margin below SQLite's 999 limit
        console.log(`Query has ${paramCount} parameters, using chunked query...`);
        const chunkedResult = await queryDatabaseChunked(filter, bookmark, env);
        for (const event of chunkedResult.events) {
          eventSet.set(event.id, event);
        }
        continue;
      }

      // For queries under 900 params but still large, truncate to be safe
      const safeFilter = { ...filter };
      if (safeFilter.ids && safeFilter.ids.length > 500) {
        console.log(`Large ID filter detected: ${safeFilter.ids.length} IDs. Truncating to 500.`);
        safeFilter.ids = safeFilter.ids.slice(0, 500);
      }
      
      if (safeFilter.authors && safeFilter.authors.length > 500) {
        console.log(`Large authors filter detected: ${safeFilter.authors.length} authors. Truncating to 500.`);
        safeFilter.authors = safeFilter.authors.slice(0, 500);
      }
      
      // Check tag filters
      for (const [key, values] of Object.entries(safeFilter)) {
        if (key.startsWith('#') && Array.isArray(values) && values.length > 500) {
          console.log(`Large tag filter detected for ${key}: ${values.length} values. Truncating to 500.`);
          safeFilter[key] = values.slice(0, 500);
        }
      }

      // Build and execute the query
      const query = buildQuery(safeFilter);
      console.log(`Executing query: ${query.sql}`);
      console.log(`Query parameters count: ${query.params.length}`);
      const result = await session.prepare(query.sql).bind(...query.params).all();

      // Log query metadata
      if (result.meta) {
        console.log({
          servedByRegion: result.meta.served_by_region ?? "",
          servedByPrimary: result.meta.served_by_primary ?? false,
        });
      }

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
        eventSet.set(event.id, event);
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

function buildQuery(filter: NostrFilter): { sql: string; params: any[] } {
  let sql = "SELECT * FROM events WHERE deleted = 0";
  const params: any[] = [];
  const conditions: string[] = [];

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

  // Tag filters
  const tagConditions: string[] = [];
  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith('#') && Array.isArray(values) && values.length > 0) {
      const tagName = key.substring(1);
      tagConditions.push(`
        id IN (
          SELECT event_id FROM tags 
          WHERE tag_name = ? AND tag_value IN (${values.map(() => '?').join(',')})
        )
      `);
      params.push(tagName, ...values);
    }
  }

  if (tagConditions.length > 0) {
    conditions.push(`(${tagConditions.join(' OR ')})`);
  }

  if (conditions.length > 0) {
    sql += " AND " + conditions.join(" AND ");
  }

  sql += " ORDER BY created_at DESC";
  sql += " LIMIT ?";
  params.push(Math.min(filter.limit || 10000, 10000));

  return { sql, params };
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
        <img src="https://raw.githubusercontent.com/Spl0itable/nosflare/main/images/nosflare.png" alt="Nosflare Logo" class="logo">
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

// Export functions for use by Durable Object
export { 
  verifyEventSignature, 
  hasPaidForRelay, 
  processEvent, 
  queryEvents
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
          // Use Durable Object for WebSocket connections
          const id = env.RELAY_WEBSOCKET.idFromName(url.hostname);
          const stub = env.RELAY_WEBSOCKET.get(id);
          return stub.fetch(request);
        } else if (request.headers.get("Accept") === "application/nostr+json") {
          return handleRelayInfoRequest(request);
        } else {
          // Serve the landing page
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

// Export the Durable Object class
export { RelayWebSocket };