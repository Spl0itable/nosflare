/**
 * Payment Router - Determines which PaymentDO shard to use
 */

import { pack, unpack } from 'msgpackr';
import { PAYMENT_DO_SHARDING_ENABLED } from './config';
import type {
  Env,
  PaymentRecord,
  PaymentCheckResponse,
  PaymentAddResponse
} from './types';

export function getPaymentShardId(pubkey: string): string {
  if (!pubkey || pubkey.length < 4) {
    throw new Error('Invalid pubkey for payment sharding');
  }

  if (!PAYMENT_DO_SHARDING_ENABLED) {
    return 'payment-main';
  }

  const prefix = pubkey.substring(0, 4).toLowerCase();
  return `payment-${prefix}`;
}

export async function hasPaidForRelay(pubkey: string, env: Env): Promise<boolean> {
  try {
    const shardId = getPaymentShardId(pubkey);
    const stub = env.PAYMENT_DO.get(env.PAYMENT_DO.idFromName(shardId));

    const response = await stub.fetch('https://internal/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/msgpack' },
      body: pack({ pubkey })
    });

    if (!response.ok) {
      console.error(`[PaymentRouter] Check failed for ${pubkey}: ${response.status}`);
      return false;
    }

    const result = unpack(new Uint8Array(await response.arrayBuffer())) as PaymentCheckResponse;
    return result.hasPaid;
  } catch (error: any) {
    console.error(`[PaymentRouter] Error checking payment for ${pubkey}:`, error.message);
    return false;
  }
}

export async function recordPayment(
  pubkey: string,
  amountSats: number,
  env: Env,
  expiresAt?: number
): Promise<boolean> {
  try {
    const shardId = getPaymentShardId(pubkey);
    const stub = env.PAYMENT_DO.get(env.PAYMENT_DO.idFromName(shardId));

    const record: PaymentRecord = {
      pubkey,
      paidAt: Math.floor(Date.now() / 1000),
      amountSats,
      expiresAt
    };

    const response = await stub.fetch('https://internal/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/msgpack' },
      body: pack(record)
    });

    if (!response.ok) {
      console.error(`[PaymentRouter] Failed to record payment for ${pubkey}: ${response.status}`);
      return false;
    }

    const result = unpack(new Uint8Array(await response.arrayBuffer())) as PaymentAddResponse;
    return result.success;
  } catch (error: any) {
    console.error(`[PaymentRouter] Error recording payment for ${pubkey}:`, error.message);
    return false;
  }
}
