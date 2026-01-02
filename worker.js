var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/types.ts
var _RateLimiter = class _RateLimiter {
  constructor(rate, capacity) {
    this.tokens = capacity;
    this.lastRefillTime = Date.now();
    this.capacity = capacity;
    this.fillRate = rate;
  }
  removeToken() {
    this.refill();
    if (this.tokens < 1) {
      return false;
    }
    this.tokens -= 1;
    return true;
  }
  refill() {
    const now = Date.now();
    const elapsedTime = now - this.lastRefillTime;
    const tokensToAdd = Math.floor(elapsedTime * this.fillRate);
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }
};
__name(_RateLimiter, "RateLimiter");
var RateLimiter = _RateLimiter;

// src/config.ts
var config_exports = {};
__export(config_exports, {
  AUTH_REQUIRED: () => AUTH_REQUIRED,
  AUTH_TIMEOUT_MS: () => AUTH_TIMEOUT_MS,
  DB_PRUNE_BATCH_SIZE: () => DB_PRUNE_BATCH_SIZE,
  DB_PRUNE_TARGET_GB: () => DB_PRUNE_TARGET_GB,
  DB_PRUNING_ENABLED: () => DB_PRUNING_ENABLED,
  DB_SIZE_THRESHOLD_GB: () => DB_SIZE_THRESHOLD_GB,
  PAY_TO_RELAY_ENABLED: () => PAY_TO_RELAY_ENABLED,
  PUBKEY_RATE_LIMIT: () => PUBKEY_RATE_LIMIT,
  RELAY_ACCESS_PRICE_SATS: () => RELAY_ACCESS_PRICE_SATS,
  REQ_RATE_LIMIT: () => REQ_RATE_LIMIT,
  allowedEventKinds: () => allowedEventKinds,
  allowedNip05Domains: () => allowedNip05Domains,
  allowedPubkeys: () => allowedPubkeys,
  allowedTags: () => allowedTags,
  antiSpamKinds: () => antiSpamKinds,
  blockedContent: () => blockedContent,
  blockedEventKinds: () => blockedEventKinds,
  blockedNip05Domains: () => blockedNip05Domains,
  blockedPubkeys: () => blockedPubkeys,
  blockedTags: () => blockedTags,
  checkValidNip05: () => checkValidNip05,
  containsBlockedContent: () => containsBlockedContent,
  enableAntiSpam: () => enableAntiSpam,
  enableGlobalDuplicateCheck: () => enableGlobalDuplicateCheck,
  excludedRateLimitKinds: () => excludedRateLimitKinds,
  isEventKindAllowed: () => isEventKindAllowed,
  isPubkeyAllowed: () => isPubkeyAllowed,
  isTagAllowed: () => isTagAllowed,
  nip05Users: () => nip05Users,
  pruneProtectedKinds: () => pruneProtectedKinds,
  relayInfo: () => relayInfo,
  relayNpub: () => relayNpub
});
var relayNpub = "npub16jdfqgazrkapk0yrqm9rdxlnys7ck39c7zmdzxtxqlmmpxg04r0sd733sv";
var PAY_TO_RELAY_ENABLED = true;
var RELAY_ACCESS_PRICE_SATS = 2121;
var AUTH_REQUIRED = true;
var AUTH_TIMEOUT_MS = 6e5;
var relayInfo = {
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
    restricted_writes: PAY_TO_RELAY_ENABLED
    // created_at_lower_limit: 0,
    // created_at_upper_limit: 2147483647,
    // default_limit: 10000
  }
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
var nip05Users = {
  "Luxas": "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df"
  // ... more NIP-05 verified users
};
var enableAntiSpam = false;
var enableGlobalDuplicateCheck = false;
var antiSpamKinds = /* @__PURE__ */ new Set([
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  16,
  17,
  40,
  41,
  42,
  43,
  44,
  64,
  818,
  1021,
  1022,
  1040,
  1059,
  1063,
  1311,
  1617,
  1621,
  1622,
  1630,
  1633,
  1971,
  1984,
  1985,
  1986,
  1987,
  2003,
  2004,
  2022,
  4550,
  5e3,
  5999,
  6e3,
  6999,
  7e3,
  9e3,
  9030,
  9041,
  9467,
  9734,
  9735,
  9802,
  1e4,
  10001,
  10002,
  10003,
  10004,
  10005,
  10006,
  10007,
  10009,
  10015,
  10030,
  10050,
  10063,
  10096,
  13194,
  21e3,
  22242,
  23194,
  23195,
  24133,
  24242,
  27235,
  3e4,
  30001,
  30002,
  30003,
  30004,
  30005,
  30007,
  30008,
  30009,
  30015,
  30017,
  30018,
  30019,
  30020,
  30023,
  30024,
  30030,
  30040,
  30041,
  30063,
  30078,
  30311,
  30315,
  30402,
  30403,
  30617,
  30618,
  30818,
  30819,
  31890,
  31922,
  31923,
  31924,
  31925,
  31989,
  31990,
  34235,
  34236,
  34237,
  34550,
  39e3,
  39001,
  39002,
  39003,
  39004,
  39005,
  39006,
  39007,
  39008,
  39009
  // Add other kinds you want to check for duplicates
]);
var blockedPubkeys = /* @__PURE__ */ new Set([
  "3c7f5948b5d80900046a67d8e3bf4971d6cba013abece1dd542eca223cf3dd3f",
  "fed5c0c3c8fe8f51629a0b39951acdf040fd40f53a327ae79ee69991176ba058",
  "e810fafa1e89cdf80cced8e013938e87e21b699b24c8570537be92aec4b12c18",
  "05aee96dd41429a3ae97a9dac4dfc6867fdfacebca3f3bdc051e5004b0751f01",
  "53a756bb596055219d93e888f71d936ec6c47d960320476c955efd8941af4362"
]);
var allowedPubkeys = /* @__PURE__ */ new Set([
  // ... pubkeys that are explicitly allowed
]);
var blockedEventKinds = /* @__PURE__ */ new Set([
  1064
]);
var allowedEventKinds = /* @__PURE__ */ new Set([
  // ... kinds that are explicitly allowed
]);
var blockedContent = /* @__PURE__ */ new Set([
  "~~ hello world! ~~"
  // ... more blocked content
]);
var checkValidNip05 = false;
var blockedNip05Domains = /* @__PURE__ */ new Set([
  // Add domains that are explicitly blocked
  // "primal.net"
]);
var allowedNip05Domains = /* @__PURE__ */ new Set([
  // Add domains that are explicitly allowed
  // Leave empty to allow all domains (unless blocked)
]);
var blockedTags = /* @__PURE__ */ new Set([
  // ... tags that are explicitly blocked
]);
var allowedTags = /* @__PURE__ */ new Set([
  // "p", "e", "t"
  // ... tags that are explicitly allowed
]);
var PUBKEY_RATE_LIMIT = { rate: 10 / 6e4, capacity: 10 };
var REQ_RATE_LIMIT = { rate: 50 / 6e4, capacity: 50 };
var excludedRateLimitKinds = /* @__PURE__ */ new Set([
  1059
  // ... kinds to exclude from EVENT rate limiting Ex: 1, 2, 3
]);
var DB_PRUNING_ENABLED = true;
var DB_SIZE_THRESHOLD_GB = 9;
var DB_PRUNE_BATCH_SIZE = 1e3;
var DB_PRUNE_TARGET_GB = 8;
var pruneProtectedKinds = /* @__PURE__ */ new Set([
  0,
  // Profile metadata
  3,
  // Contact list / follows
  10002
  // Relay list metadata
]);
function isPubkeyAllowed(pubkey) {
  if (allowedPubkeys.size > 0 && !allowedPubkeys.has(pubkey)) {
    return false;
  }
  return !blockedPubkeys.has(pubkey);
}
__name(isPubkeyAllowed, "isPubkeyAllowed");
function isEventKindAllowed(kind) {
  if (allowedEventKinds.size > 0 && !allowedEventKinds.has(kind)) {
    return false;
  }
  return !blockedEventKinds.has(kind);
}
__name(isEventKindAllowed, "isEventKindAllowed");
function containsBlockedContent(event) {
  const lowercaseContent = (event.content || "").toLowerCase();
  const lowercaseTags = event.tags.map((tag) => tag.join("").toLowerCase());
  for (const blocked of blockedContent) {
    const blockedLower = blocked.toLowerCase();
    if (lowercaseContent.includes(blockedLower) || lowercaseTags.some((tag) => tag.includes(blockedLower))) {
      return true;
    }
  }
  return false;
}
__name(containsBlockedContent, "containsBlockedContent");
function isTagAllowed(tag) {
  if (allowedTags.size > 0 && !allowedTags.has(tag)) {
    return false;
  }
  return !blockedTags.has(tag);
}
__name(isTagAllowed, "isTagAllowed");

// node_modules/@noble/hashes/esm/crypto.js
var crypto2 = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;

// node_modules/@noble/hashes/esm/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
__name(isBytes, "isBytes");
function anumber(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("positive integer expected, got " + n);
}
__name(anumber, "anumber");
function abytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
}
__name(abytes, "abytes");
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new Error("Hash should be wrapped by utils.createHasher");
  anumber(h.outputLen);
  anumber(h.blockLen);
}
__name(ahash, "ahash");
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
__name(aexists, "aexists");
function aoutput(out, instance) {
  abytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
__name(aoutput, "aoutput");
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
__name(clean, "clean");
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
__name(createView, "createView");
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
__name(rotr, "rotr");
var hasHexBuiltin = /* @__PURE__ */ (() => (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
))();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
__name(bytesToHex, "bytesToHex");
var asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
__name(asciiToBase16, "asciiToBase16");
function hexToBytes(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  if (hasHexBuiltin)
    return Uint8Array.fromHex(hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
__name(hexToBytes, "hexToBytes");
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
__name(utf8ToBytes, "utf8ToBytes");
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  abytes(data);
  return data;
}
__name(toBytes, "toBytes");
function concatBytes(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
__name(concatBytes, "concatBytes");
var _Hash = class _Hash {
};
__name(_Hash, "Hash");
var Hash = _Hash;
function createHasher(hashCons) {
  const hashC = /* @__PURE__ */ __name((msg) => hashCons().update(toBytes(msg)).digest(), "hashC");
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
__name(createHasher, "createHasher");
function randomBytes(bytesLength = 32) {
  if (crypto2 && typeof crypto2.getRandomValues === "function") {
    return crypto2.getRandomValues(new Uint8Array(bytesLength));
  }
  if (crypto2 && typeof crypto2.randomBytes === "function") {
    return Uint8Array.from(crypto2.randomBytes(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}
__name(randomBytes, "randomBytes");

// node_modules/@noble/hashes/esm/_md.js
function setBigUint64(view, byteOffset, value, isLE) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE);
  const _32n = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE ? 4 : 0;
  const l = isLE ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE);
  view.setUint32(byteOffset + l, wl, isLE);
}
__name(setBigUint64, "setBigUint64");
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
__name(Chi, "Chi");
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
__name(Maj, "Maj");
var _HashMD = class _HashMD extends Hash {
  constructor(blockLen, outputLen, padOffset, isLE) {
    super();
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor());
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
__name(_HashMD, "HashMD");
var HashMD = _HashMD;
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// node_modules/@noble/hashes/esm/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var _SHA256 = class _SHA256 extends HashMD {
  constructor(outputLen = 32) {
    super(64, outputLen, 8, false);
    this.A = SHA256_IV[0] | 0;
    this.B = SHA256_IV[1] | 0;
    this.C = SHA256_IV[2] | 0;
    this.D = SHA256_IV[3] | 0;
    this.E = SHA256_IV[4] | 0;
    this.F = SHA256_IV[5] | 0;
    this.G = SHA256_IV[6] | 0;
    this.H = SHA256_IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
__name(_SHA256, "SHA256");
var SHA256 = _SHA256;
var sha256 = /* @__PURE__ */ createHasher(() => new SHA256());

// node_modules/@noble/hashes/esm/hmac.js
var _HMAC = class _HMAC extends Hash {
  constructor(hash, _key) {
    super();
    this.finished = false;
    this.destroyed = false;
    ahash(hash);
    const key = toBytes(_key);
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean(pad);
  }
  update(buf) {
    aexists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists(this);
    abytes(out, this.outputLen);
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to || (to = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
};
__name(_HMAC, "HMAC");
var HMAC = _HMAC;
var hmac = /* @__PURE__ */ __name((hash, key, message) => new HMAC(hash, key).update(message).digest(), "hmac");
hmac.create = (hash, key) => new HMAC(hash, key);

// node_modules/@noble/curves/esm/utils.js
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
function _abool2(value, title = "") {
  if (typeof value !== "boolean") {
    const prefix = title && `"${title}"`;
    throw new Error(prefix + "expected boolean, got type=" + typeof value);
  }
  return value;
}
__name(_abool2, "_abool2");
function _abytes2(value, length, title = "") {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
__name(_abytes2, "_abytes2");
function numberToHexUnpadded(num2) {
  const hex = num2.toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
__name(numberToHexUnpadded, "numberToHexUnpadded");
function hexToNumber(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  return hex === "" ? _0n : BigInt("0x" + hex);
}
__name(hexToNumber, "hexToNumber");
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex(bytes));
}
__name(bytesToNumberBE, "bytesToNumberBE");
function bytesToNumberLE(bytes) {
  abytes(bytes);
  return hexToNumber(bytesToHex(Uint8Array.from(bytes).reverse()));
}
__name(bytesToNumberLE, "bytesToNumberLE");
function numberToBytesBE(n, len) {
  return hexToBytes(n.toString(16).padStart(len * 2, "0"));
}
__name(numberToBytesBE, "numberToBytesBE");
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
__name(numberToBytesLE, "numberToBytesLE");
function ensureBytes(title, hex, expectedLength) {
  let res;
  if (typeof hex === "string") {
    try {
      res = hexToBytes(hex);
    } catch (e) {
      throw new Error(title + " must be hex string or Uint8Array, cause: " + e);
    }
  } else if (isBytes(hex)) {
    res = Uint8Array.from(hex);
  } else {
    throw new Error(title + " must be hex string or Uint8Array");
  }
  const len = res.length;
  if (typeof expectedLength === "number" && len !== expectedLength)
    throw new Error(title + " of length " + expectedLength + " expected, got " + len);
  return res;
}
__name(ensureBytes, "ensureBytes");
var isPosBig = /* @__PURE__ */ __name((n) => typeof n === "bigint" && _0n <= n, "isPosBig");
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
__name(inRange, "inRange");
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new Error("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
__name(aInRange, "aInRange");
function bitLen(n) {
  let len;
  for (len = 0; n > _0n; n >>= _1n, len += 1)
    ;
  return len;
}
__name(bitLen, "bitLen");
var bitMask = /* @__PURE__ */ __name((n) => (_1n << BigInt(n)) - _1n, "bitMask");
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  if (typeof hashLen !== "number" || hashLen < 2)
    throw new Error("hashLen must be a number");
  if (typeof qByteLen !== "number" || qByteLen < 2)
    throw new Error("qByteLen must be a number");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  const u8n = /* @__PURE__ */ __name((len) => new Uint8Array(len), "u8n");
  const u8of = /* @__PURE__ */ __name((byte) => Uint8Array.of(byte), "u8of");
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = /* @__PURE__ */ __name(() => {
    v.fill(1);
    k.fill(0);
    i = 0;
  }, "reset");
  const h = /* @__PURE__ */ __name((...b) => hmacFn(k, v, ...b), "h");
  const reseed = /* @__PURE__ */ __name((seed = u8n(0)) => {
    k = h(u8of(0), seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(u8of(1), seed);
    v = h();
  }, "reseed");
  const gen = /* @__PURE__ */ __name(() => {
    if (i++ >= 1e3)
      throw new Error("drbg: tried 1000 values");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes(...out);
  }, "gen");
  const genUntil = /* @__PURE__ */ __name((seed, pred) => {
    reset();
    reseed(seed);
    let res = void 0;
    while (!(res = pred(gen())))
      reseed();
    reset();
    return res;
  }, "genUntil");
  return genUntil;
}
__name(createHmacDrbg, "createHmacDrbg");
function _validateObject(object, fields, optFields = {}) {
  if (!object || typeof object !== "object")
    throw new Error("expected valid options object");
  function checkField(fieldName, expectedType, isOpt) {
    const val = object[fieldName];
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
  }
  __name(checkField, "checkField");
  Object.entries(fields).forEach(([k, v]) => checkField(k, v, false));
  Object.entries(optFields).forEach(([k, v]) => checkField(k, v, true));
}
__name(_validateObject, "_validateObject");
function memoized(fn) {
  const map = /* @__PURE__ */ new WeakMap();
  return (arg, ...args) => {
    const val = map.get(arg);
    if (val !== void 0)
      return val;
    const computed = fn(arg, ...args);
    map.set(arg, computed);
    return computed;
  };
}
__name(memoized, "memoized");

// node_modules/@noble/curves/esm/abstract/modular.js
var _0n2 = BigInt(0);
var _1n2 = BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
var _3n = /* @__PURE__ */ BigInt(3);
var _4n = /* @__PURE__ */ BigInt(4);
var _5n = /* @__PURE__ */ BigInt(5);
var _7n = /* @__PURE__ */ BigInt(7);
var _8n = /* @__PURE__ */ BigInt(8);
var _9n = /* @__PURE__ */ BigInt(9);
var _16n = /* @__PURE__ */ BigInt(16);
function mod(a, b) {
  const result = a % b;
  return result >= _0n2 ? result : b + result;
}
__name(mod, "mod");
function pow2(x, power, modulo) {
  let res = x;
  while (power-- > _0n2) {
    res *= res;
    res %= modulo;
  }
  return res;
}
__name(pow2, "pow2");
function invert(number, modulo) {
  if (number === _0n2)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _0n2)
    throw new Error("invert: expected positive modulus, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n2, y = _1n2, u = _1n2, v = _0n2;
  while (a !== _0n2) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd = b;
  if (gcd !== _1n2)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
__name(invert, "invert");
function assertIsSquare(Fp, root, n) {
  if (!Fp.eql(Fp.sqr(root), n))
    throw new Error("Cannot find square root");
}
__name(assertIsSquare, "assertIsSquare");
function sqrt3mod4(Fp, n) {
  const p1div4 = (Fp.ORDER + _1n2) / _4n;
  const root = Fp.pow(n, p1div4);
  assertIsSquare(Fp, root, n);
  return root;
}
__name(sqrt3mod4, "sqrt3mod4");
function sqrt5mod8(Fp, n) {
  const p5div8 = (Fp.ORDER - _5n) / _8n;
  const n2 = Fp.mul(n, _2n);
  const v = Fp.pow(n2, p5div8);
  const nv = Fp.mul(n, v);
  const i = Fp.mul(Fp.mul(nv, _2n), v);
  const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
  assertIsSquare(Fp, root, n);
  return root;
}
__name(sqrt5mod8, "sqrt5mod8");
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n) / _16n;
  return (Fp, n) => {
    let tv1 = Fp.pow(n, c4);
    let tv2 = Fp.mul(tv1, c1);
    const tv3 = Fp.mul(tv1, c2);
    const tv4 = Fp.mul(tv1, c3);
    const e1 = Fp.eql(Fp.sqr(tv2), n);
    const e2 = Fp.eql(Fp.sqr(tv3), n);
    tv1 = Fp.cmov(tv1, tv2, e1);
    tv2 = Fp.cmov(tv4, tv3, e2);
    const e3 = Fp.eql(Fp.sqr(tv2), n);
    const root = Fp.cmov(tv1, tv2, e3);
    assertIsSquare(Fp, root, n);
    return root;
  };
}
__name(sqrt9mod16, "sqrt9mod16");
function tonelliShanks(P) {
  if (P < _3n)
    throw new Error("sqrt is not defined for small field");
  let Q = P - _1n2;
  let S = 0;
  while (Q % _2n === _0n2) {
    Q /= _2n;
    S++;
  }
  let Z = _2n;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n2) / _2n;
  return /* @__PURE__ */ __name(function tonelliSlow(Fp, n) {
    if (Fp.is0(n))
      return n;
    if (FpLegendre(Fp, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = Fp.mul(Fp.ONE, cc);
    let t = Fp.pow(n, Q);
    let R = Fp.pow(n, Q1div2);
    while (!Fp.eql(t, Fp.ONE)) {
      if (Fp.is0(t))
        return Fp.ZERO;
      let i = 1;
      let t_tmp = Fp.sqr(t);
      while (!Fp.eql(t_tmp, Fp.ONE)) {
        i++;
        t_tmp = Fp.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n2 << BigInt(M - i - 1);
      const b = Fp.pow(c, exponent);
      M = i;
      c = Fp.sqr(b);
      t = Fp.mul(t, c);
      R = Fp.mul(R, b);
    }
    return R;
  }, "tonelliSlow");
}
__name(tonelliShanks, "tonelliShanks");
function FpSqrt(P) {
  if (P % _4n === _3n)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
__name(FpSqrt, "FpSqrt");
var FIELD_FIELDS = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    MASK: "bigint",
    BYTES: "number",
    BITS: "number"
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  _validateObject(field, opts);
  return field;
}
__name(validateField, "validateField");
function FpPow(Fp, num2, power) {
  if (power < _0n2)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n2)
    return Fp.ONE;
  if (power === _1n2)
    return num2;
  let p = Fp.ONE;
  let d = num2;
  while (power > _0n2) {
    if (power & _1n2)
      p = Fp.mul(p, d);
    d = Fp.sqr(d);
    power >>= _1n2;
  }
  return p;
}
__name(FpPow, "FpPow");
function FpInvertBatch(Fp, nums, passZero = false) {
  const inverted = new Array(nums.length).fill(passZero ? Fp.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num2, i) => {
    if (Fp.is0(num2))
      return acc;
    inverted[i] = acc;
    return Fp.mul(acc, num2);
  }, Fp.ONE);
  const invertedAcc = Fp.inv(multipliedAcc);
  nums.reduceRight((acc, num2, i) => {
    if (Fp.is0(num2))
      return acc;
    inverted[i] = Fp.mul(acc, inverted[i]);
    return Fp.mul(acc, num2);
  }, invertedAcc);
  return inverted;
}
__name(FpInvertBatch, "FpInvertBatch");
function FpLegendre(Fp, n) {
  const p1mod2 = (Fp.ORDER - _1n2) / _2n;
  const powered = Fp.pow(n, p1mod2);
  const yes = Fp.eql(powered, Fp.ONE);
  const zero = Fp.eql(powered, Fp.ZERO);
  const no = Fp.eql(powered, Fp.neg(Fp.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
__name(FpLegendre, "FpLegendre");
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber(nBitLength);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
__name(nLength, "nLength");
function Field(ORDER, bitLenOrOpts, isLE = false, opts = {}) {
  if (ORDER <= _0n2)
    throw new Error("invalid field: expected ORDER > 0, got " + ORDER);
  let _nbitLength = void 0;
  let _sqrt = void 0;
  let modFromBytes = false;
  let allowedLengths = void 0;
  if (typeof bitLenOrOpts === "object" && bitLenOrOpts != null) {
    if (opts.sqrt || isLE)
      throw new Error("cannot specify opts in two arguments");
    const _opts = bitLenOrOpts;
    if (_opts.BITS)
      _nbitLength = _opts.BITS;
    if (_opts.sqrt)
      _sqrt = _opts.sqrt;
    if (typeof _opts.isLE === "boolean")
      isLE = _opts.isLE;
    if (typeof _opts.modFromBytes === "boolean")
      modFromBytes = _opts.modFromBytes;
    allowedLengths = _opts.allowedLengths;
  } else {
    if (typeof bitLenOrOpts === "number")
      _nbitLength = bitLenOrOpts;
    if (opts.sqrt)
      _sqrt = opts.sqrt;
  }
  const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, _nbitLength);
  if (BYTES > 2048)
    throw new Error("invalid field: expected ORDER of <= 2048 bytes");
  let sqrtP;
  const f = Object.freeze({
    ORDER,
    isLE,
    BITS,
    BYTES,
    MASK: bitMask(BITS),
    ZERO: _0n2,
    ONE: _1n2,
    allowedLengths,
    create: (num2) => mod(num2, ORDER),
    isValid: (num2) => {
      if (typeof num2 !== "bigint")
        throw new Error("invalid field element: expected bigint, got " + typeof num2);
      return _0n2 <= num2 && num2 < ORDER;
    },
    is0: (num2) => num2 === _0n2,
    // is valid and invertible
    isValidNot0: (num2) => !f.is0(num2) && f.isValid(num2),
    isOdd: (num2) => (num2 & _1n2) === _1n2,
    neg: (num2) => mod(-num2, ORDER),
    eql: (lhs, rhs) => lhs === rhs,
    sqr: (num2) => mod(num2 * num2, ORDER),
    add: (lhs, rhs) => mod(lhs + rhs, ORDER),
    sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
    mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
    pow: (num2, power) => FpPow(f, num2, power),
    div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
    // Same as above, but doesn't normalize
    sqrN: (num2) => num2 * num2,
    addN: (lhs, rhs) => lhs + rhs,
    subN: (lhs, rhs) => lhs - rhs,
    mulN: (lhs, rhs) => lhs * rhs,
    inv: (num2) => invert(num2, ORDER),
    sqrt: _sqrt || ((n) => {
      if (!sqrtP)
        sqrtP = FpSqrt(ORDER);
      return sqrtP(f, n);
    }),
    toBytes: (num2) => isLE ? numberToBytesLE(num2, BYTES) : numberToBytesBE(num2, BYTES),
    fromBytes: (bytes, skipValidation = true) => {
      if (allowedLengths) {
        if (!allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
          throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
        }
        const padded = new Uint8Array(BYTES);
        padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
        bytes = padded;
      }
      if (bytes.length !== BYTES)
        throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
      let scalar = isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
      if (modFromBytes)
        scalar = mod(scalar, ORDER);
      if (!skipValidation) {
        if (!f.isValid(scalar))
          throw new Error("invalid field element: outside of range 0..ORDER");
      }
      return scalar;
    },
    // TODO: we don't need it here, move out to separate fn
    invertBatch: (lst) => FpInvertBatch(f, lst),
    // We can't move this out because Fp6, Fp12 implement it
    // and it's unclear what to return in there.
    cmov: (a, b, c) => c ? b : a
  });
  return Object.freeze(f);
}
__name(Field, "Field");
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  const bitLength = fieldOrder.toString(2).length;
  return Math.ceil(bitLength / 8);
}
__name(getFieldBytesLength, "getFieldBytesLength");
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
__name(getMinHashLength, "getMinHashLength");
function mapHashToField(key, fieldOrder, isLE = false) {
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = getMinHashLength(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num2 = isLE ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num2, fieldOrder - _1n2) + _1n2;
  return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}
__name(mapHashToField, "mapHashToField");

// node_modules/@noble/curves/esm/abstract/curve.js
var _0n3 = BigInt(0);
var _1n3 = BigInt(1);
function negateCt(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
__name(negateCt, "negateCt");
function normalizeZ(c, points) {
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
__name(normalizeZ, "normalizeZ");
function validateW(W, bits) {
  if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
}
__name(validateW, "validateW");
function calcWOpts(W, scalarBits) {
  validateW(W, scalarBits);
  const windows = Math.ceil(scalarBits / W) + 1;
  const windowSize = 2 ** (W - 1);
  const maxNumber = 2 ** W;
  const mask = bitMask(W);
  const shiftBy = BigInt(W);
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
__name(calcWOpts, "calcWOpts");
function calcOffsets(n, window, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask);
  let nextN = n >> shiftBy;
  if (wbits > windowSize) {
    wbits -= maxNumber;
    nextN += _1n3;
  }
  const offsetStart = window * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1;
  const isZero = wbits === 0;
  const isNeg = wbits < 0;
  const isNegF = window % 2 !== 0;
  const offsetF = offsetStart;
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
__name(calcOffsets, "calcOffsets");
function validateMSMPoints(points, c) {
  if (!Array.isArray(points))
    throw new Error("array expected");
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error("invalid point at index " + i);
  });
}
__name(validateMSMPoints, "validateMSMPoints");
function validateMSMScalars(scalars, field) {
  if (!Array.isArray(scalars))
    throw new Error("array of scalars expected");
  scalars.forEach((s, i) => {
    if (!field.isValid(s))
      throw new Error("invalid scalar at index " + i);
  });
}
__name(validateMSMScalars, "validateMSMScalars");
var pointPrecomputes = /* @__PURE__ */ new WeakMap();
var pointWindowSizes = /* @__PURE__ */ new WeakMap();
function getW(P) {
  return pointWindowSizes.get(P) || 1;
}
__name(getW, "getW");
function assert0(n) {
  if (n !== _0n3)
    throw new Error("invalid wNAF");
}
__name(assert0, "assert0");
var _wNAF = class _wNAF {
  // Parametrized with a given Point class (not individual point)
  constructor(Point, bits) {
    this.BASE = Point.BASE;
    this.ZERO = Point.ZERO;
    this.Fn = Point.Fn;
    this.bits = bits;
  }
  // non-const time multiplication ladder
  _unsafeLadder(elm, n, p = this.ZERO) {
    let d = elm;
    while (n > _0n3) {
      if (n & _1n3)
        p = p.add(d);
      d = d.double();
      n >>= _1n3;
    }
    return p;
  }
  /**
   * Creates a wNAF precomputation window. Used for caching.
   * Default window size is set by `utils.precompute()` and is equal to 8.
   * Number of precomputed points depends on the curve size:
   * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
   * - 𝑊 is the window size
   * - 𝑛 is the bitlength of the curve order.
   * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
   * @param point Point instance
   * @param W window size
   * @returns precomputed point tables flattened to a single array
   */
  precomputeWindow(point, W) {
    const { windows, windowSize } = calcWOpts(W, this.bits);
    const points = [];
    let p = point;
    let base = p;
    for (let window = 0; window < windows; window++) {
      base = p;
      points.push(base);
      for (let i = 1; i < windowSize; i++) {
        base = base.add(p);
        points.push(base);
      }
      p = base.double();
    }
    return points;
  }
  /**
   * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
   * More compact implementation:
   * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
   * @returns real and fake (for const-time) points
   */
  wNAF(W, precomputes, n) {
    if (!this.Fn.isValid(n))
      throw new Error("invalid scalar");
    let p = this.ZERO;
    let f = this.BASE;
    const wo = calcWOpts(W, this.bits);
    for (let window = 0; window < wo.windows; window++) {
      const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window, wo);
      n = nextN;
      if (isZero) {
        f = f.add(negateCt(isNegF, precomputes[offsetF]));
      } else {
        p = p.add(negateCt(isNeg, precomputes[offset]));
      }
    }
    assert0(n);
    return { p, f };
  }
  /**
   * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
   * @param acc accumulator point to add result of multiplication
   * @returns point
   */
  wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
    const wo = calcWOpts(W, this.bits);
    for (let window = 0; window < wo.windows; window++) {
      if (n === _0n3)
        break;
      const { nextN, offset, isZero, isNeg } = calcOffsets(n, window, wo);
      n = nextN;
      if (isZero) {
        continue;
      } else {
        const item = precomputes[offset];
        acc = acc.add(isNeg ? item.negate() : item);
      }
    }
    assert0(n);
    return acc;
  }
  getPrecomputes(W, point, transform) {
    let comp = pointPrecomputes.get(point);
    if (!comp) {
      comp = this.precomputeWindow(point, W);
      if (W !== 1) {
        if (typeof transform === "function")
          comp = transform(comp);
        pointPrecomputes.set(point, comp);
      }
    }
    return comp;
  }
  cached(point, scalar, transform) {
    const W = getW(point);
    return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
  }
  unsafe(point, scalar, transform, prev) {
    const W = getW(point);
    if (W === 1)
      return this._unsafeLadder(point, scalar, prev);
    return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
  }
  // We calculate precomputes for elliptic curve point multiplication
  // using windowed method. This specifies window size and
  // stores precomputed values. Usually only base point would be precomputed.
  createCache(P, W) {
    validateW(W, this.bits);
    pointWindowSizes.set(P, W);
    pointPrecomputes.delete(P);
  }
  hasCache(elm) {
    return getW(elm) !== 1;
  }
};
__name(_wNAF, "wNAF");
var wNAF = _wNAF;
function mulEndoUnsafe(Point, point, k1, k2) {
  let acc = point;
  let p1 = Point.ZERO;
  let p2 = Point.ZERO;
  while (k1 > _0n3 || k2 > _0n3) {
    if (k1 & _1n3)
      p1 = p1.add(acc);
    if (k2 & _1n3)
      p2 = p2.add(acc);
    acc = acc.double();
    k1 >>= _1n3;
    k2 >>= _1n3;
  }
  return { p1, p2 };
}
__name(mulEndoUnsafe, "mulEndoUnsafe");
function pippenger(c, fieldN, points, scalars) {
  validateMSMPoints(points, c);
  validateMSMScalars(scalars, fieldN);
  const plength = points.length;
  const slength = scalars.length;
  if (plength !== slength)
    throw new Error("arrays of points and scalars must have equal length");
  const zero = c.ZERO;
  const wbits = bitLen(BigInt(plength));
  let windowSize = 1;
  if (wbits > 12)
    windowSize = wbits - 3;
  else if (wbits > 4)
    windowSize = wbits - 2;
  else if (wbits > 0)
    windowSize = 2;
  const MASK = bitMask(windowSize);
  const buckets = new Array(Number(MASK) + 1).fill(zero);
  const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
  let sum = zero;
  for (let i = lastBits; i >= 0; i -= windowSize) {
    buckets.fill(zero);
    for (let j = 0; j < slength; j++) {
      const scalar = scalars[j];
      const wbits2 = Number(scalar >> BigInt(i) & MASK);
      buckets[wbits2] = buckets[wbits2].add(points[j]);
    }
    let resI = zero;
    for (let j = buckets.length - 1, sumI = zero; j > 0; j--) {
      sumI = sumI.add(buckets[j]);
      resI = resI.add(sumI);
    }
    sum = sum.add(resI);
    if (i !== 0)
      for (let j = 0; j < windowSize; j++)
        sum = sum.double();
  }
  return sum;
}
__name(pippenger, "pippenger");
function createField(order, field, isLE) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE });
  }
}
__name(createField, "createField");
function _createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (FpFnLE === void 0)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(typeof val === "bigint" && val > _0n3))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp, Fn };
}
__name(_createCurveFields, "_createCurveFields");

// node_modules/@noble/curves/esm/abstract/weierstrass.js
var divNearest = /* @__PURE__ */ __name((num2, den) => (num2 + (num2 >= 0 ? den : -den) / _2n2) / den, "divNearest");
function _splitEndoScalar(k, basis, n) {
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n4;
  const k2neg = k2 < _0n4;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n4;
  if (k1 < _0n4 || k1 >= MAX_NUM || k2 < _0n4 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed, k=" + k);
  }
  return { k1neg, k1, k2neg, k2 };
}
__name(_splitEndoScalar, "_splitEndoScalar");
function validateSigFormat(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
__name(validateSigFormat, "validateSigFormat");
function validateSigOpts(opts, def) {
  const optsn = {};
  for (let optName of Object.keys(def)) {
    optsn[optName] = opts[optName] === void 0 ? def[optName] : opts[optName];
  }
  _abool2(optsn.lowS, "lowS");
  _abool2(optsn.prehash, "prehash");
  if (optsn.format !== void 0)
    validateSigFormat(optsn.format);
  return optsn;
}
__name(validateSigOpts, "validateSigOpts");
var _DERErr = class _DERErr extends Error {
  constructor(m = "") {
    super(m);
  }
};
__name(_DERErr, "DERErr");
var DERErr = _DERErr;
var DER = {
  // asn.1 DER encoding utils
  Err: DERErr,
  // Basic building block is TLV (Tag-Length-Value)
  _tlv: {
    encode: (tag, data) => {
      const { Err: E } = DER;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length & 1)
        throw new E("tlv.encode: unpadded data");
      const dataLen = data.length / 2;
      const len = numberToHexUnpadded(dataLen);
      if (len.length / 2 & 128)
        throw new E("tlv.encode: long form length too big");
      const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
      const t = numberToHexUnpadded(tag);
      return t + lenLen + len + data;
    },
    // v - value, l - left bytes (unparsed)
    decode(tag, data) {
      const { Err: E } = DER;
      let pos = 0;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length < 2 || data[pos++] !== tag)
        throw new E("tlv.decode: wrong tlv");
      const first = data[pos++];
      const isLong = !!(first & 128);
      let length = 0;
      if (!isLong)
        length = first;
      else {
        const lenLen = first & 127;
        if (!lenLen)
          throw new E("tlv.decode(long): indefinite length not supported");
        if (lenLen > 4)
          throw new E("tlv.decode(long): byte length is too big");
        const lengthBytes = data.subarray(pos, pos + lenLen);
        if (lengthBytes.length !== lenLen)
          throw new E("tlv.decode: length bytes not complete");
        if (lengthBytes[0] === 0)
          throw new E("tlv.decode(long): zero leftmost byte");
        for (const b of lengthBytes)
          length = length << 8 | b;
        pos += lenLen;
        if (length < 128)
          throw new E("tlv.decode(long): not minimal encoding");
      }
      const v = data.subarray(pos, pos + length);
      if (v.length !== length)
        throw new E("tlv.decode: wrong value length");
      return { v, l: data.subarray(pos + length) };
    }
  },
  // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
  // since we always use positive integers here. It must always be empty:
  // - add zero byte if exists
  // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
  _int: {
    encode(num2) {
      const { Err: E } = DER;
      if (num2 < _0n4)
        throw new E("integer: negative integers are not allowed");
      let hex = numberToHexUnpadded(num2);
      if (Number.parseInt(hex[0], 16) & 8)
        hex = "00" + hex;
      if (hex.length & 1)
        throw new E("unexpected DER parsing assertion: unpadded hex");
      return hex;
    },
    decode(data) {
      const { Err: E } = DER;
      if (data[0] & 128)
        throw new E("invalid signature integer: negative");
      if (data[0] === 0 && !(data[1] & 128))
        throw new E("invalid signature integer: unnecessary leading zero");
      return bytesToNumberBE(data);
    }
  },
  toSig(hex) {
    const { Err: E, _int: int, _tlv: tlv } = DER;
    const data = ensureBytes("signature", hex);
    const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
    if (seqLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
    const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
    if (sLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    return { r: int.decode(rBytes), s: int.decode(sBytes) };
  },
  hexFromSig(sig) {
    const { _tlv: tlv, _int: int } = DER;
    const rs = tlv.encode(2, int.encode(sig.r));
    const ss = tlv.encode(2, int.encode(sig.s));
    const seq = rs + ss;
    return tlv.encode(48, seq);
  }
};
var _0n4 = BigInt(0);
var _1n4 = BigInt(1);
var _2n2 = BigInt(2);
var _3n2 = BigInt(3);
var _4n2 = BigInt(4);
function _normFnElement(Fn, key) {
  const { BYTES: expected } = Fn;
  let num2;
  if (typeof key === "bigint") {
    num2 = key;
  } else {
    let bytes = ensureBytes("private key", key);
    try {
      num2 = Fn.fromBytes(bytes);
    } catch (error) {
      throw new Error(`invalid private key: expected ui8a of size ${expected}, got ${typeof key}`);
    }
  }
  if (!Fn.isValidNot0(num2))
    throw new Error("invalid private key: out of range [1..N-1]");
  return num2;
}
__name(_normFnElement, "_normFnElement");
function weierstrassN(params, extraOpts = {}) {
  const validated = _createCurveFields("weierstrass", params, extraOpts);
  const { Fp, Fn } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  _validateObject(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object",
    wrapPrivateKey: "boolean"
  });
  const { endo } = extraOpts;
  if (endo) {
    if (!Fp.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const lengths = getWLengths(Fp, Fn);
  function assertCompressionIsSupported() {
    if (!Fp.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  __name(assertCompressionIsSupported, "assertCompressionIsSupported");
  function pointToBytes2(_c, point, isCompressed) {
    const { x, y } = point.toAffine();
    const bx = Fp.toBytes(x);
    _abool2(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp.isOdd(y);
      return concatBytes(pprefix(hasEvenY), bx);
    } else {
      return concatBytes(Uint8Array.of(4), bx, Fp.toBytes(y));
    }
  }
  __name(pointToBytes2, "pointToBytes");
  function pointFromBytes(bytes) {
    _abytes2(bytes, void 0, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp.fromBytes(tail);
      if (!Fp.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const isYOdd = Fp.isOdd(y);
      const isHeadOdd = (head & 1) === 1;
      if (isHeadOdd !== isYOdd)
        y = Fp.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L = Fp.BYTES;
      const x = Fp.fromBytes(tail.subarray(0, L));
      const y = Fp.fromBytes(tail.subarray(L, L * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  __name(pointFromBytes, "pointFromBytes");
  const encodePoint = extraOpts.toBytes || pointToBytes2;
  const decodePoint = extraOpts.fromBytes || pointFromBytes;
  function weierstrassEquation(x) {
    const x2 = Fp.sqr(x);
    const x3 = Fp.mul(x2, x);
    return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
  }
  __name(weierstrassEquation, "weierstrassEquation");
  function isValidXY(x, y) {
    const left = Fp.sqr(y);
    const right = weierstrassEquation(x);
    return Fp.eql(left, right);
  }
  __name(isValidXY, "isValidXY");
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n2), _4n2);
  const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
  if (Fp.is0(Fp.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp.isValid(n) || banZero && Fp.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return n;
  }
  __name(acoord, "acoord");
  function aprjpoint(other) {
    if (!(other instanceof Point))
      throw new Error("ProjectivePoint expected");
  }
  __name(aprjpoint, "aprjpoint");
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn.ORDER);
  }
  __name(splitEndoScalarN, "splitEndoScalarN");
  const toAffineMemo = memoized((p, iz) => {
    const { X, Y, Z } = p;
    if (Fp.eql(Z, Fp.ONE))
      return { x: X, y: Y };
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? Fp.ONE : Fp.inv(Z);
    const x = Fp.mul(X, iz);
    const y = Fp.mul(Y, iz);
    const zz = Fp.mul(Z, iz);
    if (is0)
      return { x: Fp.ZERO, y: Fp.ZERO };
    if (!Fp.eql(zz, Fp.ONE))
      throw new Error("invZ was invalid");
    return { x, y };
  });
  const assertValidMemo = memoized((p) => {
    if (p.is0()) {
      if (extraOpts.allowInfinityPoint && !Fp.is0(p.Y))
        return;
      throw new Error("bad point: ZERO");
    }
    const { x, y } = p.toAffine();
    if (!Fp.isValid(x) || !Fp.isValid(y))
      throw new Error("bad point: x or y not field elements");
    if (!isValidXY(x, y))
      throw new Error("bad point: equation left != right");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    return true;
  });
  function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
    k2p = new Point(Fp.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
    k1p = negateCt(k1neg, k1p);
    k2p = negateCt(k2neg, k2p);
    return k1p.add(k2p);
  }
  __name(finishEndo, "finishEndo");
  const _Point = class _Point {
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof _Point)
        throw new Error("projective point not allowed");
      if (Fp.is0(x) && Fp.is0(y))
        return _Point.ZERO;
      return new _Point(x, y, Fp.ONE);
    }
    static fromBytes(bytes) {
      const P = _Point.fromAffine(decodePoint(_abytes2(bytes, void 0, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex) {
      return _Point.fromBytes(ensureBytes("pointHex", hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     *
     * @param windowSize
     * @param isLazy true will defer table computation until the first multiplication
     * @returns
     */
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_3n2);
      return this;
    }
    // TODO: return `this`
    /** A point on curve is valid if it conforms to equation. */
    assertValidity() {
      assertValidMemo(this);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp.isOdd(y);
    }
    /** Compare one point to another. */
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
    negate() {
      return new _Point(this.X, Fp.neg(this.Y), this.Z);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp.mul(b, _3n2);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      let t0 = Fp.mul(X1, X1);
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3);
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = Fp.mul(a, Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3);
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3);
      t2 = Fp.mul(a, t2);
      t3 = Fp.sub(t0, t2);
      t3 = Fp.mul(a, t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0);
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1);
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3);
      Z3 = Fp.add(Z3, Z3);
      return new _Point(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      const a = CURVE.a;
      const b3 = Fp.mul(CURVE.b, _3n2);
      let t0 = Fp.mul(X1, X2);
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2);
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2);
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2);
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = Fp.mul(a, t4);
      X3 = Fp.mul(b3, t2);
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0);
      t1 = Fp.add(t1, t0);
      t2 = Fp.mul(a, t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2);
      t2 = Fp.mul(a, t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4);
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0);
      return new _Point(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(_Point.ZERO);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      const { endo: endo2 } = extraOpts;
      if (!Fn.isValidNot0(scalar))
        throw new Error("invalid scalar: out of range");
      let point, fake;
      const mul = /* @__PURE__ */ __name((n) => wnaf.cached(this, n, (p) => normalizeZ(_Point, p)), "mul");
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
        const { p: k1p, f: k1f } = mul(k1);
        const { p: k2p, f: k2f } = mul(k2);
        fake = k1f.add(k2f);
        point = finishEndo(endo2.beta, k1p, k2p, k1neg, k2neg);
      } else {
        const { p, f } = mul(scalar);
        point = p;
        fake = f;
      }
      return normalizeZ(_Point, [point, fake])[0];
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed secret key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(sc) {
      const { endo: endo2 } = extraOpts;
      const p = this;
      if (!Fn.isValid(sc))
        throw new Error("invalid scalar: out of range");
      if (sc === _0n4 || p.is0())
        return _Point.ZERO;
      if (sc === _1n4)
        return p;
      if (wnaf.hasCache(this))
        return this.multiply(sc);
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
        const { p1, p2 } = mulEndoUnsafe(_Point, p, k1, k2);
        return finishEndo(endo2.beta, p1, p2, k1neg, k2neg);
      } else {
        return wnaf.unsafe(p, sc);
      }
    }
    multiplyAndAddUnsafe(Q, a, b) {
      const sum = this.multiplyUnsafe(a).add(Q.multiplyUnsafe(b));
      return sum.is0() ? void 0 : sum;
    }
    /**
     * Converts Projective point to affine (x, y) coordinates.
     * @param invertedZ Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
     */
    toAffine(invertedZ) {
      return toAffineMemo(this, invertedZ);
    }
    /**
     * Checks whether Point is free of torsion elements (is in prime subgroup).
     * Always torsion-free for cofactor=1 curves.
     */
    isTorsionFree() {
      const { isTorsionFree } = extraOpts;
      if (cofactor === _1n4)
        return true;
      if (isTorsionFree)
        return isTorsionFree(_Point, this);
      return wnaf.unsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      const { clearCofactor } = extraOpts;
      if (cofactor === _1n4)
        return this;
      if (clearCofactor)
        return clearCofactor(_Point, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      return this.multiplyUnsafe(cofactor).is0();
    }
    toBytes(isCompressed = true) {
      _abool2(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(_Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
    // TODO: remove
    get px() {
      return this.X;
    }
    get py() {
      return this.X;
    }
    get pz() {
      return this.Z;
    }
    toRawBytes(isCompressed = true) {
      return this.toBytes(isCompressed);
    }
    _setWindowSize(windowSize) {
      this.precompute(windowSize);
    }
    static normalizeZ(points) {
      return normalizeZ(_Point, points);
    }
    static msm(points, scalars) {
      return pippenger(_Point, Fn, points, scalars);
    }
    static fromPrivateKey(privateKey) {
      return _Point.BASE.multiply(_normFnElement(Fn, privateKey));
    }
  };
  __name(_Point, "Point");
  let Point = _Point;
  Point.BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
  Point.ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO);
  Point.Fp = Fp;
  Point.Fn = Fn;
  const bits = Fn.BITS;
  const wnaf = new wNAF(Point, extraOpts.endo ? Math.ceil(bits / 2) : bits);
  Point.BASE.precompute(8);
  return Point;
}
__name(weierstrassN, "weierstrassN");
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
__name(pprefix, "pprefix");
function getWLengths(Fp, Fn) {
  return {
    secretKey: Fn.BYTES,
    publicKey: 1 + Fp.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp.BYTES,
    publicKeyHasPrefix: true,
    signature: 2 * Fn.BYTES
  };
}
__name(getWLengths, "getWLengths");
function ecdh(Point, ecdhOpts = {}) {
  const { Fn } = Point;
  const randomBytes_ = ecdhOpts.randomBytes || randomBytes;
  const lengths = Object.assign(getWLengths(Point.Fp, Fn), { seed: getMinHashLength(Fn.ORDER) });
  function isValidSecretKey(secretKey) {
    try {
      return !!_normFnElement(Fn, secretKey);
    } catch (error) {
      return false;
    }
  }
  __name(isValidSecretKey, "isValidSecretKey");
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp)
        return false;
      if (isCompressed === false && l !== publicKeyUncompressed)
        return false;
      return !!Point.fromBytes(publicKey);
    } catch (error) {
      return false;
    }
  }
  __name(isValidPublicKey, "isValidPublicKey");
  function randomSecretKey(seed = randomBytes_(lengths.seed)) {
    return mapHashToField(_abytes2(seed, lengths.seed, "seed"), Fn.ORDER);
  }
  __name(randomSecretKey, "randomSecretKey");
  function getPublicKey(secretKey, isCompressed = true) {
    return Point.BASE.multiply(_normFnElement(Fn, secretKey)).toBytes(isCompressed);
  }
  __name(getPublicKey, "getPublicKey");
  function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  }
  __name(keygen, "keygen");
  function isProbPub(item) {
    if (typeof item === "bigint")
      return false;
    if (item instanceof Point)
      return true;
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    if (Fn.allowedLengths || secretKey === publicKey)
      return void 0;
    const l = ensureBytes("key", item).length;
    return l === publicKey || l === publicKeyUncompressed;
  }
  __name(isProbPub, "isProbPub");
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false)
      throw new Error("second arg must be public key");
    const s = _normFnElement(Fn, secretKeyA);
    const b = Point.fromHex(publicKeyB);
    return b.multiply(s).toBytes(isCompressed);
  }
  __name(getSharedSecret, "getSharedSecret");
  const utils = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey,
    // TODO: remove
    isValidPrivateKey: isValidSecretKey,
    randomPrivateKey: randomSecretKey,
    normPrivateKeyToScalar: (key) => _normFnElement(Fn, key),
    precompute(windowSize = 8, point = Point.BASE) {
      return point.precompute(windowSize, false);
    }
  };
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point, utils, lengths });
}
__name(ecdh, "ecdh");
function ecdsa(Point, hash, ecdsaOpts = {}) {
  ahash(hash);
  _validateObject(ecdsaOpts, {}, {
    hmac: "function",
    lowS: "boolean",
    randomBytes: "function",
    bits2int: "function",
    bits2int_modN: "function"
  });
  const randomBytes2 = ecdsaOpts.randomBytes || randomBytes;
  const hmac2 = ecdsaOpts.hmac || ((key, ...msgs) => hmac(hash, key, concatBytes(...msgs)));
  const { Fp, Fn } = Point;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn;
  const { keygen, getPublicKey, getSharedSecret, utils, lengths } = ecdh(Point, ecdsaOpts);
  const defaultSigOpts = {
    prehash: false,
    lowS: typeof ecdsaOpts.lowS === "boolean" ? ecdsaOpts.lowS : false,
    format: void 0,
    //'compact' as ECDSASigFormat,
    extraEntropy: false
  };
  const defaultSigOpts_format = "compact";
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n4;
    return number > HALF;
  }
  __name(isBiggerThanHalfOrder, "isBiggerThanHalfOrder");
  function validateRS(title, num2) {
    if (!Fn.isValidNot0(num2))
      throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num2;
  }
  __name(validateRS, "validateRS");
  function validateSigLength(bytes, format) {
    validateSigFormat(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : void 0;
    return _abytes2(bytes, sizer, `${format} signature`);
  }
  __name(validateSigLength, "validateSigLength");
  const _Signature = class _Signature {
    constructor(r, s, recovery) {
      this.r = validateRS("r", r);
      this.s = validateRS("s", s);
      if (recovery != null)
        this.recovery = recovery;
      Object.freeze(this);
    }
    static fromBytes(bytes, format = defaultSigOpts_format) {
      validateSigLength(bytes, format);
      let recid;
      if (format === "der") {
        const { r: r2, s: s2 } = DER.toSig(_abytes2(bytes));
        return new _Signature(r2, s2);
      }
      if (format === "recovered") {
        recid = bytes[0];
        format = "compact";
        bytes = bytes.subarray(1);
      }
      const L = Fn.BYTES;
      const r = bytes.subarray(0, L);
      const s = bytes.subarray(L, L * 2);
      return new _Signature(Fn.fromBytes(r), Fn.fromBytes(s), recid);
    }
    static fromHex(hex, format) {
      return this.fromBytes(hexToBytes(hex), format);
    }
    addRecoveryBit(recovery) {
      return new _Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(messageHash) {
      const FIELD_ORDER = Fp.ORDER;
      const { r, s, recovery: rec } = this;
      if (rec == null || ![0, 1, 2, 3].includes(rec))
        throw new Error("recovery id invalid");
      const hasCofactor = CURVE_ORDER * _2n2 < FIELD_ORDER;
      if (hasCofactor && rec > 1)
        throw new Error("recovery id is ambiguous for h>1 curve");
      const radj = rec === 2 || rec === 3 ? r + CURVE_ORDER : r;
      if (!Fp.isValid(radj))
        throw new Error("recovery id 2 or 3 invalid");
      const x = Fp.toBytes(radj);
      const R = Point.fromBytes(concatBytes(pprefix((rec & 1) === 0), x));
      const ir = Fn.inv(radj);
      const h = bits2int_modN(ensureBytes("msgHash", messageHash));
      const u1 = Fn.create(-h * ir);
      const u2 = Fn.create(s * ir);
      const Q = Point.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
      if (Q.is0())
        throw new Error("point at infinify");
      Q.assertValidity();
      return Q;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts_format) {
      validateSigFormat(format);
      if (format === "der")
        return hexToBytes(DER.hexFromSig(this));
      const r = Fn.toBytes(this.r);
      const s = Fn.toBytes(this.s);
      if (format === "recovered") {
        if (this.recovery == null)
          throw new Error("recovery bit must be present");
        return concatBytes(Uint8Array.of(this.recovery), r, s);
      }
      return concatBytes(r, s);
    }
    toHex(format) {
      return bytesToHex(this.toBytes(format));
    }
    // TODO: remove
    assertValidity() {
    }
    static fromCompact(hex) {
      return _Signature.fromBytes(ensureBytes("sig", hex), "compact");
    }
    static fromDER(hex) {
      return _Signature.fromBytes(ensureBytes("sig", hex), "der");
    }
    normalizeS() {
      return this.hasHighS() ? new _Signature(this.r, Fn.neg(this.s), this.recovery) : this;
    }
    toDERRawBytes() {
      return this.toBytes("der");
    }
    toDERHex() {
      return bytesToHex(this.toBytes("der"));
    }
    toCompactRawBytes() {
      return this.toBytes("compact");
    }
    toCompactHex() {
      return bytesToHex(this.toBytes("compact"));
    }
  };
  __name(_Signature, "Signature");
  let Signature = _Signature;
  const bits2int = ecdsaOpts.bits2int || /* @__PURE__ */ __name(function bits2int_def(bytes) {
    if (bytes.length > 8192)
      throw new Error("input is too large");
    const num2 = bytesToNumberBE(bytes);
    const delta = bytes.length * 8 - fnBits;
    return delta > 0 ? num2 >> BigInt(delta) : num2;
  }, "bits2int_def");
  const bits2int_modN = ecdsaOpts.bits2int_modN || /* @__PURE__ */ __name(function bits2int_modN_def(bytes) {
    return Fn.create(bits2int(bytes));
  }, "bits2int_modN_def");
  const ORDER_MASK = bitMask(fnBits);
  function int2octets(num2) {
    aInRange("num < 2^" + fnBits, num2, _0n4, ORDER_MASK);
    return Fn.toBytes(num2);
  }
  __name(int2octets, "int2octets");
  function validateMsgAndHash(message, prehash) {
    _abytes2(message, void 0, "message");
    return prehash ? _abytes2(hash(message), void 0, "prehashed message") : message;
  }
  __name(validateMsgAndHash, "validateMsgAndHash");
  function prepSig(message, privateKey, opts) {
    if (["recovered", "canonical"].some((k) => k in opts))
      throw new Error("sign() legacy options not supported");
    const { lowS, prehash, extraEntropy } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    const h1int = bits2int_modN(message);
    const d = _normFnElement(Fn, privateKey);
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (extraEntropy != null && extraEntropy !== false) {
      const e = extraEntropy === true ? randomBytes2(lengths.secretKey) : extraEntropy;
      seedArgs.push(ensureBytes("extraEntropy", e));
    }
    const seed = concatBytes(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!Fn.isValidNot0(k))
        return;
      const ik = Fn.inv(k);
      const q = Point.BASE.multiply(k).toAffine();
      const r = Fn.create(q.x);
      if (r === _0n4)
        return;
      const s = Fn.create(ik * Fn.create(m + r * d));
      if (s === _0n4)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n4);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn.neg(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, recovery);
    }
    __name(k2sig, "k2sig");
    return { seed, k2sig };
  }
  __name(prepSig, "prepSig");
  function sign(message, secretKey, opts = {}) {
    message = ensureBytes("message", message);
    const { seed, k2sig } = prepSig(message, secretKey, opts);
    const drbg = createHmacDrbg(hash.outputLen, Fn.BYTES, hmac2);
    const sig = drbg(seed, k2sig);
    return sig;
  }
  __name(sign, "sign");
  function tryParsingSig(sg) {
    let sig = void 0;
    const isHex = typeof sg === "string" || isBytes(sg);
    const isObj = !isHex && sg !== null && typeof sg === "object" && typeof sg.r === "bigint" && typeof sg.s === "bigint";
    if (!isHex && !isObj)
      throw new Error("invalid signature, expected Uint8Array, hex string or Signature instance");
    if (isObj) {
      sig = new Signature(sg.r, sg.s);
    } else if (isHex) {
      try {
        sig = Signature.fromBytes(ensureBytes("sig", sg), "der");
      } catch (derError) {
        if (!(derError instanceof DER.Err))
          throw derError;
      }
      if (!sig) {
        try {
          sig = Signature.fromBytes(ensureBytes("sig", sg), "compact");
        } catch (error) {
          return false;
        }
      }
    }
    if (!sig)
      return false;
    return sig;
  }
  __name(tryParsingSig, "tryParsingSig");
  function verify(signature, message, publicKey, opts = {}) {
    const { lowS, prehash, format } = validateSigOpts(opts, defaultSigOpts);
    publicKey = ensureBytes("publicKey", publicKey);
    message = validateMsgAndHash(ensureBytes("message", message), prehash);
    if ("strict" in opts)
      throw new Error("options.strict was renamed to lowS");
    const sig = format === void 0 ? tryParsingSig(signature) : Signature.fromBytes(ensureBytes("sig", signature), format);
    if (sig === false)
      return false;
    try {
      const P = Point.fromBytes(publicKey);
      if (lowS && sig.hasHighS())
        return false;
      const { r, s } = sig;
      const h = bits2int_modN(message);
      const is = Fn.inv(s);
      const u1 = Fn.create(h * is);
      const u2 = Fn.create(r * is);
      const R = Point.BASE.multiplyUnsafe(u1).add(P.multiplyUnsafe(u2));
      if (R.is0())
        return false;
      const v = Fn.create(R.x);
      return v === r;
    } catch (e) {
      return false;
    }
  }
  __name(verify, "verify");
  function recoverPublicKey(signature, message, opts = {}) {
    const { prehash } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  __name(recoverPublicKey, "recoverPublicKey");
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils,
    lengths,
    Point,
    sign,
    verify,
    recoverPublicKey,
    Signature,
    hash
  });
}
__name(ecdsa, "ecdsa");
function _weierstrass_legacy_opts_to_new(c) {
  const CURVE = {
    a: c.a,
    b: c.b,
    p: c.Fp.ORDER,
    n: c.n,
    h: c.h,
    Gx: c.Gx,
    Gy: c.Gy
  };
  const Fp = c.Fp;
  let allowedLengths = c.allowedPrivateKeyLengths ? Array.from(new Set(c.allowedPrivateKeyLengths.map((l) => Math.ceil(l / 2)))) : void 0;
  const Fn = Field(CURVE.n, {
    BITS: c.nBitLength,
    allowedLengths,
    modFromBytes: c.wrapPrivateKey
  });
  const curveOpts = {
    Fp,
    Fn,
    allowInfinityPoint: c.allowInfinityPoint,
    endo: c.endo,
    isTorsionFree: c.isTorsionFree,
    clearCofactor: c.clearCofactor,
    fromBytes: c.fromBytes,
    toBytes: c.toBytes
  };
  return { CURVE, curveOpts };
}
__name(_weierstrass_legacy_opts_to_new, "_weierstrass_legacy_opts_to_new");
function _ecdsa_legacy_opts_to_new(c) {
  const { CURVE, curveOpts } = _weierstrass_legacy_opts_to_new(c);
  const ecdsaOpts = {
    hmac: c.hmac,
    randomBytes: c.randomBytes,
    lowS: c.lowS,
    bits2int: c.bits2int,
    bits2int_modN: c.bits2int_modN
  };
  return { CURVE, curveOpts, hash: c.hash, ecdsaOpts };
}
__name(_ecdsa_legacy_opts_to_new, "_ecdsa_legacy_opts_to_new");
function _ecdsa_new_output_to_legacy(c, _ecdsa) {
  const Point = _ecdsa.Point;
  return Object.assign({}, _ecdsa, {
    ProjectivePoint: Point,
    CURVE: Object.assign({}, c, nLength(Point.Fn.ORDER, Point.Fn.BITS))
  });
}
__name(_ecdsa_new_output_to_legacy, "_ecdsa_new_output_to_legacy");
function weierstrass(c) {
  const { CURVE, curveOpts, hash, ecdsaOpts } = _ecdsa_legacy_opts_to_new(c);
  const Point = weierstrassN(CURVE, curveOpts);
  const signs = ecdsa(Point, hash, ecdsaOpts);
  return _ecdsa_new_output_to_legacy(c, signs);
}
__name(weierstrass, "weierstrass");

// node_modules/@noble/curves/esm/_shortw_utils.js
function createCurve(curveDef, defHash) {
  const create = /* @__PURE__ */ __name((hash) => weierstrass({ ...curveDef, hash }), "create");
  return { ...create(defHash), create };
}
__name(createCurve, "createCurve");

// node_modules/@noble/curves/esm/secp256k1.js
var secp256k1_CURVE = {
  p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
  n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
  h: BigInt(1),
  a: BigInt(0),
  b: BigInt(7),
  Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
  Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
};
var secp256k1_ENDO = {
  beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
  basises: [
    [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
    [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
  ]
};
var _0n5 = /* @__PURE__ */ BigInt(0);
var _1n5 = /* @__PURE__ */ BigInt(1);
var _2n3 = /* @__PURE__ */ BigInt(2);
function sqrtMod(y) {
  const P = secp256k1_CURVE.p;
  const _3n3 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n3, P) * b3 % P;
  const b9 = pow2(b6, _3n3, P) * b3 % P;
  const b11 = pow2(b9, _2n3, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n3, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n3, P);
  if (!Fpk1.eql(Fpk1.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
__name(sqrtMod, "sqrtMod");
var Fpk1 = Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
var secp256k1 = createCurve({ ...secp256k1_CURVE, Fp: Fpk1, lowS: true, endo: secp256k1_ENDO }, sha256);
var TAGGED_HASH_PREFIXES = {};
function taggedHash(tag, ...messages) {
  let tagP = TAGGED_HASH_PREFIXES[tag];
  if (tagP === void 0) {
    const tagH = sha256(utf8ToBytes(tag));
    tagP = concatBytes(tagH, tagH);
    TAGGED_HASH_PREFIXES[tag] = tagP;
  }
  return sha256(concatBytes(tagP, ...messages));
}
__name(taggedHash, "taggedHash");
var pointToBytes = /* @__PURE__ */ __name((point) => point.toBytes(true).slice(1), "pointToBytes");
var Pointk1 = /* @__PURE__ */ (() => secp256k1.Point)();
var hasEven = /* @__PURE__ */ __name((y) => y % _2n3 === _0n5, "hasEven");
function schnorrGetExtPubKey(priv) {
  const { Fn, BASE } = Pointk1;
  const d_ = _normFnElement(Fn, priv);
  const p = BASE.multiply(d_);
  const scalar = hasEven(p.y) ? d_ : Fn.neg(d_);
  return { scalar, bytes: pointToBytes(p) };
}
__name(schnorrGetExtPubKey, "schnorrGetExtPubKey");
function lift_x(x) {
  const Fp = Fpk1;
  if (!Fp.isValidNot0(x))
    throw new Error("invalid x: Fail if x \u2265 p");
  const xx = Fp.create(x * x);
  const c = Fp.create(xx * x + BigInt(7));
  let y = Fp.sqrt(c);
  if (!hasEven(y))
    y = Fp.neg(y);
  const p = Pointk1.fromAffine({ x, y });
  p.assertValidity();
  return p;
}
__name(lift_x, "lift_x");
var num = bytesToNumberBE;
function challenge(...args) {
  return Pointk1.Fn.create(num(taggedHash("BIP0340/challenge", ...args)));
}
__name(challenge, "challenge");
function schnorrGetPublicKey(secretKey) {
  return schnorrGetExtPubKey(secretKey).bytes;
}
__name(schnorrGetPublicKey, "schnorrGetPublicKey");
function schnorrSign(message, secretKey, auxRand = randomBytes(32)) {
  const { Fn } = Pointk1;
  const m = ensureBytes("message", message);
  const { bytes: px, scalar: d } = schnorrGetExtPubKey(secretKey);
  const a = ensureBytes("auxRand", auxRand, 32);
  const t = Fn.toBytes(d ^ num(taggedHash("BIP0340/aux", a)));
  const rand = taggedHash("BIP0340/nonce", t, px, m);
  const { bytes: rx, scalar: k } = schnorrGetExtPubKey(rand);
  const e = challenge(rx, px, m);
  const sig = new Uint8Array(64);
  sig.set(rx, 0);
  sig.set(Fn.toBytes(Fn.create(k + e * d)), 32);
  if (!schnorrVerify(sig, m, px))
    throw new Error("sign: Invalid signature produced");
  return sig;
}
__name(schnorrSign, "schnorrSign");
function schnorrVerify(signature, message, publicKey) {
  const { Fn, BASE } = Pointk1;
  const sig = ensureBytes("signature", signature, 64);
  const m = ensureBytes("message", message);
  const pub = ensureBytes("publicKey", publicKey, 32);
  try {
    const P = lift_x(num(pub));
    const r = num(sig.subarray(0, 32));
    if (!inRange(r, _1n5, secp256k1_CURVE.p))
      return false;
    const s = num(sig.subarray(32, 64));
    if (!inRange(s, _1n5, secp256k1_CURVE.n))
      return false;
    const e = challenge(Fn.toBytes(r), pointToBytes(P), m);
    const R = BASE.multiplyUnsafe(s).add(P.multiplyUnsafe(Fn.neg(e)));
    const { x, y } = R.toAffine();
    if (R.is0() || !hasEven(y) || x !== r)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}
__name(schnorrVerify, "schnorrVerify");
var schnorr = /* @__PURE__ */ (() => {
  const size = 32;
  const seedLength = 48;
  const randomSecretKey = /* @__PURE__ */ __name((seed = randomBytes(seedLength)) => {
    return mapHashToField(seed, secp256k1_CURVE.n);
  }, "randomSecretKey");
  secp256k1.utils.randomSecretKey;
  function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: schnorrGetPublicKey(secretKey) };
  }
  __name(keygen, "keygen");
  return {
    keygen,
    getPublicKey: schnorrGetPublicKey,
    sign: schnorrSign,
    verify: schnorrVerify,
    Point: Pointk1,
    utils: {
      randomSecretKey,
      randomPrivateKey: randomSecretKey,
      taggedHash,
      // TODO: remove
      lift_x,
      pointToBytes,
      numberToBytesBE,
      bytesToNumberBE,
      mod
    },
    lengths: {
      secretKey: size,
      publicKey: size,
      publicKeyHasPrefix: false,
      signature: size * 2,
      seed: seedLength
    }
  };
})();

// src/relay-worker.ts
var {
  relayInfo: relayInfo2,
  PAY_TO_RELAY_ENABLED: PAY_TO_RELAY_ENABLED2,
  RELAY_ACCESS_PRICE_SATS: RELAY_ACCESS_PRICE_SATS2,
  relayNpub: relayNpub2,
  nip05Users: nip05Users2,
  enableAntiSpam: enableAntiSpam2,
  enableGlobalDuplicateCheck: enableGlobalDuplicateCheck2,
  antiSpamKinds: antiSpamKinds2,
  checkValidNip05: checkValidNip052,
  blockedNip05Domains: blockedNip05Domains2,
  allowedNip05Domains: allowedNip05Domains2,
  DB_PRUNING_ENABLED: DB_PRUNING_ENABLED2,
  DB_SIZE_THRESHOLD_GB: DB_SIZE_THRESHOLD_GB2,
  DB_PRUNE_BATCH_SIZE: DB_PRUNE_BATCH_SIZE2,
  DB_PRUNE_TARGET_GB: DB_PRUNE_TARGET_GB2,
  pruneProtectedKinds: pruneProtectedKinds2
} = config_exports;
var GLOBAL_MAX_EVENTS = 500;
var MAX_QUERY_COMPLEXITY = 1e3;
var CHUNK_SIZE = 500;
async function initializeDatabase(db) {
  try {
    const session2 = db.withSession("first-unconstrained");
    const initCheck = await session2.prepare(
      "SELECT value FROM system_config WHERE key = 'db_initialized' LIMIT 1"
    ).first().catch(() => null);
    if (initCheck && initCheck.value === "1") {
      console.log("Database already initialized");
      return;
    }
  } catch (error) {
    console.log("Database not initialized, creating schema...");
  }
  const session = db.withSession("first-primary");
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
    const versionResult = await session.prepare(
      "SELECT value FROM system_config WHERE key = 'schema_version'"
    ).first();
    const currentVersion = versionResult ? parseInt(versionResult.value) : 0;
    if (currentVersion < 5) {
      console.log("Migrating to schema version 5: populating tag columns in events table...");
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
      console.log("Schema v5 migration completed");
    }
    if (currentVersion < 6) {
      console.log("Migrating to schema version 6: adding L/s/u tags and thread metadata...");
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
      console.log("Schema v6 migration completed");
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
__name(initializeDatabase, "initializeDatabase");
async function verifyEventSignature(event) {
  try {
    const signatureBytes = hexToBytes2(event.sig);
    const serializedEventData = serializeEventForSigning(event);
    const messageHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(serializedEventData)
    );
    const messageHash = new Uint8Array(messageHashBuffer);
    const publicKeyBytes = hexToBytes2(event.pubkey);
    return schnorr.verify(signatureBytes, messageHash, publicKeyBytes);
  } catch (error) {
    console.error("Error verifying event signature:", error);
    return false;
  }
}
__name(verifyEventSignature, "verifyEventSignature");
function serializeEventForSigning(event) {
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ]);
}
__name(serializeEventForSigning, "serializeEventForSigning");
function hexToBytes2(hexString) {
  if (hexString.length % 2 !== 0)
    throw new Error("Invalid hex string");
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}
__name(hexToBytes2, "hexToBytes");
function bytesToHex2(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(bytesToHex2, "bytesToHex");
async function hashContent(event) {
  const contentToHash = enableGlobalDuplicateCheck2 ? JSON.stringify({ kind: event.kind, tags: event.tags, content: event.content }) : JSON.stringify({ pubkey: event.pubkey, kind: event.kind, tags: event.tags, content: event.content });
  const buffer = new TextEncoder().encode(contentToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return bytesToHex2(new Uint8Array(hashBuffer));
}
__name(hashContent, "hashContent");
function shouldCheckForDuplicates(kind) {
  return enableAntiSpam2 && antiSpamKinds2.has(kind);
}
__name(shouldCheckForDuplicates, "shouldCheckForDuplicates");
async function hasPaidForRelay(pubkey, env) {
  if (!PAY_TO_RELAY_ENABLED2)
    return true;
  try {
    const session = env.RELAY_DATABASE.withSession("first-unconstrained");
    const result = await session.prepare(
      "SELECT pubkey FROM paid_pubkeys WHERE pubkey = ? LIMIT 1"
    ).bind(pubkey).first();
    return result !== null;
  } catch (error) {
    console.error(`Error checking paid status for ${pubkey}:`, error);
    return false;
  }
}
__name(hasPaidForRelay, "hasPaidForRelay");
async function savePaidPubkey(pubkey, env) {
  try {
    const session = env.RELAY_DATABASE.withSession("first-primary");
    await session.prepare(`
      INSERT INTO paid_pubkeys (pubkey, paid_at, amount_sats)
      VALUES (?, ?, ?)
      ON CONFLICT(pubkey) DO UPDATE SET
        paid_at = excluded.paid_at,
        amount_sats = excluded.amount_sats
    `).bind(pubkey, Math.floor(Date.now() / 1e3), RELAY_ACCESS_PRICE_SATS2).run();
    return true;
  } catch (error) {
    console.error(`Error saving paid pubkey ${pubkey}:`, error);
    return false;
  }
}
__name(savePaidPubkey, "savePaidPubkey");
function fetchEventFromFallbackRelay(pubkey) {
  return new Promise((resolve, reject) => {
    const fallbackRelayUrl = "wss://relay.nostr.band";
    const ws = new WebSocket(fallbackRelayUrl);
    let hasClosed = false;
    const closeWebSocket = /* @__PURE__ */ __name((subscriptionId) => {
      if (!hasClosed && ws.readyState === WebSocket.OPEN) {
        if (subscriptionId) {
          ws.send(JSON.stringify(["CLOSE", subscriptionId]));
        }
        ws.close();
        hasClosed = true;
        console.log("WebSocket connection to fallback relay closed");
      }
    }, "closeWebSocket");
    ws.addEventListener("open", () => {
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
    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message[0] === "EVENT" && message[1]) {
          const eventData = message[2];
          if (eventData.kind === 0 && eventData.pubkey === pubkey) {
            console.log("Received kind 0 event from fallback relay.");
            closeWebSocket(message[1]);
            resolve(eventData);
          }
        } else if (message[0] === "EOSE") {
          console.log("EOSE received from fallback relay, no kind 0 event found.");
          closeWebSocket(message[1]);
          resolve(null);
        }
      } catch (error) {
        console.error(`Error processing fallback relay event for pubkey ${pubkey}: ${error}`);
        reject(error);
      }
    });
    ws.addEventListener("error", (error) => {
      console.error(`WebSocket error with fallback relay:`, error);
      ws.close();
      hasClosed = true;
      reject(error);
    });
    ws.addEventListener("close", () => {
      hasClosed = true;
      console.log("Fallback relay WebSocket connection closed.");
    });
    setTimeout(() => {
      if (!hasClosed) {
        console.log("Timeout reached. Closing WebSocket connection to fallback relay.");
        closeWebSocket(null);
        reject(new Error(`No response from fallback relay for pubkey ${pubkey}`));
      }
    }, 5e3);
  });
}
__name(fetchEventFromFallbackRelay, "fetchEventFromFallbackRelay");
async function fetchKind0EventForPubkey(pubkey, env) {
  try {
    const filters = [{ kinds: [0], authors: [pubkey], limit: 1 }];
    const result = await queryEvents(filters, "first-unconstrained", env);
    if (result.events && result.events.length > 0) {
      return result.events[0];
    }
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
__name(fetchKind0EventForPubkey, "fetchKind0EventForPubkey");
async function validateNIP05FromKind0(pubkey, env) {
  try {
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
    const isValid = await validateNIP05(nip05Address, pubkey);
    return isValid;
  } catch (error) {
    console.error(`Error validating NIP-05 for pubkey ${pubkey}: ${error}`);
    return false;
  }
}
__name(validateNIP05FromKind0, "validateNIP05FromKind0");
async function validateNIP05(nip05Address, pubkey) {
  try {
    const [name, domain] = nip05Address.split("@");
    if (!domain) {
      throw new Error(`Invalid NIP-05 address format: ${nip05Address}`);
    }
    if (blockedNip05Domains2.has(domain)) {
      console.error(`NIP-05 domain is blocked: ${domain}`);
      return false;
    }
    if (allowedNip05Domains2.size > 0 && !allowedNip05Domains2.has(domain)) {
      console.error(`NIP-05 domain is not allowed: ${domain}`);
      return false;
    }
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
__name(validateNIP05, "validateNIP05");
function calculateQueryComplexity(filter) {
  let complexity = 0;
  complexity += (filter.ids?.length || 0) * 1;
  complexity += (filter.authors?.length || 0) * 2;
  complexity += (filter.kinds?.length || 0) * 5;
  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith("#") && Array.isArray(values)) {
      complexity += values.length * 10;
    }
  }
  if (!filter.since && !filter.until) {
    complexity *= 2;
  }
  if ((filter.limit || 0) > 1e3) {
    complexity *= 1.5;
  }
  return complexity;
}
__name(calculateQueryComplexity, "calculateQueryComplexity");
async function processEvent(event, sessionId, env) {
  try {
    const session = env.RELAY_DATABASE.withSession("first-primary");
    const existingEvent = await session.prepare("SELECT id FROM events WHERE id = ? LIMIT 1").bind(event.id).first();
    if (existingEvent) {
      console.log(`Duplicate event detected: ${event.id}`);
      return { success: false, message: "duplicate: already have this event", bookmark: session.getBookmark() ?? void 0 };
    }
    if (event.kind !== 1059 && checkValidNip052 && event.kind !== 0) {
      const isValidNIP05 = await validateNIP05FromKind0(event.pubkey, env);
      if (!isValidNIP05) {
        console.error(`Event denied. NIP-05 validation failed for pubkey ${event.pubkey}.`);
        return { success: false, message: "invalid: NIP-05 validation failed" };
      }
    }
    if (event.kind === 5) {
      return await processDeletionEvent(event, env);
    }
    return await saveEventToDatabase(event, env);
  } catch (error) {
    console.error(`Error processing event: ${error.message}`);
    return { success: false, message: `error: ${error.message}` };
  }
}
__name(processEvent, "processEvent");
async function saveEventToDatabase(event, env) {
  try {
    const cache = caches.default;
    const cacheKey = new Request(`https://event-cache/${event.id}`);
    const cached = await cache.match(cacheKey);
    if (cached) {
      return { success: false, message: "duplicate: event already exists" };
    }
    const session = env.RELAY_DATABASE.withSession("first-primary");
    const existingEvent = await session.prepare("SELECT id FROM events WHERE id = ? LIMIT 1").bind(event.id).first();
    if (existingEvent) {
      return { success: false, message: "duplicate: event already exists", bookmark: session.getBookmark() ?? void 0 };
    }
    let contentHash = null;
    if (shouldCheckForDuplicates(event.kind)) {
      contentHash = await hashContent(event);
      const duplicateContent = enableGlobalDuplicateCheck2 ? await session.prepare("SELECT event_id FROM content_hashes WHERE hash = ? LIMIT 1").bind(contentHash).first() : await session.prepare("SELECT event_id FROM content_hashes WHERE hash = ? AND pubkey = ? LIMIT 1").bind(contentHash, event.pubkey).first();
      if (duplicateContent) {
        return { success: false, message: "duplicate: content already exists", bookmark: session.getBookmark() ?? void 0 };
      }
    }
    const tagInserts = [];
    let tagP = null;
    let tagE = null;
    let tagA = null;
    let tagT = null;
    let tagD = null;
    let tagR = null;
    let tagL = null;
    let tagS = null;
    let tagU = null;
    for (const tag of event.tags) {
      if (tag[0]) {
        tagInserts.push({
          name: tag[0],
          value: tag[1] || ""
        });
        if (tag[0] === "p" && !tagP)
          tagP = tag[1];
        if (tag[0] === "e" && !tagE)
          tagE = tag[1];
        if (tag[0] === "a" && !tagA)
          tagA = tag[1];
        if (tag[0] === "t" && !tagT)
          tagT = tag[1];
        if (tag[0] === "d" && !tagD)
          tagD = tag[1];
        if (tag[0] === "r" && !tagR)
          tagR = tag[1];
        if (tag[0] === "L" && !tagL)
          tagL = tag[1];
        if (tag[0] === "s" && !tagS)
          tagS = tag[1];
        if (tag[0] === "u" && !tagU)
          tagU = tag[1];
      }
    }
    const eTags = tagInserts.filter((t) => t.name === "e").map((t) => t.value);
    const replyToEventId = eTags.length > 0 ? eTags[0] : null;
    const rootEventId = eTags.length > 1 ? eTags[eTags.length - 1] : null;
    const contentPreview = event.content.substring(0, 100);
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
    if (insertResult.meta.changes === 0) {
      console.log(`Event ${event.id} already exists in database (race condition duplicate)`);
      return { success: false, message: "duplicate: event already exists", bookmark: session.getBookmark() ?? void 0 };
    }
    if (tagInserts.length > 0) {
      for (let j = 0; j < tagInserts.length; j += 50) {
        const tagChunk = tagInserts.slice(j, j + 50);
        const tagBatch = tagChunk.map(
          (t) => session.prepare(`
            INSERT INTO tags (event_id, tag_name, tag_value)
            VALUES (?, ?, ?)
          `).bind(event.id, t.name, t.value)
        );
        if (tagBatch.length > 0) {
          await session.batch(tagBatch);
        }
      }
    }
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
    const cacheableTags = tagInserts.filter((t) => ["p", "e", "a", "t", "d", "r", "L", "s", "u"].includes(t.name));
    if (cacheableTags.length > 0) {
      for (let j = 0; j < cacheableTags.length; j += 50) {
        const cacheChunk = cacheableTags.slice(j, j + 50);
        const cacheBatch = cacheChunk.map(
          (t) => session.prepare(`
            INSERT OR IGNORE INTO event_tags_cache_multi (event_id, pubkey, kind, created_at, tag_type, tag_value)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(event.id, event.pubkey, event.kind, event.created_at, t.name, t.value)
        );
        await session.batch(cacheBatch);
      }
    }
    if (contentHash) {
      await session.prepare(`
        INSERT INTO content_hashes (hash, event_id, pubkey, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(hash) DO NOTHING
      `).bind(contentHash, event.id, event.pubkey, event.created_at).run();
    }
    await cache.put(cacheKey, new Response("cached", {
      headers: {
        "Cache-Control": "max-age=3600"
      }
    }));
    console.log(`Event ${event.id} saved directly to database`);
    return { success: true, message: "Event saved successfully", bookmark: session.getBookmark() ?? void 0 };
  } catch (error) {
    console.error(`Error saving event to database: ${error.message}`);
    console.error(`Event details: ID=${event.id}, Kind=${event.kind}, Tags count=${event.tags.length}`);
    return { success: false, message: `error: ${error.message}` };
  }
}
__name(saveEventToDatabase, "saveEventToDatabase");
async function processDeletionEvent(event, env) {
  console.log(`Processing deletion event ${event.id}`);
  const deletedEventIds = event.tags.filter((tag) => tag[0] === "e").map((tag) => tag[1]);
  const session = env.RELAY_DATABASE.withSession("first-primary");
  if (deletedEventIds.length === 0) {
    return { success: true, message: "No events to delete", bookmark: session.getBookmark() ?? void 0 };
  }
  let deletedCount = 0;
  const errors = [];
  for (const eventId of deletedEventIds) {
    try {
      const existing = await session.prepare(
        "SELECT pubkey FROM events WHERE id = ? LIMIT 1"
      ).bind(eventId).first();
      if (!existing) {
        console.warn(`Event ${eventId} not found in D1. Nothing to delete (may be in queue).`);
        continue;
      }
      if (existing.pubkey !== event.pubkey) {
        console.warn(`Event ${eventId} does not belong to pubkey ${event.pubkey}. Skipping deletion.`);
        errors.push(`unauthorized: cannot delete event ${eventId} - wrong pubkey`);
        continue;
      }
      await session.prepare(
        "DELETE FROM tags WHERE event_id = ?"
      ).bind(eventId).run();
      await session.prepare(
        "DELETE FROM content_hashes WHERE event_id = ?"
      ).bind(eventId).run();
      await session.prepare(
        "DELETE FROM event_tags_cache WHERE event_id = ?"
      ).bind(eventId).run();
      await session.prepare(
        "DELETE FROM event_tags_cache_multi WHERE event_id = ?"
      ).bind(eventId).run();
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
  const saveResult = await saveEventToDatabase(event, env);
  if (errors.length > 0) {
    return { success: false, message: errors[0], bookmark: saveResult.bookmark ?? (session.getBookmark() ?? void 0) };
  }
  return {
    success: true,
    message: deletedCount > 0 ? `Successfully deleted ${deletedCount} event(s)` : "No matching events found to delete",
    bookmark: saveResult.bookmark ?? (session.getBookmark() ?? void 0)
  };
}
__name(processDeletionEvent, "processDeletionEvent");
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
__name(chunkArray, "chunkArray");
function buildCountQuery(filter) {
  const params = [];
  const conditions = [];
  const directTags = [];
  const otherTags = [];
  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith("#") && Array.isArray(values) && values.length > 0) {
      const tagName = key.substring(1);
      if (["p", "e", "a", "t", "d", "r", "L", "s", "u"].includes(tagName)) {
        directTags.push({ name: tagName, values });
      } else {
        otherTags.push({ name: tagName, values });
      }
    }
  }
  if (directTags.length > 0 && otherTags.length === 0) {
    if (directTags.length === 1) {
      const tagFilter = directTags[0];
      let sql2 = `SELECT COUNT(DISTINCT e.id) as count FROM events e
        INNER JOIN event_tags_cache_multi m ON e.id = m.event_id
        WHERE m.tag_type = ? AND m.tag_value IN (${tagFilter.values.map(() => "?").join(",")})`;
      params.push(tagFilter.name, ...tagFilter.values);
      if (filter.authors && filter.authors.length > 0) {
        sql2 += ` AND e.pubkey IN (${filter.authors.map(() => "?").join(",")})`;
        params.push(...filter.authors);
      }
      if (filter.kinds && filter.kinds.length > 0) {
        sql2 += ` AND e.kind IN (${filter.kinds.map(() => "?").join(",")})`;
        params.push(...filter.kinds);
      }
      if (filter.since) {
        sql2 += " AND e.created_at >= ?";
        params.push(filter.since);
      }
      if (filter.until) {
        sql2 += " AND e.created_at <= ?";
        params.push(filter.until);
      }
      return { sql: sql2, params };
    } else {
      const tagJoins = directTags.map((t, i) => {
        const alias = `m${i}`;
        const placeholders = t.values.map(() => "?").join(",");
        return `INNER JOIN event_tags_cache_multi ${alias} ON e.id = ${alias}.event_id AND ${alias}.tag_type = ? AND ${alias}.tag_value IN (${placeholders})`;
      }).join("\n        ");
      let sql2 = `SELECT COUNT(DISTINCT e.id) as count FROM events e
        ${tagJoins}
        WHERE 1=1`;
      for (const tagFilter of directTags) {
        params.push(tagFilter.name, ...tagFilter.values);
      }
      if (filter.authors && filter.authors.length > 0) {
        sql2 += ` AND e.pubkey IN (${filter.authors.map(() => "?").join(",")})`;
        params.push(...filter.authors);
      }
      if (filter.kinds && filter.kinds.length > 0) {
        sql2 += ` AND e.kind IN (${filter.kinds.map(() => "?").join(",")})`;
        params.push(...filter.kinds);
      }
      if (filter.since) {
        sql2 += " AND e.created_at >= ?";
        params.push(filter.since);
      }
      if (filter.until) {
        sql2 += " AND e.created_at <= ?";
        params.push(filter.until);
      }
      return { sql: sql2, params };
    }
  }
  if (directTags.length > 0 || otherTags.length > 0) {
    const allTags = [...directTags, ...otherTags];
    if (allTags.length === 1) {
      const tagFilter = allTags[0];
      let sql2 = `SELECT COUNT(DISTINCT e.id) as count FROM events e
        INNER JOIN tags t ON e.id = t.event_id
        WHERE t.tag_name = ? AND t.tag_value IN (${tagFilter.values.map(() => "?").join(",")})`;
      params.push(tagFilter.name, ...tagFilter.values);
      if (filter.authors && filter.authors.length > 0) {
        sql2 += ` AND e.pubkey IN (${filter.authors.map(() => "?").join(",")})`;
        params.push(...filter.authors);
      }
      if (filter.kinds && filter.kinds.length > 0) {
        sql2 += ` AND e.kind IN (${filter.kinds.map(() => "?").join(",")})`;
        params.push(...filter.kinds);
      }
      if (filter.since) {
        sql2 += " AND e.created_at >= ?";
        params.push(filter.since);
      }
      if (filter.until) {
        sql2 += " AND e.created_at <= ?";
        params.push(filter.until);
      }
      return { sql: sql2, params };
    } else {
      const tagConditions = allTags.map((t) => {
        const placeholders = t.values.map(() => "?").join(",");
        return `(t.tag_name = ? AND t.tag_value IN (${placeholders}))`;
      }).join(" OR ");
      for (const tagFilter of allTags) {
        params.push(tagFilter.name, ...tagFilter.values);
      }
      let sql2 = `SELECT COUNT(DISTINCT e.id) as count FROM events e
        INNER JOIN tags t ON e.id = t.event_id
        WHERE ${tagConditions}`;
      if (filter.authors && filter.authors.length > 0) {
        sql2 += ` AND e.pubkey IN (${filter.authors.map(() => "?").join(",")})`;
        params.push(...filter.authors);
      }
      if (filter.kinds && filter.kinds.length > 0) {
        sql2 += ` AND e.kind IN (${filter.kinds.map(() => "?").join(",")})`;
        params.push(...filter.kinds);
      }
      if (filter.since) {
        sql2 += " AND e.created_at >= ?";
        params.push(filter.since);
      }
      if (filter.until) {
        sql2 += " AND e.created_at <= ?";
        params.push(filter.until);
      }
      sql2 += ` GROUP BY e.id HAVING COUNT(DISTINCT t.tag_name) = ?`;
      params.push(allTags.length);
      sql2 = `SELECT COUNT(*) as count FROM (${sql2})`;
      return { sql: sql2, params };
    }
  }
  let sql = "SELECT COUNT(*) as count FROM events";
  if (filter.ids && filter.ids.length > 0) {
    conditions.push(`id IN (${filter.ids.map(() => "?").join(",")})`);
    params.push(...filter.ids);
  }
  if (filter.authors && filter.authors.length > 0) {
    conditions.push(`pubkey IN (${filter.authors.map(() => "?").join(",")})`);
    params.push(...filter.authors);
  }
  if (filter.kinds && filter.kinds.length > 0) {
    conditions.push(`kind IN (${filter.kinds.map(() => "?").join(",")})`);
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
__name(buildCountQuery, "buildCountQuery");
function buildQuery(filter) {
  const params = [];
  const conditions = [];
  let tagCount = 0;
  const directTags = [];
  const otherTags = [];
  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith("#") && Array.isArray(values) && values.length > 0) {
      tagCount += values.length;
      const tagName = key.substring(1);
      if (["p", "e", "a", "t", "d", "r", "L", "s", "u"].includes(tagName)) {
        directTags.push({ name: tagName, values });
      } else {
        otherTags.push({ name: tagName, values });
      }
    }
  }
  if (directTags.length > 0 && otherTags.length === 0) {
    let sql2;
    const whereConditions = [];
    if (directTags.length === 1) {
      const tagFilter = directTags[0];
      const hasKinds2 = filter.kinds && filter.kinds.length > 0;
      let indexHint2 = "";
      if (hasKinds2 && filter.kinds.length <= 10) {
        indexHint2 = " INDEXED BY idx_cache_multi_kind_type_value";
      } else {
        indexHint2 = " INDEXED BY idx_cache_multi_type_value_time";
      }
      sql2 = `SELECT DISTINCT e.* FROM events e
        INNER JOIN event_tags_cache_multi m${indexHint2} ON e.id = m.event_id
        WHERE m.tag_type = ? AND m.tag_value IN (${tagFilter.values.map(() => "?").join(",")})`;
      params.push(tagFilter.name, ...tagFilter.values);
    } else {
      const tagConditions = directTags.map((t, i) => {
        const alias = `m${i}`;
        const placeholders = t.values.map(() => "?").join(",");
        return `INNER JOIN event_tags_cache_multi ${alias} ON e.id = ${alias}.event_id AND ${alias}.tag_type = ? AND ${alias}.tag_value IN (${placeholders})`;
      }).join("\n        ");
      sql2 = `SELECT DISTINCT e.* FROM events e
        ${tagConditions}
        WHERE 1=1`;
      for (const tagFilter of directTags) {
        params.push(tagFilter.name, ...tagFilter.values);
      }
    }
    if (filter.ids && filter.ids.length > 0) {
      whereConditions.push(`e.id IN (${filter.ids.map(() => "?").join(",")})`);
      params.push(...filter.ids);
    }
    if (filter.authors && filter.authors.length > 0) {
      whereConditions.push(`e.pubkey IN (${filter.authors.map(() => "?").join(",")})`);
      params.push(...filter.authors);
    }
    if (filter.kinds && filter.kinds.length > 0) {
      whereConditions.push(`e.kind IN (${filter.kinds.map(() => "?").join(",")})`);
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
      const [timestamp, lastId] = filter.cursor.split(":");
      whereConditions.push("(e.created_at < ? OR (e.created_at = ? AND e.id > ?))");
      params.push(parseInt(timestamp), parseInt(timestamp), lastId);
    }
    if (whereConditions.length > 0) {
      sql2 += " AND " + whereConditions.join(" AND ");
    }
    sql2 += " ORDER BY e.created_at DESC LIMIT ?";
    params.push(Math.min(filter.limit || 500, 500));
    return { sql: sql2, params };
  }
  if (tagCount > 0) {
    const allTags = [...directTags, ...otherTags];
    if (allTags.length === 1) {
      const tagFilter = allTags[0];
      let sql3 = `SELECT e.* FROM events e
        INNER JOIN tags t ON e.id = t.event_id
        WHERE t.tag_name = ? AND t.tag_value IN (${tagFilter.values.map(() => "?").join(",")})`;
      params.push(tagFilter.name, ...tagFilter.values);
      const whereConditions2 = [];
      if (filter.ids && filter.ids.length > 0) {
        whereConditions2.push(`e.id IN (${filter.ids.map(() => "?").join(",")})`);
        params.push(...filter.ids);
      }
      if (filter.authors && filter.authors.length > 0) {
        whereConditions2.push(`e.pubkey IN (${filter.authors.map(() => "?").join(",")})`);
        params.push(...filter.authors);
      }
      if (filter.kinds && filter.kinds.length > 0) {
        whereConditions2.push(`e.kind IN (${filter.kinds.map(() => "?").join(",")})`);
        params.push(...filter.kinds);
      }
      if (filter.since) {
        whereConditions2.push("e.created_at >= ?");
        params.push(filter.since);
      }
      if (filter.until) {
        whereConditions2.push("e.created_at <= ?");
        params.push(filter.until);
      }
      if (filter.cursor) {
        const [timestamp, lastId] = filter.cursor.split(":");
        whereConditions2.push("(e.created_at < ? OR (e.created_at = ? AND e.id > ?))");
        params.push(parseInt(timestamp), parseInt(timestamp), lastId);
      }
      if (whereConditions2.length > 0) {
        sql3 += " AND " + whereConditions2.join(" AND ");
      }
      sql3 += " ORDER BY e.created_at DESC";
      sql3 += " LIMIT ?";
      params.push(Math.min(filter.limit || 500, 500));
      return { sql: sql3, params };
    }
    const tagConditions = allTags.map((t) => {
      const placeholders = t.values.map(() => "?").join(",");
      return `(t.tag_name = ? AND t.tag_value IN (${placeholders}))`;
    }).join(" OR ");
    for (const tagFilter of allTags) {
      params.push(tagFilter.name, ...tagFilter.values);
    }
    let sql2 = `SELECT e.* FROM events e
      INNER JOIN tags t ON e.id = t.event_id
      WHERE ${tagConditions}`;
    const whereConditions = [];
    if (filter.ids && filter.ids.length > 0) {
      whereConditions.push(`e.id IN (${filter.ids.map(() => "?").join(",")})`);
      params.push(...filter.ids);
    }
    if (filter.authors && filter.authors.length > 0) {
      whereConditions.push(`e.pubkey IN (${filter.authors.map(() => "?").join(",")})`);
      params.push(...filter.authors);
    }
    if (filter.kinds && filter.kinds.length > 0) {
      whereConditions.push(`e.kind IN (${filter.kinds.map(() => "?").join(",")})`);
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
      const [timestamp, lastId] = filter.cursor.split(":");
      whereConditions.push("(e.created_at < ? OR (e.created_at = ? AND e.id > ?))");
      params.push(parseInt(timestamp), parseInt(timestamp), lastId);
    }
    if (whereConditions.length > 0) {
      sql2 += " AND " + whereConditions.join(" AND ");
    }
    sql2 += " GROUP BY e.id, e.pubkey, e.created_at, e.kind, e.tags, e.content, e.sig";
    sql2 += ` HAVING COUNT(DISTINCT t.tag_name) = ?`;
    params.push(allTags.length);
    sql2 += " ORDER BY e.created_at DESC";
    sql2 += " LIMIT ?";
    params.push(Math.min(filter.limit || 500, 500));
    return { sql: sql2, params };
  }
  let indexHint = "";
  const hasAuthors = filter.authors && filter.authors.length > 0;
  const hasKinds = filter.kinds && filter.kinds.length > 0;
  const hasTimeRange = filter.since || filter.until;
  const authorCount = filter.authors?.length || 0;
  const kindCount = filter.kinds?.length || 0;
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
    conditions.push(`id IN (${filter.ids.map(() => "?").join(",")})`);
    params.push(...filter.ids);
  }
  if (filter.authors && filter.authors.length > 0) {
    conditions.push(`pubkey IN (${filter.authors.map(() => "?").join(",")})`);
    params.push(...filter.authors);
  }
  if (filter.kinds && filter.kinds.length > 0) {
    conditions.push(`kind IN (${filter.kinds.map(() => "?").join(",")})`);
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
  if (filter.cursor) {
    const [timestamp, lastId] = filter.cursor.split(":");
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
__name(buildQuery, "buildQuery");
async function queryDatabaseChunked(filter, bookmark, env) {
  const session = env.RELAY_DATABASE.withSession(bookmark);
  const allRows = /* @__PURE__ */ new Map();
  const baseFilter = { ...filter };
  const needsChunking = {
    ids: false,
    authors: false,
    kinds: false,
    tags: {}
  };
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
  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith("#") && Array.isArray(values) && values.length > CHUNK_SIZE) {
      needsChunking.tags[key] = true;
      delete baseFilter[key];
    }
  }
  const processStringChunks = /* @__PURE__ */ __name(async (filterType, values) => {
    const chunks = chunkArray(values, CHUNK_SIZE);
    for (const chunk of chunks) {
      const chunkFilter = { ...baseFilter };
      if (filterType === "ids") {
        chunkFilter.ids = chunk;
      } else if (filterType === "authors") {
        chunkFilter.authors = chunk;
      } else if (filterType.startsWith("#")) {
        chunkFilter[filterType] = chunk;
      }
      const query = buildQuery(chunkFilter);
      try {
        const result = await session.prepare(query.sql).bind(...query.params).all();
        for (const row of result.results) {
          allRows.set(row.id, row);
        }
      } catch (error) {
        console.error(`Error in chunk query: ${error}`);
      }
    }
  }, "processStringChunks");
  const processNumberChunks = /* @__PURE__ */ __name(async (filterType, values) => {
    const chunks = chunkArray(values, CHUNK_SIZE);
    for (const chunk of chunks) {
      const chunkFilter = { ...baseFilter };
      chunkFilter.kinds = chunk;
      const query = buildQuery(chunkFilter);
      try {
        const result = await session.prepare(query.sql).bind(...query.params).all();
        for (const row of result.results) {
          allRows.set(row.id, row);
        }
      } catch (error) {
        console.error(`Error in chunk query: ${error}`);
      }
    }
  }, "processNumberChunks");
  if (needsChunking.ids && filter.ids) {
    await processStringChunks("ids", filter.ids);
  }
  if (needsChunking.authors && filter.authors) {
    await processStringChunks("authors", filter.authors);
  }
  if (needsChunking.kinds && filter.kinds) {
    await processNumberChunks("kinds", filter.kinds);
  }
  for (const [tagKey, _] of Object.entries(needsChunking.tags)) {
    const tagValues = filter[tagKey];
    if (Array.isArray(tagValues) && tagValues.every((v) => typeof v === "string")) {
      await processStringChunks(tagKey, tagValues);
    }
  }
  if (!needsChunking.ids && !needsChunking.authors && !needsChunking.kinds && Object.keys(needsChunking.tags).length === 0) {
    const query = buildQuery(filter);
    try {
      const result = await session.prepare(query.sql).bind(...query.params).all();
      for (const row of result.results) {
        allRows.set(row.id, row);
      }
    } catch (error) {
      console.error(`Error in query: ${error}`);
    }
  }
  const events = Array.from(allRows.values()).map((row) => ({
    id: row.id,
    pubkey: row.pubkey,
    created_at: row.created_at,
    kind: row.kind,
    tags: JSON.parse(row.tags),
    content: row.content,
    sig: row.sig
  }));
  console.log(`Found ${events.length} events (chunked)`);
  return { events };
}
__name(queryDatabaseChunked, "queryDatabaseChunked");
async function queryEvents(filters, bookmark, env) {
  try {
    console.log(`Processing query with ${filters.length} filters and bookmark: ${bookmark}`);
    const session = env.RELAY_DATABASE.withSession(bookmark);
    const eventSet = /* @__PURE__ */ new Map();
    const chunkedFilters = [];
    const batchableFilters = [];
    for (const filter of filters) {
      const complexity = calculateQueryComplexity(filter);
      if (complexity > MAX_QUERY_COMPLEXITY) {
        console.warn(`Query too complex (complexity: ${complexity}), skipping filter`);
        continue;
      }
      const needsChunking = filter.ids && filter.ids.length > CHUNK_SIZE || filter.authors && filter.authors.length > CHUNK_SIZE || filter.kinds && filter.kinds.length > CHUNK_SIZE || Object.entries(filter).some(
        ([key, values]) => key.startsWith("#") && Array.isArray(values) && values.length > CHUNK_SIZE
      );
      if (needsChunking) {
        chunkedFilters.push(filter);
      } else {
        batchableFilters.push(filter);
      }
    }
    let totalEventsRead = 0;
    for (const filter of chunkedFilters) {
      if (totalEventsRead >= GLOBAL_MAX_EVENTS) {
        console.warn(`Global event limit reached (${GLOBAL_MAX_EVENTS}), stopping query`);
        break;
      }
      console.log(`Filter has arrays >${CHUNK_SIZE} items, using chunked query...`);
      const chunkedResult = await queryDatabaseChunked(filter, bookmark, env);
      for (const event of chunkedResult.events) {
        if (totalEventsRead >= GLOBAL_MAX_EVENTS)
          break;
        eventSet.set(event.id, event);
        totalEventsRead++;
      }
    }
    if (batchableFilters.length > 0 && totalEventsRead < GLOBAL_MAX_EVENTS) {
      const validFilters = [];
      for (const filter of batchableFilters) {
        const hasTagFilters = Object.keys(filter).some((key) => key.startsWith("#"));
        if (hasTagFilters) {
          const countQuery = buildCountQuery(filter);
          const countResult = await session.prepare(countQuery.sql).bind(...countQuery.params).first();
          const estimatedRows = countResult?.count || 0;
          if (estimatedRows > 1e4) {
            console.warn(`Query precheck: estimated ${estimatedRows} rows, skipping filter to prevent timeout`);
            continue;
          } else {
            console.log(`Query precheck: estimated ${estimatedRows} rows, proceeding`);
          }
        }
        validFilters.push(filter);
      }
      if (validFilters.length === 0) {
        console.warn("All filters were too expensive after COUNT precheck");
      } else {
        const queries = validFilters.map((filter) => {
          const query = buildQuery(filter);
          return session.prepare(query.sql).bind(...query.params);
        });
        try {
          const results = await session.batch(queries);
          const allRows = [];
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (i === 0 && result.meta) {
              console.log({
                servedByRegion: result.meta.served_by_region ?? "",
                servedByPrimary: result.meta.served_by_primary ?? false,
                batchSize: results.length
              });
            }
            if (result.success && result.results) {
              for (const row of result.results) {
                if (totalEventsRead >= GLOBAL_MAX_EVENTS)
                  break;
                allRows.push(row);
                totalEventsRead++;
              }
            } else if (!result.success) {
              console.error(`Batch query ${i} failed:`, result.error);
            }
          }
          for (const row of allRows) {
            const event = {
              id: row.id,
              pubkey: row.pubkey,
              created_at: row.created_at,
              kind: row.kind,
              tags: JSON.parse(row.tags),
              content: row.content,
              sig: row.sig
            };
            eventSet.set(event.id, event);
          }
        } catch (error) {
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
  } catch (error) {
    console.error(`Error querying events: ${error.message}`);
    return { events: [], bookmark: null };
  }
}
__name(queryEvents, "queryEvents");
function handleRelayInfoRequest(request) {
  const responseInfo = { ...relayInfo2 };
  if (PAY_TO_RELAY_ENABLED2) {
    const url = new URL(request.url);
    responseInfo.payments_url = `${url.protocol}//${url.host}`;
    responseInfo.fees = {
      admission: [{ amount: RELAY_ACCESS_PRICE_SATS2 * 1e3, unit: "msats" }]
    };
  }
  return new Response(JSON.stringify(responseInfo), {
    status: 200,
    headers: {
      "Content-Type": "application/nostr+json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Allow-Methods": "GET"
    }
  });
}
__name(handleRelayInfoRequest, "handleRelayInfoRequest");
function serveLandingPage() {
  const payToRelaySection = PAY_TO_RELAY_ENABLED2 ? `
    <div class="pay-section" id="paySection">
      <p style="margin-bottom: 1rem;">Pay to access this relay:</p>
      <button id="payButton" class="pay-button" data-npub="${relayNpub2}" data-relays="wss://relay.damus.io,wss://relay.primal.net,wss://sendit.nosflare.com" data-sats-amount="${RELAY_ACCESS_PRICE_SATS2}">
        <img src="https://nosflare.com/images/pwb-button-min.png" alt="Pay with Bitcoin" style="height: 60px;">
      </button>
      <p class="price-info">${RELAY_ACCESS_PRICE_SATS2.toLocaleString()} sats</p>
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
                <div class="stat-value">${relayInfo2.supported_nips.length}</div>
                <div class="stat-label">Supported NIPs</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${relayInfo2.version}</div>
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
        
        ${PAY_TO_RELAY_ENABLED2 ? `
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
        ` : ""}
    </script>
    ${PAY_TO_RELAY_ENABLED2 ? '<script src="https://unpkg.com/nostr-login@latest/dist/unpkg.js" data-perms="sign_event:1" data-methods="connect,extension,local" data-dark-mode="true"></script>' : ""}
</body>
</html>
  `;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
__name(serveLandingPage, "serveLandingPage");
async function serveFavicon() {
  const response = await fetch(relayInfo2.icon);
  if (response.ok) {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "max-age=3600");
    return new Response(response.body, {
      status: response.status,
      headers
    });
  }
  return new Response(null, { status: 404 });
}
__name(serveFavicon, "serveFavicon");
function handleNIP05Request(url) {
  const name = url.searchParams.get("name");
  if (!name) {
    return new Response(JSON.stringify({ error: "Missing 'name' parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const pubkey = nip05Users2[name.toLowerCase()];
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
__name(handleNIP05Request, "handleNIP05Request");
async function handleCheckPayment(request, env) {
  const url = new URL(request.url);
  const pubkey = url.searchParams.get("pubkey");
  if (!pubkey) {
    return new Response(JSON.stringify({ error: "Missing pubkey" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const paid = await hasPaidForRelay(pubkey, env);
  return new Response(JSON.stringify({ paid }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(handleCheckPayment, "handleCheckPayment");
async function handlePaymentNotification(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const url = new URL(request.url);
    const pubkey = url.searchParams.get("npub");
    if (!pubkey) {
      return new Response(JSON.stringify({ error: "Missing pubkey" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const success = await savePaidPubkey(pubkey, env);
    return new Response(JSON.stringify({
      success,
      message: success ? "Payment recorded successfully" : "Failed to save payment"
    }), {
      status: success ? 200 : 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Error processing payment notification:", error);
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handlePaymentNotification, "handlePaymentNotification");
async function getOptimalDO(cf, env, url) {
  const continent = cf?.continent || "NA";
  const country = cf?.country || "US";
  const region = cf?.region || "unknown";
  const colo = cf?.colo || "unknown";
  console.log(`User location: continent=${continent}, country=${country}, region=${region}, colo=${colo}`);
  const ALL_ENDPOINTS = [
    { name: "relay-WNAM-primary", hint: "wnam" },
    { name: "relay-ENAM-primary", hint: "enam" },
    { name: "relay-WEUR-primary", hint: "weur" },
    { name: "relay-EEUR-primary", hint: "eeur" },
    { name: "relay-APAC-primary", hint: "apac" },
    { name: "relay-OC-primary", hint: "oc" },
    { name: "relay-SAM-primary", hint: "sam" },
    { name: "relay-AFR-primary", hint: "afr" },
    { name: "relay-ME-primary", hint: "me" }
  ];
  const countryToHint = {
    // North America
    "US": "enam",
    "CA": "enam",
    "MX": "wnam",
    // Central America & Caribbean (route to WNAM)
    "GT": "wnam",
    "BZ": "wnam",
    "SV": "wnam",
    "HN": "wnam",
    "NI": "wnam",
    "CR": "wnam",
    "PA": "wnam",
    "CU": "wnam",
    "DO": "wnam",
    "HT": "wnam",
    "JM": "wnam",
    "PR": "wnam",
    "TT": "wnam",
    "BB": "wnam",
    // South America
    "BR": "sam",
    "AR": "sam",
    "CL": "sam",
    "CO": "sam",
    "PE": "sam",
    "VE": "sam",
    "EC": "sam",
    "BO": "sam",
    "PY": "sam",
    "UY": "sam",
    "GY": "sam",
    "SR": "sam",
    "GF": "sam",
    // Western Europe
    "GB": "weur",
    "FR": "weur",
    "DE": "weur",
    "ES": "weur",
    "IT": "weur",
    "NL": "weur",
    "BE": "weur",
    "CH": "weur",
    "AT": "weur",
    "PT": "weur",
    "IE": "weur",
    "LU": "weur",
    "MC": "weur",
    "AD": "weur",
    "SM": "weur",
    "VA": "weur",
    "LI": "weur",
    "MT": "weur",
    // Nordic countries (route to WEUR)
    "SE": "weur",
    "NO": "weur",
    "DK": "weur",
    "FI": "weur",
    "IS": "weur",
    // Eastern Europe
    "PL": "eeur",
    "RU": "eeur",
    "UA": "eeur",
    "RO": "eeur",
    "CZ": "eeur",
    "HU": "eeur",
    "GR": "eeur",
    "BG": "eeur",
    "SK": "eeur",
    "HR": "eeur",
    "RS": "eeur",
    "SI": "eeur",
    "BA": "eeur",
    "AL": "eeur",
    "MK": "eeur",
    "ME": "eeur",
    "XK": "eeur",
    "BY": "eeur",
    "MD": "eeur",
    "LT": "eeur",
    "LV": "eeur",
    "EE": "eeur",
    "CY": "eeur",
    // Asia-Pacific
    "JP": "apac",
    "CN": "apac",
    "KR": "apac",
    "IN": "apac",
    "SG": "apac",
    "TH": "apac",
    "ID": "apac",
    "MY": "apac",
    "VN": "apac",
    "PH": "apac",
    "TW": "apac",
    "HK": "apac",
    "MO": "apac",
    "KH": "apac",
    "LA": "apac",
    "MM": "apac",
    "BD": "apac",
    "LK": "apac",
    "NP": "apac",
    "BT": "apac",
    "MV": "apac",
    "PK": "apac",
    "AF": "apac",
    "MN": "apac",
    "KP": "apac",
    "BN": "apac",
    "TL": "apac",
    "PG": "apac",
    "FJ": "apac",
    "SB": "apac",
    "VU": "apac",
    "NC": "apac",
    "PF": "apac",
    "WS": "apac",
    "TO": "apac",
    "KI": "apac",
    "PW": "apac",
    "MH": "apac",
    "FM": "apac",
    "NR": "apac",
    "TV": "apac",
    "CK": "apac",
    "NU": "apac",
    "TK": "apac",
    "GU": "apac",
    "MP": "apac",
    "AS": "apac",
    // Oceania
    "AU": "oc",
    "NZ": "oc",
    // Middle East
    "AE": "me",
    "SA": "me",
    "IL": "me",
    "TR": "me",
    "EG": "me",
    "IQ": "me",
    "IR": "me",
    "SY": "me",
    "JO": "me",
    "LB": "me",
    "KW": "me",
    "QA": "me",
    "BH": "me",
    "OM": "me",
    "YE": "me",
    "PS": "me",
    "GE": "me",
    "AM": "me",
    "AZ": "me",
    // Africa
    "ZA": "afr",
    "NG": "afr",
    "KE": "afr",
    "MA": "afr",
    "TN": "afr",
    "DZ": "afr",
    "LY": "afr",
    "ET": "afr",
    "GH": "afr",
    "TZ": "afr",
    "UG": "afr",
    "SD": "afr",
    "AO": "afr",
    "MZ": "afr",
    "MG": "afr",
    "CM": "afr",
    "CI": "afr",
    "NE": "afr",
    "BF": "afr",
    "ML": "afr",
    "MW": "afr",
    "ZM": "afr",
    "SN": "afr",
    "SO": "afr",
    "TD": "afr",
    "ZW": "afr",
    "GN": "afr",
    "RW": "afr",
    "BJ": "afr",
    "BI": "afr",
    "TG": "afr",
    "SL": "afr",
    "LR": "afr",
    "MR": "afr",
    "CF": "afr",
    "ER": "afr",
    "GM": "afr",
    "BW": "afr",
    "NA": "afr",
    "GA": "afr",
    "LS": "afr",
    "GW": "afr",
    "GQ": "afr",
    "MU": "afr",
    "SZ": "afr",
    "DJ": "afr",
    "KM": "afr",
    "CV": "afr",
    "SC": "afr",
    "ST": "afr",
    "SS": "afr",
    "EH": "afr",
    "CG": "afr",
    "CD": "afr",
    // Central Asia (route to APAC)
    "KZ": "apac",
    "UZ": "apac",
    "TM": "apac",
    "TJ": "apac",
    "KG": "apac"
  };
  const usStateToHint = {
    // Western states -> WNAM
    "California": "wnam",
    "Oregon": "wnam",
    "Washington": "wnam",
    "Nevada": "wnam",
    "Arizona": "wnam",
    "Utah": "wnam",
    "Idaho": "wnam",
    "Montana": "wnam",
    "Wyoming": "wnam",
    "Colorado": "wnam",
    "New Mexico": "wnam",
    "Alaska": "wnam",
    "Hawaii": "wnam",
    // Eastern states -> ENAM
    "New York": "enam",
    "Florida": "enam",
    "Texas": "enam",
    "Illinois": "enam",
    "Georgia": "enam",
    "Pennsylvania": "enam",
    "Ohio": "enam",
    "Michigan": "enam",
    "North Carolina": "enam",
    "Virginia": "enam",
    "Massachusetts": "enam",
    "New Jersey": "enam",
    "Maryland": "enam",
    "Connecticut": "enam",
    "Maine": "enam",
    "New Hampshire": "enam",
    "Vermont": "enam",
    "Rhode Island": "enam",
    "South Carolina": "enam",
    "Tennessee": "enam",
    "Alabama": "enam",
    "Mississippi": "enam",
    "Louisiana": "enam",
    "Arkansas": "enam",
    "Missouri": "enam",
    "Iowa": "enam",
    "Minnesota": "enam",
    "Wisconsin": "enam",
    "Indiana": "enam",
    "Kentucky": "enam",
    "West Virginia": "enam",
    "Delaware": "enam",
    "Oklahoma": "enam",
    "Kansas": "enam",
    "Nebraska": "enam",
    "South Dakota": "enam",
    "North Dakota": "enam",
    // DC
    "District of Columbia": "enam"
  };
  const continentToHint = {
    "NA": "enam",
    "SA": "sam",
    "EU": "weur",
    "AS": "apac",
    "AF": "afr",
    "OC": "oc"
  };
  let bestHint;
  if (country === "US" && region && region !== "unknown") {
    bestHint = usStateToHint[region] || "enam";
  } else {
    bestHint = countryToHint[country] || continentToHint[continent] || "enam";
  }
  const primaryEndpoint = ALL_ENDPOINTS.find((ep) => ep.hint === bestHint) || ALL_ENDPOINTS[1];
  const orderedEndpoints = [
    primaryEndpoint,
    ...ALL_ENDPOINTS.filter((ep) => ep.name !== primaryEndpoint.name)
  ];
  for (const endpoint of orderedEndpoints) {
    try {
      const id2 = env.RELAY_WEBSOCKET.idFromName(endpoint.name);
      const stub2 = env.RELAY_WEBSOCKET.get(id2, { locationHint: endpoint.hint });
      console.log(`Connected to DO: ${endpoint.name} (hint: ${endpoint.hint})`);
      return { stub: stub2, doName: endpoint.name };
    } catch (error) {
      console.log(`Failed to connect to ${endpoint.name}: ${error}`);
    }
  }
  const fallback = ALL_ENDPOINTS[1];
  const id = env.RELAY_WEBSOCKET.idFromName(fallback.name);
  const stub = env.RELAY_WEBSOCKET.get(id, { locationHint: fallback.hint });
  console.log(`Fallback to DO: ${fallback.name} (hint: ${fallback.hint})`);
  return { stub, doName: fallback.name };
}
__name(getOptimalDO, "getOptimalDO");
async function getDatabaseSizeBytes(session) {
  try {
    const pageCountResult = await session.prepare("PRAGMA page_count").first();
    const pageSizeResult = await session.prepare("PRAGMA page_size").first();
    if (pageCountResult && pageSizeResult) {
      return pageCountResult.page_count * pageSizeResult.page_size;
    }
    return 0;
  } catch (error) {
    console.error("Error getting database size:", error);
    return 0;
  }
}
__name(getDatabaseSizeBytes, "getDatabaseSizeBytes");
async function pruneOldEvents(session, targetSizeBytes) {
  let totalEventsDeleted = 0;
  let currentSize = await getDatabaseSizeBytes(session);
  console.log(`Starting database pruning. Current size: ${(currentSize / (1024 * 1024 * 1024)).toFixed(2)} GB, Target: ${(targetSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`);
  const protectedKindsArray = Array.from(pruneProtectedKinds2);
  const protectedKindsClause = protectedKindsArray.length > 0 ? `AND kind NOT IN (${protectedKindsArray.join(",")})` : "";
  while (currentSize > targetSizeBytes) {
    const oldestEvents = await session.prepare(`
      SELECT id FROM events
      WHERE 1=1 ${protectedKindsClause}
      ORDER BY created_at ASC
      LIMIT ?
    `).bind(DB_PRUNE_BATCH_SIZE2).all();
    if (!oldestEvents.results || oldestEvents.results.length === 0) {
      console.log("No more events eligible for pruning");
      break;
    }
    const eventIds = oldestEvents.results.map((row) => row.id);
    const placeholders = eventIds.map(() => "?").join(",");
    const deleteResult = await session.prepare(`
      DELETE FROM events WHERE id IN (${placeholders})
    `).bind(...eventIds).run();
    const deletedCount = deleteResult.meta?.changes || eventIds.length;
    totalEventsDeleted += deletedCount;
    await session.prepare(`
      DELETE FROM event_tags_cache WHERE event_id IN (${placeholders})
    `).bind(...eventIds).run();
    await session.prepare(`
      DELETE FROM event_tags_cache_multi WHERE event_id IN (${placeholders})
    `).bind(...eventIds).run();
    await session.prepare(`
      DELETE FROM mv_recent_notes WHERE id IN (${placeholders})
    `).bind(...eventIds).run();
    await session.prepare(`
      DELETE FROM mv_timeline_cache WHERE event_id IN (${placeholders})
    `).bind(...eventIds).run();
    console.log(`Pruned ${deletedCount} events (total: ${totalEventsDeleted})`);
    currentSize = await getDatabaseSizeBytes(session);
    console.log(`Current database size: ${(currentSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);
    if (totalEventsDeleted >= 1e5) {
      console.log("Reached maximum pruning limit for this run (100,000 events)");
      break;
    }
  }
  return { eventsDeleted: totalEventsDeleted, finalSizeBytes: currentSize };
}
__name(pruneOldEvents, "pruneOldEvents");
var relay_worker_default = {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.searchParams.has("notify-zap") && PAY_TO_RELAY_ENABLED2) {
        return await handlePaymentNotification(request, env);
      }
      if (url.pathname === "/api/check-payment" && PAY_TO_RELAY_ENABLED2) {
        return await handleCheckPayment(request, env);
      }
      if (url.pathname === "/") {
        if (request.headers.get("Upgrade") === "websocket") {
          const cf = request.cf;
          const { stub, doName } = await getOptimalDO(cf, env, url);
          const newUrl = new URL(request.url);
          newUrl.searchParams.set("region", cf?.region || "unknown");
          newUrl.searchParams.set("colo", cf?.colo || "unknown");
          newUrl.searchParams.set("continent", cf?.continent || "unknown");
          newUrl.searchParams.set("country", cf?.country || "unknown");
          newUrl.searchParams.set("doName", doName);
          return stub.fetch(new Request(newUrl, request));
        } else if (request.headers.get("Accept") === "application/nostr+json") {
          return handleRelayInfoRequest(request);
        } else {
          ctx.waitUntil(
            initializeDatabase(env.RELAY_DATABASE).catch((e) => console.error("DB init error:", e))
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
  async scheduled(event, env, ctx) {
    console.log("Running scheduled 24hr database maintenance...");
    try {
      const session = env.RELAY_DATABASE.withSession("first-primary");
      if (DB_PRUNING_ENABLED2) {
        const currentSizeBytes = await getDatabaseSizeBytes(session);
        const currentSizeGB = currentSizeBytes / (1024 * 1024 * 1024);
        console.log(`Current database size: ${currentSizeGB.toFixed(2)} GB (threshold: ${DB_SIZE_THRESHOLD_GB2} GB)`);
        if (currentSizeGB >= DB_SIZE_THRESHOLD_GB2) {
          console.log(`Database size (${currentSizeGB.toFixed(2)} GB) exceeds threshold (${DB_SIZE_THRESHOLD_GB2} GB). Starting pruning...`);
          const targetSizeBytes = DB_PRUNE_TARGET_GB2 * 1024 * 1024 * 1024;
          const pruneResult = await pruneOldEvents(session, targetSizeBytes);
          console.log(`Pruning completed. Deleted ${pruneResult.eventsDeleted} events. Final size: ${(pruneResult.finalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`);
        } else {
          console.log("Database size is within limits. No pruning needed.");
        }
      } else {
        console.log("Database pruning is disabled.");
      }
      console.log("Running PRAGMA optimize...");
      await session.prepare("PRAGMA optimize").run();
      console.log("PRAGMA optimize completed");
      console.log("Running ANALYZE on all tables...");
      await session.prepare("ANALYZE events").run();
      await session.prepare("ANALYZE tags").run();
      await session.prepare("ANALYZE event_tags_cache").run();
      await session.prepare("ANALYZE event_tags_cache_multi").run();
      await session.prepare("ANALYZE content_hashes").run();
      console.log("ANALYZE completed - query planner statistics updated");
      console.log("Scheduled 24hr database maintenance completed successfully");
    } catch (error) {
      console.error("Scheduled maintenance failed:", error);
    }
  }
};

// src/durable-object.ts
var _RelayWebSocket = class _RelayWebSocket {
  constructor(state, env) {
    this.processedEvents = /* @__PURE__ */ new Map();
    // eventId -> timestamp
    // Query cache for REQ messages
    this.queryCache = /* @__PURE__ */ new Map();
    this.QUERY_CACHE_TTL = 6e4;
    this.MAX_CACHE_SIZE = 100;
    // Query cache index for efficient invalidation (kind:X, author:Y, etc.)
    this.queryCacheIndex = /* @__PURE__ */ new Map();
    // Active queries for deduplication (prevent duplicate work)
    this.activeQueries = /* @__PURE__ */ new Map();
    // Payment status cache
    this.paymentCache = /* @__PURE__ */ new Map();
    this.PAYMENT_CACHE_TTL = 6e4;
    // Alarm and cleanup configuration
    this.IDLE_TIMEOUT = 5 * 60 * 1e3;
    // 5 minutes
    this.lastActivityTime = Date.now();
    this.state = state;
    this.sessions = /* @__PURE__ */ new Map();
    this.env = env;
    this.doId = crypto.randomUUID();
    this.region = "unknown";
    this.doName = "unknown";
    this.processedEvents = /* @__PURE__ */ new Map();
    this.queryCache = /* @__PURE__ */ new Map();
    this.queryCacheIndex = /* @__PURE__ */ new Map();
    this.activeQueries = /* @__PURE__ */ new Map();
    this.paymentCache = /* @__PURE__ */ new Map();
    this.lastActivityTime = Date.now();
  }
  // Alarm handler - called when scheduled alarm fires
  async alarm() {
    console.log(`Alarm triggered for DO ${this.doName}`);
    const now = Date.now();
    const idleTime = now - this.lastActivityTime;
    const activeWebSockets = this.state.getWebSockets();
    const activeCount = activeWebSockets.length;
    console.log(`DO ${this.doName} - Active WebSockets: ${activeCount}, Idle time: ${idleTime}ms`);
    if (activeCount === 0) {
      console.log(`Cleaning up DO ${this.doName} - no active connections`);
      await this.cleanup();
      return;
    }
    const nextAlarm = now + this.IDLE_TIMEOUT;
    await this.state.storage.setAlarm(nextAlarm);
    console.log(`Next alarm scheduled for DO ${this.doName} in ${this.IDLE_TIMEOUT}ms`);
  }
  // Cleanup method to clear caches and sessions
  async cleanup() {
    console.log(`Running cleanup for DO ${this.doName}`);
    this.queryCache.clear();
    this.queryCacheIndex.clear();
    this.activeQueries.clear();
    this.paymentCache.clear();
    this.processedEvents.clear();
    this.sessions.clear();
    await this.cleanupOrphanedSubscriptions();
    console.log(`Cleanup complete for DO ${this.doName}`);
  }
  // Remove orphaned subscription data from storage
  async cleanupOrphanedSubscriptions() {
    try {
      const allKeys = await this.state.storage.list();
      const activeWebSockets = this.state.getWebSockets();
      const activeSessionIds = /* @__PURE__ */ new Set();
      for (const ws of activeWebSockets) {
        const attachment = ws.deserializeAttachment();
        if (attachment) {
          activeSessionIds.add(attachment.sessionId);
        }
      }
      const keysToDelete = [];
      for (const [key] of allKeys) {
        if (key.startsWith("subs:")) {
          const sessionId = key.substring(5);
          if (!activeSessionIds.has(sessionId)) {
            keysToDelete.push(key);
          }
        }
      }
      if (keysToDelete.length > 0) {
        await this.state.storage.delete(keysToDelete);
        console.log(`Cleaned up ${keysToDelete.length} orphaned subscription entries`);
      }
    } catch (error) {
      console.error("Error cleaning up orphaned subscriptions:", error);
    }
  }
  // Schedule alarm if one doesn't exist
  async scheduleAlarmIfNeeded() {
    const existingAlarm = await this.state.storage.getAlarm();
    if (existingAlarm === null) {
      const alarmTime = Date.now() + this.IDLE_TIMEOUT;
      await this.state.storage.setAlarm(alarmTime);
      console.log(`Scheduled first alarm for DO ${this.doName}`);
    }
  }
  // Storage helper methods for subscriptions
  async saveSubscriptions(sessionId, subscriptions) {
    const key = `subs:${sessionId}`;
    const data = Array.from(subscriptions.entries());
    await this.state.storage.put(key, data);
  }
  async loadSubscriptions(sessionId) {
    const key = `subs:${sessionId}`;
    const data = await this.state.storage.get(key);
    return new Map(data || []);
  }
  async deleteSubscriptions(sessionId) {
    const key = `subs:${sessionId}`;
    await this.state.storage.delete(key);
  }
  // Payment cache methods
  async getCachedPaymentStatus(pubkey) {
    const cached = this.paymentCache.get(pubkey);
    if (cached && Date.now() - cached.timestamp < this.PAYMENT_CACHE_TTL) {
      return cached.hasPaid;
    }
    if (cached) {
      this.paymentCache.delete(pubkey);
    }
    return null;
  }
  setCachedPaymentStatus(pubkey, hasPaid) {
    this.paymentCache.set(pubkey, {
      hasPaid,
      timestamp: Date.now()
    });
    if (this.paymentCache.size > 1e3) {
      const sortedEntries = Array.from(this.paymentCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = Math.floor(this.paymentCache.size * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.paymentCache.delete(sortedEntries[i][0]);
      }
    }
  }
  // Helper to generate global cache key
  async generateGlobalCacheKey(filters, bookmark) {
    const cacheData = JSON.stringify({ filters, bookmark });
    const buffer = new TextEncoder().encode(cacheData);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `https://nosflare-query-cache/${hashHex}`;
  }
  // Query cache methods with deduplication and global caching
  async getCachedOrQuery(filters, bookmark) {
    const cacheKey = JSON.stringify({ filters, bookmark });
    if (this.activeQueries.has(cacheKey)) {
      console.log("Returning in-flight query result (deduplication)");
      return await this.activeQueries.get(cacheKey);
    }
    try {
      const globalCache = caches.default;
      const globalCacheKey = await this.generateGlobalCacheKey(filters, bookmark);
      const globalCached = await globalCache.match(globalCacheKey);
      if (globalCached) {
        console.log("Returning globally cached query result");
        const result = await globalCached.json();
        this.queryCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
          accessCount: 1,
          lastAccessed: Date.now()
        });
        this.addToCacheIndex(cacheKey, filters);
        return result;
      }
    } catch (error) {
      console.error("Error checking global cache:", error);
    }
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.QUERY_CACHE_TTL) {
      console.log("Returning locally cached query result");
      cached.accessCount++;
      cached.lastAccessed = Date.now();
      return cached.result;
    }
    const queryPromise = queryEvents(filters, bookmark, this.env);
    this.activeQueries.set(cacheKey, queryPromise);
    try {
      const result = await queryPromise;
      this.queryCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now()
      });
      this.addToCacheIndex(cacheKey, filters);
      if (this.queryCache.size > this.MAX_CACHE_SIZE) {
        this.cleanupQueryCache();
      }
      try {
        const globalCache = caches.default;
        const globalCacheKey = await this.generateGlobalCacheKey(filters, bookmark);
        const response = new Response(JSON.stringify(result), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300"
            // 5 minute TTL
          }
        });
        await globalCache.put(globalCacheKey, response);
        console.log("Stored query result in global cache");
      } catch (error) {
        console.error("Error storing in global cache:", error);
      }
      return result;
    } finally {
      this.activeQueries.delete(cacheKey);
    }
  }
  cleanupQueryCache() {
    const now = Date.now();
    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > this.QUERY_CACHE_TTL) {
        this.queryCache.delete(key);
        this.removeFromCacheIndex(key);
      }
    }
    if (this.queryCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.queryCache.entries());
      const scoredEntries = entries.map(([key, entry]) => {
        const recencyScore = (now - entry.lastAccessed) / 1e3;
        const frequencyScore = entry.accessCount * 10;
        const evictionScore = frequencyScore - recencyScore / 60;
        return { key, score: evictionScore };
      });
      scoredEntries.sort((a, b) => a.score - b.score);
      const toRemove = Math.floor(this.MAX_CACHE_SIZE * 0.2);
      for (let i = 0; i < toRemove; i++) {
        const key = scoredEntries[i].key;
        this.queryCache.delete(key);
        this.removeFromCacheIndex(key);
      }
      console.log(`Evicted ${toRemove} low-scoring cache entries (LFU)`);
    }
  }
  // Add cache entry to index for efficient invalidation
  addToCacheIndex(cacheKey, filters) {
    for (const filter of filters) {
      if (filter.kinds) {
        for (const kind of filter.kinds) {
          const indexKey = `kind:${kind}`;
          if (!this.queryCacheIndex.has(indexKey)) {
            this.queryCacheIndex.set(indexKey, /* @__PURE__ */ new Set());
          }
          this.queryCacheIndex.get(indexKey).add(cacheKey);
        }
      }
      if (filter.authors) {
        for (const author of filter.authors) {
          const indexKey = `author:${author}`;
          if (!this.queryCacheIndex.has(indexKey)) {
            this.queryCacheIndex.set(indexKey, /* @__PURE__ */ new Set());
          }
          this.queryCacheIndex.get(indexKey).add(cacheKey);
        }
      }
      for (const [key, values] of Object.entries(filter)) {
        if (key.startsWith("#") && Array.isArray(values)) {
          const tagName = key.substring(1);
          for (const value of values) {
            const indexKey = `tag:${tagName}:${value}`;
            if (!this.queryCacheIndex.has(indexKey)) {
              this.queryCacheIndex.set(indexKey, /* @__PURE__ */ new Set());
            }
            this.queryCacheIndex.get(indexKey).add(cacheKey);
          }
        }
      }
    }
  }
  // Remove cache entry from index
  removeFromCacheIndex(cacheKey) {
    for (const [indexKey, cacheKeys] of this.queryCacheIndex.entries()) {
      cacheKeys.delete(cacheKey);
      if (cacheKeys.size === 0) {
        this.queryCacheIndex.delete(indexKey);
      }
    }
  }
  invalidateRelevantCaches(event) {
    const keysToInvalidate = /* @__PURE__ */ new Set();
    const kindKey = `kind:${event.kind}`;
    if (this.queryCacheIndex.has(kindKey)) {
      for (const cacheKey of this.queryCacheIndex.get(kindKey)) {
        keysToInvalidate.add(cacheKey);
      }
    }
    const authorKey = `author:${event.pubkey}`;
    if (this.queryCacheIndex.has(authorKey)) {
      for (const cacheKey of this.queryCacheIndex.get(authorKey)) {
        keysToInvalidate.add(cacheKey);
      }
    }
    for (const tag of event.tags) {
      if (tag.length >= 2) {
        const tagKey = `tag:${tag[0]}:${tag[1]}`;
        if (this.queryCacheIndex.has(tagKey)) {
          for (const cacheKey of this.queryCacheIndex.get(tagKey)) {
            keysToInvalidate.add(cacheKey);
          }
        }
      }
    }
    for (const key of keysToInvalidate) {
      this.queryCache.delete(key);
      this.removeFromCacheIndex(key);
    }
    if (keysToInvalidate.size > 0) {
      console.log(`Invalidated ${keysToInvalidate.size} local cache entries for event ${event.id} (kind:${event.kind}, author:${event.pubkey.substring(0, 8)}...)`);
    }
  }
  async fetch(request) {
    const url = new URL(request.url);
    const urlDoName = url.searchParams.get("doName");
    if (urlDoName && urlDoName !== "unknown" && _RelayWebSocket.ALLOWED_ENDPOINTS.includes(urlDoName)) {
      this.doName = urlDoName;
    }
    if (url.pathname === "/do-broadcast") {
      return await this.handleDOBroadcast(request);
    }
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }
    this.region = url.searchParams.get("region") || this.region || "unknown";
    const colo = url.searchParams.get("colo") || "default";
    console.log(`WebSocket connection to DO: ${this.doName} (region: ${this.region}, colo: ${colo})`);
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    const sessionId = crypto.randomUUID();
    const host = request.headers.get("host") || url.host;
    const session = {
      id: sessionId,
      webSocket: server,
      subscriptions: /* @__PURE__ */ new Map(),
      pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
      reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
      bookmark: "first-unconstrained",
      host,
      challenge: AUTH_REQUIRED ? this.generateAuthChallenge() : void 0,
      authenticatedPubkeys: /* @__PURE__ */ new Set()
    };
    this.sessions.set(sessionId, session);
    const attachment = {
      sessionId,
      bookmark: session.bookmark,
      host,
      doName: this.doName
    };
    server.serializeAttachment(attachment);
    this.state.acceptWebSocket(server);
    if (AUTH_REQUIRED && session.challenge) {
      this.sendAuth(server, session.challenge);
    }
    this.lastActivityTime = Date.now();
    await this.scheduleAlarmIfNeeded();
    console.log(`New WebSocket session: ${sessionId} on DO ${this.doName}`);
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  // WebSocket Hibernation API handler methods
  async webSocketMessage(ws, message) {
    this.lastActivityTime = Date.now();
    const attachment = ws.deserializeAttachment();
    if (!attachment) {
      console.error("No session attachment found");
      ws.close(1011, "Session not found");
      return;
    }
    let session = this.sessions.get(attachment.sessionId);
    if (!session) {
      if (attachment.doName && this.doName === "unknown") {
        this.doName = attachment.doName;
      }
      const subscriptions = await this.loadSubscriptions(attachment.sessionId);
      session = {
        id: attachment.sessionId,
        webSocket: ws,
        subscriptions,
        pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
        reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
        bookmark: attachment.bookmark,
        host: attachment.host,
        // NIP-42: Generate new challenge after hibernation (old one is lost)
        challenge: AUTH_REQUIRED ? this.generateAuthChallenge() : void 0,
        authenticatedPubkeys: /* @__PURE__ */ new Set()
      };
      this.sessions.set(attachment.sessionId, session);
      if (AUTH_REQUIRED && session.challenge) {
        this.sendAuth(ws, session.challenge);
      }
    }
    try {
      let parsedMessage;
      if (typeof message === "string") {
        parsedMessage = JSON.parse(message);
      } else {
        const decoder = new TextDecoder();
        const text = decoder.decode(message);
        parsedMessage = JSON.parse(text);
      }
      await this.handleMessage(session, parsedMessage);
      const updatedAttachment = {
        sessionId: session.id,
        bookmark: session.bookmark,
        host: session.host,
        doName: this.doName,
        hasPaid: attachment.hasPaid
      };
      ws.serializeAttachment(updatedAttachment);
    } catch (error) {
      console.error("Error handling message:", error);
      if (error instanceof SyntaxError) {
        this.sendError(ws, "Invalid JSON format");
      } else {
        this.sendError(ws, "Failed to process message");
      }
    }
  }
  async webSocketClose(ws, code, reason, wasClean) {
    const attachment = ws.deserializeAttachment();
    if (attachment) {
      console.log(`WebSocket closed: ${attachment.sessionId} on DO ${this.doName}`);
      this.sessions.delete(attachment.sessionId);
      await this.deleteSubscriptions(attachment.sessionId);
      const activeWebSockets = this.state.getWebSockets();
      if (activeWebSockets.length === 0) {
        await this.state.storage.deleteAlarm();
        console.log(`Deleted alarm for DO ${this.doName} - no active connections remaining`);
      }
    }
  }
  async webSocketError(ws, error) {
    const attachment = ws.deserializeAttachment();
    if (attachment) {
      console.error(`WebSocket error for session ${attachment.sessionId}:`, error);
      this.sessions.delete(attachment.sessionId);
    }
  }
  async handleDOBroadcast(request) {
    try {
      const data = await request.json();
      const { event, sourceDoId } = data;
      if (this.processedEvents.has(event.id)) {
        return new Response(JSON.stringify({ success: true, duplicate: true }));
      }
      this.processedEvents.set(event.id, Date.now());
      console.log(`DO ${this.doName} received event ${event.id} from ${sourceDoId}`);
      await this.broadcastToLocalSessions(event);
      const fiveMinutesAgo = Date.now() - 3e5;
      let cleaned = 0;
      for (const [eventId, timestamp] of this.processedEvents) {
        if (timestamp < fiveMinutesAgo) {
          this.processedEvents.delete(eventId);
          cleaned++;
        }
      }
      return new Response(JSON.stringify({ success: true }));
    } catch (error) {
      console.error("Error handling DO broadcast:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  async handleMessage(session, message) {
    if (!Array.isArray(message)) {
      this.sendError(session.webSocket, "Invalid message format: expected JSON array");
      return;
    }
    const [type, ...args] = message;
    try {
      switch (type) {
        case "EVENT":
          await this.handleEvent(session, args[0]);
          break;
        case "REQ":
          await this.handleReq(session, message);
          break;
        case "CLOSE":
          await this.handleCloseSubscription(session, args[0]);
          break;
        case "AUTH":
          await this.handleAuth(session, args[0]);
          break;
        default:
          this.sendError(session.webSocket, `Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error(`Error handling ${type} message:`, error);
      this.sendError(session.webSocket, `Failed to process ${type} message`);
    }
  }
  async handleEvent(session, event) {
    try {
      if (!event || typeof event !== "object") {
        this.sendOK(session.webSocket, "", false, "invalid: event object required");
        return;
      }
      if (!event.id || !event.pubkey || !event.sig || !event.created_at || event.kind === void 0 || !Array.isArray(event.tags) || event.content === void 0 || event.content === null) {
        this.sendOK(session.webSocket, event.id || "", false, "invalid: missing required fields");
        return;
      }
      if (event.kind === 22242) {
        this.sendOK(session.webSocket, event.id, false, "invalid: kind 22242 events are for authentication only");
        return;
      }
      if (AUTH_REQUIRED && !session.authenticatedPubkeys.has(event.pubkey)) {
        this.sendOK(session.webSocket, event.id, false, "auth-required: authenticate to publish events");
        return;
      }
      if (!excludedRateLimitKinds.has(event.kind)) {
        if (!session.pubkeyRateLimiter.removeToken()) {
          console.log(`Rate limit exceeded for pubkey ${event.pubkey}`);
          this.sendOK(session.webSocket, event.id, false, "rate-limited: slow down there chief");
          return;
        }
      }
      const isValidSignature = await verifyEventSignature(event);
      if (!isValidSignature) {
        console.error(`Signature verification failed for event ${event.id}`);
        this.sendOK(session.webSocket, event.id, false, "invalid: signature verification failed");
        return;
      }
      if (PAY_TO_RELAY_ENABLED) {
        let hasPaid = await this.getCachedPaymentStatus(event.pubkey);
        if (hasPaid === null) {
          hasPaid = await hasPaidForRelay(event.pubkey, this.env);
          this.setCachedPaymentStatus(event.pubkey, hasPaid);
        }
        if (!hasPaid) {
          const protocol = "https:";
          const relayUrl = `${protocol}//${session.host}`;
          console.error(`Event denied. Pubkey ${event.pubkey} has not paid for relay access.`);
          this.sendOK(session.webSocket, event.id, false, `blocked: payment required. Visit ${relayUrl} to pay for relay access.`);
          return;
        }
      }
      if (event.kind !== 1059 && !isPubkeyAllowed(event.pubkey)) {
        console.error(`Event denied. Pubkey ${event.pubkey} is not allowed.`);
        this.sendOK(session.webSocket, event.id, false, "blocked: pubkey not allowed");
        return;
      }
      if (!isEventKindAllowed(event.kind)) {
        console.error(`Event denied. Event kind ${event.kind} is not allowed.`);
        this.sendOK(session.webSocket, event.id, false, `blocked: event kind ${event.kind} not allowed`);
        return;
      }
      if (containsBlockedContent(event)) {
        console.error("Event denied. Content contains blocked phrases.");
        this.sendOK(session.webSocket, event.id, false, "blocked: content contains blocked phrases");
        return;
      }
      for (const tag of event.tags) {
        if (!isTagAllowed(tag[0])) {
          console.error(`Event denied. Tag '${tag[0]}' is not allowed.`);
          this.sendOK(session.webSocket, event.id, false, `blocked: tag '${tag[0]}' not allowed`);
          return;
        }
      }
      const result = await processEvent(event, session.id, this.env);
      if (result.bookmark) {
        session.bookmark = result.bookmark;
      }
      if (result.success) {
        this.sendOK(session.webSocket, event.id, true, result.message);
        this.processedEvents.set(event.id, Date.now());
        this.invalidateRelevantCaches(event);
        console.log(`DO ${this.doName} broadcasting event ${event.id}`);
        await this.broadcastEvent(event);
      } else {
        this.sendOK(session.webSocket, event.id, false, result.message);
      }
    } catch (error) {
      console.error("Error handling event:", error);
      this.sendOK(session.webSocket, event?.id || "", false, `error: ${error.message}`);
    }
  }
  async handleReq(session, message) {
    const [_, subscriptionId, ...filters] = message;
    if (!subscriptionId || typeof subscriptionId !== "string" || subscriptionId === "" || subscriptionId.length > 64) {
      this.sendError(session.webSocket, "Invalid subscription ID: must be non-empty string of max 64 chars");
      return;
    }
    if (AUTH_REQUIRED && session.authenticatedPubkeys.size === 0) {
      this.sendClosed(session.webSocket, subscriptionId, "auth-required: authentication required to subscribe");
      return;
    }
    if (!session.reqRateLimiter.removeToken()) {
      console.error(`REQ rate limit exceeded for subscription: ${subscriptionId}`);
      this.sendClosed(session.webSocket, subscriptionId, "rate-limited: slow down there chief");
      return;
    }
    if (filters.length === 0) {
      this.sendClosed(session.webSocket, subscriptionId, "error: at least one filter required");
      return;
    }
    for (const filter of filters) {
      if (typeof filter !== "object" || filter === null) {
        this.sendClosed(session.webSocket, subscriptionId, "invalid: filter must be an object");
        return;
      }
      if (filter.ids) {
        for (const id of filter.ids) {
          if (!/^[a-f0-9]{64}$/.test(id)) {
            this.sendClosed(session.webSocket, subscriptionId, `invalid: Invalid event ID format: ${id}`);
            return;
          }
        }
      }
      if (filter.authors) {
        for (const author of filter.authors) {
          if (!/^[a-f0-9]{64}$/.test(author)) {
            this.sendClosed(session.webSocket, subscriptionId, `invalid: Invalid author pubkey format: ${author}`);
            return;
          }
        }
      }
      if (filter.kinds) {
        const blockedKinds = filter.kinds.filter((kind) => !isEventKindAllowed(kind));
        if (blockedKinds.length > 0) {
          console.error(`Blocked kinds in subscription: ${blockedKinds.join(", ")}`);
          this.sendClosed(session.webSocket, subscriptionId, `blocked: kinds ${blockedKinds.join(", ")} not allowed`);
          return;
        }
      }
      if (filter.ids && filter.ids.length > 5e3) {
        this.sendClosed(session.webSocket, subscriptionId, "invalid: too many event IDs (max 5000)");
        return;
      }
      if (filter.limit && filter.limit > 500) {
        filter.limit = 500;
      } else if (!filter.limit) {
        filter.limit = 500;
      }
    }
    session.subscriptions.set(subscriptionId, filters);
    await this.saveSubscriptions(session.id, session.subscriptions);
    console.log(`New subscription ${subscriptionId} for session ${session.id} on DO ${this.doName}`);
    try {
      const result = await this.getCachedOrQuery(filters, session.bookmark);
      if (result.bookmark) {
        session.bookmark = result.bookmark;
      }
      for (const event of result.events) {
        this.sendEvent(session.webSocket, subscriptionId, event);
      }
      this.sendEOSE(session.webSocket, subscriptionId);
    } catch (error) {
      console.error(`Error processing REQ for subscription ${subscriptionId}:`, error);
      this.sendClosed(session.webSocket, subscriptionId, "error: could not connect to the database");
    }
  }
  async handleCloseSubscription(session, subscriptionId) {
    if (!subscriptionId) {
      this.sendError(session.webSocket, "Invalid subscription ID for CLOSE");
      return;
    }
    const deleted = session.subscriptions.delete(subscriptionId);
    if (deleted) {
      await this.saveSubscriptions(session.id, session.subscriptions);
      console.log(`Closed subscription ${subscriptionId} for session ${session.id} on DO ${this.doName}`);
      this.sendClosed(session.webSocket, subscriptionId, "Subscription closed");
    } else {
      this.sendClosed(session.webSocket, subscriptionId, "Subscription not found");
    }
  }
  // NIP-42: Handle AUTH message from client
  async handleAuth(session, authEvent) {
    try {
      if (!authEvent || typeof authEvent !== "object") {
        this.sendOK(session.webSocket, "", false, "invalid: auth event object required");
        return;
      }
      if (!authEvent.id || !authEvent.pubkey || !authEvent.sig || !authEvent.created_at || authEvent.kind === void 0 || !Array.isArray(authEvent.tags) || authEvent.content === void 0) {
        this.sendOK(session.webSocket, authEvent.id || "", false, "invalid: missing required fields");
        return;
      }
      if (authEvent.kind !== 22242) {
        this.sendOK(session.webSocket, authEvent.id, false, "invalid: auth event must be kind 22242");
        return;
      }
      const isValidSignature = await verifyEventSignature(authEvent);
      if (!isValidSignature) {
        this.sendOK(session.webSocket, authEvent.id, false, "invalid: signature verification failed");
        return;
      }
      const now = Math.floor(Date.now() / 1e3);
      const timeDiff = Math.abs(now - authEvent.created_at);
      const timeoutSeconds = AUTH_TIMEOUT_MS / 1e3;
      if (timeDiff > timeoutSeconds) {
        this.sendOK(session.webSocket, authEvent.id, false, "invalid: auth event created_at is too far from current time");
        return;
      }
      const challengeTag = authEvent.tags.find((tag) => tag[0] === "challenge");
      if (!challengeTag || !challengeTag[1]) {
        this.sendOK(session.webSocket, authEvent.id, false, "invalid: missing challenge tag");
        return;
      }
      if (!session.challenge) {
        this.sendOK(session.webSocket, authEvent.id, false, "invalid: no challenge was issued");
        return;
      }
      if (challengeTag[1] !== session.challenge) {
        this.sendOK(session.webSocket, authEvent.id, false, "invalid: challenge mismatch");
        return;
      }
      const relayTag = authEvent.tags.find((tag) => tag[0] === "relay");
      if (!relayTag || !relayTag[1]) {
        this.sendOK(session.webSocket, authEvent.id, false, "invalid: missing relay tag");
        return;
      }
      try {
        const authRelayUrl = new URL(relayTag[1]);
        const sessionHost = session.host.toLowerCase().replace(/:\d+$/, "");
        const authHost = authRelayUrl.host.toLowerCase().replace(/:\d+$/, "");
        if (authHost !== sessionHost) {
          this.sendOK(session.webSocket, authEvent.id, false, `invalid: relay URL mismatch (expected ${sessionHost})`);
          return;
        }
      } catch {
        this.sendOK(session.webSocket, authEvent.id, false, "invalid: malformed relay URL");
        return;
      }
      session.authenticatedPubkeys.add(authEvent.pubkey);
      this.sendOK(session.webSocket, authEvent.id, true, "");
    } catch (error) {
      console.error("Error handling AUTH:", error);
      this.sendOK(session.webSocket, authEvent?.id || "", false, `error: ${error.message}`);
    }
  }
  async broadcastEvent(event) {
    await this.broadcastToLocalSessions(event);
    await this.broadcastToOtherDOs(event);
  }
  async broadcastToLocalSessions(event) {
    let broadcastCount = 0;
    const activeWebSockets = this.state.getWebSockets();
    for (const ws of activeWebSockets) {
      const attachment = ws.deserializeAttachment();
      if (!attachment)
        continue;
      let session = this.sessions.get(attachment.sessionId);
      if (!session) {
        const subscriptions = await this.loadSubscriptions(attachment.sessionId);
        session = {
          id: attachment.sessionId,
          webSocket: ws,
          subscriptions,
          pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
          reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
          bookmark: attachment.bookmark,
          host: attachment.host,
          challenge: AUTH_REQUIRED ? this.generateAuthChallenge() : void 0,
          authenticatedPubkeys: /* @__PURE__ */ new Set()
        };
        this.sessions.set(attachment.sessionId, session);
      }
      for (const [subscriptionId, filters] of session.subscriptions) {
        if (this.matchesFilters(event, filters)) {
          try {
            this.sendEvent(ws, subscriptionId, event);
            broadcastCount++;
          } catch (error) {
            console.error(`Error broadcasting to subscription ${subscriptionId}:`, error);
          }
        }
      }
    }
    if (broadcastCount > 0) {
      console.log(`Event ${event.id} broadcast to ${broadcastCount} local subscriptions on DO ${this.doName}`);
    }
  }
  async broadcastToOtherDOs(event) {
    const broadcasts = [];
    for (const endpoint of _RelayWebSocket.ALLOWED_ENDPOINTS) {
      if (endpoint === this.doName)
        continue;
      broadcasts.push(this.sendToSpecificDO(endpoint, event));
    }
    const results = await Promise.allSettled(
      broadcasts.map((p) => Promise.race([
        p,
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Broadcast timeout")), 3e3)
        )
      ]))
    );
    const successful = results.filter((r) => r.status === "fulfilled").length;
    console.log(`Event ${event.id} broadcast from DO ${this.doName} to ${successful}/${broadcasts.length} remote DOs`);
  }
  async sendToSpecificDO(doName, event) {
    try {
      if (!_RelayWebSocket.ALLOWED_ENDPOINTS.includes(doName)) {
        throw new Error(`Invalid DO name: ${doName}`);
      }
      const id = this.env.RELAY_WEBSOCKET.idFromName(doName);
      const locationHint = _RelayWebSocket.ENDPOINT_HINTS[doName] || "auto";
      const stub = this.env.RELAY_WEBSOCKET.get(id, { locationHint });
      const url = new URL("https://internal/do-broadcast");
      url.searchParams.set("doName", doName);
      return await stub.fetch(new Request(url.toString(), {
        method: "POST",
        body: JSON.stringify({
          event,
          sourceDoId: this.doId
        })
      }));
    } catch (error) {
      console.error(`Failed to broadcast to ${doName}:`, error);
      throw error;
    }
  }
  matchesFilters(event, filters) {
    return filters.some((filter) => this.matchesFilter(event, filter));
  }
  matchesFilter(event, filter) {
    if (filter.ids && filter.ids.length > 0 && !filter.ids.includes(event.id)) {
      return false;
    }
    if (filter.authors && filter.authors.length > 0 && !filter.authors.includes(event.pubkey)) {
      return false;
    }
    if (filter.kinds && filter.kinds.length > 0 && !filter.kinds.includes(event.kind)) {
      return false;
    }
    if (filter.since && event.created_at < filter.since) {
      return false;
    }
    if (filter.until && event.created_at > filter.until) {
      return false;
    }
    for (const [key, values] of Object.entries(filter)) {
      if (key.startsWith("#") && Array.isArray(values) && values.length > 0) {
        const tagName = key.substring(1);
        const eventTagValues = event.tags.filter((tag) => tag[0] === tagName).map((tag) => tag[1]);
        const hasMatch = values.some((v) => eventTagValues.includes(v));
        if (!hasMatch) {
          return false;
        }
      }
    }
    return true;
  }
  // NIP-42: Send AUTH challenge to client
  sendAuth(ws, challenge2) {
    try {
      const authMessage = ["AUTH", challenge2];
      ws.send(JSON.stringify(authMessage));
    } catch (error) {
      console.error("Error sending AUTH:", error);
    }
  }
  // NIP-42: Generate a cryptographically secure challenge string
  generateAuthChallenge() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  sendOK(ws, eventId, status, message) {
    try {
      const okMessage = ["OK", eventId, status, message || ""];
      ws.send(JSON.stringify(okMessage));
    } catch (error) {
      console.error("Error sending OK:", error);
    }
  }
  sendError(ws, message) {
    try {
      const noticeMessage = ["NOTICE", message];
      ws.send(JSON.stringify(noticeMessage));
    } catch (error) {
      console.error("Error sending NOTICE:", error);
    }
  }
  sendEOSE(ws, subscriptionId) {
    try {
      const eoseMessage = ["EOSE", subscriptionId];
      ws.send(JSON.stringify(eoseMessage));
    } catch (error) {
      console.error("Error sending EOSE:", error);
    }
  }
  sendClosed(ws, subscriptionId, message) {
    try {
      const closedMessage = ["CLOSED", subscriptionId, message];
      ws.send(JSON.stringify(closedMessage));
    } catch (error) {
      console.error("Error sending CLOSED:", error);
    }
  }
  sendEvent(ws, subscriptionId, event) {
    try {
      const eventMessage = ["EVENT", subscriptionId, event];
      ws.send(JSON.stringify(eventMessage));
    } catch (error) {
      console.error("Error sending EVENT:", error);
    }
  }
};
__name(_RelayWebSocket, "RelayWebSocket");
// Define allowed endpoints
_RelayWebSocket.ALLOWED_ENDPOINTS = [
  "relay-WNAM-primary",
  // Western North America
  "relay-ENAM-primary",
  // Eastern North America
  "relay-WEUR-primary",
  // Western Europe
  "relay-EEUR-primary",
  // Eastern Europe
  "relay-APAC-primary",
  // Asia-Pacific
  "relay-OC-primary",
  // Oceania
  "relay-SAM-primary",
  // South America (redirects to enam)
  "relay-AFR-primary",
  // Africa (redirects to weur)
  "relay-ME-primary"
  // Middle East (redirects to eeur)
];
// Map endpoints to their proper location hints
_RelayWebSocket.ENDPOINT_HINTS = {
  "relay-WNAM-primary": "wnam",
  "relay-ENAM-primary": "enam",
  "relay-WEUR-primary": "weur",
  "relay-EEUR-primary": "eeur",
  "relay-APAC-primary": "apac",
  "relay-OC-primary": "oc",
  "relay-SAM-primary": "enam",
  // SAM redirects to ENAM
  "relay-AFR-primary": "weur",
  // AFR redirects to WEUR
  "relay-ME-primary": "eeur"
  // ME redirects to EEUR
};
var RelayWebSocket = _RelayWebSocket;
export {
  RelayWebSocket,
  relay_worker_default as default
};
/*! Bundled license information:

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/utils.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/abstract/modular.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/abstract/curve.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/abstract/weierstrass.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/_shortw_utils.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/secp256k1.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
