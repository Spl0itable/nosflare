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
  relayInfo: () => relayInfo,
  relayNpub: () => relayNpub
});
var relayNpub = "npub16jdfqgazrkapk0yrqm9rdxlnys7ck39c7zmdzxtxqlmmpxg04r0sd733sv";
var PAY_TO_RELAY_ENABLED = true;
var RELAY_ACCESS_PRICE_SATS = 2121;
var relayInfo = {
  name: "Nosflare",
  description: "A serverless Nostr relay through Cloudflare Worker and D1 database",
  pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
  contact: "lux@fed.wtf",
  supported_nips: [1, 2, 4, 5, 9, 11, 12, 15, 16, 17, 20, 22, 33, 40],
  software: "https://github.com/Spl0itable/nosflare",
  version: "7.1.5",
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
    // auth_required: false,
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
var PUBKEY_RATE_LIMIT = { rate: 50 / 6e4, capacity: 50 };
var REQ_RATE_LIMIT = { rate: 5e3 / 6e4, capacity: 5e3 };
var excludedRateLimitKinds = /* @__PURE__ */ new Set([
  // ... kinds to exclude from EVENT rate limiting Ex: 1, 2, 3
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

// ../../../node_modules/@noble/hashes/esm/_assert.js
function number(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error(`positive integer expected, not ${n}`);
}
__name(number, "number");
function isBytes(a) {
  return a instanceof Uint8Array || a != null && typeof a === "object" && a.constructor.name === "Uint8Array";
}
__name(isBytes, "isBytes");
function bytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error(`Uint8Array expected of length ${lengths}, not of length=${b.length}`);
}
__name(bytes, "bytes");
function hash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new Error("Hash should be wrapped by utils.wrapConstructor");
  number(h.outputLen);
  number(h.blockLen);
}
__name(hash, "hash");
function exists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
__name(exists, "exists");
function output(out, instance) {
  bytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error(`digestInto() expects output buffer of length at least ${min}`);
  }
}
__name(output, "output");

// ../../../node_modules/@noble/hashes/esm/crypto.js
var crypto2 = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;

// ../../../node_modules/@noble/hashes/esm/utils.js
var createView = /* @__PURE__ */ __name((arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength), "createView");
var rotr = /* @__PURE__ */ __name((word, shift) => word << 32 - shift | word >>> shift, "rotr");
var isLE = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
  return new Uint8Array(new TextEncoder().encode(str));
}
__name(utf8ToBytes, "utf8ToBytes");
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  bytes(data);
  return data;
}
__name(toBytes, "toBytes");
function concatBytes(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    bytes(a);
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
  // Safe version that clones internal state
  clone() {
    return this._cloneInto();
  }
};
__name(_Hash, "Hash");
var Hash = _Hash;
var toStr = {}.toString;
function wrapConstructor(hashCons) {
  const hashC = /* @__PURE__ */ __name((msg) => hashCons().update(toBytes(msg)).digest(), "hashC");
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
__name(wrapConstructor, "wrapConstructor");
function randomBytes(bytesLength = 32) {
  if (crypto2 && typeof crypto2.getRandomValues === "function") {
    return crypto2.getRandomValues(new Uint8Array(bytesLength));
  }
  if (crypto2 && typeof crypto2.randomBytes === "function") {
    return crypto2.randomBytes(bytesLength);
  }
  throw new Error("crypto.getRandomValues must be defined");
}
__name(randomBytes, "randomBytes");

// ../../../node_modules/@noble/hashes/esm/_md.js
function setBigUint64(view, byteOffset, value, isLE2) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE2);
  const _32n = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE2 ? 4 : 0;
  const l = isLE2 ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE2);
  view.setUint32(byteOffset + l, wl, isLE2);
}
__name(setBigUint64, "setBigUint64");
var Chi = /* @__PURE__ */ __name((a, b, c) => a & b ^ ~a & c, "Chi");
var Maj = /* @__PURE__ */ __name((a, b, c) => a & b ^ a & c ^ b & c, "Maj");
var _HashMD = class _HashMD extends Hash {
  constructor(blockLen, outputLen, padOffset, isLE2) {
    super();
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE2;
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    exists(this);
    const { view, buffer, blockLen } = this;
    data = toBytes(data);
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
    exists(this);
    output(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE: isLE2 } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    this.buffer.subarray(pos).fill(0);
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE2);
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
      oview.setUint32(4 * i, state[i], isLE2);
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
    to.length = length;
    to.pos = pos;
    to.finished = finished;
    to.destroyed = destroyed;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
};
__name(_HashMD, "HashMD");
var HashMD = _HashMD;

// ../../../node_modules/@noble/hashes/esm/sha256.js
var SHA256_K = /* @__PURE__ */ new Uint32Array([
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
var SHA256_IV = /* @__PURE__ */ new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var _SHA256 = class _SHA256 extends HashMD {
  constructor() {
    super(64, 32, 8, false);
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
    SHA256_W.fill(0);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    this.buffer.fill(0);
  }
};
__name(_SHA256, "SHA256");
var SHA256 = _SHA256;
var sha256 = /* @__PURE__ */ wrapConstructor(() => new SHA256());

// ../../../node_modules/@noble/hashes/esm/hmac.js
var _HMAC = class _HMAC extends Hash {
  constructor(hash2, _key) {
    super();
    this.finished = false;
    this.destroyed = false;
    hash(hash2);
    const key = toBytes(_key);
    this.iHash = hash2.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash2.create().update(key).digest() : key);
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash2.create();
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    pad.fill(0);
  }
  update(buf) {
    exists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    exists(this);
    bytes(out, this.outputLen);
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
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
};
__name(_HMAC, "HMAC");
var HMAC = _HMAC;
var hmac = /* @__PURE__ */ __name((hash2, key, message) => new HMAC(hash2, key).update(message).digest(), "hmac");
hmac.create = (hash2, key) => new HMAC(hash2, key);

// ../../../node_modules/@noble/curves/esm/abstract/utils.js
var utils_exports = {};
__export(utils_exports, {
  aInRange: () => aInRange,
  abool: () => abool,
  abytes: () => abytes,
  bitGet: () => bitGet,
  bitLen: () => bitLen,
  bitMask: () => bitMask,
  bitSet: () => bitSet,
  bytesToHex: () => bytesToHex,
  bytesToNumberBE: () => bytesToNumberBE,
  bytesToNumberLE: () => bytesToNumberLE,
  concatBytes: () => concatBytes2,
  createHmacDrbg: () => createHmacDrbg,
  ensureBytes: () => ensureBytes,
  equalBytes: () => equalBytes,
  hexToBytes: () => hexToBytes,
  hexToNumber: () => hexToNumber,
  inRange: () => inRange,
  isBytes: () => isBytes2,
  memoized: () => memoized,
  notImplemented: () => notImplemented,
  numberToBytesBE: () => numberToBytesBE,
  numberToBytesLE: () => numberToBytesLE,
  numberToHexUnpadded: () => numberToHexUnpadded,
  numberToVarBytesBE: () => numberToVarBytesBE,
  utf8ToBytes: () => utf8ToBytes2,
  validateObject: () => validateObject
});
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
function isBytes2(a) {
  return a instanceof Uint8Array || a != null && typeof a === "object" && a.constructor.name === "Uint8Array";
}
__name(isBytes2, "isBytes");
function abytes(item) {
  if (!isBytes2(item))
    throw new Error("Uint8Array expected");
}
__name(abytes, "abytes");
function abool(title, value) {
  if (typeof value !== "boolean")
    throw new Error(`${title} must be valid boolean, got "${value}".`);
}
__name(abool, "abool");
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes2) {
  abytes(bytes2);
  let hex = "";
  for (let i = 0; i < bytes2.length; i++) {
    hex += hexes[bytes2[i]];
  }
  return hex;
}
__name(bytesToHex, "bytesToHex");
function numberToHexUnpadded(num2) {
  const hex = num2.toString(16);
  return hex.length & 1 ? `0${hex}` : hex;
}
__name(numberToHexUnpadded, "numberToHexUnpadded");
function hexToNumber(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  return BigInt(hex === "" ? "0" : `0x${hex}`);
}
__name(hexToNumber, "hexToNumber");
var asciis = { _0: 48, _9: 57, _A: 65, _F: 70, _a: 97, _f: 102 };
function asciiToBase16(char) {
  if (char >= asciis._0 && char <= asciis._9)
    return char - asciis._0;
  if (char >= asciis._A && char <= asciis._F)
    return char - (asciis._A - 10);
  if (char >= asciis._a && char <= asciis._f)
    return char - (asciis._a - 10);
  return;
}
__name(asciiToBase16, "asciiToBase16");
function hexToBytes(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("padded hex string expected, got unpadded hex of length " + hl);
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
function bytesToNumberBE(bytes2) {
  return hexToNumber(bytesToHex(bytes2));
}
__name(bytesToNumberBE, "bytesToNumberBE");
function bytesToNumberLE(bytes2) {
  abytes(bytes2);
  return hexToNumber(bytesToHex(Uint8Array.from(bytes2).reverse()));
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
function numberToVarBytesBE(n) {
  return hexToBytes(numberToHexUnpadded(n));
}
__name(numberToVarBytesBE, "numberToVarBytesBE");
function ensureBytes(title, hex, expectedLength) {
  let res;
  if (typeof hex === "string") {
    try {
      res = hexToBytes(hex);
    } catch (e) {
      throw new Error(`${title} must be valid hex string, got "${hex}". Cause: ${e}`);
    }
  } else if (isBytes2(hex)) {
    res = Uint8Array.from(hex);
  } else {
    throw new Error(`${title} must be hex string or Uint8Array`);
  }
  const len = res.length;
  if (typeof expectedLength === "number" && len !== expectedLength)
    throw new Error(`${title} expected ${expectedLength} bytes, got ${len}`);
  return res;
}
__name(ensureBytes, "ensureBytes");
function concatBytes2(...arrays) {
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
__name(concatBytes2, "concatBytes");
function equalBytes(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
__name(equalBytes, "equalBytes");
function utf8ToBytes2(str) {
  if (typeof str !== "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
  return new Uint8Array(new TextEncoder().encode(str));
}
__name(utf8ToBytes2, "utf8ToBytes");
var isPosBig = /* @__PURE__ */ __name((n) => typeof n === "bigint" && _0n <= n, "isPosBig");
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
__name(inRange, "inRange");
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new Error(`expected valid ${title}: ${min} <= n < ${max}, got ${typeof n} ${n}`);
}
__name(aInRange, "aInRange");
function bitLen(n) {
  let len;
  for (len = 0; n > _0n; n >>= _1n, len += 1)
    ;
  return len;
}
__name(bitLen, "bitLen");
function bitGet(n, pos) {
  return n >> BigInt(pos) & _1n;
}
__name(bitGet, "bitGet");
function bitSet(n, pos, value) {
  return n | (value ? _1n : _0n) << BigInt(pos);
}
__name(bitSet, "bitSet");
var bitMask = /* @__PURE__ */ __name((n) => (_2n << BigInt(n - 1)) - _1n, "bitMask");
var u8n = /* @__PURE__ */ __name((data) => new Uint8Array(data), "u8n");
var u8fr = /* @__PURE__ */ __name((arr) => Uint8Array.from(arr), "u8fr");
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  if (typeof hashLen !== "number" || hashLen < 2)
    throw new Error("hashLen must be a number");
  if (typeof qByteLen !== "number" || qByteLen < 2)
    throw new Error("qByteLen must be a number");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = /* @__PURE__ */ __name(() => {
    v.fill(1);
    k.fill(0);
    i = 0;
  }, "reset");
  const h = /* @__PURE__ */ __name((...b) => hmacFn(k, v, ...b), "h");
  const reseed = /* @__PURE__ */ __name((seed = u8n()) => {
    k = h(u8fr([0]), seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(u8fr([1]), seed);
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
    return concatBytes2(...out);
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
var validatorFns = {
  bigint: /* @__PURE__ */ __name((val) => typeof val === "bigint", "bigint"),
  function: /* @__PURE__ */ __name((val) => typeof val === "function", "function"),
  boolean: /* @__PURE__ */ __name((val) => typeof val === "boolean", "boolean"),
  string: /* @__PURE__ */ __name((val) => typeof val === "string", "string"),
  stringOrUint8Array: /* @__PURE__ */ __name((val) => typeof val === "string" || isBytes2(val), "stringOrUint8Array"),
  isSafeInteger: /* @__PURE__ */ __name((val) => Number.isSafeInteger(val), "isSafeInteger"),
  array: /* @__PURE__ */ __name((val) => Array.isArray(val), "array"),
  field: /* @__PURE__ */ __name((val, object) => object.Fp.isValid(val), "field"),
  hash: /* @__PURE__ */ __name((val) => typeof val === "function" && Number.isSafeInteger(val.outputLen), "hash")
};
function validateObject(object, validators, optValidators = {}) {
  const checkField = /* @__PURE__ */ __name((fieldName, type, isOptional) => {
    const checkVal = validatorFns[type];
    if (typeof checkVal !== "function")
      throw new Error(`Invalid validator "${type}", expected function`);
    const val = object[fieldName];
    if (isOptional && val === void 0)
      return;
    if (!checkVal(val, object)) {
      throw new Error(`Invalid param ${String(fieldName)}=${val} (${typeof val}), expected ${type}`);
    }
  }, "checkField");
  for (const [fieldName, type] of Object.entries(validators))
    checkField(fieldName, type, false);
  for (const [fieldName, type] of Object.entries(optValidators))
    checkField(fieldName, type, true);
  return object;
}
__name(validateObject, "validateObject");
var notImplemented = /* @__PURE__ */ __name(() => {
  throw new Error("not implemented");
}, "notImplemented");
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

// ../../../node_modules/@noble/curves/esm/abstract/modular.js
var _0n2 = BigInt(0);
var _1n2 = BigInt(1);
var _2n2 = BigInt(2);
var _3n = BigInt(3);
var _4n = BigInt(4);
var _5n = BigInt(5);
var _8n = BigInt(8);
var _9n = BigInt(9);
var _16n = BigInt(16);
function mod(a, b) {
  const result = a % b;
  return result >= _0n2 ? result : b + result;
}
__name(mod, "mod");
function pow(num2, power, modulo) {
  if (modulo <= _0n2 || power < _0n2)
    throw new Error("Expected power/modulo > 0");
  if (modulo === _1n2)
    return _0n2;
  let res = _1n2;
  while (power > _0n2) {
    if (power & _1n2)
      res = res * num2 % modulo;
    num2 = num2 * num2 % modulo;
    power >>= _1n2;
  }
  return res;
}
__name(pow, "pow");
function pow2(x, power, modulo) {
  let res = x;
  while (power-- > _0n2) {
    res *= res;
    res %= modulo;
  }
  return res;
}
__name(pow2, "pow2");
function invert(number2, modulo) {
  if (number2 === _0n2 || modulo <= _0n2) {
    throw new Error(`invert: expected positive integers, got n=${number2} mod=${modulo}`);
  }
  let a = mod(number2, modulo);
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
function tonelliShanks(P) {
  const legendreC = (P - _1n2) / _2n2;
  let Q, S, Z;
  for (Q = P - _1n2, S = 0; Q % _2n2 === _0n2; Q /= _2n2, S++)
    ;
  for (Z = _2n2; Z < P && pow(Z, legendreC, P) !== P - _1n2; Z++)
    ;
  if (S === 1) {
    const p1div4 = (P + _1n2) / _4n;
    return /* @__PURE__ */ __name(function tonelliFast(Fp2, n) {
      const root = Fp2.pow(n, p1div4);
      if (!Fp2.eql(Fp2.sqr(root), n))
        throw new Error("Cannot find square root");
      return root;
    }, "tonelliFast");
  }
  const Q1div2 = (Q + _1n2) / _2n2;
  return /* @__PURE__ */ __name(function tonelliSlow(Fp2, n) {
    if (Fp2.pow(n, legendreC) === Fp2.neg(Fp2.ONE))
      throw new Error("Cannot find square root");
    let r = S;
    let g = Fp2.pow(Fp2.mul(Fp2.ONE, Z), Q);
    let x = Fp2.pow(n, Q1div2);
    let b = Fp2.pow(n, Q);
    while (!Fp2.eql(b, Fp2.ONE)) {
      if (Fp2.eql(b, Fp2.ZERO))
        return Fp2.ZERO;
      let m = 1;
      for (let t2 = Fp2.sqr(b); m < r; m++) {
        if (Fp2.eql(t2, Fp2.ONE))
          break;
        t2 = Fp2.sqr(t2);
      }
      const ge = Fp2.pow(g, _1n2 << BigInt(r - m - 1));
      g = Fp2.sqr(ge);
      x = Fp2.mul(x, ge);
      b = Fp2.mul(b, g);
      r = m;
    }
    return x;
  }, "tonelliSlow");
}
__name(tonelliShanks, "tonelliShanks");
function FpSqrt(P) {
  if (P % _4n === _3n) {
    const p1div4 = (P + _1n2) / _4n;
    return /* @__PURE__ */ __name(function sqrt3mod4(Fp2, n) {
      const root = Fp2.pow(n, p1div4);
      if (!Fp2.eql(Fp2.sqr(root), n))
        throw new Error("Cannot find square root");
      return root;
    }, "sqrt3mod4");
  }
  if (P % _8n === _5n) {
    const c1 = (P - _5n) / _8n;
    return /* @__PURE__ */ __name(function sqrt5mod8(Fp2, n) {
      const n2 = Fp2.mul(n, _2n2);
      const v = Fp2.pow(n2, c1);
      const nv = Fp2.mul(n, v);
      const i = Fp2.mul(Fp2.mul(nv, _2n2), v);
      const root = Fp2.mul(nv, Fp2.sub(i, Fp2.ONE));
      if (!Fp2.eql(Fp2.sqr(root), n))
        throw new Error("Cannot find square root");
      return root;
    }, "sqrt5mod8");
  }
  if (P % _16n === _9n) {
  }
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
    BYTES: "isSafeInteger",
    BITS: "isSafeInteger"
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  return validateObject(field, opts);
}
__name(validateField, "validateField");
function FpPow(f, num2, power) {
  if (power < _0n2)
    throw new Error("Expected power > 0");
  if (power === _0n2)
    return f.ONE;
  if (power === _1n2)
    return num2;
  let p = f.ONE;
  let d = num2;
  while (power > _0n2) {
    if (power & _1n2)
      p = f.mul(p, d);
    d = f.sqr(d);
    power >>= _1n2;
  }
  return p;
}
__name(FpPow, "FpPow");
function FpInvertBatch(f, nums) {
  const tmp = new Array(nums.length);
  const lastMultiplied = nums.reduce((acc, num2, i) => {
    if (f.is0(num2))
      return acc;
    tmp[i] = acc;
    return f.mul(acc, num2);
  }, f.ONE);
  const inverted = f.inv(lastMultiplied);
  nums.reduceRight((acc, num2, i) => {
    if (f.is0(num2))
      return acc;
    tmp[i] = f.mul(acc, tmp[i]);
    return f.mul(acc, num2);
  }, inverted);
  return tmp;
}
__name(FpInvertBatch, "FpInvertBatch");
function nLength(n, nBitLength) {
  const _nBitLength = nBitLength !== void 0 ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
__name(nLength, "nLength");
function Field(ORDER, bitLen2, isLE2 = false, redef = {}) {
  if (ORDER <= _0n2)
    throw new Error(`Expected Field ORDER > 0, got ${ORDER}`);
  const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, bitLen2);
  if (BYTES > 2048)
    throw new Error("Field lengths over 2048 bytes are not supported");
  const sqrtP = FpSqrt(ORDER);
  const f = Object.freeze({
    ORDER,
    BITS,
    BYTES,
    MASK: bitMask(BITS),
    ZERO: _0n2,
    ONE: _1n2,
    create: /* @__PURE__ */ __name((num2) => mod(num2, ORDER), "create"),
    isValid: /* @__PURE__ */ __name((num2) => {
      if (typeof num2 !== "bigint")
        throw new Error(`Invalid field element: expected bigint, got ${typeof num2}`);
      return _0n2 <= num2 && num2 < ORDER;
    }, "isValid"),
    is0: /* @__PURE__ */ __name((num2) => num2 === _0n2, "is0"),
    isOdd: /* @__PURE__ */ __name((num2) => (num2 & _1n2) === _1n2, "isOdd"),
    neg: /* @__PURE__ */ __name((num2) => mod(-num2, ORDER), "neg"),
    eql: /* @__PURE__ */ __name((lhs, rhs) => lhs === rhs, "eql"),
    sqr: /* @__PURE__ */ __name((num2) => mod(num2 * num2, ORDER), "sqr"),
    add: /* @__PURE__ */ __name((lhs, rhs) => mod(lhs + rhs, ORDER), "add"),
    sub: /* @__PURE__ */ __name((lhs, rhs) => mod(lhs - rhs, ORDER), "sub"),
    mul: /* @__PURE__ */ __name((lhs, rhs) => mod(lhs * rhs, ORDER), "mul"),
    pow: /* @__PURE__ */ __name((num2, power) => FpPow(f, num2, power), "pow"),
    div: /* @__PURE__ */ __name((lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER), "div"),
    // Same as above, but doesn't normalize
    sqrN: /* @__PURE__ */ __name((num2) => num2 * num2, "sqrN"),
    addN: /* @__PURE__ */ __name((lhs, rhs) => lhs + rhs, "addN"),
    subN: /* @__PURE__ */ __name((lhs, rhs) => lhs - rhs, "subN"),
    mulN: /* @__PURE__ */ __name((lhs, rhs) => lhs * rhs, "mulN"),
    inv: /* @__PURE__ */ __name((num2) => invert(num2, ORDER), "inv"),
    sqrt: redef.sqrt || ((n) => sqrtP(f, n)),
    invertBatch: /* @__PURE__ */ __name((lst) => FpInvertBatch(f, lst), "invertBatch"),
    // TODO: do we really need constant cmov?
    // We don't have const-time bigints anyway, so probably will be not very useful
    cmov: /* @__PURE__ */ __name((a, b, c) => c ? b : a, "cmov"),
    toBytes: /* @__PURE__ */ __name((num2) => isLE2 ? numberToBytesLE(num2, BYTES) : numberToBytesBE(num2, BYTES), "toBytes"),
    fromBytes: /* @__PURE__ */ __name((bytes2) => {
      if (bytes2.length !== BYTES)
        throw new Error(`Fp.fromBytes: expected ${BYTES}, got ${bytes2.length}`);
      return isLE2 ? bytesToNumberLE(bytes2) : bytesToNumberBE(bytes2);
    }, "fromBytes")
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
function mapHashToField(key, fieldOrder, isLE2 = false) {
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = getMinHashLength(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error(`expected ${minLen}-1024 bytes of input, got ${len}`);
  const num2 = isLE2 ? bytesToNumberBE(key) : bytesToNumberLE(key);
  const reduced = mod(num2, fieldOrder - _1n2) + _1n2;
  return isLE2 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}
__name(mapHashToField, "mapHashToField");

// ../../../node_modules/@noble/curves/esm/abstract/curve.js
var _0n3 = BigInt(0);
var _1n3 = BigInt(1);
var pointPrecomputes = /* @__PURE__ */ new WeakMap();
var pointWindowSizes = /* @__PURE__ */ new WeakMap();
function wNAF(c, bits) {
  const constTimeNegate = /* @__PURE__ */ __name((condition, item) => {
    const neg = item.negate();
    return condition ? neg : item;
  }, "constTimeNegate");
  const validateW = /* @__PURE__ */ __name((W) => {
    if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
      throw new Error(`Wrong window size=${W}, should be [1..${bits}]`);
  }, "validateW");
  const opts = /* @__PURE__ */ __name((W) => {
    validateW(W);
    const windows = Math.ceil(bits / W) + 1;
    const windowSize = 2 ** (W - 1);
    return { windows, windowSize };
  }, "opts");
  return {
    constTimeNegate,
    // non-const time multiplication ladder
    unsafeLadder(elm, n) {
      let p = c.ZERO;
      let d = elm;
      while (n > _0n3) {
        if (n & _1n3)
          p = p.add(d);
        d = d.double();
        n >>= _1n3;
      }
      return p;
    },
    /**
     * Creates a wNAF precomputation window. Used for caching.
     * Default window size is set by `utils.precompute()` and is equal to 8.
     * Number of precomputed points depends on the curve size:
     * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
     * - 𝑊 is the window size
     * - 𝑛 is the bitlength of the curve order.
     * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
     * @returns precomputed point tables flattened to a single array
     */
    precomputeWindow(elm, W) {
      const { windows, windowSize } = opts(W);
      const points = [];
      let p = elm;
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
    },
    /**
     * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
     * @param W window size
     * @param precomputes precomputed tables
     * @param n scalar (we don't check here, but should be less than curve order)
     * @returns real and fake (for const-time) points
     */
    wNAF(W, precomputes, n) {
      const { windows, windowSize } = opts(W);
      let p = c.ZERO;
      let f = c.BASE;
      const mask = BigInt(2 ** W - 1);
      const maxNumber = 2 ** W;
      const shiftBy = BigInt(W);
      for (let window = 0; window < windows; window++) {
        const offset = window * windowSize;
        let wbits = Number(n & mask);
        n >>= shiftBy;
        if (wbits > windowSize) {
          wbits -= maxNumber;
          n += _1n3;
        }
        const offset1 = offset;
        const offset2 = offset + Math.abs(wbits) - 1;
        const cond1 = window % 2 !== 0;
        const cond2 = wbits < 0;
        if (wbits === 0) {
          f = f.add(constTimeNegate(cond1, precomputes[offset1]));
        } else {
          p = p.add(constTimeNegate(cond2, precomputes[offset2]));
        }
      }
      return { p, f };
    },
    wNAFCached(P, n, transform) {
      const W = pointWindowSizes.get(P) || 1;
      let comp = pointPrecomputes.get(P);
      if (!comp) {
        comp = this.precomputeWindow(P, W);
        if (W !== 1)
          pointPrecomputes.set(P, transform(comp));
      }
      return this.wNAF(W, comp, n);
    },
    // We calculate precomputes for elliptic curve point multiplication
    // using windowed method. This specifies window size and
    // stores precomputed values. Usually only base point would be precomputed.
    setWindowSize(P, W) {
      validateW(W);
      pointWindowSizes.set(P, W);
      pointPrecomputes.delete(P);
    }
  };
}
__name(wNAF, "wNAF");
function pippenger(c, field, points, scalars) {
  if (!Array.isArray(points) || !Array.isArray(scalars) || scalars.length !== points.length)
    throw new Error("arrays of points and scalars must have equal length");
  scalars.forEach((s, i) => {
    if (!field.isValid(s))
      throw new Error(`wrong scalar at index ${i}`);
  });
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error(`wrong point at index ${i}`);
  });
  const wbits = bitLen(BigInt(points.length));
  const windowSize = wbits > 12 ? wbits - 3 : wbits > 4 ? wbits - 2 : wbits ? 2 : 1;
  const MASK = (1 << windowSize) - 1;
  const buckets = new Array(MASK + 1).fill(c.ZERO);
  const lastBits = Math.floor((field.BITS - 1) / windowSize) * windowSize;
  let sum = c.ZERO;
  for (let i = lastBits; i >= 0; i -= windowSize) {
    buckets.fill(c.ZERO);
    for (let j = 0; j < scalars.length; j++) {
      const scalar = scalars[j];
      const wbits2 = Number(scalar >> BigInt(i) & BigInt(MASK));
      buckets[wbits2] = buckets[wbits2].add(points[j]);
    }
    let resI = c.ZERO;
    for (let j = buckets.length - 1, sumI = c.ZERO; j > 0; j--) {
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
function validateBasic(curve) {
  validateField(curve.Fp);
  validateObject(curve, {
    n: "bigint",
    h: "bigint",
    Gx: "field",
    Gy: "field"
  }, {
    nBitLength: "isSafeInteger",
    nByteLength: "isSafeInteger"
  });
  return Object.freeze({
    ...nLength(curve.n, curve.nBitLength),
    ...curve,
    ...{ p: curve.Fp.ORDER }
  });
}
__name(validateBasic, "validateBasic");

// ../../../node_modules/@noble/curves/esm/abstract/weierstrass.js
function validateSigVerOpts(opts) {
  if (opts.lowS !== void 0)
    abool("lowS", opts.lowS);
  if (opts.prehash !== void 0)
    abool("prehash", opts.prehash);
}
__name(validateSigVerOpts, "validateSigVerOpts");
function validatePointOpts(curve) {
  const opts = validateBasic(curve);
  validateObject(opts, {
    a: "field",
    b: "field"
  }, {
    allowedPrivateKeyLengths: "array",
    wrapPrivateKey: "boolean",
    isTorsionFree: "function",
    clearCofactor: "function",
    allowInfinityPoint: "boolean",
    fromBytes: "function",
    toBytes: "function"
  });
  const { endo, Fp: Fp2, a } = opts;
  if (endo) {
    if (!Fp2.eql(a, Fp2.ZERO)) {
      throw new Error("Endomorphism can only be defined for Koblitz curves that have a=0");
    }
    if (typeof endo !== "object" || typeof endo.beta !== "bigint" || typeof endo.splitScalar !== "function") {
      throw new Error("Expected endomorphism with beta: bigint and splitScalar: function");
    }
  }
  return Object.freeze({ ...opts });
}
__name(validatePointOpts, "validatePointOpts");
var { bytesToNumberBE: b2n, hexToBytes: h2b } = utils_exports;
var _a;
var DER = {
  // asn.1 DER encoding utils
  Err: (_a = class extends Error {
    constructor(m = "") {
      super(m);
    }
  }, __name(_a, "DERErr"), _a),
  // Basic building block is TLV (Tag-Length-Value)
  _tlv: {
    encode: /* @__PURE__ */ __name((tag, data) => {
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
      return `${numberToHexUnpadded(tag)}${lenLen}${len}${data}`;
    }, "encode"),
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
        throw new E("unexpected assertion");
      return hex;
    },
    decode(data) {
      const { Err: E } = DER;
      if (data[0] & 128)
        throw new E("Invalid signature integer: negative");
      if (data[0] === 0 && !(data[1] & 128))
        throw new E("Invalid signature integer: unnecessary leading zero");
      return b2n(data);
    }
  },
  toSig(hex) {
    const { Err: E, _int: int, _tlv: tlv } = DER;
    const data = typeof hex === "string" ? h2b(hex) : hex;
    abytes(data);
    const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
    if (seqLeftBytes.length)
      throw new E("Invalid signature: left bytes after parsing");
    const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
    const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
    if (sLeftBytes.length)
      throw new E("Invalid signature: left bytes after parsing");
    return { r: int.decode(rBytes), s: int.decode(sBytes) };
  },
  hexFromSig(sig) {
    const { _tlv: tlv, _int: int } = DER;
    const seq = `${tlv.encode(2, int.encode(sig.r))}${tlv.encode(2, int.encode(sig.s))}`;
    return tlv.encode(48, seq);
  }
};
var _0n4 = BigInt(0);
var _1n4 = BigInt(1);
var _2n3 = BigInt(2);
var _3n2 = BigInt(3);
var _4n2 = BigInt(4);
function weierstrassPoints(opts) {
  const CURVE = validatePointOpts(opts);
  const { Fp: Fp2 } = CURVE;
  const Fn = Field(CURVE.n, CURVE.nBitLength);
  const toBytes2 = CURVE.toBytes || ((_c, point, _isCompressed) => {
    const a = point.toAffine();
    return concatBytes2(Uint8Array.from([4]), Fp2.toBytes(a.x), Fp2.toBytes(a.y));
  });
  const fromBytes = CURVE.fromBytes || ((bytes2) => {
    const tail = bytes2.subarray(1);
    const x = Fp2.fromBytes(tail.subarray(0, Fp2.BYTES));
    const y = Fp2.fromBytes(tail.subarray(Fp2.BYTES, 2 * Fp2.BYTES));
    return { x, y };
  });
  function weierstrassEquation(x) {
    const { a, b } = CURVE;
    const x2 = Fp2.sqr(x);
    const x3 = Fp2.mul(x2, x);
    return Fp2.add(Fp2.add(x3, Fp2.mul(x, a)), b);
  }
  __name(weierstrassEquation, "weierstrassEquation");
  if (!Fp2.eql(Fp2.sqr(CURVE.Gy), weierstrassEquation(CURVE.Gx)))
    throw new Error("bad generator point: equation left != right");
  function isWithinCurveOrder(num2) {
    return inRange(num2, _1n4, CURVE.n);
  }
  __name(isWithinCurveOrder, "isWithinCurveOrder");
  function normPrivateKeyToScalar(key) {
    const { allowedPrivateKeyLengths: lengths, nByteLength, wrapPrivateKey, n: N } = CURVE;
    if (lengths && typeof key !== "bigint") {
      if (isBytes2(key))
        key = bytesToHex(key);
      if (typeof key !== "string" || !lengths.includes(key.length))
        throw new Error("Invalid key");
      key = key.padStart(nByteLength * 2, "0");
    }
    let num2;
    try {
      num2 = typeof key === "bigint" ? key : bytesToNumberBE(ensureBytes("private key", key, nByteLength));
    } catch (error) {
      throw new Error(`private key must be ${nByteLength} bytes, hex or bigint, not ${typeof key}`);
    }
    if (wrapPrivateKey)
      num2 = mod(num2, N);
    aInRange("private key", num2, _1n4, N);
    return num2;
  }
  __name(normPrivateKeyToScalar, "normPrivateKeyToScalar");
  function assertPrjPoint(other) {
    if (!(other instanceof Point2))
      throw new Error("ProjectivePoint expected");
  }
  __name(assertPrjPoint, "assertPrjPoint");
  const toAffineMemo = memoized((p, iz) => {
    const { px: x, py: y, pz: z } = p;
    if (Fp2.eql(z, Fp2.ONE))
      return { x, y };
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? Fp2.ONE : Fp2.inv(z);
    const ax = Fp2.mul(x, iz);
    const ay = Fp2.mul(y, iz);
    const zz = Fp2.mul(z, iz);
    if (is0)
      return { x: Fp2.ZERO, y: Fp2.ZERO };
    if (!Fp2.eql(zz, Fp2.ONE))
      throw new Error("invZ was invalid");
    return { x: ax, y: ay };
  });
  const assertValidMemo = memoized((p) => {
    if (p.is0()) {
      if (CURVE.allowInfinityPoint && !Fp2.is0(p.py))
        return;
      throw new Error("bad point: ZERO");
    }
    const { x, y } = p.toAffine();
    if (!Fp2.isValid(x) || !Fp2.isValid(y))
      throw new Error("bad point: x or y not FE");
    const left = Fp2.sqr(y);
    const right = weierstrassEquation(x);
    if (!Fp2.eql(left, right))
      throw new Error("bad point: equation left != right");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    return true;
  });
  const _Point = class _Point {
    constructor(px, py, pz) {
      this.px = px;
      this.py = py;
      this.pz = pz;
      if (px == null || !Fp2.isValid(px))
        throw new Error("x required");
      if (py == null || !Fp2.isValid(py))
        throw new Error("y required");
      if (pz == null || !Fp2.isValid(pz))
        throw new Error("z required");
      Object.freeze(this);
    }
    // Does not validate if the point is on-curve.
    // Use fromHex instead, or call assertValidity() later.
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp2.isValid(x) || !Fp2.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof _Point)
        throw new Error("projective point not allowed");
      const is0 = /* @__PURE__ */ __name((i) => Fp2.eql(i, Fp2.ZERO), "is0");
      if (is0(x) && is0(y))
        return _Point.ZERO;
      return new _Point(x, y, Fp2.ONE);
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     * Takes a bunch of Projective Points but executes only one
     * inversion on all of them. Inversion is very slow operation,
     * so this improves performance massively.
     * Optimization: converts a list of projective points to a list of identical points with Z=1.
     */
    static normalizeZ(points) {
      const toInv = Fp2.invertBatch(points.map((p) => p.pz));
      return points.map((p, i) => p.toAffine(toInv[i])).map(_Point.fromAffine);
    }
    /**
     * Converts hash string or Uint8Array to Point.
     * @param hex short/long ECDSA hex
     */
    static fromHex(hex) {
      const P = _Point.fromAffine(fromBytes(ensureBytes("pointHex", hex)));
      P.assertValidity();
      return P;
    }
    // Multiplies generator point by privateKey.
    static fromPrivateKey(privateKey) {
      return _Point.BASE.multiply(normPrivateKeyToScalar(privateKey));
    }
    // Multiscalar Multiplication
    static msm(points, scalars) {
      return pippenger(_Point, Fn, points, scalars);
    }
    // "Private method", don't use it directly
    _setWindowSize(windowSize) {
      wnaf.setWindowSize(this, windowSize);
    }
    // A point on curve is valid if it conforms to equation.
    assertValidity() {
      assertValidMemo(this);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (Fp2.isOdd)
        return !Fp2.isOdd(y);
      throw new Error("Field doesn't support isOdd");
    }
    /**
     * Compare one point to another.
     */
    equals(other) {
      assertPrjPoint(other);
      const { px: X1, py: Y1, pz: Z1 } = this;
      const { px: X2, py: Y2, pz: Z2 } = other;
      const U1 = Fp2.eql(Fp2.mul(X1, Z2), Fp2.mul(X2, Z1));
      const U2 = Fp2.eql(Fp2.mul(Y1, Z2), Fp2.mul(Y2, Z1));
      return U1 && U2;
    }
    /**
     * Flips point to one corresponding to (x, -y) in Affine coordinates.
     */
    negate() {
      return new _Point(this.px, Fp2.neg(this.py), this.pz);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp2.mul(b, _3n2);
      const { px: X1, py: Y1, pz: Z1 } = this;
      let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
      let t0 = Fp2.mul(X1, X1);
      let t1 = Fp2.mul(Y1, Y1);
      let t2 = Fp2.mul(Z1, Z1);
      let t3 = Fp2.mul(X1, Y1);
      t3 = Fp2.add(t3, t3);
      Z3 = Fp2.mul(X1, Z1);
      Z3 = Fp2.add(Z3, Z3);
      X3 = Fp2.mul(a, Z3);
      Y3 = Fp2.mul(b3, t2);
      Y3 = Fp2.add(X3, Y3);
      X3 = Fp2.sub(t1, Y3);
      Y3 = Fp2.add(t1, Y3);
      Y3 = Fp2.mul(X3, Y3);
      X3 = Fp2.mul(t3, X3);
      Z3 = Fp2.mul(b3, Z3);
      t2 = Fp2.mul(a, t2);
      t3 = Fp2.sub(t0, t2);
      t3 = Fp2.mul(a, t3);
      t3 = Fp2.add(t3, Z3);
      Z3 = Fp2.add(t0, t0);
      t0 = Fp2.add(Z3, t0);
      t0 = Fp2.add(t0, t2);
      t0 = Fp2.mul(t0, t3);
      Y3 = Fp2.add(Y3, t0);
      t2 = Fp2.mul(Y1, Z1);
      t2 = Fp2.add(t2, t2);
      t0 = Fp2.mul(t2, t3);
      X3 = Fp2.sub(X3, t0);
      Z3 = Fp2.mul(t2, t1);
      Z3 = Fp2.add(Z3, Z3);
      Z3 = Fp2.add(Z3, Z3);
      return new _Point(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      assertPrjPoint(other);
      const { px: X1, py: Y1, pz: Z1 } = this;
      const { px: X2, py: Y2, pz: Z2 } = other;
      let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
      const a = CURVE.a;
      const b3 = Fp2.mul(CURVE.b, _3n2);
      let t0 = Fp2.mul(X1, X2);
      let t1 = Fp2.mul(Y1, Y2);
      let t2 = Fp2.mul(Z1, Z2);
      let t3 = Fp2.add(X1, Y1);
      let t4 = Fp2.add(X2, Y2);
      t3 = Fp2.mul(t3, t4);
      t4 = Fp2.add(t0, t1);
      t3 = Fp2.sub(t3, t4);
      t4 = Fp2.add(X1, Z1);
      let t5 = Fp2.add(X2, Z2);
      t4 = Fp2.mul(t4, t5);
      t5 = Fp2.add(t0, t2);
      t4 = Fp2.sub(t4, t5);
      t5 = Fp2.add(Y1, Z1);
      X3 = Fp2.add(Y2, Z2);
      t5 = Fp2.mul(t5, X3);
      X3 = Fp2.add(t1, t2);
      t5 = Fp2.sub(t5, X3);
      Z3 = Fp2.mul(a, t4);
      X3 = Fp2.mul(b3, t2);
      Z3 = Fp2.add(X3, Z3);
      X3 = Fp2.sub(t1, Z3);
      Z3 = Fp2.add(t1, Z3);
      Y3 = Fp2.mul(X3, Z3);
      t1 = Fp2.add(t0, t0);
      t1 = Fp2.add(t1, t0);
      t2 = Fp2.mul(a, t2);
      t4 = Fp2.mul(b3, t4);
      t1 = Fp2.add(t1, t2);
      t2 = Fp2.sub(t0, t2);
      t2 = Fp2.mul(a, t2);
      t4 = Fp2.add(t4, t2);
      t0 = Fp2.mul(t1, t4);
      Y3 = Fp2.add(Y3, t0);
      t0 = Fp2.mul(t5, t4);
      X3 = Fp2.mul(t3, X3);
      X3 = Fp2.sub(X3, t0);
      t0 = Fp2.mul(t3, t1);
      Z3 = Fp2.mul(t5, Z3);
      Z3 = Fp2.add(Z3, t0);
      return new _Point(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(_Point.ZERO);
    }
    wNAF(n) {
      return wnaf.wNAFCached(this, n, _Point.normalizeZ);
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed private key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(sc) {
      aInRange("scalar", sc, _0n4, CURVE.n);
      const I = _Point.ZERO;
      if (sc === _0n4)
        return I;
      if (sc === _1n4)
        return this;
      const { endo } = CURVE;
      if (!endo)
        return wnaf.unsafeLadder(this, sc);
      let { k1neg, k1, k2neg, k2 } = endo.splitScalar(sc);
      let k1p = I;
      let k2p = I;
      let d = this;
      while (k1 > _0n4 || k2 > _0n4) {
        if (k1 & _1n4)
          k1p = k1p.add(d);
        if (k2 & _1n4)
          k2p = k2p.add(d);
        d = d.double();
        k1 >>= _1n4;
        k2 >>= _1n4;
      }
      if (k1neg)
        k1p = k1p.negate();
      if (k2neg)
        k2p = k2p.negate();
      k2p = new _Point(Fp2.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
      return k1p.add(k2p);
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
      const { endo, n: N } = CURVE;
      aInRange("scalar", scalar, _1n4, N);
      let point, fake;
      if (endo) {
        const { k1neg, k1, k2neg, k2 } = endo.splitScalar(scalar);
        let { p: k1p, f: f1p } = this.wNAF(k1);
        let { p: k2p, f: f2p } = this.wNAF(k2);
        k1p = wnaf.constTimeNegate(k1neg, k1p);
        k2p = wnaf.constTimeNegate(k2neg, k2p);
        k2p = new _Point(Fp2.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
        point = k1p.add(k2p);
        fake = f1p.add(f2p);
      } else {
        const { p, f } = this.wNAF(scalar);
        point = p;
        fake = f;
      }
      return _Point.normalizeZ([point, fake])[0];
    }
    /**
     * Efficiently calculate `aP + bQ`. Unsafe, can expose private key, if used incorrectly.
     * Not using Strauss-Shamir trick: precomputation tables are faster.
     * The trick could be useful if both P and Q are not G (not in our case).
     * @returns non-zero affine point
     */
    multiplyAndAddUnsafe(Q, a, b) {
      const G = _Point.BASE;
      const mul = /* @__PURE__ */ __name((P, a2) => a2 === _0n4 || a2 === _1n4 || !P.equals(G) ? P.multiplyUnsafe(a2) : P.multiply(a2), "mul");
      const sum = mul(this, a).add(mul(Q, b));
      return sum.is0() ? void 0 : sum;
    }
    // Converts Projective point to affine (x, y) coordinates.
    // Can accept precomputed Z^-1 - for example, from invertBatch.
    // (x, y, z) ∋ (x=x/z, y=y/z)
    toAffine(iz) {
      return toAffineMemo(this, iz);
    }
    isTorsionFree() {
      const { h: cofactor, isTorsionFree } = CURVE;
      if (cofactor === _1n4)
        return true;
      if (isTorsionFree)
        return isTorsionFree(_Point, this);
      throw new Error("isTorsionFree() has not been declared for the elliptic curve");
    }
    clearCofactor() {
      const { h: cofactor, clearCofactor } = CURVE;
      if (cofactor === _1n4)
        return this;
      if (clearCofactor)
        return clearCofactor(_Point, this);
      return this.multiplyUnsafe(CURVE.h);
    }
    toRawBytes(isCompressed = true) {
      abool("isCompressed", isCompressed);
      this.assertValidity();
      return toBytes2(_Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      abool("isCompressed", isCompressed);
      return bytesToHex(this.toRawBytes(isCompressed));
    }
  };
  __name(_Point, "Point");
  let Point2 = _Point;
  Point2.BASE = new Point2(CURVE.Gx, CURVE.Gy, Fp2.ONE);
  Point2.ZERO = new Point2(Fp2.ZERO, Fp2.ONE, Fp2.ZERO);
  const _bits = CURVE.nBitLength;
  const wnaf = wNAF(Point2, CURVE.endo ? Math.ceil(_bits / 2) : _bits);
  return {
    CURVE,
    ProjectivePoint: Point2,
    normPrivateKeyToScalar,
    weierstrassEquation,
    isWithinCurveOrder
  };
}
__name(weierstrassPoints, "weierstrassPoints");
function validateOpts(curve) {
  const opts = validateBasic(curve);
  validateObject(opts, {
    hash: "hash",
    hmac: "function",
    randomBytes: "function"
  }, {
    bits2int: "function",
    bits2int_modN: "function",
    lowS: "boolean"
  });
  return Object.freeze({ lowS: true, ...opts });
}
__name(validateOpts, "validateOpts");
function weierstrass(curveDef) {
  const CURVE = validateOpts(curveDef);
  const { Fp: Fp2, n: CURVE_ORDER } = CURVE;
  const compressedLen = Fp2.BYTES + 1;
  const uncompressedLen = 2 * Fp2.BYTES + 1;
  function modN2(a) {
    return mod(a, CURVE_ORDER);
  }
  __name(modN2, "modN");
  function invN(a) {
    return invert(a, CURVE_ORDER);
  }
  __name(invN, "invN");
  const { ProjectivePoint: Point2, normPrivateKeyToScalar, weierstrassEquation, isWithinCurveOrder } = weierstrassPoints({
    ...CURVE,
    toBytes(_c, point, isCompressed) {
      const a = point.toAffine();
      const x = Fp2.toBytes(a.x);
      const cat = concatBytes2;
      abool("isCompressed", isCompressed);
      if (isCompressed) {
        return cat(Uint8Array.from([point.hasEvenY() ? 2 : 3]), x);
      } else {
        return cat(Uint8Array.from([4]), x, Fp2.toBytes(a.y));
      }
    },
    fromBytes(bytes2) {
      const len = bytes2.length;
      const head = bytes2[0];
      const tail = bytes2.subarray(1);
      if (len === compressedLen && (head === 2 || head === 3)) {
        const x = bytesToNumberBE(tail);
        if (!inRange(x, _1n4, Fp2.ORDER))
          throw new Error("Point is not on curve");
        const y2 = weierstrassEquation(x);
        let y;
        try {
          y = Fp2.sqrt(y2);
        } catch (sqrtError) {
          const suffix = sqrtError instanceof Error ? ": " + sqrtError.message : "";
          throw new Error("Point is not on curve" + suffix);
        }
        const isYOdd = (y & _1n4) === _1n4;
        const isHeadOdd = (head & 1) === 1;
        if (isHeadOdd !== isYOdd)
          y = Fp2.neg(y);
        return { x, y };
      } else if (len === uncompressedLen && head === 4) {
        const x = Fp2.fromBytes(tail.subarray(0, Fp2.BYTES));
        const y = Fp2.fromBytes(tail.subarray(Fp2.BYTES, 2 * Fp2.BYTES));
        return { x, y };
      } else {
        throw new Error(`Point of length ${len} was invalid. Expected ${compressedLen} compressed bytes or ${uncompressedLen} uncompressed bytes`);
      }
    }
  });
  const numToNByteStr = /* @__PURE__ */ __name((num2) => bytesToHex(numberToBytesBE(num2, CURVE.nByteLength)), "numToNByteStr");
  function isBiggerThanHalfOrder(number2) {
    const HALF = CURVE_ORDER >> _1n4;
    return number2 > HALF;
  }
  __name(isBiggerThanHalfOrder, "isBiggerThanHalfOrder");
  function normalizeS(s) {
    return isBiggerThanHalfOrder(s) ? modN2(-s) : s;
  }
  __name(normalizeS, "normalizeS");
  const slcNum = /* @__PURE__ */ __name((b, from, to) => bytesToNumberBE(b.slice(from, to)), "slcNum");
  const _Signature = class _Signature {
    constructor(r, s, recovery) {
      this.r = r;
      this.s = s;
      this.recovery = recovery;
      this.assertValidity();
    }
    // pair (bytes of r, bytes of s)
    static fromCompact(hex) {
      const l = CURVE.nByteLength;
      hex = ensureBytes("compactSignature", hex, l * 2);
      return new _Signature(slcNum(hex, 0, l), slcNum(hex, l, 2 * l));
    }
    // DER encoded ECDSA signature
    // https://bitcoin.stackexchange.com/questions/57644/what-are-the-parts-of-a-bitcoin-transaction-input-script
    static fromDER(hex) {
      const { r, s } = DER.toSig(ensureBytes("DER", hex));
      return new _Signature(r, s);
    }
    assertValidity() {
      aInRange("r", this.r, _1n4, CURVE_ORDER);
      aInRange("s", this.s, _1n4, CURVE_ORDER);
    }
    addRecoveryBit(recovery) {
      return new _Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(msgHash) {
      const { r, s, recovery: rec } = this;
      const h = bits2int_modN(ensureBytes("msgHash", msgHash));
      if (rec == null || ![0, 1, 2, 3].includes(rec))
        throw new Error("recovery id invalid");
      const radj = rec === 2 || rec === 3 ? r + CURVE.n : r;
      if (radj >= Fp2.ORDER)
        throw new Error("recovery id 2 or 3 invalid");
      const prefix = (rec & 1) === 0 ? "02" : "03";
      const R = Point2.fromHex(prefix + numToNByteStr(radj));
      const ir = invN(radj);
      const u1 = modN2(-h * ir);
      const u2 = modN2(s * ir);
      const Q = Point2.BASE.multiplyAndAddUnsafe(R, u1, u2);
      if (!Q)
        throw new Error("point at infinify");
      Q.assertValidity();
      return Q;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    normalizeS() {
      return this.hasHighS() ? new _Signature(this.r, modN2(-this.s), this.recovery) : this;
    }
    // DER-encoded
    toDERRawBytes() {
      return hexToBytes(this.toDERHex());
    }
    toDERHex() {
      return DER.hexFromSig({ r: this.r, s: this.s });
    }
    // padded bytes of r, then padded bytes of s
    toCompactRawBytes() {
      return hexToBytes(this.toCompactHex());
    }
    toCompactHex() {
      return numToNByteStr(this.r) + numToNByteStr(this.s);
    }
  };
  __name(_Signature, "Signature");
  let Signature = _Signature;
  const utils = {
    isValidPrivateKey(privateKey) {
      try {
        normPrivateKeyToScalar(privateKey);
        return true;
      } catch (error) {
        return false;
      }
    },
    normPrivateKeyToScalar,
    /**
     * Produces cryptographically secure private key from random of size
     * (groupLen + ceil(groupLen / 2)) with modulo bias being negligible.
     */
    randomPrivateKey: /* @__PURE__ */ __name(() => {
      const length = getMinHashLength(CURVE.n);
      return mapHashToField(CURVE.randomBytes(length), CURVE.n);
    }, "randomPrivateKey"),
    /**
     * Creates precompute table for an arbitrary EC point. Makes point "cached".
     * Allows to massively speed-up `point.multiply(scalar)`.
     * @returns cached point
     * @example
     * const fast = utils.precompute(8, ProjectivePoint.fromHex(someonesPubKey));
     * fast.multiply(privKey); // much faster ECDH now
     */
    precompute(windowSize = 8, point = Point2.BASE) {
      point._setWindowSize(windowSize);
      point.multiply(BigInt(3));
      return point;
    }
  };
  function getPublicKey(privateKey, isCompressed = true) {
    return Point2.fromPrivateKey(privateKey).toRawBytes(isCompressed);
  }
  __name(getPublicKey, "getPublicKey");
  function isProbPub(item) {
    const arr = isBytes2(item);
    const str = typeof item === "string";
    const len = (arr || str) && item.length;
    if (arr)
      return len === compressedLen || len === uncompressedLen;
    if (str)
      return len === 2 * compressedLen || len === 2 * uncompressedLen;
    if (item instanceof Point2)
      return true;
    return false;
  }
  __name(isProbPub, "isProbPub");
  function getSharedSecret(privateA, publicB, isCompressed = true) {
    if (isProbPub(privateA))
      throw new Error("first arg must be private key");
    if (!isProbPub(publicB))
      throw new Error("second arg must be public key");
    const b = Point2.fromHex(publicB);
    return b.multiply(normPrivateKeyToScalar(privateA)).toRawBytes(isCompressed);
  }
  __name(getSharedSecret, "getSharedSecret");
  const bits2int = CURVE.bits2int || function(bytes2) {
    const num2 = bytesToNumberBE(bytes2);
    const delta = bytes2.length * 8 - CURVE.nBitLength;
    return delta > 0 ? num2 >> BigInt(delta) : num2;
  };
  const bits2int_modN = CURVE.bits2int_modN || function(bytes2) {
    return modN2(bits2int(bytes2));
  };
  const ORDER_MASK = bitMask(CURVE.nBitLength);
  function int2octets(num2) {
    aInRange(`num < 2^${CURVE.nBitLength}`, num2, _0n4, ORDER_MASK);
    return numberToBytesBE(num2, CURVE.nByteLength);
  }
  __name(int2octets, "int2octets");
  function prepSig(msgHash, privateKey, opts = defaultSigOpts) {
    if (["recovered", "canonical"].some((k) => k in opts))
      throw new Error("sign() legacy options not supported");
    const { hash: hash2, randomBytes: randomBytes2 } = CURVE;
    let { lowS, prehash, extraEntropy: ent } = opts;
    if (lowS == null)
      lowS = true;
    msgHash = ensureBytes("msgHash", msgHash);
    validateSigVerOpts(opts);
    if (prehash)
      msgHash = ensureBytes("prehashed msgHash", hash2(msgHash));
    const h1int = bits2int_modN(msgHash);
    const d = normPrivateKeyToScalar(privateKey);
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (ent != null && ent !== false) {
      const e = ent === true ? randomBytes2(Fp2.BYTES) : ent;
      seedArgs.push(ensureBytes("extraEntropy", e));
    }
    const seed = concatBytes2(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!isWithinCurveOrder(k))
        return;
      const ik = invN(k);
      const q = Point2.BASE.multiply(k).toAffine();
      const r = modN2(q.x);
      if (r === _0n4)
        return;
      const s = modN2(ik * modN2(m + r * d));
      if (s === _0n4)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n4);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = normalizeS(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, recovery);
    }
    __name(k2sig, "k2sig");
    return { seed, k2sig };
  }
  __name(prepSig, "prepSig");
  const defaultSigOpts = { lowS: CURVE.lowS, prehash: false };
  const defaultVerOpts = { lowS: CURVE.lowS, prehash: false };
  function sign(msgHash, privKey, opts = defaultSigOpts) {
    const { seed, k2sig } = prepSig(msgHash, privKey, opts);
    const C = CURVE;
    const drbg = createHmacDrbg(C.hash.outputLen, C.nByteLength, C.hmac);
    return drbg(seed, k2sig);
  }
  __name(sign, "sign");
  Point2.BASE._setWindowSize(8);
  function verify(signature, msgHash, publicKey, opts = defaultVerOpts) {
    const sg = signature;
    msgHash = ensureBytes("msgHash", msgHash);
    publicKey = ensureBytes("publicKey", publicKey);
    if ("strict" in opts)
      throw new Error("options.strict was renamed to lowS");
    validateSigVerOpts(opts);
    const { lowS, prehash } = opts;
    let _sig = void 0;
    let P;
    try {
      if (typeof sg === "string" || isBytes2(sg)) {
        try {
          _sig = Signature.fromDER(sg);
        } catch (derError) {
          if (!(derError instanceof DER.Err))
            throw derError;
          _sig = Signature.fromCompact(sg);
        }
      } else if (typeof sg === "object" && typeof sg.r === "bigint" && typeof sg.s === "bigint") {
        const { r: r2, s: s2 } = sg;
        _sig = new Signature(r2, s2);
      } else {
        throw new Error("PARSE");
      }
      P = Point2.fromHex(publicKey);
    } catch (error) {
      if (error.message === "PARSE")
        throw new Error(`signature must be Signature instance, Uint8Array or hex string`);
      return false;
    }
    if (lowS && _sig.hasHighS())
      return false;
    if (prehash)
      msgHash = CURVE.hash(msgHash);
    const { r, s } = _sig;
    const h = bits2int_modN(msgHash);
    const is = invN(s);
    const u1 = modN2(h * is);
    const u2 = modN2(r * is);
    const R = Point2.BASE.multiplyAndAddUnsafe(P, u1, u2)?.toAffine();
    if (!R)
      return false;
    const v = modN2(R.x);
    return v === r;
  }
  __name(verify, "verify");
  return {
    CURVE,
    getPublicKey,
    getSharedSecret,
    sign,
    verify,
    ProjectivePoint: Point2,
    Signature,
    utils
  };
}
__name(weierstrass, "weierstrass");

// ../../../node_modules/@noble/curves/esm/_shortw_utils.js
function getHash(hash2) {
  return {
    hash: hash2,
    hmac: /* @__PURE__ */ __name((key, ...msgs) => hmac(hash2, key, concatBytes(...msgs)), "hmac"),
    randomBytes
  };
}
__name(getHash, "getHash");
function createCurve(curveDef, defHash) {
  const create = /* @__PURE__ */ __name((hash2) => weierstrass({ ...curveDef, ...getHash(hash2) }), "create");
  return Object.freeze({ ...create(defHash), create });
}
__name(createCurve, "createCurve");

// ../../../node_modules/@noble/curves/esm/secp256k1.js
var secp256k1P = BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f");
var secp256k1N = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
var _1n5 = BigInt(1);
var _2n4 = BigInt(2);
var divNearest = /* @__PURE__ */ __name((a, b) => (a + b / _2n4) / b, "divNearest");
function sqrtMod(y) {
  const P = secp256k1P;
  const _3n3 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n3, P) * b3 % P;
  const b9 = pow2(b6, _3n3, P) * b3 % P;
  const b11 = pow2(b9, _2n4, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n3, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n4, P);
  if (!Fp.eql(Fp.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
__name(sqrtMod, "sqrtMod");
var Fp = Field(secp256k1P, void 0, void 0, { sqrt: sqrtMod });
var secp256k1 = createCurve({
  a: BigInt(0),
  // equation params: a, b
  b: BigInt(7),
  // Seem to be rigid: bitcointalk.org/index.php?topic=289795.msg3183975#msg3183975
  Fp,
  // Field's prime: 2n**256n - 2n**32n - 2n**9n - 2n**8n - 2n**7n - 2n**6n - 2n**4n - 1n
  n: secp256k1N,
  // Curve order, total count of valid points in the field
  // Base point (x, y) aka generator point
  Gx: BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),
  Gy: BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),
  h: BigInt(1),
  // Cofactor
  lowS: true,
  // Allow only low-S signatures by default in sign() and verify()
  /**
   * secp256k1 belongs to Koblitz curves: it has efficiently computable endomorphism.
   * Endomorphism uses 2x less RAM, speeds up precomputation by 2x and ECDH / key recovery by 20%.
   * For precomputed wNAF it trades off 1/2 init time & 1/3 ram for 20% perf hit.
   * Explanation: https://gist.github.com/paulmillr/eb670806793e84df628a7c434a873066
   */
  endo: {
    beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
    splitScalar: /* @__PURE__ */ __name((k) => {
      const n = secp256k1N;
      const a1 = BigInt("0x3086d221a7d46bcde86c90e49284eb15");
      const b1 = -_1n5 * BigInt("0xe4437ed6010e88286f547fa90abfe4c3");
      const a2 = BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8");
      const b2 = a1;
      const POW_2_128 = BigInt("0x100000000000000000000000000000000");
      const c1 = divNearest(b2 * k, n);
      const c2 = divNearest(-b1 * k, n);
      let k1 = mod(k - c1 * a1 - c2 * a2, n);
      let k2 = mod(-c1 * b1 - c2 * b2, n);
      const k1neg = k1 > POW_2_128;
      const k2neg = k2 > POW_2_128;
      if (k1neg)
        k1 = n - k1;
      if (k2neg)
        k2 = n - k2;
      if (k1 > POW_2_128 || k2 > POW_2_128) {
        throw new Error("splitScalar: Endomorphism failed, k=" + k);
      }
      return { k1neg, k1, k2neg, k2 };
    }, "splitScalar")
  }
}, sha256);
var _0n5 = BigInt(0);
var TAGGED_HASH_PREFIXES = {};
function taggedHash(tag, ...messages) {
  let tagP = TAGGED_HASH_PREFIXES[tag];
  if (tagP === void 0) {
    const tagH = sha256(Uint8Array.from(tag, (c) => c.charCodeAt(0)));
    tagP = concatBytes2(tagH, tagH);
    TAGGED_HASH_PREFIXES[tag] = tagP;
  }
  return sha256(concatBytes2(tagP, ...messages));
}
__name(taggedHash, "taggedHash");
var pointToBytes = /* @__PURE__ */ __name((point) => point.toRawBytes(true).slice(1), "pointToBytes");
var numTo32b = /* @__PURE__ */ __name((n) => numberToBytesBE(n, 32), "numTo32b");
var modP = /* @__PURE__ */ __name((x) => mod(x, secp256k1P), "modP");
var modN = /* @__PURE__ */ __name((x) => mod(x, secp256k1N), "modN");
var Point = secp256k1.ProjectivePoint;
var GmulAdd = /* @__PURE__ */ __name((Q, a, b) => Point.BASE.multiplyAndAddUnsafe(Q, a, b), "GmulAdd");
function schnorrGetExtPubKey(priv) {
  let d_ = secp256k1.utils.normPrivateKeyToScalar(priv);
  let p = Point.fromPrivateKey(d_);
  const scalar = p.hasEvenY() ? d_ : modN(-d_);
  return { scalar, bytes: pointToBytes(p) };
}
__name(schnorrGetExtPubKey, "schnorrGetExtPubKey");
function lift_x(x) {
  aInRange("x", x, _1n5, secp256k1P);
  const xx = modP(x * x);
  const c = modP(xx * x + BigInt(7));
  let y = sqrtMod(c);
  if (y % _2n4 !== _0n5)
    y = modP(-y);
  const p = new Point(x, y, _1n5);
  p.assertValidity();
  return p;
}
__name(lift_x, "lift_x");
var num = bytesToNumberBE;
function challenge(...args) {
  return modN(num(taggedHash("BIP0340/challenge", ...args)));
}
__name(challenge, "challenge");
function schnorrGetPublicKey(privateKey) {
  return schnorrGetExtPubKey(privateKey).bytes;
}
__name(schnorrGetPublicKey, "schnorrGetPublicKey");
function schnorrSign(message, privateKey, auxRand = randomBytes(32)) {
  const m = ensureBytes("message", message);
  const { bytes: px, scalar: d } = schnorrGetExtPubKey(privateKey);
  const a = ensureBytes("auxRand", auxRand, 32);
  const t = numTo32b(d ^ num(taggedHash("BIP0340/aux", a)));
  const rand = taggedHash("BIP0340/nonce", t, px, m);
  const k_ = modN(num(rand));
  if (k_ === _0n5)
    throw new Error("sign failed: k is zero");
  const { bytes: rx, scalar: k } = schnorrGetExtPubKey(k_);
  const e = challenge(rx, px, m);
  const sig = new Uint8Array(64);
  sig.set(rx, 0);
  sig.set(numTo32b(modN(k + e * d)), 32);
  if (!schnorrVerify(sig, m, px))
    throw new Error("sign: Invalid signature produced");
  return sig;
}
__name(schnorrSign, "schnorrSign");
function schnorrVerify(signature, message, publicKey) {
  const sig = ensureBytes("signature", signature, 64);
  const m = ensureBytes("message", message);
  const pub = ensureBytes("publicKey", publicKey, 32);
  try {
    const P = lift_x(num(pub));
    const r = num(sig.subarray(0, 32));
    if (!inRange(r, _1n5, secp256k1P))
      return false;
    const s = num(sig.subarray(32, 64));
    if (!inRange(s, _1n5, secp256k1N))
      return false;
    const e = challenge(numTo32b(r), pointToBytes(P), m);
    const R = GmulAdd(P, s, modN(-e));
    if (!R || !R.hasEvenY() || R.toAffine().x !== r)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}
__name(schnorrVerify, "schnorrVerify");
var schnorr = /* @__PURE__ */ (() => ({
  getPublicKey: schnorrGetPublicKey,
  sign: schnorrSign,
  verify: schnorrVerify,
  utils: {
    randomPrivateKey: secp256k1.utils.randomPrivateKey,
    lift_x,
    pointToBytes,
    numberToBytesBE,
    bytesToNumberBE,
    taggedHash,
    mod
  }
}))();

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
  allowedNip05Domains: allowedNip05Domains2
} = config_exports;
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
      "INSERT OR REPLACE INTO system_config (key, value) VALUES ('schema_version', '1')"
    ).run();
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
  if (hexString.length % 2 !== 0) throw new Error("Invalid hex string");
  const bytes2 = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes2.length; i++) {
    bytes2[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes2;
}
__name(hexToBytes2, "hexToBytes");
function bytesToHex2(bytes2) {
  return Array.from(bytes2).map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
  if (!PAY_TO_RELAY_ENABLED2) return true;
  try {
    const session = env.relayDb.withSession("first-unconstrained");
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
    const session = env.relayDb.withSession("first-primary");
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
async function processEvent(event, sessionId, env) {
  try {
    const existingEvent = await env.relayDb.withSession("first-unconstrained").prepare("SELECT id FROM events WHERE id = ? LIMIT 1").bind(event.id).first();
    if (existingEvent) {
      console.log(`Duplicate event detected: ${event.id}`);
      return { success: false, message: "duplicate: already have this event" };
    }
    if (checkValidNip052 && event.kind !== 0) {
      const isValidNIP05 = await validateNIP05FromKind0(event.pubkey, env);
      if (!isValidNIP05) {
        console.error(`Event denied. NIP-05 validation failed for pubkey ${event.pubkey}.`);
        return { success: false, message: "invalid: NIP-05 validation failed" };
      }
    }
    if (event.kind === 5) {
      return await processDeletionEvent(event, env);
    }
    const saveResult = await saveEventToD1(event, env);
    return saveResult;
  } catch (error) {
    console.error(`Error processing event: ${error.message}`);
    return { success: false, message: `error: ${error.message}` };
  }
}
__name(processEvent, "processEvent");
async function saveEventToD1(event, env) {
  try {
    const session = env.relayDb.withSession("first-primary");
    if (shouldCheckForDuplicates(event.kind)) {
      const contentHash = await hashContent(event);
      const duplicateCheck = enableGlobalDuplicateCheck2 ? await session.prepare("SELECT event_id FROM content_hashes WHERE hash = ? LIMIT 1").bind(contentHash).first() : await session.prepare("SELECT event_id FROM content_hashes WHERE hash = ? AND pubkey = ? LIMIT 1").bind(contentHash, event.pubkey).first();
      if (duplicateCheck) {
        return { success: false, message: "duplicate: content already exists" };
      }
    }
    await session.prepare(`
      INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(event.id, event.pubkey, event.created_at, event.kind, JSON.stringify(event.tags), event.content, event.sig).run();
    const TAG_CHUNK_SIZE = 50;
    const tagInserts = [];
    for (const tag of event.tags) {
      if (tag[0] && tag[1]) {
        tagInserts.push({ tag_name: tag[0], tag_value: tag[1] });
      }
    }
    for (let i = 0; i < tagInserts.length; i += TAG_CHUNK_SIZE) {
      const chunk = tagInserts.slice(i, i + TAG_CHUNK_SIZE);
      const batch = chunk.map(
        (t) => session.prepare(`
          INSERT INTO tags (event_id, tag_name, tag_value)
          VALUES (?, ?, ?)
        `).bind(event.id, t.tag_name, t.tag_value)
      );
      if (batch.length > 0) {
        await session.batch(batch);
      }
    }
    if (shouldCheckForDuplicates(event.kind)) {
      const contentHash = await hashContent(event);
      await session.prepare(`
        INSERT INTO content_hashes (hash, event_id, pubkey, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(contentHash, event.id, event.pubkey, event.created_at).run();
    }
    console.log(`Event ${event.id} saved successfully to D1.`);
    return { success: true, message: "Event received successfully for processing" };
  } catch (error) {
    console.error(`Error saving event: ${error.message}`);
    console.error(`Event details: ID=${event.id}, Tags count=${event.tags.length}`);
    return { success: false, message: "error: could not save event" };
  }
}
__name(saveEventToD1, "saveEventToD1");
async function processDeletionEvent(event, env) {
  console.log(`Processing deletion event ${event.id}`);
  const deletedEventIds = event.tags.filter((tag) => tag[0] === "e").map((tag) => tag[1]);
  if (deletedEventIds.length === 0) {
    return { success: true, message: "No events to delete" };
  }
  const session = env.relayDb.withSession("first-primary");
  let deletedCount = 0;
  const errors = [];
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
__name(processDeletionEvent, "processDeletionEvent");
function countQueryParameters(filters) {
  let count = 1;
  if (filters.ids) count += filters.ids.length;
  if (filters.authors) count += filters.authors.length;
  if (filters.kinds) count += filters.kinds.length;
  if (filters.since) count += 1;
  if (filters.until) count += 1;
  for (const [key, values] of Object.entries(filters)) {
    if (key.startsWith("#") && Array.isArray(values) && values.length > 0) {
      count += 1 + values.length;
    }
  }
  if (filters.limit) count += 1;
  return count;
}
__name(countQueryParameters, "countQueryParameters");
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
__name(chunkArray, "chunkArray");
async function queryDatabaseChunked(filters, bookmark, env) {
  const session = env.relayDb.withSession(bookmark);
  const allEvents = /* @__PURE__ */ new Map();
  const CHUNK_SIZE = 50;
  const baseFilter = { ...filters };
  const needsChunking = {
    ids: false,
    authors: false,
    kinds: false,
    tags: {}
  };
  if (filters.ids && filters.ids.length > CHUNK_SIZE) {
    needsChunking.ids = true;
    delete baseFilter.ids;
  }
  if (filters.authors && filters.authors.length > CHUNK_SIZE) {
    needsChunking.authors = true;
    delete baseFilter.authors;
  }
  if (filters.kinds && filters.kinds.length > CHUNK_SIZE) {
    needsChunking.kinds = true;
    delete baseFilter.kinds;
  }
  for (const [key, values] of Object.entries(filters)) {
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
        console.log(`Executing chunk query with ${query.params.length} parameters`);
        const result = await session.prepare(query.sql).bind(...query.params).all();
        for (const row of result.results) {
          const event = {
            id: row.id,
            pubkey: row.pubkey,
            created_at: row.created_at,
            kind: row.kind,
            tags: JSON.parse(row.tags),
            content: row.content,
            sig: row.sig
          };
          allEvents.set(event.id, event);
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
        console.log(`Executing chunk query with ${query.params.length} parameters`);
        const result = await session.prepare(query.sql).bind(...query.params).all();
        for (const row of result.results) {
          const event = {
            id: row.id,
            pubkey: row.pubkey,
            created_at: row.created_at,
            kind: row.kind,
            tags: JSON.parse(row.tags),
            content: row.content,
            sig: row.sig
          };
          allEvents.set(event.id, event);
        }
      } catch (error) {
        console.error(`Error in chunk query: ${error}`);
      }
    }
  }, "processNumberChunks");
  if (needsChunking.ids && filters.ids) {
    await processStringChunks("ids", filters.ids);
  }
  if (needsChunking.authors && filters.authors) {
    await processStringChunks("authors", filters.authors);
  }
  if (needsChunking.kinds && filters.kinds) {
    await processNumberChunks("kinds", filters.kinds);
  }
  for (const [tagKey, _] of Object.entries(needsChunking.tags)) {
    const tagValues = filters[tagKey];
    if (Array.isArray(tagValues) && tagValues.every((v) => typeof v === "string")) {
      await processStringChunks(tagKey, tagValues);
    }
  }
  if (!needsChunking.ids && !needsChunking.authors && !needsChunking.kinds && Object.keys(needsChunking.tags).length === 0) {
    const query = buildQuery(filters);
    try {
      const result = await session.prepare(query.sql).bind(...query.params).all();
      for (const row of result.results) {
        const event = {
          id: row.id,
          pubkey: row.pubkey,
          created_at: row.created_at,
          kind: row.kind,
          tags: JSON.parse(row.tags),
          content: row.content,
          sig: row.sig
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
__name(queryDatabaseChunked, "queryDatabaseChunked");
async function queryEvents(filters, bookmark, env) {
  try {
    console.log(`Processing query with ${filters.length} filters and bookmark: ${bookmark}`);
    const session = env.relayDb.withSession(bookmark);
    const eventSet = /* @__PURE__ */ new Map();
    for (const filter of filters) {
      const paramCount = countQueryParameters(filter);
      console.log(`Filter parameter count: ${paramCount}`);
      if (paramCount > 200) {
        console.log(`Query has ${paramCount} parameters, using chunked query...`);
        const chunkedResult = await queryDatabaseChunked(filter, bookmark, env);
        for (const event of chunkedResult.events) {
          eventSet.set(event.id, event);
        }
        continue;
      }
      const safeFilter = { ...filter };
      if (safeFilter.ids && safeFilter.ids.length > 100) {
        console.log(`Large ID filter detected: ${safeFilter.ids.length} IDs. Truncating to 100.`);
        safeFilter.ids = safeFilter.ids.slice(0, 100);
      }
      if (safeFilter.authors && safeFilter.authors.length > 100) {
        console.log(`Large authors filter detected: ${safeFilter.authors.length} authors. Truncating to 100.`);
        safeFilter.authors = safeFilter.authors.slice(0, 100);
      }
      for (const [key, values] of Object.entries(safeFilter)) {
        if (key.startsWith("#") && Array.isArray(values) && values.length > 100) {
          console.log(`Large tag filter detected for ${key}: ${values.length} values. Truncating to 100.`);
          safeFilter[key] = values.slice(0, 100);
        }
      }
      const query = buildQuery(safeFilter);
      console.log(`Executing query: ${query.sql}`);
      console.log(`Query parameters count: ${query.params.length}`);
      try {
        const result = await session.prepare(query.sql).bind(...query.params).all();
        if (result.meta) {
          console.log({
            servedByRegion: result.meta.served_by_region ?? "",
            servedByPrimary: result.meta.served_by_primary ?? false
          });
        }
        for (const row of result.results) {
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
        console.error(`Query execution error: ${error.message}`);
        if (error.message.includes("too many SQL variables")) {
          console.log("Still hit parameter limit, falling back to chunked query");
          const chunkedResult = await queryDatabaseChunked(filter, bookmark, env);
          for (const event of chunkedResult.events) {
            eventSet.set(event.id, event);
          }
        } else {
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
function buildQuery(filter) {
  let sql = "SELECT * FROM events WHERE deleted = 0";
  const params = [];
  const conditions = [];
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
  const tagConditions = [];
  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith("#") && Array.isArray(values) && values.length > 0) {
      const tagName = key.substring(1);
      tagConditions.push(`
        id IN (
          SELECT event_id FROM tags 
          WHERE tag_name = ? AND tag_value IN (${values.map(() => "?").join(",")})
        )
      `);
      params.push(tagName, ...values);
    }
  }
  if (tagConditions.length > 0) {
    conditions.push(`(${tagConditions.join(" OR ")})`);
  }
  if (conditions.length > 0) {
    sql += " AND " + conditions.join(" AND ");
  }
  sql += " ORDER BY created_at DESC";
  sql += " LIMIT ?";
  params.push(Math.min(filter.limit || 1e4, 1e4));
  return { sql, params };
}
__name(buildQuery, "buildQuery");
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
    // South America (all use 'sam' which redirects to 'enam')
    "BR": "sam",
    "AR": "sam",
    "CL": "sam",
    "CO": "sam",
    "PE": "sam",
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
    // Eastern Europe
    "PL": "eeur",
    "RU": "eeur",
    "UA": "eeur",
    "RO": "eeur",
    "CZ": "eeur",
    "HU": "eeur",
    "GR": "eeur",
    "BG": "eeur",
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
    // Oceania
    "AU": "oc",
    "NZ": "oc",
    // Middle East (uses 'me' which redirects to nearby)
    "AE": "me",
    "SA": "me",
    "IL": "me",
    "TR": "me",
    "EG": "me",
    // Africa (uses 'afr' which redirects to nearby)
    "ZA": "afr",
    "NG": "afr",
    "KE": "afr",
    "MA": "afr"
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
    "North Dakota": "enam"
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
      const testResponse = await Promise.race([
        stub2.fetch(new Request("https://internal/health")),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Timeout")), 1e3)
        )
      ]);
      if (testResponse.ok) {
        console.log(`Connected to DO: ${endpoint.name} (hint: ${endpoint.hint})`);
        return { stub: stub2, doName: endpoint.name };
      }
    } catch (error) {
      console.log(`Failed to connect to ${endpoint.name}: ${error}`);
    }
  }
  const fallback = ALL_ENDPOINTS[1];
  const id = env.RELAY_WEBSOCKET.idFromName(fallback.name);
  const stub = env.RELAY_WEBSOCKET.get(id, { locationHint: fallback.hint });
  return { stub, doName: fallback.name };
}
__name(getOptimalDO, "getOptimalDO");
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
            initializeDatabase(env.relayDb).catch((e) => console.error("DB init error:", e))
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
  }
};

// src/durable-object.ts
var _RelayWebSocket = class _RelayWebSocket {
  constructor(state, env) {
    this.processedEvents = /* @__PURE__ */ new Map();
    this.state = state;
    this.sessions = /* @__PURE__ */ new Map();
    this.env = env;
    this.doId = crypto.randomUUID();
    this.region = "unknown";
    this.doName = "unknown";
    this.processedEvents = /* @__PURE__ */ new Map();
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
    const attachment = {
      sessionId,
      bookmark: "first-unconstrained",
      host
    };
    server.serializeAttachment(attachment);
    this.state.acceptWebSocket(server);
    console.log(`New WebSocket session: ${sessionId} on DO ${this.doName}`);
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  // WebSocket Hibernation API handler methods
  async webSocketMessage(ws, message) {
    const attachment = ws.deserializeAttachment();
    if (!attachment) {
      console.error("No session attachment found");
      ws.close(1011, "Session not found");
      return;
    }
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
        host: attachment.host
      };
      this.sessions.set(attachment.sessionId, session);
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
        host: session.host
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
      const { event, sourceDoId, hopCount = 0 } = data;
      if (hopCount > 3) {
        return new Response(JSON.stringify({ success: true, dropped: true }));
      }
      if (this.processedEvents.has(event.id)) {
        return new Response(JSON.stringify({ success: true, duplicate: true }));
      }
      this.processedEvents.set(event.id, Date.now());
      console.log(`DO ${this.doName} received event ${event.id} from ${sourceDoId} (hop ${hopCount})`);
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
      if (!event.id || !event.pubkey || !event.sig || !event.created_at || event.kind === void 0 || !Array.isArray(event.tags) || event.content === void 0) {
        this.sendOK(session.webSocket, event.id || "", false, "invalid: missing required fields");
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
        const hasPaid = await hasPaidForRelay(event.pubkey, this.env);
        if (!hasPaid) {
          const protocol = "https:";
          const relayUrl = `${protocol}//${session.host}`;
          console.error(`Event denied. Pubkey ${event.pubkey} has not paid for relay access.`);
          this.sendOK(session.webSocket, event.id, false, `blocked: payment required. Visit ${relayUrl} to pay for relay access.`);
          return;
        }
      }
      if (!isPubkeyAllowed(event.pubkey)) {
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
      if (result.success) {
        this.sendOK(session.webSocket, event.id, true, result.message);
        this.processedEvents.set(event.id, Date.now());
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
      if (filter.limit && filter.limit > 5e3) {
        this.sendClosed(session.webSocket, subscriptionId, "invalid: limit too high (max 5000)");
        return;
      }
      if (!filter.limit) {
        filter.limit = 5e3;
      }
    }
    session.subscriptions.set(subscriptionId, filters);
    await this.saveSubscriptions(session.id, session.subscriptions);
    console.log(`New subscription ${subscriptionId} for session ${session.id} on DO ${this.doName}`);
    try {
      const result = await queryEvents(filters, session.bookmark, this.env);
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
  async broadcastEvent(event) {
    await this.broadcastToLocalSessions(event);
    await this.broadcastToOtherDOs(event);
  }
  async broadcastToLocalSessions(event) {
    let broadcastCount = 0;
    const activeWebSockets = this.state.getWebSockets();
    for (const ws of activeWebSockets) {
      const attachment = ws.deserializeAttachment();
      if (!attachment) continue;
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
          host: attachment.host
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
      if (endpoint === this.doName) continue;
      broadcasts.push(this.sendToSpecificDO(endpoint, endpoint, event, 0));
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
  async sendToSpecificDO(region, doName, event, hopCount) {
    try {
      const actualDoName = _RelayWebSocket.ALLOWED_ENDPOINTS.includes(doName) ? doName : `relay-${region.split("-")[0]}-${region.split("-")[1]}-primary`;
      if (!_RelayWebSocket.ALLOWED_ENDPOINTS.includes(actualDoName)) {
        throw new Error(`Invalid DO name: ${actualDoName}`);
      }
      const id = this.env.RELAY_WEBSOCKET.idFromName(actualDoName);
      const locationHint = _RelayWebSocket.ENDPOINT_HINTS[actualDoName] || "auto";
      const stub = this.env.RELAY_WEBSOCKET.get(id, { locationHint });
      const url = new URL("https://internal/do-broadcast");
      url.searchParams.set("doName", actualDoName);
      return await stub.fetch(new Request(url.toString(), {
        method: "POST",
        body: JSON.stringify({
          event,
          sourceDoId: this.doId,
          hopCount
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
// eventId -> timestamp
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

@noble/curves/esm/abstract/utils.js:
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
