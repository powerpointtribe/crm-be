import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PortalAccountDocument } from '../schemas/portal-account.schema';

/** Injects the authenticated PortalAccount (set by PortalJwtStrategy). */
export const CurrentPortalAccount = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PortalAccountDocument => {
    return ctx.switchToHttp().getRequest().user;
  },
);
