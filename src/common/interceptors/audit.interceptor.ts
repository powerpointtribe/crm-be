import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AUDIT_KEY, AuditOptions } from '../decorators/audit.decorator';
import { QueueName, JobType } from '../interfaces/queue-job.interface';
import { Request } from 'express';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    @Optional() @InjectQueue(QueueName.AUDIT_LOGS)
    private readonly auditLogQueue: Queue | undefined,
    private readonly reflector: Reflector,
  ) {
    if (!auditLogQueue) {
      this.logger.warn(
        'Audit log queue not available - audit logging is disabled. Enable the AUDIT_LOGS queue in queue.module.ts to restore functionality.',
      );
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditOptions = this.reflector.get<AuditOptions>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!auditOptions || auditOptions.skipAudit) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    // `user` is attached at runtime by auth middleware; cast defensively so the
    // build never fails if the Express Request augmentation isn't in scope.
    const user = (request as Request & { user?: any })?.user;
    const method = request.method;
    const url = request.url;
    const userAgent = request.headers['user-agent'];
    const ipAddress = request.ip || request.socket.remoteAddress;

    return next.handle().pipe(
      tap((response) => {
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

          // Add job to queue (non-blocking) - only if queue is available
          if (this.auditLogQueue) {
            this.auditLogQueue.add(
              JobType.AUDIT_LOG_CREATE,
              {
                action: auditOptions.action,
                entityType: auditOptions.entity,
                entityId,
                userId: (user as any)._id || (user as any).sub,
                userEmail: (user as any).email,
                userName: `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim(),
                auditData: {
                  description,
                  oldValues,
                  newValues,
                  severity: auditOptions.severity || 'medium',
                  metadata: {
                    ipAddress,
                    userAgent,
                    source: 'web',
                    requestId: request.headers['x-request-id'] as string,
                    relatedUnit: (user as any).unit?.toString(),
                    relatedDistrict: (user as any).district?.toString(),
                  },
                },
              },
              {
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 1000,
                },
                removeOnComplete: true,
                removeOnFail: false,
              },
            ).catch((error) => {
              // Log queue error but don't throw to avoid blocking the main request
              this.logger.error('Failed to queue audit log', error.message);
            });
          } else {
            // Queue not available, log but don't block the request
            this.logger.debug(
              `Audit log skipped (queue disabled): ${auditOptions.action} on ${auditOptions.entity} ${entityId}`,
            );
          }
        } catch (error) {
          // Log error but don't throw to avoid blocking the main request
          this.logger.error('Failed to prepare audit log', error.stack);
        }
      }),
    );
  }
}
