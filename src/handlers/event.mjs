import { isPubkeyAllowed, isEventKindAllowed, containsBlockedContent } from '../utils/filters.mjs';
import { verifyEventSignature } from '../utils/verification.mjs';
import { relayCache } from '../utils/cache.mjs';
import { sendOK, sendError } from '../utils/rateLimiter.mjs';
import { blastEventToRelays } from '../utils/relay.mjs';
import { saveEventToD1 } from './deletion.mjs';

export async function processEvent(event, server, env) {
  try {
    if (!isPubkeyAllowed(event.pubkey)) {
      sendOK(server, event.id, false, "Denied. The pubkey is not allowed.");
      return;
    }
    if (!isEventKindAllowed(event.kind)) {
      sendOK(server, event.id, false, `Denied. Event kind ${event.kind} is not allowed.`);
      return;
    }
    if (containsBlockedContent(event)) {
      sendOK(server, event.id, false, "Denied. The event contains blocked content.");
      return;
    }
    if (!excludedRateLimitKinds.includes(event.kind)) {
      if (!pubkeyRateLimiter.removeToken()) {
        sendOK(server, event.id, false, "Rate limit exceeded. Please try again later.");
        return;
      }
    }
    if (event.kind === 5) {
      await processDeletionEvent(event, server, env);
      return;
    }
    const cacheKey = `event:${event.id}`;
    const cachedEvent = relayCache.get(cacheKey);
    if (cachedEvent) {
      sendOK(server, event.id, false, "Duplicate. Event dropped.");
      return;
    }
    const isValidSignature = await verifyEventSignature(event);
    if (isValidSignature) {
      relayCache.set(cacheKey, event);
      sendOK(server, event.id, true, "Event received successfully.");
      blastEventToRelays(event);
      saveEventToD1(event, env).catch((error) => {
        console.error("Error saving event to D1:", error);
      });
    } else {
      sendOK(server, event.id, false, "Invalid: signature verification failed.");
    }
  } catch (error) {
    console.error("Error in EVENT processing:", error);
    sendOK(server, event.id, false, `Error: EVENT processing failed - ${error.message}`);
  }
}