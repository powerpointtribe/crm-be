import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

export type ZoomKind = 'meeting' | 'webinar';

/** One row of Zoom's past-meeting participant report. A participant may appear
 *  in multiple rows if they left and rejoined — callers should sum `duration`. */
export interface ZoomParticipant {
  id?: string;
  user_id?: string;
  name?: string;
  user_email?: string;
  join_time?: string;
  leave_time?: string;
  duration?: number; // seconds
}

export interface ZoomInstance {
  uuid: string;
  start_time: string;
}

/**
 * Thin client for Zoom's Server-to-Server OAuth + Reports API. Used to pull
 * past-meeting participant reports and turn them into session attendance.
 * Credentials come from env: ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET.
 */
@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private token: { value: string; expiresAt: number } | null = null;

  private get creds() {
    return {
      accountId: process.env.ZOOM_ACCOUNT_ID,
      clientId: process.env.ZOOM_CLIENT_ID,
      clientSecret: process.env.ZOOM_CLIENT_SECRET,
    };
  }

  get isConfigured(): boolean {
    const c = this.creds;
    return !!(c.accountId && c.clientId && c.clientSecret);
  }

  private async getAccessToken(): Promise<string> {
    // Reuse the cached token until ~1 min before it expires.
    if (this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.value;
    }
    const { accountId, clientId, clientSecret } = this.creds;
    if (!accountId || !clientId || !clientSecret) {
      throw new Error('Zoom credentials are not configured.');
    }
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      { method: 'POST', headers: { Authorization: `Basic ${basic}` } },
    );
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new Error(
        `Zoom token request failed: ${res.status} ${JSON.stringify(data)}`,
      );
    }
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    };
    return this.token.value;
  }

  private async api<T>(path: string): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`https://api.zoom.us/v2${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(
        `Zoom API ${path} → ${res.status}: ${data?.message || JSON.stringify(data)}`,
      );
      err.status = res.status;
      err.zoomCode = data?.code;
      throw err;
    }
    return data as T;
  }

  /** UUIDs that start with '/' or contain '//' must be double-URL-encoded. */
  private encodeId(idOrUuid: string): string {
    if (idOrUuid.startsWith('/') || idOrUuid.includes('//')) {
      return encodeURIComponent(encodeURIComponent(idOrUuid));
    }
    return encodeURIComponent(idOrUuid);
  }

  /** Past occurrences of a (recurring) meeting/webinar, each with its own UUID. */
  async getPastInstances(
    id: string,
    kind: ZoomKind = 'meeting',
  ): Promise<ZoomInstance[]> {
    const data = await this.api<{ meetings?: ZoomInstance[]; webinars?: ZoomInstance[] }>(
      `/past_${kind}s/${encodeURIComponent(id)}/instances`,
    );
    return data.meetings || data.webinars || [];
  }

  /** All participants for a meeting/webinar id or occurrence UUID (handles paging). */
  async getParticipants(
    idOrUuid: string,
    kind: ZoomKind = 'meeting',
  ): Promise<ZoomParticipant[]> {
    const id = this.encodeId(idOrUuid);
    const out: ZoomParticipant[] = [];
    let pageToken = '';
    do {
      const data = await this.api<{
        participants: ZoomParticipant[];
        next_page_token?: string;
      }>(
        `/report/${kind}s/${id}/participants?page_size=300${
          pageToken ? `&next_page_token=${pageToken}` : ''
        }`,
      );
      out.push(...(data.participants || []));
      pageToken = data.next_page_token || '';
    } while (pageToken);
    return out;
  }

  // ---- Meeting SDK (embedded viewing) --------------------------------------

  get isSdkConfigured(): boolean {
    return !!(process.env.ZOOM_MEETING_SDK_KEY && process.env.ZOOM_MEETING_SDK_SECRET);
  }

  /**
   * Sign a short-lived Meeting SDK JWT so a student can join the embedded
   * meeting/webinar from the portal without a Zoom login. role: 0 = attendee.
   */
  generateSdkSignature(
    meetingNumber: string,
    role = 0,
  ): { signature: string; sdkKey: string } {
    const key = process.env.ZOOM_MEETING_SDK_KEY;
    const secret = process.env.ZOOM_MEETING_SDK_SECRET;
    if (!key || !secret) {
      throw new Error('Zoom Meeting SDK is not configured.');
    }
    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2; // 2 hours
    const signature = jwt.sign(
      { appKey: key, sdkKey: key, mn: meetingNumber, role, iat, exp, tokenExp: exp },
      secret,
      { algorithm: 'HS256' },
    );
    return { signature, sdkKey: key };
  }

  // ---- Event webhooks ------------------------------------------------------

  get webhookSecret(): string | undefined {
    return process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  }

  /**
   * Answer Zoom's endpoint URL-validation challenge (CRC): return the plainToken
   * plus its HMAC-SHA256 with the webhook secret. Zoom sends this once when the
   * webhook URL is (re)configured.
   */
  webhookCrcResponse(plainToken: string): {
    plainToken: string;
    encryptedToken: string;
  } {
    const secret = this.webhookSecret || '';
    const encryptedToken = crypto
      .createHmac('sha256', secret)
      .update(plainToken)
      .digest('hex');
    return { plainToken, encryptedToken };
  }

  /**
   * Verify a Zoom webhook request signature:
   *   x-zm-signature === 'v0=' + HMAC-SHA256(`v0:{timestamp}:{rawBody}`, secret)
   * Returns false if no secret is configured (so callers can decide).
   */
  verifyWebhookSignature(
    signature: string | undefined,
    timestamp: string | undefined,
    rawBody: string,
  ): boolean {
    const secret = this.webhookSecret;
    if (!secret || !signature || !timestamp) return false;
    const expected =
      'v0=' +
      crypto
        .createHmac('sha256', secret)
        .update(`v0:${timestamp}:${rawBody}`)
        .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }
}
