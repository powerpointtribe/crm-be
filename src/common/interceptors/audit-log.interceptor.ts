import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AUDIT_LOG_KEY, AuditLogMetadata } from '../decorators/audit-log.decorator';
import { AuditAction } from '../enums/audit-action.enum';
import { QueueName, JobType } from '../interfaces/queue-job.interface';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectQueue(QueueName.AUDIT_LOGS)
    private readonly auditLogQueue: Queue,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.get<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('AuditLogInterceptor: No user found in request');
      return next.handle();
    }

    let oldValues: any = null;
    const entityId = this.extractEntityId(request, auditMetadata);

    // For UPDATE actions, fetch old values before the operation
    const isUpdate = auditMetadata.action === AuditAction.UPDATE ||
                     auditMetadata.action.toString().includes('_UPDATED');

    return next.handle().pipe(
      tap((result) => {
        try {
          // Get the entity ID from the result or request
          const finalEntityId = auditMetadata.getEntityId
            ? auditMetadata.getEntityId(result, request)
            : entityId || this.extractEntityIdFromResult(result);

          if (!finalEntityId) {
            this.logger.warn('AuditLogInterceptor: Could not determine entity ID');
            return;
          }

          // Prepare audit log metadata
          const metadata = {
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            source: 'web',
            method: request.method,
            url: request.url,
            params: request.params,
          };

          // Prepare audit log data
          const auditData: any = {
            description: auditMetadata.description || this.generateDescription(auditMetadata.action, auditMetadata.entityType),
            severity: auditMetadata.severity || this.determineSeverity(auditMetadata.action),
            metadata,
          };

          // Add old and new values for updates
          if (isUpdate) {
            auditData.oldValues = this.extractOldValues(request.body, result);
            auditData.newValues = this.sanitizeData(result);
          } else {
            // For creates and deletes, just store the data
            auditData.newValues = this.sanitizeData(result);
          }

          // Add job to queue (non-blocking)
          this.auditLogQueue.add(
            JobType.AUDIT_LOG_CREATE,
            {
              action: auditMetadata.action,
              entityType: auditMetadata.entityType,
              entityId: finalEntityId,
              userId: user._id || user.sub,
              userEmail: user.email,
              userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
              auditData,
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
        } catch (error) {
          // Log error but don't throw to avoid blocking the main request
          this.logger.error('Failed to prepare audit log', error.stack);
        }
      }),
      catchError((error) => {
        // Log failed operations too
        this.logger.error('Operation failed, audit log not created', error.message);
        throw error;
      }),
    );
  }

  private extractEntityId(request: any, metadata: AuditLogMetadata): string | null {
    // Try to get from params.id first
    if (request.params?.id) {
      return request.params.id;
    }

    // Try to get from body._id or body.id
    if (request.body?._id) {
      return request.body._id;
    }

    if (request.body?.id) {
      return request.body.id;
    }

    return null;
  }

  private extractEntityIdFromResult(result: any): string | null {
    if (!result) return null;

    if (typeof result === 'string') {
      return result;
    }

    if (result._id) {
      return result._id.toString();
    }

    if (result.id) {
      return result.id.toString();
    }

    // For arrays, try to get the first item's ID
    if (Array.isArray(result) && result.length > 0) {
      return this.extractEntityIdFromResult(result[0]);
    }

    return null;
  }

  private generateDescription(action: AuditAction, entityType: string): string {
    const actionWord = action.toString().split('_').pop()?.toLowerCase() || 'modified';
    const entityName = entityType.toString().toLowerCase().replace(/_/g, ' ');
    return `${actionWord} ${entityName}`;
  }

  private determineSeverity(action: AuditAction): 'low' | 'medium' | 'high' | 'critical' {
    const actionStr = action.toString();

    if (actionStr.includes('DELETE')) {
      return 'high';
    }

    if (actionStr.includes('CREATE') || actionStr.includes('UPDATE')) {
      return 'medium';
    }

    if (actionStr.includes('LOGIN') || actionStr.includes('PASSWORD')) {
      return 'high';
    }

    return 'low';
  }

  private extractOldValues(updateData: any, currentData: any): any {
    if (!updateData || !currentData) return null;

    const oldValues: any = {};

    // Get the fields that are being updated
    Object.keys(updateData).forEach(key => {
      if (currentData[key] !== undefined && currentData[key] !== updateData[key]) {
        oldValues[key] = currentData[key];
      }
    });

    return Object.keys(oldValues).length > 0 ? oldValues : null;
  }

  private sanitizeData(data: any): any {
    if (!data) return null;

    try {
      // Remove sensitive fields
      const sanitized = { ...data };
      const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'resetPasswordOtp'];

      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });

      // Convert mongoose documents to plain objects
      if (data.toObject && typeof data.toObject === 'function') {
        return this.sanitizeData(data.toObject());
      }

      // Limit depth to avoid circular references
      return JSON.parse(JSON.stringify(sanitized, this.getCircularReplacer()));
    } catch (error) {
      this.logger.warn('Failed to sanitize data for audit log', error.message);
      return { error: 'Failed to serialize data' };
    }
  }

  private getCircularReplacer() {
    const seen = new WeakSet();
    return (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
  }
}
