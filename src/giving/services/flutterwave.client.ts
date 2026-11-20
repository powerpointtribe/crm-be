import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FlutterwaveTransaction {
  id?: number | string;
  tx_ref?: string;
  status?: string;
  amount?: number;
  currency?: string;
}

export class FlutterwaveError extends Error {}

/**
 * Minimal Flutterwave v3 client for giving, using the same API and auth as
 * the store (StoreService). Tests replace global fetch; nothing here is cached.
 */
@Injectable()
export class FlutterwaveClient {
  private readonly logger = new Logger(FlutterwaveClient.name);
  private readonly baseUrl = 'https://api.flutterwave.com/v3';

  constructor(private readonly config: ConfigService) {}

  private get secretKey(): string {
    return this.config.get<string>('FLUTTERWAVE_SECRET_KEY') || '';
  }

  get isConfigured(): boolean {
    return this.secretKey.length > 0;
  }

  /** Create a hosted payment page. Returns the link to send the payer to. */
  async createPaymentLink(payload: Record<string, unknown>): Promise<string> {
    let data: { status?: string; data?: { link?: string }; message?: string };
    try {
      const res = await fetch(`${this.baseUrl}/payments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      data = (await res.json()) as typeof data;
    } catch (err) {
      this.logger.error(`Flutterwave /payments failed: ${String(err)}`);
      throw new FlutterwaveError('Payment provider unreachable');
    }
    if (data?.status !== 'success' || !data.data?.link) {
      this.logger.error(
        `Flutterwave /payments rejected: ${data?.message ?? ''}`,
      );
      throw new FlutterwaveError('Payment provider rejected the request');
    }
    return data.data.link;
  }

  /**
   * Look a transaction up by our reference. Returns null when Flutterwave has
   * no such transaction (yet) or can't be reached, so callers keep waiting.
   */
  async verifyByReference(
    txRef: string,
  ): Promise<FlutterwaveTransaction | null> {
    try {
      const res = await fetch(
        `${this.baseUrl}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
        {
          headers: { Authorization: `Bearer ${this.secretKey}` },
          signal: AbortSignal.timeout(15_000),
        },
      );
      const data = (await res.json()) as {
        status?: string;
        data?: FlutterwaveTransaction;
      };
      if (data?.status !== 'success' || !data.data) return null;
      return data.data;
    } catch (err) {
      this.logger.warn(
        `Flutterwave verify failed for ${txRef}: ${String(err)}`,
      );
      return null;
    }
  }
}
