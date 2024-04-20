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
