import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MemberLifecycleService } from '../member-lifecycle.service';
import {
  LOG_LIFECYCLE_KEY,
  LifecycleLogConfig,
} from '../../common/decorators/log-lifecycle.decorator';
import { ActivityPriority } from '../../common/enums/activity-tracker.enum';

@Injectable()
export class LifecycleLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly lifecycleService: MemberLifecycleService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const logConfig = this.reflector.get<LifecycleLogConfig>(
      LOG_LIFECYCLE_KEY,
      context.getHandler(),
    );

    if (!logConfig) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const args = [request.body, request.params, request.query];

    return next.handle().pipe(
      tap(async (result) => {
        try {
          // Check condition if provided
          if (logConfig.condition && !logConfig.condition(args, result)) {
            return;
          }

          // Extract member ID
          let memberId: string;
          if (logConfig.extractMemberId) {
            memberId = logConfig.extractMemberId(args, result);
          } else {
            // Default extraction logic
            memberId =
              args[0]?.memberId ||
              args[0]?.member ||
              args[1]?.memberId ||
              args[1]?.id ||
              result?.member ||
              result?._id;
          }

          if (!memberId) {
            console.warn('Could not extract member ID for lifecycle logging');
            return;
          }

          // Extract additional event data
          const eventData = logConfig.extractEventData
            ? logConfig.extractEventData(args, result)
            : {};

          // Get user who initiated the action
          const initiatedBy = request.user?._id || request.user?.id;
          if (!initiatedBy) {
            console.warn('Could not extract user ID for lifecycle logging');
            return;
          }

          // Log the lifecycle event
          await this.lifecycleService.logLifecycleEvent({
            memberId,
            activityType: logConfig.activityType,
            title: logConfig.title,
            description: logConfig.description,
            priority: this.mapPriority(logConfig.priority),
            requiresFollowUp: logConfig.requiresFollowUp,
            initiatedBy,
            reason: 'System-generated activity log',
            ...eventData,
          });
        } catch (error) {
          console.error('Error logging lifecycle event:', error);
          // Don't throw error to avoid breaking the main operation
        }
      }),
    );
  }

  private mapPriority(priority?: string): ActivityPriority {
    const priorityMap: Record<string, ActivityPriority> = {
      'LOW': ActivityPriority.LOW,
      'MEDIUM': ActivityPriority.MEDIUM,
      'HIGH': ActivityPriority.HIGH,
      'URGENT': ActivityPriority.URGENT,
      'CRITICAL': ActivityPriority.CRITICAL,
    };

    return priorityMap[priority || 'MEDIUM'] || ActivityPriority.MEDIUM;
  }
}