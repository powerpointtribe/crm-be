import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

const BEARER = /^Bearer\s+\S+/i;

/**
 * Try the staff (`jwt`) and learner (`portal-jwt`) strategies one at a time.
 * They can't be combined as `AuthGuard(['jwt', 'portal-jwt'])`: each strategy
 * *throws* on the other's token, and passport stops the chain on an error.
 * On success the strategy sets `req.user`.
 */
async function authenticate(
  context: ExecutionContext,
  guards: CanActivate[],
): Promise<boolean> {
  const req = context.switchToHttp().getRequest<Request>();
  if (!BEARER.test(req.headers.authorization ?? '')) return false;
  for (const guard of guards) {
    try {
      if (await (guard.canActivate(context) as Promise<boolean>)) return true;
    } catch {
      // Not this kind of token: try the next strategy.
    }
  }
  return false;
}

const strategies = (): CanActivate[] => [
  new (AuthGuard('jwt'))(),
  new (AuthGuard('portal-jwt'))(),
];

/** Requires a valid staff or portal token. */
@Injectable()
export class UploadAuthGuard implements CanActivate {
  private readonly guards = strategies();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (await authenticate(context, this.guards)) return true;
    throw new UnauthorizedException();
  }
}

/**
 * Never blocks. Sets `req.user` when a valid staff or portal token is sent,
 * otherwise leaves it unset so the handler treats the caller as anonymous.
 * An invalid or expired token is treated as anonymous (the route was fully
 * public before, so rejecting it would break existing callers).
 */
@Injectable()
export class OptionalUploadAuthGuard implements CanActivate {
  private readonly guards = strategies();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!(await authenticate(context, this.guards))) req.user = undefined;
    return true;
  }
}
