/**
 * Configuration - Change optional relay settings
 */

// ***************************** //
// ** BEGIN EDITABLE SETTINGS ** //
// ***************************** //

// Settings below can be configured to your preferences

// Pay to relay
export const relayNpub = "npub16jdfqgazrkapk0yrqm9rdxlnys7ck39c7zmdzxtxqlmmpxg04r0sd733sv"; // Use your own npub
export const PAY_TO_RELAY_ENABLED = true; // Set to false to disable pay to relay
export const RELAY_ACCESS_PRICE_SATS = 212121; // Price in SATS for relay access

// Relay info
export const relayInfo: RelayInfo = {
  name: "Nosflare",
  description: "A serverless Nostr relay using Cloudflare Workers and Durable Objects",
  pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
  contact: "lux@fed.wtf",
  supported_nips: [1, 2, 4, 5, 9, 11, 12, 15, 16, 17, 20, 22, 23, 33, 40, 42, 50, 51, 58, 65, 71, 78, 89, 94],
  software: "https://github.com/Spl0itable/nosflare",
  version: "8.9.25",
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
    auth_required: false, // Set to true to enable NIP-42 authentication
    payment_required: PAY_TO_RELAY_ENABLED,
    restricted_writes: PAY_TO_RELAY_ENABLED,
    created_at_lower_limit: 946684800, // January 1, 2000
    created_at_upper_limit: 2147483647, // Max unix timestamp (year 2038)
    // default_limit: 10000
  },

  // Event retention policies (uncomment and configure as needed):
  // retention: [
  //   { kinds: [0, 1, [5, 7], [40, 49]], time: 3600 },
  //   { kinds: [[40000, 49999]], time: 100 },
  //   { kinds: [[30000, 39999]], count: 1000 },
  //   { time: 3600, count: 10000 }
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
  //   admission: [{ amount: 1000000, unit: "msats" }],
  //   subscription: [{ amount: 5000000, unit: "msats", period: 2592000 }],
  //   publication: [{ kinds: [4], amount: 100, unit: "msats" }],
  // }
};

// Nostr address NIP-05 verified users (for verified checkmark like username@your-relay.com)
export const nip05Users: Record<string, string> = {
  "Luxas": "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
  // ... more NIP-05 verified users
};

// Blocked pubkeys
// Add pubkeys in hex format to block write access
export const blockedPubkeys = new Set([
  "3c7f5948b5d80900046a67d8e3bf4971d6cba013abece1dd542eca223cf3dd3f",
  "fed5c0c3c8fe8f51629a0b39951acdf040fd40f53a327ae79ee69991176ba058",
  "e810fafa1e89cdf80cced8e013938e87e21b699b24c8570537be92aec4b12c18",
  "05aee96dd41429a3ae97a9dac4dfc6867fdfacebca3f3bdc051e5004b0751f01",
  "53a756bb596055219d93e888f71d936ec6c47d960320476c955efd8941af4362"
]);

// Allowed pubkeys
// Add pubkeys in hex format to allow write access
export const allowedPubkeys = new Set<string>([
  // ... pubkeys that are explicitly allowed
]);

// Blocked event kinds
// Add comma-separated kinds Ex: 1064, 4, 22242
export const blockedEventKinds = new Set([
  1064
]);

// Allowed event kinds
// Add comma-separated kinds Ex: 1, 2, 3
export const allowedEventKinds = new Set<number>([
  // ... kinds that are explicitly allowed
]);

// Blocked words or phrases (case-insensitive)
export const blockedContent = new Set([
  "~~ hello world! ~~"
  // ... more blocked content
]);

// NIP-05 validation
export const checkValidNip05 = false; // Set to true to enable NIP-05 validation (this requires users to have a valid NIP-05 in order to publish events to the relay as part of anti-spam)

// Blocked NIP-05 domains
// This prevents users with NIP-05's from specified domains from publishing events to the relay
export const blockedNip05Domains = new Set<string>([
  // Add domains that are explicitly blocked
  // "primal.net"
]);

// Allowed NIP-05 domains
export const allowedNip05Domains = new Set<string>([
  // Add domains that are explicitly allowed
  // Leave empty to allow all domains (unless blocked)
]);

// Blocked tags
// Add comma-separated tags Ex: t, e, p
export const blockedTags = new Set<string>([
  // ... tags that are explicitly blocked
]);

// Allowed tags
// Add comma-separated tags Ex: p, e, t
export const allowedTags = new Set<string>([
  // "p", "e", "t"
  // ... tags that are explicitly allowed
]);

// ConnectionDO sharding
// When true, each WebSocket connection gets its own ConnectionDO instance (unique ID per connection).
// When false, all connections share a single ConnectionDO instance.
// Disabling sharding reduces Durable Object instance count but increases per-DO resource usage.
// Recommended: true for high traffic relays, false for smaller relays to reduce DO instance count
export const CONNECTION_DO_SHARDING_ENABLED = true;

// SessionManagerDO sharding
// Controls how event kinds are distributed across SessionManager shards for subscription matching.
// Events are assigned to shards using: kind % SESSION_MANAGER_SHARD_COUNT
// Lower values = fewer shards = less horizontal scaling but fewer DO requests
// Higher values = more shards = more horizontal scaling but more DO requests
// Recommended: 1 (all kinds in one shard) for small relay to 50 (maximum distribution) for heavy traffic relay
export const SESSION_MANAGER_SHARD_COUNT = 50;

// EventShardDO time windows
// Controls how many days of EventShardDO shards are queried per REQ.
// Each day = 1 time shard. Lower values = fewer DO requests but less historical data.
// This is used for: max query time range, default time window when filter has no 'since', and shard fan-out limit.
export const MAX_TIME_WINDOWS_PER_QUERY = 30;

// EventShardDO read replicas
// Number of replicas per time shard. Each event write goes to all replicas.
// All replicas contain identical data for high availability and load distribution.
// Higher values = more read parallelism but more write overhead.
// Recommended: 2 (low traffic) to 4+ (high traffic)
// Scaling note: When you increase this value, new replicas will automatically backfill
// old data on-demand when first queried (lazy backfill from replica 0).
export const READ_REPLICAS_PER_SHARD = 4;

// PaymentDO sharding
// When true, paid pubkeys are distributed across shards based on the first 4 characters of the pubkey.
// When false, all paid pubkeys are stored in a single PaymentDO instance.
// Recommended: true for high traffic relays, false for smaller relays
export const PAYMENT_DO_SHARDING_ENABLED = true;

// Rate limit thresholds
export const PUBKEY_RATE_LIMIT = { rate: 10 / 60000, capacity: 10 }; // 10 EVENT messages per min
export const REQ_RATE_LIMIT = { rate: 100 / 60000, capacity: 100 }; // 100 REQ messages per min
export const excludedRateLimitKinds = new Set<number>([
  1059
  // ... kinds to exclude from EVENT rate limiting Ex: 1, 2, 3
]);

// *************************** //
// ** END EDITABLE SETTINGS ** //
// *************************** //

import { RelayInfo } from './types';
import { NostrEvent } from './types';

export const CREATED_AT_LOWER_LIMIT = relayInfo.limitation?.created_at_lower_limit ?? 0;
export const CREATED_AT_UPPER_LIMIT = relayInfo.limitation?.created_at_upper_limit ?? 2147483647;
export const AUTH_REQUIRED = relayInfo.limitation?.auth_required ?? false;

export function isPubkeyAllowed(pubkey: string): boolean {
  if (allowedPubkeys.size > 0 && !allowedPubkeys.has(pubkey)) {
    return false;
  }
  return !blockedPubkeys.has(pubkey);
}

export function isEventKindAllowed(kind: number): boolean {
  if (allowedEventKinds.size > 0 && !allowedEventKinds.has(kind)) {
    return false;
  }
  return !blockedEventKinds.has(kind);
}

export function containsBlockedContent(event: NostrEvent): boolean {
  const lowercaseContent = (event.content || "").toLowerCase();
  const lowercaseTags = event.tags.map(tag => tag.join("").toLowerCase());

  for (const blocked of blockedContent) {
    const blockedLower = blocked.toLowerCase();
    if (
      lowercaseContent.includes(blockedLower) ||
      lowercaseTags.some(tag => tag.includes(blockedLower))
    ) {
      return true;
    }
  }
  return false;
}

export function isTagAllowed(tag: string): boolean {
  if (allowedTags.size > 0 && !allowedTags.has(tag)) {
    return false;
  }
  return !blockedTags.has(tag);
}