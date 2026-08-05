import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LmsService } from './lms.service';

/**
 * Logs every successful change action (POST/PATCH/PUT/DELETE) on the facilitator
 * controller to the facilitator audit log — who (from the JWT member), what
 * (derived from the handler name), and where (method + path). Read-only GETs are
 * ignored, and a logging failure never affects the request.
 */
@Injectable()
export class FacilitatorAuditInterceptor implements NestInterceptor {
  constructor(private readonly lms: LmsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = (req.method || '').toUpperCase();
    const mutating = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);

    if (!mutating) return next.handle();

    const handler = context.getHandler()?.name || 'action';
    const actor = req.user;
    const params = req.params || {};
    const path = req.originalUrl || req.url || '';

    return next.handle().pipe(
      tap(() => {
        // Fire-and-forget; never block or fail the response on audit errors.
        this.lms
          .recordFacilitatorAudit({ handler, method, path, params, actor })
          .catch(() => undefined);
      }),
    );
  }
}
