import { RelayInfo } from './types';

// ***************************** //
// ** BEGIN EDITABLE SETTINGS ** //
// ***************************** //

// Settings below can be configured to your preferences

// Pay to relay
export const relayNpub = "npub16jdfqgazrkapk0yrqm9rdxlnys7ck39c7zmdzxtxqlmmpxg04r0sd733sv"; // Use your own npub
export const PAY_TO_RELAY_ENABLED = true; // Set to false to disable pay to relay
export const RELAY_ACCESS_PRICE_SATS = 2121; // Price in SATS for relay access

// NIP-42 Authentication
export const AUTH_REQUIRED = true; // Set to false to disable NIP-42 authentication requirement
export const AUTH_TIMEOUT_MS = 600000; // 10 minutes - how long the challenge is valid

// Relay info
export const relayInfo: RelayInfo = {
  name: "Nosflare",
  description: "A serverless Nostr relay through Cloudflare Worker and D1 database",
  pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
  contact: "lux@fed.wtf",
  supported_nips: [1, 2, 4, 5, 9, 11, 12, 15, 16, 17, 20, 22, 33, 40, 42],
  software: "https://github.com/Spl0itable/nosflare",
  version: "7.9.33",
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
    auth_required: AUTH_REQUIRED,
    payment_required: PAY_TO_RELAY_ENABLED,
    restricted_writes: PAY_TO_RELAY_ENABLED,
    // created_at_lower_limit: 0,
    // created_at_upper_limit: 2147483647,
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

// Anti-spam settings
export const enableAntiSpam = false; // Set to true to enable hashing and duplicate content checking
export const enableGlobalDuplicateCheck = false; // When anti-spam is enabled, set to true for global hash (across all pubkeys and not individually)

// Kinds subjected to duplicate checks (only when anti-spam is enabled)
export const antiSpamKinds = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 40, 41, 42, 43, 44, 64, 818, 1021, 1022, 1040, 1059, 1063, 1311, 1617, 1621, 1622, 1630, 1633, 1971, 1984, 1985, 1986, 1987, 2003, 2004, 2022, 4550, 5000, 5999, 6000, 6999, 7000, 9000, 9030, 9041, 9467, 9734, 9735, 9802, 10000, 10001, 10002, 10003, 10004, 10005, 10006, 10007, 10009, 10015, 10030, 10050, 10063, 10096, 13194, 21000, 22242, 23194, 23195, 24133, 24242, 27235, 30000, 30001, 30002, 30003, 30004, 30005, 30007, 30008, 30009, 30015, 30017, 30018, 30019, 30020, 30023, 30024, 30030, 30040, 30041, 30063, 30078, 30311, 30315, 30402, 30403, 30617, 30618, 30818, 30819, 31890, 31922, 31923, 31924, 31925, 31989, 31990, 34235, 34236, 34237, 34550, 39000, 39001, 39002, 39003, 39004, 39005, 39006, 39007, 39008, 39009
  // Add other kinds you want to check for duplicates
]);

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

// Rate limit thresholds
export const PUBKEY_RATE_LIMIT = { rate: 10 / 60000, capacity: 10 }; // 10 EVENT messages per min
export const REQ_RATE_LIMIT = { rate: 50 / 60000, capacity: 50 }; // 50 REQ messages per min
export const excludedRateLimitKinds = new Set<number>([
  1059
  // ... kinds to exclude from EVENT rate limiting Ex: 1, 2, 3
]);

// Database pruning settings (D1 has a 10GB limit)
export const DB_PRUNING_ENABLED = true; // Set to false to disable automatic pruning
export const DB_SIZE_THRESHOLD_GB = 9; // Start pruning when database exceeds this size (in GB)
export const DB_PRUNE_BATCH_SIZE = 1000; // Number of events to delete per batch
export const DB_PRUNE_TARGET_GB = 8; // Target size to prune down to (in GB)

// Event kinds to preserve during pruning (replaceable events critical for user identity)
// Kind 0: Profile metadata, Kind 3: Contact list, Kind 10002: Relay list
export const pruneProtectedKinds = new Set<number>([
  0,      // Profile metadata
  3,      // Contact list / follows
  10002,  // Relay list metadata
]);

// *************************** //
// ** END EDITABLE SETTINGS ** //
// *************************** //

// Helper validation functions
import { NostrEvent } from './types';

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

export function isTagAllowed(tag: string): boolean {
  if (allowedTags.size > 0 && !allowedTags.has(tag)) {
    return false;
  }
  return !blockedTags.has(tag);
}