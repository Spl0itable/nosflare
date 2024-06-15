export const blockedPubkeys = [
    "3c7f5948b5d80900046a67d8e3bf4971d6cba013abece1dd542eca223cf3dd3f",
    "fed5c0c3c8fe8f51629a0b39951acdf040fd40f53a327ae79ee69991176ba058",
    "e810fafa1e89cdf80cced8e013938e87e21b699b24c8570537be92aec4b12c18",
    "05aee96dd41429a3ae97a9dac4dfc6867fdfacebca3f3bdc051e5004b0751f01",
    "53a756bb596055219d93e888f71d936ec6c47d960320476c955efd8941af4362"
  ];
  
  export const allowedPubkeys = [];
  
  export function isPubkeyAllowed(pubkey) {
    if (allowedPubkeys.length > 0 && !allowedPubkeys.includes(pubkey)) {
      return false;
    }
    return !blockedPubkeys.includes(pubkey);
  }
  
  // Blocked event kinds
  export const blockedEventKinds = new Set([1064]);
  
  // Allowed event kinds
  export const allowedEventKinds = new Set([]);
  
  export function isEventKindAllowed(kind) {
    if (allowedEventKinds.size > 0 && !allowedEventKinds.has(kind)) {
      return false;
    }
    return !blockedEventKinds.has(kind);
  }
  
  // Blocked words or phrases (case-insensitive)
  export const blockedContent = new Set(["~~ hello world! ~~"]);
  
  export function containsBlockedContent(event) {
    const lowercaseContent = (event.content || "").toLowerCase();
    const lowercaseTags = event.tags.map(tag => tag.join("").toLowerCase());
    for (const blocked of blockedContent) {
      if (
        lowercaseContent.includes(blocked) ||
        lowercaseTags.some(tag => tag.includes(blocked))
      ) {
        return true;
      }
    }
    return false;
  }
  
  // Blocked tags
  export const blockedTags = new Set([]);
  
  // Allowed tags
  export const allowedTags = new Set(["p", "e"]);
  
  export function isTagAllowed(tag) {
    if (allowedTags.size > 0 && !allowedTags.has(tag)) {
      return false;
    }
    return !blockedTags.has(tag);
  }
  
  export function isTagBlocked(tag) {
    return blockedTags.has(tag);
  }