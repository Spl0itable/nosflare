/**
 * R2 Archive Consumer - Event archival to R2
 */

import { Env, NostrEvent, R2ArchiveQueueMessage } from './types';

const R2_WRITES_PER_BATCH = 50;
const BATCH_DELAY_MS = 100;

export default {
  async queue(batch: MessageBatch<R2ArchiveQueueMessage>, env: Env): Promise<void> {
    console.log(`R2ArchiveConsumer: Processing ${batch.messages.length} events`);
    const startTime = Date.now();

    if (!env.NOSTR_ARCHIVE) {
      console.error('R2ArchiveConsumer: NOSTR_ARCHIVE bucket not configured');
      for (const message of batch.messages) {
        message.ack();
      }
      return;
    }

    const eventMap = new Map<string, NostrEvent>();
    for (const message of batch.messages) {
      if (!eventMap.has(message.body.event.id)) {
        eventMap.set(message.body.event.id, message.body.event);
      }
    }

    const events = Array.from(eventMap.values());
    console.log(`R2ArchiveConsumer: ${events.length} unique events after deduplication`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < events.length; i += R2_WRITES_PER_BATCH) {
      const batchEvents = events.slice(i, i + R2_WRITES_PER_BATCH);

      const writePromises = batchEvents.map(async (event) => {
        try {
          const path = `events/raw/${event.id}.json`;
          await env.NOSTR_ARCHIVE.put(path, JSON.stringify(event), {
            httpMetadata: {
              contentType: 'application/json'
            },
            customMetadata: {
              pubkey: event.pubkey,
              kind: String(event.kind),
              created_at: String(event.created_at)
            }
          });
          return { success: true, eventId: event.id };
        } catch (error: any) {
          console.error(`R2ArchiveConsumer: Failed to write event ${event.id}: ${error.message}`);
          return { success: false, eventId: event.id, error: error.message };
        }
      });

      const results = await Promise.all(writePromises);

      for (const result of results) {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      if (i + R2_WRITES_PER_BATCH < events.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `R2ArchiveConsumer: Archived ${successCount}/${events.length} events ` +
      `(${errorCount} errors) in ${duration}ms`
    );

    for (const message of batch.messages) {
      message.ack();
    }
  }
};
