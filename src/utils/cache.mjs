export const relayCache = {
    _cache: {},
    get(key) {
      const item = this._cache[key];
      if (item && item.expires > Date.now()) {
        return item.value;
      }
      return null;
    },
    set(key, value, ttl = 60000) {
      this._cache[key] = {
        value,
        expires: Date.now() + ttl,
      };
    },
    delete(key) {
      delete this._cache[key];
    },
  };
  
  export function generateSubscriptionCacheKey(filters) {
    const filterKeys = Object.keys(filters).sort();
    const cacheKey = filterKeys.map(key => {
      let value = filters[key];
      if (Array.isArray(value)) {
        if (key === 'kinds' || key === 'authors' || key === 'ids' || key.startsWith('#') && /^#[a-zA-Z]$/.test(key)) {
          value = value.sort().join(',');
        } else {
          value = value.sort();
        }
      }
      value = Array.isArray(value) ? value.join(',') : String(value);
      return `${key}:${value}`;
    }).join('|');
    return `subscription:${cacheKey}`;
  }