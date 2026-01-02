## v7.9.33 - 2026-01-03

Hotfix: session/bookmark storage improvement

## v7.9.32 - 2026-01-03

Hotfix: tag handling in queries

## v7.9.31 - 2026-01-02

Hotfix: tag insertion issue

## v7.9.30 - 2026-01-02

Hotfix: removed support for Queue

## v7.9.29 - 2026-01-02

New: NIP-42 support

## v7.8.29 - 2026-01-02

New: added automatic database pruning to stay under D1's 10GB storage limit

## v7.7.29 - 2026-01-02

Hotfix: tags handling optimization

## v7.7.28 - 2026-01-01

Hotfix: simplified db optimization schedule

## v7.7.27 - 2026-01-01

Hotfix: issue with queue consumer conurrency

## v7.7.26 - 2026-01-01

Hotfix: added global cache api

## v7.7.25 - 2025-12-31

Hotfix: removed r2 bucket event archiving

## v7.7.24 - 2025-12-31

Hotfix: bug in query logic

## v7.7.23 - 2025-12-31

Hotfix: direct ID lookup bug with R2 bucket

## v7.7.22 - 2025-12-31

Hotfix: reduce unnecessary calls to R2 bucket

## v7.7.21 - 2025-12-31

Hotfix: set max returned events from 5000 to 500

## v7.7.20 - 2025-12-31

Hotfix: unnecessary calls to R2 bucket from REQs

## v7.7.19 - 2025-12-31

Hotfix: broken event archive system

## v7.7.18 - 2025-11-19

Hotfix: possible infinite loop in DOs alarm

## v7.7.17 - 2025-11-19

Hotfix: optimized tag handling

## v7.7.16 - 2025-11-18

Hotfix: return up to 5000 events if value in REQ too high instead of immediate close

## v7.7.15 - 2025-11-18

New: more indexes, better query handling, caching, and other database optimizations

*NOTE* this update includes is a small breaking change if database is already live. Please run the following from the Storage & Databases > D1 SQL database page in the Cloudflare dashboard and select your relay's database. Then click into console from the top menu. From there, run these commands:

```
CREATE TABLE IF NOT EXISTS event_tags_cache_multi (
  event_id TEXT NOT NULL,
  pubkey TEXT NOT NULL,
  kind INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  tag_type TEXT NOT NULL CHECK(tag_type IN ('p', 'e', 'a', 't', 'd', 'r')),
  tag_value TEXT NOT NULL,
  PRIMARY KEY (event_id, tag_type, tag_value)
);
CREATE INDEX IF NOT EXISTS idx_cache_multi_type_value_time ON event_tags_cache_multi(tag_type, tag_value, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_multi_type_value_event ON event_tags_cache_multi(tag_type, tag_value, event_id);
CREATE INDEX IF NOT EXISTS idx_cache_multi_kind_type_value ON event_tags_cache_multi(kind, tag_type, tag_value, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_multi_event_id ON event_tags_cache_multi(event_id);
CREATE TABLE IF NOT EXISTS mv_follow_graph (
  follower_pubkey TEXT NOT NULL,
  followed_pubkey TEXT NOT NULL,
  last_updated INTEGER NOT NULL,
  PRIMARY KEY (follower_pubkey, followed_pubkey)
);
CREATE INDEX IF NOT EXISTS idx_mv_follow_graph_follower ON mv_follow_graph(follower_pubkey);
CREATE INDEX IF NOT EXISTS idx_mv_follow_graph_followed ON mv_follow_graph(followed_pubkey);
CREATE TABLE IF NOT EXISTS mv_timeline_cache (
  follower_pubkey TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_pubkey TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  kind INTEGER NOT NULL,
  PRIMARY KEY (follower_pubkey, event_id)
);
CREATE INDEX IF NOT EXISTS idx_mv_timeline_follower_time ON mv_timeline_cache(follower_pubkey, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mv_timeline_event ON mv_timeline_cache(event_id);
CREATE TABLE IF NOT EXISTS mv_recent_notes (
  id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  kind INTEGER NOT NULL,
  tags TEXT NOT NULL,
  content TEXT NOT NULL,
  sig TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mv_recent_notes_created_at ON mv_recent_notes(created_at DESC);
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
WHERE t.tag_name IN ('p', 'e', 'a', 't', 'd', 'r');
INSERT INTO mv_recent_notes (id, pubkey, created_at, kind, tags, content, sig)
SELECT id, pubkey, created_at, kind, tags, content, sig
FROM events
WHERE kind = 1 AND created_at > (strftime('%s', 'now') - 86400)
ORDER BY created_at DESC
LIMIT 1000;
INSERT OR REPLACE INTO system_config (key, value) VALUES ('schema_version', '5');
ANALYZE events;
ANALYZE tags;
ANALYZE event_tags_cache;
ANALYZE event_tags_cache_multi;
ANALYZE mv_follow_graph;
ANALYZE mv_timeline_cache;
ANALYZE mv_recent_notes;
```

## v7.6.15 - 2025-11-17

New: uses Queues for all event messages

## v7.5.15 - 2025-11-17

Hotfix: cache published event IDs to prevent duplicates

## v7.5.14 - 2025-11-17

Hotfix: optimized the KV write buffer

## v7.5.13 - 2025-11-17

New: uses KV write buffer

## v7.4.13 - 2025-11-16

Hotfix: added alarms to shutdown DOs

## v7.4.12 - 2025-11-02

Hotfix: increased unbound queries to last 90 days

## v7.4.11 - 2025-10-23

Hotfix: lowered the archived event batch size

## v7.4.10 - 2025-10-23

Hotfix: lowered the REQ and EVENT messages rate limit amount

## v7.4.9 - 2025-09-27

Hotfix: removed excessive ANALYZE functionality, replaced with PRAGMA optimize

## v7.4.8 - 2025-09-26

Tweak: added REQ query cachhing to durable objects and added new compound indices.

*NOTE* this update includes is a small breaking change if database is already live. Please run the following from the Storage & Databases > D1 SQL database page in the Cloudflare dashboard and select your relay's database. Then click into console from the top menu. From there, run these commands:

```
DROP INDEX IF EXISTS idx_events_pubkey_kind;
DROP INDEX IF EXISTS idx_events_deleted;
DROP INDEX IF EXISTS idx_events_deleted_kind;
CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_pubkey_kind_created_at ON events(pubkey, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_kind_pubkey_created_at ON events(kind, pubkey, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_authors_kinds ON events(pubkey, kind) WHERE kind IN (0, 1, 3, 4, 6, 7, 1984, 9735, 10002);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_kind_created_at ON events(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_pubkey_created_at ON events(pubkey, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created_at_kind ON events(created_at DESC, kind);
CREATE INDEX IF NOT EXISTS idx_tags_name_value ON tags(tag_name, tag_value);
CREATE INDEX IF NOT EXISTS idx_tags_name_value_event ON tags(tag_name, tag_value, event_id);
CREATE INDEX IF NOT EXISTS idx_tags_event_id ON tags(event_id);
CREATE INDEX IF NOT EXISTS idx_tags_value ON tags(tag_value);
CREATE TABLE IF NOT EXISTS event_tags_cache (
  event_id TEXT NOT NULL,
  pubkey TEXT NOT NULL,
  kind INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  tag_p TEXT,
  tag_e TEXT,
  tag_a TEXT,
  PRIMARY KEY (event_id)
);
CREATE INDEX IF NOT EXISTS idx_event_tags_cache_p ON event_tags_cache(tag_p, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_tags_cache_e ON event_tags_cache(tag_e, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_tags_cache_kind_p ON event_tags_cache(kind, tag_p);
CREATE INDEX IF NOT EXISTS idx_event_tags_cache_p_e ON event_tags_cache(tag_p, tag_e) WHERE tag_p IS NOT NULL AND tag_e IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_tags_cache_kind_created_at ON event_tags_cache(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_tags_cache_pubkey_kind_created_at ON event_tags_cache(pubkey, kind, created_at DESC);
INSERT OR REPLACE INTO system_config (key, value) VALUES ('schema_version', '2');
ANALYZE events;
ANALYZE tags;
ANALYZE event_tags_cache;
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
);
ANALYZE event_tags_cache;
```

## v7.3.8 - 2025-09-25

Hotfix: optimized event deletions and fixed redundant deletion check

## v7.3.7 - 2025-09-25

Tweak: enhanced database query chunking to encompass any REQ filter with array values greater than 50

## v7.2.7 - 2025-07-15

- Hotfix: bypass kind 1059 from pubkey allowlist, nip05 validation, and rate-limiting

## v7.2.6 - 2025-06-18

- New: hybrid storage capacity to archive older events than 90 days to R2 bucket

## v7.1.6 - 2025-06-16

- Hotfix: included almost all country ISO codes for better Durable Object mesh network routing

## v7.1.5 - 2025-06-15

- Hotfix: changed Durable Objects to be zero-latency SQLite-backed

## v7.1.4 - 2025-06-15

- Hotfix: support for Websocket Hibernation API
- Hotfix: removed peer discovery interval

## v7.1.3 - 2025-06-14

- Hotfix: set peer caching

## v7.1.2 - 2025-06-14

- Hotfix: improved multi-regional selection for Durable Objects

## v7.1.1 - 2025-06-14

- Tweak: multi-regional Durable Object mesh network to increase throughput and load balancing

## v7.0.1 - 2025-06-11

- Hotfix: improved large query chunking

## v7.0.0 - 2025-06-09

- New: refactored code into typescript
- New: uses cloudflare durable object to handle websocket connection for real-time updates
- New: includes a database initialization script to build D1 database tables on first build

## v6.0.4 - 2025-06-07

- Hotfix: case where too many params in query could overload sqlite

## v6.0.3 - 2025-06-07

- Hotfix: improved caching, websocket inactivity, and removed bloat

## v6.0.2 - 2025-06-06

- Hotfix: improved database initialization and websocket handler

## v6.0.1 - 2025-06-05

- Hotfix: corrected a case where it wouldn't fetch whether someone was paid or not

## v6.0.0 - 2025-06-04

- New: deprecated usage of R2 bucket in place of D1 SQL database
- New: supports read replication to lower latency for read queries and scale read throughput by adding read-only database copies, called read replicas, across regions globally closer to clients
- New: includes migration worker script `migrate.js` which can be deployed on seperate worker to migrate data from R2 bucket to D1 database

## v5.24.37 - 2025-06-03

- Tweak: added all NIP-11 options; paid relay status now shows correctly
- Tweak: moved NIP-05 validation check to optional state using `checkValidNip05` in `relay-worker.js` defaults to disabled
- New: added `enableAntiSpam` in `event-worker.js` for consolidated control over event hashing and duplicate content checking, defaults to disabled

## v5.23.37 - 2025-06-02

- Hotfix: error breaking "since" and "until" filters

## v5.23.36 - 2025-06-02

- Tweak: increased rate limiting thresholds
- Hotfix: case where tags filter caused fatal error

## v5.23.35 - 2025-06-01

- New: added compound key construction when saving events that allows use of "since" and "until" filters in REQs
- New: added "pay to relay" functionality to charge SATS for relay usage
- New: added customizable HTML landing page for HTTP requests to relay URL

## v4.22.30 - 2024-09-19

- Tweak: added robust console logging

## v4.22.29 - 2024-09-19

- Hotfix: prevent unnecessary filters
- Tweak: added logging to cache handling

## v4.22.28 - 2024-09-18

- Hotfix: splitting req messages into chunks
- Tweak: better logging and error handling

## v4.22.27 - 2024-09-18

- Hotfix: event and req workers simultaneous connection management
- Tweak: better logging and error handling

## v4.22.26 - 2024-09-18

- Hotfix: sending REQ for tags
- Tweak: improved batch saving events

## v4.22.25 - 2024-09-17

- New: only allow events from pubkey's with valid NIP-05 address

## v4.21.25 - 2024-09-17

- Hotfix: added missing 't' tag

## v4.21.24 - 2024-09-17

- Hotfix: improved rate limiting
- Hotfix: blocked content was not checked properly
- Tweak: moved tag blocking logic to main relay worker
- Tweak: backgrounded event processing
- Tweak: integrated event kind blocking logic into REQ handling
- Tweak: set hardcoded REQ limit to 50 events and/or ids

## v4.20.24 - 2024-09-15

- Hotfix: improved subscription management
- Tweak: better logging
- Tweak: refactored req helper worker

## v4.20.23 - 2024-09-13

- Hotfix: improved in-memory cache

## v4.20.22 - 2024-09-09

- Hotfix: corrected global spam filtering hash logic

## v4.20.21 - 2024-09-09

- New: spam filtering through hash based duplicate checker

## v4.19.21 - 2024-06-22

- Hotfix: changed number of fetched events
- Hotfix: removed unnecessary in-memory caching

## v4.19.20 - 2024-06-20

- Hotfix: fixed response

## v4.19.19 - 2024-06-20

- Hotfix: fixed tag count increment

## v4.19.18 - 2024-06-19

- New: introduction of EVENT and REQ message helpers
- Removed: COUNT message support
- Removed: blasting to other relays

## v3.19.18 - 2024-06-09

- Tweaked: indexation within R2 bucket now uses specific directories and changed the way indexing count is fetched (please see new cache bypass rule example in readme)
- Added: reintroduced COUNT message support
- Added: reintroduced blasting event to other relays
- New: support for blocklisting or allowlisting specific tags

## v3.18.18 - 2024-06-06

- Hotfix: support aA-zZ tags
- Hotfix: corrected deletion bug

## v3.18.17 - 2024-06-06

- Tweaked: added new tags to worker cache
- Tweaked: added minor improvement for worker limits
- Removed: unneccessary tags
- Removed: COUNT messages (NIP-45)
- Removed: blasting to relays

## v3.18.16 - 2024-06-06

- Hotfix: corrected bug that showed unrelated tags to user

## v3.18.15 - 2024-06-05

- Hotfix: updated deletion process to support all tags

## v3.18.14 - 2024-06-05

- Added: support for all standardized tags
- Added: suport for COUNT messages (NIP-45)

## v3.17.14 - 2024-05-09

- Hotfix: improved fetching indexation count from R2 bucket

## v3.17.13 - 2024-05-08

- New: integration with R2 bucket
- Deprecated: use of KV store

## v2.17.13 - 2024-04-27

- Hotfix: corrected deletion (kind 5) logic for indexation

## v2.17.12 - 2024-04-27

- Deprecated: retry event save to KV after initial failure

## v2.17.11 - 2024-04-26

- Added: rate limiting to duplicate event check
- Added: retry event save to KV after initial failure
- Improved: concurrently save event data to KV store 

## v2.16.11 - 2024-04-26

- Hotfix: improved allowed pubkey validator and rate limiter

## v2.16.10 - 2024-04-25

- Tweaked: more strict rate limiting on read requests to KV store 

## v2.15.10 - 2024-04-25

- Hotfix: corrected websocket graceful error handling and call to KV store

## v2.15.9 - 2024-04-24

- Added: consecutive ordering of events through new KV storage indexation

## v1.15.9 - 2024-04-21

- Added: relay blasting to send events to other relays
- Tweaked: rate limits all kinds unless excluded

## v1.14.9 - 2024-04-20

- Added: in-memory cache buffering for event handling

## v1.13.9 - 2024-04-19

- Added: support for Nostr address NIP-05 verified users

## v1.12.9 - 2024-04-18

- Added: rate-limiting per kind - default kinds 1, 3, 4, 5 at 10 events per minute
- Added: ability to block words or phrases

## v1.11.9 - 2024-04-15

- Hotfix for rate-limiting KV store in REQ

## v1.11.8 - 2024-04-15

- Improved event filter handling and simplified logic

## v1.10.8 - 2024-04-09

- Hotfix for cache storage

## v1.10.7 - 2024-04-08

- Improved in-memory cache
- Removed: listener for stale cache deletion (please remove cron trigger)
- Fixed erroneous delete operations
- Fixed broken filtering

## v1.9.7 - 2024-04-03

- Improved in-memory cache handling for event listing
- Added listener for stale cache deletion (please add cron trigger)
- Fixed broken filtering

## v1.8.7 - 2024-03-31

- Improved in-memory cache handling for event listing

## v1.8.6 - 2024-03-31

- More granular control over allowlisted and blocklisted pubkeys and event kinds

## v1.7.6 - 2024-03-30

- Added rate-limiting
- Added support for blocklisting pubkeys and kinds
- Added back support for all kinds unless blocked
- Improved in-memory caching
- Other general optimizations

## v1.5.6 - 2024-03-28

- Removal of various kinds, now with focus on kind 1 and 5
- Improved in-memory caching

## v1.4.6 - 2024-03-27

- Hotfix #2 for event batching, which fixes `error: EVENT processing failed - Too many API requests by single worker invocation.`

## v1.4.5 - 2024-03-27

- Hotfix for event batching, which should help mitigate `error: EVENT processing failed - Too many API requests by single worker invocation.`

## v1.4.4 - 2024-03-27

- Added in-memory caching
- Added maximum request limit to 50 events, with support for pagination
- If no filter used, only return kind 1 events

## v1.3.4 - 2024-03-26

- Significant codebase rewrite to support new filter logic and indexes for correctly fetching events to show in global, relay explorers, etc.

## v0.3.4 - 2024-03-26

- Added support for KV TTL to self-expire events that have an expiration. Dropped the need for cron triggers.

## v0.3.3 - 2024-03-25

- Initial commit with supported [Nostr Improvement Proposals (NIPs)](https://github.com/fiatjaf/nostr/tree/master/nips) 1, 2, 4, 9, 11, 12, 15, 16, 20, 22, 33, and 40.
