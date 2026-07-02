import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface YouTubeLiveStatus {
  videoId: string;
  // 'upcoming' (scheduled), 'live' (streaming now), 'ended' (was live), or
  // 'none' (not a live broadcast / unknown).
  state: 'upcoming' | 'live' | 'ended' | 'none';
  scheduledStartTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  concurrentViewers?: number;
  title?: string;
}

/**
 * YouTube Data API v3 client (read-only, API-key auth — no OAuth).
 *
 * Attendance is NOT pulled from YouTube (live viewers are anonymous); it is
 * tracked as watch-time on the trainee portal instead. This service only
 * reports a broadcast's live status so the portal can show a "LIVE" badge /
 * viewer count and open/close the attendance window automatically.
 *
 * Reads YOUTUBE_API_KEY. Degrades gracefully (returns state 'none') when the
 * key is missing or the API errors — never throws into request flow.
 */
@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private readonly apiKey?: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('YOUTUBE_API_KEY');
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Extract the 11-char video ID from any common YouTube URL/ID form:
   *   https://youtu.be/<id>
   *   https://www.youtube.com/watch?v=<id>
   *   https://www.youtube.com/live/<id>
   *   https://www.youtube.com/embed/<id>
   *   <id> (already just the id)
   */
  static extractVideoId(input?: string): string | null {
    if (!input) return null;
    const raw = input.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
    const patterns = [
      /youtu\.be\/([A-Za-z0-9_-]{11})/,
      /[?&]v=([A-Za-z0-9_-]{11})/,
      /youtube\.com\/live\/([A-Za-z0-9_-]{11})/,
      /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = raw.match(p);
      if (m) return m[1];
    }
    return null;
  }

  /** Fetch the live status of a broadcast. Never throws — returns 'none' on failure. */
  async getLiveStatus(videoIdOrUrl: string): Promise<YouTubeLiveStatus> {
    const videoId = YoutubeService.extractVideoId(videoIdOrUrl);
    if (!videoId) return { videoId: '', state: 'none' };
    if (!this.isConfigured) return { videoId, state: 'none' };

    try {
      const url =
        `https://www.googleapis.com/youtube/v3/videos` +
        `?part=snippet,liveStreamingDetails&id=${videoId}&key=${this.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(`YouTube API ${res.status} for video ${videoId}`);
        return { videoId, state: 'none' };
      }
      const data = (await res.json()) as any;
      const item = data.items?.[0];
      if (!item) return { videoId, state: 'none' };

      const d = item.liveStreamingDetails;
      const title = item.snippet?.title;
      if (!d) return { videoId, state: 'none', title };

      let state: YouTubeLiveStatus['state'] = 'none';
      if (d.actualEndTime) state = 'ended';
      else if (d.actualStartTime) state = 'live';
      else if (d.scheduledStartTime) state = 'upcoming';

      return {
        videoId,
        state,
        title,
        scheduledStartTime: d.scheduledStartTime,
        actualStartTime: d.actualStartTime,
        actualEndTime: d.actualEndTime,
        concurrentViewers: d.concurrentViewers
          ? Number(d.concurrentViewers)
          : undefined,
      };
    } catch (err) {
      this.logger.warn(`YouTube live-status fetch failed: ${(err as Error).message}`);
      return { videoId, state: 'none' };
    }
  }
}
