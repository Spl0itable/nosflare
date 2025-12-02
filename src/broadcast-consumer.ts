/**
 * Broadcast Consumer - Queue-based event distribution (Push Model)
 */

import { Env, BroadcastQueueMessage, NostrEvent } from './types';
import { pack } from 'msgpackr';
import { SESSION_MANAGER_SHARD_COUNT } from './config';

const DEBUG = false;

export default {
  async queue(batch: MessageBatch<BroadcastQueueMessage>, env: Env): Promise<void> {
    if (DEBUG) console.log(`BroadcastConsumer: Processing ${batch.messages.length} events`);

    try {
      const eventMap = new Map<string, NostrEvent>();
      for (const message of batch.messages) {
        if (!eventMap.has(message.body.event.id)) {
          eventMap.set(message.body.event.id, message.body.event);
        }
      }

      const events = Array.from(eventMap.values());
      if (events.length === 0) {
        for (const message of batch.messages) {
          message.ack();
        }
        return;
      }

      if (DEBUG) console.log(`BroadcastConsumer: ${events.length} unique events after deduplication`);

      const shardToEvents = new Map<number, NostrEvent[]>();

      for (const event of events) {
        const shardNum = event.kind % SESSION_MANAGER_SHARD_COUNT;
        if (!shardToEvents.has(shardNum)) {
          shardToEvents.set(shardNum, []);
        }
        shardToEvents.get(shardNum)!.push(event);
      }

      if (DEBUG) console.log(`BroadcastConsumer: Distributing to ${shardToEvents.size} shards`);

      const shardPromises: Promise<void>[] = [];

      for (const [shardNum, shardEvents] of shardToEvents) {
        shardPromises.push(
          (async () => {
            try {
              const sessionManagerId = env.SESSION_MANAGER_DO.idFromName(`manager-${shardNum}`);
              const sessionManagerStub = env.SESSION_MANAGER_DO.get(sessionManagerId);

              const response = await sessionManagerStub.fetch('https://internal/process-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/msgpack' },
                body: pack({ events: shardEvents })
              });

              if (!response.ok) {
                console.error(`Failed to process events on shard ${shardNum}: ${response.status}`);
              }
            } catch (error) {
              console.error(`Error processing events on SessionManagerDO shard ${shardNum}:`, error);
            }
          })()
        );
      }

      await Promise.all(shardPromises);

      for (const message of batch.messages) {
        message.ack();
      }
    } catch (error) {
      console.error('BroadcastConsumer: Fatal error:', error);

      for (const message of batch.messages) {
        message.retry();
      }
    }
  }
};
