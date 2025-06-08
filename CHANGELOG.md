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
