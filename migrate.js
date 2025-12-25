// R2 to D1 Migration Worker

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return new Response(getMigrationHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (url.pathname === '/api/migrate' && request.method === 'POST') {
      return startMigration(env);
    }

    if (url.pathname === '/api/reset' && request.method === 'POST') {
      return resetMigration(env);
    }

    if (url.pathname === '/api/process-batch' && request.method === 'POST') {
      return processSingleBatch(env);
    }

    if (url.pathname === '/api/status' && request.method === 'GET') {
      return getMigrationStatus(env);
    }

    return new Response('Not found', { status: 404 });
  }
};

// Reset migration state
async function resetMigration(env) {
  try {
    await env.D1_DB.prepare(
      "DELETE FROM system_config WHERE key = 'migration_state'"
    ).run();

    // Delete the migration queue from R2
    await env.R2_BUCKET.delete('migration_queue.json');

    return new Response(JSON.stringify({
      success: true,
      message: 'Migration state reset successfully'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Start migration
async function startMigration(env) {
  try {
    // Check if migration is already in progress
    const existingState = await env.D1_DB.prepare(
      "SELECT value FROM system_config WHERE key = 'migration_state' LIMIT 1"
    ).first();

    if (existingState) {
      const state = JSON.parse(existingState.value);

      if (state.inProgress) {
        return new Response(JSON.stringify({
          error: 'Migration already in progress',
          hint: 'Use the Reset button if you need to start over'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // Initialize database schema
    await initializeDatabase(env.D1_DB);

    // Create initial migration state
    const migrationState = {
      inProgress: true,
      phase: 'scanning',
      total: 0,
      migrated: 0,
      failed: 0,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      currentBatch: 0,
      sections: {
        events: 0,
        paidPubkeys: 0,
        hashes: 0
      }
      // No queue or totalBatches for events
    };

    await env.D1_DB.prepare(
      "INSERT OR REPLACE INTO system_config (key, value) VALUES ('migration_state', ?)"
    ).bind(JSON.stringify(migrationState)).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Migration started',
      needsProcessing: true
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error starting migration:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Process a single batch
async function processSingleBatch(env) {
  try {
    // Get current migration state
    const stateResult = await env.D1_DB.prepare(
      "SELECT value FROM system_config WHERE key = 'migration_state' LIMIT 1"
    ).first();

    if (!stateResult) {
      return new Response(JSON.stringify({
        error: 'No migration in progress'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    let state = JSON.parse(stateResult.value);

    if (!state.inProgress) {
      return new Response(JSON.stringify({
        complete: true,
        message: 'Migration already completed'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Update last activity timestamp
    state.lastUpdate = Date.now();

    // Process based on current phase
    let result = {};
    try {
      switch (state.phase) {
        case 'scanning':
          result = await scanItems(env, state);
          break;
        case 'migrating_paid_pubkeys':
          result = await migratePaidPubkeysBatch(env, state);
          break;
        case 'migrating_events':
          result = await migrateEventsBatch(env, state);
          break;
        case 'migrating_hashes':
          result = await migrateHashesBatch(env, state);
          break;
        default:
          state.inProgress = false;
          state.phase = 'complete';
          result = { complete: true };
      }
    } catch (error) {
      console.error(`Error in phase ${state.phase}:`, error);
      result = { error: error.message };
    }

    // Save updated state
    await env.D1_DB.prepare(
      "UPDATE system_config SET value = ? WHERE key = 'migration_state'"
    ).bind(JSON.stringify(state)).run();

    const progress = state.total > 0 ? Math.floor((state.migrated + state.failed) / state.total * 100) : 0;

    return new Response(JSON.stringify({
      success: true,
      phase: state.phase,
      progress,
      complete: !state.inProgress,
      continueProcessing: state.inProgress,
      stats: {
        total: state.total,
        migrated: state.migrated,
        failed: state.failed,
        sections: state.sections
      },
      ...result
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error processing batch:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Scan items in R2
async function scanItems(env, state) {
  console.log('Scanning R2 bucket...');

  const listOptions = {
    prefix: 'events/',
    limit: 1000
  };

  if (state.cursor && typeof state.cursor === 'string') {
    listOptions.cursor = state.cursor;
  }

  const listed = await env.R2_BUCKET.list(listOptions);
  const events = [];

  for (const object of listed.objects) {
    if (object.key.startsWith('events/event:')) {
      events.push({
        type: 'event',
        key: object.key
      });
    }
  }

  // Get existing queue from R2 (if any)
  let existingQueue = [];
  try {
    const queueObj = await env.R2_BUCKET.get('migration_queue.json');
    if (queueObj) {
      existingQueue = JSON.parse(await queueObj.text());
    }
  } catch (error) {
    // Queue doesn't exist yet
  }

  // Add new events to existing queue
  const newQueue = [...existingQueue, ...events];

  // Save updated queue to R2
  await env.R2_BUCKET.put('migration_queue.json', JSON.stringify(newQueue), {
    customMetadata: {
      totalEvents: String(newQueue.length),
      lastUpdated: String(Date.now())
    }
  });

  if (listed.truncated && listed.cursor) {
    state.cursor = listed.cursor;
    console.log(`Scanning... found ${newQueue.length} items so far...`);
    return { scanning: true, found: newQueue.length };
  } else {
    delete state.cursor;
    console.log(`Scan complete. Found ${newQueue.length} events`);
    state.sections.events = newQueue.length;
    state.phase = 'migrating_paid_pubkeys';
    return { scanComplete: true, totalEvents: newQueue.length };
  }
}

// Migrate paid pubkeys in batches
async function migratePaidPubkeysBatch(env, state) {
  console.log('Migrating paid pubkeys batch...');

  const listOptions = {
    prefix: 'paid-pubkeys/',
    limit: 50
  };

  if (state.cursor && typeof state.cursor === 'string') {
    listOptions.cursor = state.cursor;
  }

  const listed = await env.R2_BUCKET.list(listOptions);

  let count = 0;
  for (const object of listed.objects) {
    try {
      const data = await env.R2_BUCKET.get(object.key);
      if (data) {
        const paidData = JSON.parse(await data.text());
        await env.D1_DB.prepare(
          `INSERT OR IGNORE INTO paid_pubkeys (pubkey, paid_at, amount_sats)
           VALUES (?, ?, ?)`
        ).bind(
          paidData.pubkey,
          paidData.paidAt || Math.floor(Date.now() / 1000),
          paidData.amountSats || null
        ).run();
        count++;
        state.migrated++;
      }
    } catch (error) {
      console.error(`Error migrating paid pubkey ${object.key}:`, error);
      state.failed++;
    }
  }

  state.sections.paidPubkeys += count;

  if (listed.truncated && listed.cursor) {
    state.cursor = listed.cursor;
    return { migratedInBatch: count };
  } else {
    delete state.cursor;
    console.log(`Completed paid pubkeys. Total: ${state.sections.paidPubkeys}`);
    state.phase = 'migrating_events';
    state.total = state.sections.paidPubkeys + state.sections.events;
    state.currentBatch = 0;
    state.totalBatches = Math.ceil(state.queue.length / 50);
    return { phaseComplete: true, totalPaidPubkeys: state.sections.paidPubkeys };
  }
}

// Migrate events in batches
async function migrateEventsBatch(env, state) {
  try {
    // Get queue from R2
    const queueObj = await env.R2_BUCKET.get('migration_queue.json');
    if (!queueObj) {
      console.log('No migration queue found');
      return { migrationComplete: true };
    }

    const queue = JSON.parse(await queueObj.text());
    if (queue.length === 0) {
      console.log('Migration queue is empty');
      return { migrationComplete: true };
    }

    const BATCH_SIZE = 50;
    const startIdx = state.currentBatch * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, queue.length);

    console.log(`Processing events batch ${state.currentBatch + 1}/${Math.ceil(queue.length / BATCH_SIZE)}`);

    const batch = queue.slice(startIdx, endIdx);
    let migratedCount = 0;

    for (const item of batch) {
      try {
        const eventObject = await env.R2_BUCKET.get(item.key);
        if (!eventObject) {
          state.failed++;
          continue;
        }

        const event = JSON.parse(await eventObject.text());

        // Check if event already exists
        const existing = await env.D1_DB.prepare(
          "SELECT id FROM events WHERE id = ? LIMIT 1"
        ).bind(event.id).first();

        if (!existing) {
          // Insert event and tags
          const statements = [];

          statements.push(
            env.D1_DB.prepare(
              `INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig)
              VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
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
              statements.push(
                env.D1_DB.prepare(
                  `INSERT INTO tags (event_id, tag_name, tag_value)
                  VALUES (?, ?, ?)`
                ).bind(event.id, tagName, tagValue)
              );
            }
          }

          await env.D1_DB.batch(statements);
        }

        state.migrated++;
        migratedCount++;
      } catch (error) {
        console.error(`Error migrating event:`, error);
        state.failed++;
      }
    }

    // Update queue - remove processed items
    const remainingQueue = queue.slice(endIdx);
    await env.R2_BUCKET.put('migration_queue.json', JSON.stringify(remainingQueue), {
      customMetadata: {
        totalEvents: String(remainingQueue.length),
        lastUpdated: String(Date.now())
      }
    });

    state.currentBatch++;

    if (remainingQueue.length === 0) {
      console.log('Events migration complete');
      state.phase = 'migrating_hashes';
      state.currentBatch = 0;
      return { phaseComplete: true, migratedInBatch: migratedCount };
    } else {
      return {
        migratedInBatch: migratedCount,
        currentBatch: state.currentBatch,
        totalBatches: Math.ceil(remainingQueue.length / BATCH_SIZE)
      };
    }
  } catch (error) {
    console.error('Error migrating events batch:', error);
    throw error;
  }
}

// Migrate content hashes in batches
async function migrateHashesBatch(env, state) {
  console.log('Migrating content hashes batch...');

  const listOptions = {
    prefix: 'hashes/',
    limit: 100
  };

  if (state.cursor && typeof state.cursor === 'string') {
    listOptions.cursor = state.cursor;
  }

  const listed = await env.R2_BUCKET.list(listOptions);

  let count = 0;
  let skipped = 0;

  for (const object of listed.objects) {
    try {
      // Get the object with metadata
      const dataObject = await env.R2_BUCKET.get(object.key);
      if (!dataObject) {
        console.warn(`No data found for hash key: ${object.key}`);
        skipped++;
        continue;
      }

      let hashData = {};

      // First check if there's custom metadata
      if (dataObject.customMetadata) {
        hashData = { ...dataObject.customMetadata };
      }

      // If body exists, try to parse it and merge with metadata
      const text = await dataObject.text();
      if (text && text.trim()) {
        try {
          const bodyData = JSON.parse(text);
          hashData = { ...hashData, ...bodyData };
        } catch (e) {
          console.warn(`Failed to parse body for ${object.key}, using metadata only`);
        }
      }

      // Extract hash parts from the key
      const keyParts = object.key.split('/');
      if (keyParts.length < 2) {
        console.warn(`Invalid hash key format: ${object.key}`);
        skipped++;
        continue;
      }

      const hashParts = keyParts[1];

      let hash, pubkey;

      if (hashParts.includes(':')) {
        const parts = hashParts.split(':');
        if (parts.length === 2) {
          [pubkey, hash] = parts;
        } else {
          console.warn(`Invalid hash format: ${hashParts}`);
          skipped++;
          continue;
        }
      } else {
        hash = hashParts;
        pubkey = hashData.pubkey;
      }

      let eventId = hashData.eventId || hashData.event_id || hashData.id;

      if (!eventId && hashData.id && hashData.sig) {
        eventId = hashData.id;

        if (!pubkey && hashData.pubkey) {
          pubkey = hashData.pubkey;
        }
      }

      // Validate all required fields
      if (!hash) {
        console.warn(`Missing hash for key: ${object.key}`);
        skipped++;
        continue;
      }

      if (!eventId) {
        console.warn(`Missing eventId for hash: ${object.key}`);
        console.warn('Available data:', JSON.stringify(hashData).substring(0, 200) + '...');
        skipped++;
        continue;
      }

      if (!pubkey) {
        // Try to get pubkey from the event in the database
        const event = await env.D1_DB.prepare(
          "SELECT pubkey FROM events WHERE id = ? LIMIT 1"
        ).bind(eventId).first();

        if (event) {
          pubkey = event.pubkey;
        } else {
          console.warn(`Missing pubkey for hash: ${object.key}, eventId: ${eventId}`);
          skipped++;
          continue;
        }
      }

      const createdAt = hashData.timestamp || hashData.created_at ||
        (object.uploaded ? Math.floor(object.uploaded.getTime() / 1000) : Math.floor(Date.now() / 1000));

      // Insert the hash record
      await env.D1_DB.prepare(
        `INSERT OR IGNORE INTO content_hashes (hash, event_id, pubkey, created_at)
         VALUES (?, ?, ?, ?)`
      ).bind(
        hash,
        eventId,
        pubkey,
        createdAt
      ).run();

      count++;
      state.migrated++;

    } catch (error) {
      console.error(`Error migrating content hash ${object.key}:`, error);
      console.error('Error details:', error.message);
      state.failed++;
    }
  }

  state.sections.hashes += count;

  // Update total when we have processed some hashes
  if (count > 0 && !state.hashesTotalUpdated) {
    // Try to estimate total hashes if this is first batch
    state.total = state.total || state.sections.paidPubkeys + state.sections.events;
    state.total += count * 10;
    state.hashesTotalUpdated = true;
  }

  console.log(`Processed ${count} hashes, skipped ${skipped} in this batch`);

  if (listed.truncated && listed.cursor) {
    state.cursor = listed.cursor;
    return { migratedInBatch: count, skipped };
  } else {
    // Migration complete
    console.log(`Migration complete! Total hashes: ${state.sections.hashes}`);
    state.phase = 'complete';
    state.inProgress = false;
    delete state.cursor;

    // Adjust total to actual count
    if (state.hashesTotalUpdated) {
      state.total = state.sections.paidPubkeys + state.sections.events + state.sections.hashes;
    }

    return { migrationComplete: true, totalHashes: state.sections.hashes };
  }
}

// Get migration status
async function getMigrationStatus(env) {
  try {
    const result = await env.D1_DB.prepare(
      "SELECT value FROM system_config WHERE key = 'migration_state' LIMIT 1"
    ).first();

    if (result) {
      const state = JSON.parse(result.value);
      const percent = state.total > 0 ? Math.floor((state.migrated + state.failed) / state.total * 100) : 0;

      return new Response(JSON.stringify({
        inProgress: state.inProgress,
        complete: !state.inProgress && state.phase === 'complete',
        phase: state.phase,
        percent,
        lastUpdate: state.lastUpdate,
        stats: {
          total: state.total,
          migrated: state.migrated,
          failed: state.failed,
          sections: state.sections
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({
      inProgress: false,
      complete: false,
      percent: 0,
      stats: { total: 0, migrated: 0, failed: 0 }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Initialize D1 database schema
async function initializeDatabase(db) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,

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

    `CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey)`,
    `CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind)`,
    `CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_events_pubkey_kind ON events(pubkey, kind)`,
    `CREATE INDEX IF NOT EXISTS idx_events_deleted ON events(deleted)`,

    `CREATE TABLE IF NOT EXISTS tags (
      event_id TEXT NOT NULL,
      tag_name TEXT NOT NULL,
      tag_value TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_tags_name_value ON tags(tag_name, tag_value)`,
    `CREATE INDEX IF NOT EXISTS idx_tags_event_id ON tags(event_id)`,

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
    await db.prepare(statement).run();
  }

  await db.prepare("PRAGMA foreign_keys = ON").run();
}

// HTML for migration page
function getMigrationHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>R2 to D1 Migration Tool</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #0a0a0a;
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem;
        }
        
        .container {
            max-width: 800px;
            width: 100%;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 2rem;
            backdrop-filter: blur(10px);
        }
        
        h1 {
            font-size: 2rem;
            margin-bottom: 1.5rem;
            background: linear-gradient(135deg, #ff4500, #ff8c00);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .status-box {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 69, 0, 0.3);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            line-height: 1.6;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .status-line {
            margin-bottom: 0.5rem;
            padding: 0.25rem 0;
        }
        
        .status-line.success {
            color: #4CAF50;
        }
        
        .status-line.error {
            color: #f44336;
        }
        
        .status-line.info {
            color: #2196F3;
        }
        
        .status-line.warning {
            color: #ff9800;
        }
        
        .progress-bar {
            width: 100%;
            height: 30px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            overflow: hidden;
            margin-bottom: 2rem;
            position: relative;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #ff4500, #ff8c00);
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 0.9rem;
        }
        
        .button {
            background: linear-gradient(135deg, #ff4500, #ff8c00);
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            width: 100%;
            margin-bottom: 1rem;
        }
        
        .button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(255, 69, 0, 0.4);
        }
        
        .button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .button.danger {
            background: linear-gradient(135deg, #d32f2f, #f44336);
        }
        
        .phase-indicator {
            background: rgba(255, 140, 0, 0.1);
            border: 1px solid rgba(255, 140, 0, 0.3);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            text-align: center;
            font-weight: 600;
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
            text-align: center;
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
        
        .warning-box {
            background: rgba(255, 152, 0, 0.1);
            border: 1px solid rgba(255, 152, 0, 0.3);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 2rem;
        }
        
        .warning-box h3 {
            color: #ff9800;
            margin-bottom: 0.5rem;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .processing-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            background: #4CAF50;
            border-radius: 50%;
            margin-left: 0.5rem;
            animation: pulse 1s infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔄 R2 to D1 Migration Tool</h1>
        
        <div class="warning-box">
            <h3>⚠️ Important</h3>
            <p>This tool will migrate all data from your R2 bucket to D1 database.</p>
            <p>The migration will process automatically in batches.</p>
        </div>
        
        <div class="phase-indicator" id="phaseIndicator" style="display: none;">
            Current Phase: <span id="currentPhase">-</span>
            <span class="processing-indicator" id="processingIndicator" style="display: none;"></span>
        </div>
        
        <div class="progress-bar">
            <div class="progress-fill" id="progressBar">0%</div>
        </div>
        
        <button class="button" id="migrateBtn" onclick="startMigration()">
            Start Migration
        </button>
        
        <button class="button danger" id="resetBtn" onclick="resetMigration()">
            Reset Migration
        </button>
        
        <div class="status-box" id="statusBox">
            <div class="status-line info">Ready to start migration...</div>
        </div>
        
        <div class="stats" id="stats" style="display: none;">
            <div class="stat-item">
                <div class="stat-value" id="totalItems">0</div>
                <div class="stat-label">Total Items</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" id="migratedItems">0</div>
                <div class="stat-label">Migrated</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" id="failedItems">0</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" id="duration">0s</div>
                <div class="stat-label">Duration</div>
            </div>
        </div>
    </div>
    
    <script>
        let migrationInProgress = false;
        let processingInterval = null;
        let statusInterval = null;
        let startTime = null;
        let batchCount = 0;
        
        const phaseNames = {
            'scanning': 'Scanning R2 Bucket',
            'migrating_paid_pubkeys': 'Migrating Paid Pubkeys',
            'migrating_events': 'Migrating Events',
            'migrating_hashes': 'Migrating Content Hashes',
            'complete': 'Migration Complete'
        };
        
        function addStatusLine(message, type = 'info') {
            const statusBox = document.getElementById('statusBox');
            const line = document.createElement('div');
            line.className = 'status-line ' + type;
            line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
            statusBox.appendChild(line);
            statusBox.scrollTop = statusBox.scrollHeight;
        }
        
        function updateProgress(percent) {
            const progressBar = document.getElementById('progressBar');
            progressBar.style.width = percent + '%';
            progressBar.textContent = percent + '%';
        }
        
        function updatePhase(phase) {
            const indicator = document.getElementById('phaseIndicator');
            const phaseSpan = document.getElementById('currentPhase');
            indicator.style.display = 'block';
            phaseSpan.textContent = phaseNames[phase] || phase;
        }
        
        function updateStats(stats) {
            document.getElementById('stats').style.display = 'grid';
            document.getElementById('totalItems').textContent = stats.total || 0;
            document.getElementById('migratedItems').textContent = stats.migrated || 0;
            document.getElementById('failedItems').textContent = stats.failed || 0;
            
            if (startTime) {
                const duration = Math.floor((Date.now() - startTime) / 1000);
                document.getElementById('duration').textContent = duration + 's';
            }
        }
        
        async function startMigration() {
            const btn = document.getElementById('migrateBtn');
            btn.disabled = true;
            btn.textContent = 'Starting...';
            
            try {
                const response = await fetch('/api/migrate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    addStatusLine('Error: ' + (data.error || 'Failed to start migration'), 'error');
                    if (data.hint) {
                        addStatusLine('Hint: ' + data.hint, 'warning');
                    }
                    btn.disabled = false;
                    btn.textContent = 'Start Migration';
                    return;
                }
                
                migrationInProgress = true;
                startTime = Date.now();
                batchCount = 0;
                btn.textContent = 'Migration in Progress...';
                
                addStatusLine('Migration started successfully', 'info');
                
                // Show processing indicator
                document.getElementById('processingIndicator').style.display = 'inline-block';
                
                // Start processing batches
                processBatches();
                
                // Start status polling
                statusInterval = setInterval(checkStatus, 2000);
                
            } catch (error) {
                addStatusLine('Error: ' + error.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Start Migration';
            }
        }
        
        async function processBatches() {
            if (!migrationInProgress) return;
            
            try {
                const response = await fetch('/api/process-batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    addStatusLine('Error processing batch: ' + (data.error || 'Unknown error'), 'error');
                    stopProcessing();
                    return;
                }
                
                batchCount++;
                
                // Log batch results
                if (data.scanning) {
                    addStatusLine('Scanning... found ' + data.found + ' events so far', 'info');
                } else if (data.scanComplete) {
                    addStatusLine('Scan complete. Found ' + data.totalEvents + ' total events', 'info');
                } else if (data.migratedInBatch !== undefined) {
                    addStatusLine('Batch ' + batchCount + ': Migrated ' + data.migratedInBatch + ' items', 'info');
                }
                
                if (data.phaseComplete) {
                    addStatusLine('Starting phase: ' + phaseNames[data.phase] || data.phase, 'info');
                }
                
                if (data.complete || data.migrationComplete) {
                    migrationComplete(data);
                } else if (data.continueProcessing) {
                    // Continue processing with a small delay to avoid overwhelming the server
                    setTimeout(() => processBatches(), 500);
                } else {
                    stopProcessing();
                }
                
            } catch (error) {
                addStatusLine('Error: ' + error.message, 'error');
                stopProcessing();
            }
        }
        
        function stopProcessing() {
            migrationInProgress = false;
            document.getElementById('processingIndicator').style.display = 'none';
            
            const btn = document.getElementById('migrateBtn');
            btn.disabled = false;
            btn.textContent = 'Start Migration';
            
            if (statusInterval) {
                clearInterval(statusInterval);
                statusInterval = null;
            }
        }
        
        async function resetMigration() {
            if (!confirm('Are you sure you want to reset the migration? This will clear any existing migration state.')) {
                return;
            }
            
            try {
                const response = await fetch('/api/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    addStatusLine('Migration state reset successfully', 'success');
                    
                    // Clear UI
                    document.getElementById('phaseIndicator').style.display = 'none';
                    document.getElementById('processingIndicator').style.display = 'none';
                    updateProgress(0);
                    
                    // Reset stats display
                    document.getElementById('stats').style.display = 'none';
                    document.getElementById('totalItems').textContent = '0';
                    document.getElementById('migratedItems').textContent = '0';
                    document.getElementById('failedItems').textContent = '0';
                    document.getElementById('duration').textContent = '0s';
                    
                    // Reset state variables
                    startTime = null;
                    batchCount = 0;
                    stopProcessing();
                } else {
                    addStatusLine('Error resetting: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                addStatusLine('Error: ' + error.message, 'error');
            }
        }
        
        async function checkStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                if (data.phase) {
                    updatePhase(data.phase);
                }
                
                if (data.percent !== undefined) {
                    updateProgress(data.percent);
                }
                
                if (data.stats) {
                    updateStats(data.stats);
                }
                
            } catch (error) {
                console.error('Error checking status:', error);
            }
        }
        
        function migrationComplete(data) {
            stopProcessing();
            
            updateProgress(100);
            updatePhase('complete');
            
            if (data.stats) {
                updateStats(data.stats);
            }
            
            addStatusLine('Migration completed successfully!', 'success');
            addStatusLine('Total migrated: ' + (data.stats?.migrated || 0), 'success');
            
            if (data.stats?.failed > 0) {
                addStatusLine('Failed items: ' + data.stats.failed, 'warning');
            }
            
            addStatusLine('Total batches processed: ' + batchCount, 'success');
        }
        
        // Check initial status on page load
        window.addEventListener('DOMContentLoaded', async () => {
            await checkStatus();
        });
    </script>
</body>
</html>
  `;
}