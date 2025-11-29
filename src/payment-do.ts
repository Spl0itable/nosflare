/**
 * PaymentDO - Sharded payment tracking
 */

import { pack, unpack } from 'msgpackr';
import type {
  DurableObject,
  DurableObjectState,
  PaymentRecord,
  PaymentCheckRequest,
  PaymentCheckResponse,
  PaymentAddResponse,
  PaymentRemoveRequest,
  PaymentRemoveResponse,
  ErrorResponse
} from './types';

export class PaymentDO implements DurableObject {
  private state: DurableObjectState;
  private paidPubkeys: Map<string, PaymentRecord> = new Map();

  constructor(state: DurableObjectState, _env: any) {
    this.state = state;

    this.state.blockConcurrencyWhile(async () => {
      await this.loadPayments();
    });
  }

  private async loadPayments(): Promise<void> {
    try {
      const stored = await this.state.storage.list<PaymentRecord>({ prefix: 'paid:' });

      for (const [key, record] of stored) {
        const pubkey = key.substring(5);

        if (record.expiresAt && record.expiresAt < Date.now() / 1000) {
          await this.state.storage.delete(key);
          continue;
        }

        this.paidPubkeys.set(pubkey, record);
      }

      console.log(`[PaymentDO] Loaded ${this.paidPubkeys.size} payment records`);
    } catch (error) {
      console.error('[PaymentDO] Error loading payment data:', error);
    }
  }

  async fetch(request: Request): Promise<Response> {

    const url = new URL(request.url);

    if (url.pathname === '/check') {
      return this.handleCheck(request);
    } else if (url.pathname === '/add') {
      return this.handleAdd(request);
    } else if (url.pathname === '/remove') {
      return this.handleRemove(request);
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleCheck(request: Request): Promise<Response> {
    try {
      let pubkey: string;

      try {
        const payload = unpack(new Uint8Array(await request.arrayBuffer())) as PaymentCheckRequest;
        pubkey = payload.pubkey;
      } catch (error: any) {
        if (error.message?.includes('client disconnected')) {
          console.log('[PaymentDO] Client disconnected during check request');
          return new Response('Client disconnected', { status: 499 });
        }
        throw error;
      }

      if (!pubkey) {
        const error: ErrorResponse = { error: 'Missing pubkey' };
        return new Response(pack(error), {
          status: 400,
          headers: { 'Content-Type': 'application/msgpack' }
        });
      }

      const record = this.paidPubkeys.get(pubkey);

      if (record?.expiresAt && record.expiresAt < Date.now() / 1000) {
        this.paidPubkeys.delete(pubkey);
        await this.state.storage.delete(`paid:${pubkey}`);

        const response: PaymentCheckResponse = {
          hasPaid: false,
          reason: 'expired'
        };

        return new Response(pack(response), {
          headers: { 'Content-Type': 'application/msgpack' }
        });
      }

      const response: PaymentCheckResponse = {
        hasPaid: record !== undefined,
        record: record ? {
          paidAt: record.paidAt,
          amountSats: record.amountSats,
          expiresAt: record.expiresAt
        } : undefined
      };

      return new Response(pack(response), {
        headers: { 'Content-Type': 'application/msgpack' }
      });
    } catch (error: any) {
      console.error('[PaymentDO] Error checking payment:', error);
      const errorResponse: ErrorResponse = { error: error.message };
      return new Response(pack(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/msgpack' }
      });
    }
  }

  private async handleAdd(request: Request): Promise<Response> {
    try {
      let record: PaymentRecord;

      try {
        record = unpack(new Uint8Array(await request.arrayBuffer())) as PaymentRecord;
      } catch (error: any) {
        if (error.message?.includes('client disconnected')) {
          console.log('[PaymentDO] Client disconnected during add request');
          return new Response('Client disconnected', { status: 499 });
        }
        throw error;
      }

      if (!record.pubkey) {
        const error: ErrorResponse = { error: 'Missing pubkey' };
        return new Response(pack(error), {
          status: 400,
          headers: { 'Content-Type': 'application/msgpack' }
        });
      }

      this.paidPubkeys.set(record.pubkey, record);
      await this.state.storage.put(`paid:${record.pubkey}`, record);

      const response: PaymentAddResponse = {
        success: true,
        message: 'Payment recorded'
      };

      return new Response(pack(response), {
        headers: { 'Content-Type': 'application/msgpack' }
      });
    } catch (error: any) {
      console.error('[PaymentDO] Error adding payment:', error);
      const errorResponse: ErrorResponse = { error: error.message };
      return new Response(pack(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/msgpack' }
      });
    }
  }

  private async handleRemove(request: Request): Promise<Response> {
    try {
      let pubkey: string;

      try {
        const payload = unpack(new Uint8Array(await request.arrayBuffer())) as PaymentRemoveRequest;
        pubkey = payload.pubkey;
      } catch (error: any) {
        if (error.message?.includes('client disconnected')) {
          console.log('[PaymentDO] Client disconnected during remove request');
          return new Response('Client disconnected', { status: 499 });
        }
        throw error;
      }

      if (!pubkey) {
        const error: ErrorResponse = { error: 'Missing pubkey' };
        return new Response(pack(error), {
          status: 400,
          headers: { 'Content-Type': 'application/msgpack' }
        });
      }

      this.paidPubkeys.delete(pubkey);
      await this.state.storage.delete(`paid:${pubkey}`);

      const response: PaymentRemoveResponse = {
        success: true,
        message: 'Payment record removed'
      };

      return new Response(pack(response), {
        headers: { 'Content-Type': 'application/msgpack' }
      });
    } catch (error: any) {
      console.error('[PaymentDO] Error removing payment:', error);
      const errorResponse: ErrorResponse = { error: error.message };
      return new Response(pack(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/msgpack' }
      });
    }
  }

}
