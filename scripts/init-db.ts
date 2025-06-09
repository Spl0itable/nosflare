import { D1Database } from '@cloudflare/workers-types';

async function initializeDatabase(db: D1Database) {
  console.log("Initializing D1 database schema...");

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
    `CREATE INDEX IF NOT EXISTS idx_events_kind_created_at ON events(kind, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_events_deleted_kind ON events(deleted, kind)`,
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
    `CREATE INDEX IF NOT EXISTS idx_content_hashes_pubkey ON content_hashes(pubkey)`,
    `PRAGMA foreign_keys = ON`,
    `INSERT OR REPLACE INTO system_config (key, value) VALUES ('db_initialized', '1')`,
    `INSERT OR REPLACE INTO system_config (key, value) VALUES ('schema_version', '1')`
  ];

  for (const statement of statements) {
    try {
      await db.prepare(statement).run();
      console.log(`✓ Executed: ${statement.substring(0, 50)}...`);
    } catch (error) {
      console.error(`✗ Failed to execute: ${statement}`);
      throw error;
    }
  }

  console.log("Database initialization completed!");
}

// This will be called by wrangler
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    try {
      await initializeDatabase(env.relayDb);
      return new Response("Database initialized successfully!", { status: 200 });
    } catch (error) {
      return new Response(`Database initialization failed: ${error}`, { status: 500 });
    }
  }
};