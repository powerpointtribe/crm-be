import { Module, forwardRef, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { QueueName } from '../common/interfaces/queue-job.interface';
import { FirstTimerNotificationProcessor } from './processors/first-timer-notification.processor';
import { AuditLogProcessor } from './processors/audit-log.processor';
import { EmailNotificationProcessor } from './processors/email-notification.processor';
import { ActivityLogProcessor } from './processors/activity-log.processor';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesModule } from '../roles/roles.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ActivityTrackerModule } from '../activity-tracker/activity-tracker.module';
import {
  UserInvitation,
  UserInvitationSchema,
} from '../user-invitations/schemas/user-invitation.schema';

const logger = new Logger('QueueModule');

@Module({
  imports: [
    RolesModule,
    MongooseModule.forFeature([
      { name: UserInvitation.name, schema: UserInvitationSchema },
    ]),
    // Configure Bull with Redis - using standard configuration for reliable processor registration
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get('REDIS_HOST', 'localhost');
        const redisPort = configService.get('REDIS_PORT', 6379);
        const redisPassword = configService.get('REDIS_PASSWORD');
        const redisDb = configService.get('REDIS_DB', 0);

        logger.log(`Bull Redis configuration: host=${redisHost}, port=${redisPort}, db=${redisDb}`);

        return {
          redis: {
            host: redisHost,
            port: redisPort,
            password: redisPassword || undefined,
            db: redisDb,
            maxRetriesPerRequest: null, // Required for Bull
            enableReadyCheck: false, // Faster startup
            retryStrategy: (times: number) => {
              if (times > 10) {
                logger.error('Redis connection failed after 10 retries');
                return null; // Stop retrying
              }
              return Math.min(times * 100, 3000); // Max 3 second backoff
            },
          },
          defaultJobOptions: {
            removeOnComplete: 100, // Keep last 100 completed jobs for debugging
            removeOnFail: 200, // Keep last 200 failed jobs for debugging
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    // Register all queues in one place - this is the single source of truth
    BullModule.registerQueue(
      { name: QueueName.AUDIT_LOGS },
      { name: QueueName.EMAIL_NOTIFICATIONS },
      { name: QueueName.FIRST_TIMER_NOTIFICATIONS },
      { name: QueueName.ACTIVITY_LOGS },
    ),
    NotificationsModule,
    forwardRef(() => AuditLogsModule),
    forwardRef(() => ActivityTrackerModule),
  ],
  controllers: [QueueController],
  providers: [
    // All processors for queues registered in this module
    FirstTimerNotificationProcessor,
    AuditLogProcessor,
    EmailNotificationProcessor,
    ActivityLogProcessor,
    QueueService,
  ],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
