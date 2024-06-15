import { relayCache } from '../utils/cache.mjs';
import { sendOK } from '../utils/rateLimiter.mjs';

export async function processDeletionEvent(deletionEvent, server, env) {
  try {
    if (deletionEvent.kind === 5 && deletionEvent.pubkey) {
      sendOK(server, deletionEvent.id, true, "Deletion request received successfully.");

      const deletedEventIds = deletionEvent.tags
        .filter((tag) => tag[0] === "e")
        .map((tag) => tag[1]);

      for (const eventId of deletedEventIds) {
        const existingEvent = await env.relayDb.prepare("SELECT * FROM events WHERE id = ?")
          .bind(eventId)
          .first();

        if (existingEvent && existingEvent.pubkey === deletionEvent.pubkey) {
          await env.relayDb.prepare("DELETE FROM events WHERE id = ?")
            .bind(eventId)
            .run();

          console.log(`Event ${eventId} deleted successfully.`);
        }
      }
    } else {
      sendOK(server, deletionEvent.id, false, "Invalid deletion event.");
    }
  } catch (error) {
    console.error("Error processing deletion event:", error);
    sendOK(server, deletionEvent.id, false, `Error processing deletion event: ${error.message}`);
  }
}

export async function saveEventToD1(event, env) {
  try {
    const eventKey = `event:${event.id}`;

    // Validate event JSON
    try {
      JSON.stringify(event);
    } catch (error) {
      console.error(`Invalid JSON for event: ${event.id}. Event dropped.`, error);
      return;
    }

    // Check for duplicate event ID
    const existingEvent = await env.relayDb.prepare("SELECT * FROM events WHERE id = ?")
      .bind(event.id)
      .first();

    if (existingEvent) {
      console.log(`Duplicate event: ${event.id}. Event dropped.`);
      return;
    }

    // Insert event into D1
    await env.relayDb.prepare(`
      INSERT INTO events (id, pubkey, created_at, kind, tags, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
      .bind(event.id, event.pubkey, event.created_at, event.kind, JSON.stringify(event.tags), event.content)
      .run();

    console.log(`Event ${event.id} saved successfully.`);

  } catch (error) {
    console.error(`Error saving event to D1: ${error.message}`);
  }
}