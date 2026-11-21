import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export const ANONYMOUS_UPLOAD_LIMIT = 5;
export const ANONYMOUS_UPLOAD_WINDOW_MS = 60_000;

/**
 * Per-IP limit for *anonymous* uploads only (5 per minute). Signed-in callers
 * are not counted. Must run after `OptionalUploadAuthGuard`, which sets
 * `req.user`. The global ThrottlerGuard can't do this: it runs before
 * authentication, so it can't tell the two apart.
 *
 * In-memory, per process, like the app's ThrottlerModule storage.
 */
@Injectable()
export class AnonymousUploadLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.user) return true;

    const t = Date.now();
    this.prune(t);
    const key = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      this.hits.set(key, { count: 1, resetAt: t + ANONYMOUS_UPLOAD_WINDOW_MS });
      return true;
    }
    if (entry.count >= ANONYMOUS_UPLOAD_LIMIT) {
      const res = context.switchToHttp().getResponse<Response>();
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - t) / 1000));
      throw new HttpException(
        'Too many uploads. Please wait a minute and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    entry.count += 1;
    return true;
  }

  /** Drop expired windows so the map can't grow without bound. */
  private prune(t: number) {
    if (this.hits.size < 1000) return;
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= t) this.hits.delete(key);
    }
  }
}
