import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { AUDIT_KEY, AuditOptions } from '../decorators/audit.decorator';
import { Request } from 'express';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly auditLogsService: AuditLogsService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditOptions = this.reflector.get<AuditOptions>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!auditOptions || auditOptions.skipAudit) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    const method = request.method;
    const url = request.url;
    const userAgent = request.headers['user-agent'];
    const ipAddress = request.ip || request.socket.remoteAddress;

    return next.handle().pipe(
      tap(async (response) => {
        try {
          if (!user) {
            this.logger.warn('No user found in request for audit logging');
            return;
          }

          let entityId = '';
          let newValues: Record<string, any> | undefined = undefined;
          let oldValues: Record<string, any> | undefined = undefined;

          if (response && typeof response === 'object') {
            if (response._id) {
              entityId = response._id.toString();
              newValues = response;
            } else if (response.id) {
              entityId = response.id.toString();
              newValues = response;
            } else if (Array.isArray(response)) {
              entityId = 'bulk_operation';
              newValues = { count: response.length };
            }
          }

          if (request.params?.id) {
            entityId = request.params.id;
          }

          if (method === 'PUT' || method === 'PATCH') {
            oldValues = request.body?.oldValues;
            delete request.body?.oldValues;
          }

          const description =
            auditOptions.description ||
            `${method} ${auditOptions.entity} via ${url}`;

          await this.auditLogsService.logAction(
            auditOptions.action,
            auditOptions.entity,
            entityId,
            user,
            {
              description,
              oldValues,
              newValues,
              severity: auditOptions.severity || 'medium',
              metadata: {
                ipAddress,
                userAgent,
                source: 'web',
                requestId: request.headers['x-request-id'] as string,
              },
              relatedUnit: (user as any).unit?.toString(),
              relatedDistrict: (user as any).district?.toString(),
            },
          );
        } catch (error) {
          this.logger.error('Failed to create audit log', error.stack);
        }
      }),
    );
  }
}
