export class rateLimiter {
    constructor(rate, capacity) {
      this.tokens = capacity;
      this.lastRefillTime = Date.now();
      this.capacity = capacity;
      this.fillRate = rate; // tokens per millisecond
    }
  
    removeToken() {
      this.refill();
      if (this.tokens < 1) {
        return false; // no tokens available, rate limit exceeded
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
  }
  
  export const messageRateLimiter = new rateLimiter(100 / 60000, 100); // 100 messages per min
  export const pubkeyRateLimiter = new rateLimiter(10 / 60000, 10); // 10 events per min
  export const reqRateLimiter = new rateLimiter(100 / 60000, 100); // 100 reqs per min
  export const duplicateCheckRateLimiter = new rateLimiter(100 / 60000, 100); // 100 duplicate checks per min
  export const excludedRateLimitKinds = []; // kinds to exclude from rate limiting Ex: 1, 2, 3
  
  export function sendOK(server, eventId, status, message) {
    server.send(JSON.stringify(["OK", eventId, status, message]));
  }
  
  export function sendError(server, message) {
    server.send(JSON.stringify(["NOTICE", message]));
  }