import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ZoomParticipant {
  name?: string;
  user_email?: string;
  duration?: number; // seconds
  join_time?: string;
  leave_time?: string;
}

/**
 * Zoom Server-to-Server OAuth client (no SDK — uses fetch).
 *
 * Reads ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET. Provides:
 *  - getPastMeetingParticipants(): for report-based auto-attendance
 *  - createMeeting(): optionally provision a Zoom meeting per session
 * Degrades gracefully (503) when not configured.
 */
@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private readonly accountId?: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private token?: { value: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {
    this.accountId = this.config.get<string>('ZOOM_ACCOUNT_ID');
    this.clientId = this.config.get<string>('ZOOM_CLIENT_ID');
    this.clientSecret = this.config.get<string>('ZOOM_CLIENT_SECRET');
  }

  get isConfigured(): boolean {
    return !!(this.accountId && this.clientId && this.clientSecret);
  }

  private ensureConfigured() {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Zoom is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET.',
      );
    }
  }

  /** Server-to-Server OAuth: exchange account creds for a short-lived token. */
  private async getAccessToken(): Promise<string> {
    this.ensureConfigured();
    if (this.token && Date.now() < this.token.expiresAt) {
      return this.token.value;
    }
    const basic = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');
    let res: Response;
    try {
      res = await fetch(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
          this.accountId as string,
        )}`,
        { method: 'POST', headers: { Authorization: `Basic ${basic}` } },
      );
    } catch (err) {
      this.logger.error(`Zoom token request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Could not reach Zoom.');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Zoom token ${res.status}: ${text.slice(0, 200)}`);
      throw new ServiceUnavailableException('Zoom authentication failed.');
    }
    const data: any = await res.json();
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000 - 60_000,
    };
    return this.token.value;
  }

  private async api(path: string, init: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    let res: Response;
    try {
      res = await fetch(`https://api.zoom.us/v2${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      });
    } catch (err) {
      this.logger.error(`Zoom API failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Could not reach Zoom.');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Zoom API ${path} ${res.status}: ${text.slice(0, 200)}`);
      throw new ServiceUnavailableException(
        `Zoom request failed (${res.status}).`,
      );
    }
    return res.status === 204 ? null : res.json();
  }

  /**
   * All participants for a finished meeting (paginated report API).
   * `meetingId` is the numeric id or (URL-encoded) UUID.
   */
  async getPastMeetingParticipants(
    meetingId: string,
  ): Promise<ZoomParticipant[]> {
    this.ensureConfigured();
    const participants: ZoomParticipant[] = [];
    let nextPageToken = '';
    do {
      const data = await this.api(
        `/report/meetings/${encodeURIComponent(meetingId)}/participants?page_size=300${
          nextPageToken ? `&next_page_token=${nextPageToken}` : ''
        }`,
      );
      participants.push(...((data?.participants as ZoomParticipant[]) || []));
      nextPageToken = data?.next_page_token || '';
    } while (nextPageToken);
    return participants;
  }

  /** Create a meeting under a host (e.g. for a session). Returns id + join_url. */
  async createMeeting(
    hostUserId: string,
    opts: {
      topic: string;
      startTime?: string;
      durationMinutes?: number;
      agenda?: string;
    },
  ): Promise<{ id: string; joinUrl: string; startUrl: string }> {
    const data = await this.api(`/users/${encodeURIComponent(hostUserId)}/meetings`, {
      method: 'POST',
      body: JSON.stringify({
        topic: opts.topic,
        type: opts.startTime ? 2 : 1, // 2 = scheduled, 1 = instant
        start_time: opts.startTime,
        duration: opts.durationMinutes || 90,
        agenda: opts.agenda,
        settings: { join_before_host: true, waiting_room: false },
      }),
    });
    return {
      id: String(data.id),
      joinUrl: data.join_url,
      startUrl: data.start_url,
    };
  }
}
