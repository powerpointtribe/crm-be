import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { QueueName } from '../common/interfaces/queue-job.interface';
import { BulkOperationProcessor } from './processors/bulk-operation.processor';
import { FirstTimerNotificationProcessor } from './processors/first-timer-notification.processor';
import { FirstTimerAutomationProcessor } from './processors/first-timer-automation.processor';
import { AuditLogProcessor } from './processors/audit-log.processor';
import { EmailNotificationProcessor } from './processors/email-notification.processor';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesModule } from '../roles/roles.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import {
  UserInvitation,
  UserInvitationSchema,
} from '../user-invitations/schemas/user-invitation.schema';

@Module({
  imports: [
    RolesModule,
    MongooseModule.forFeature([
      { name: UserInvitation.name, schema: UserInvitationSchema },
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisConfig = {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxLoadingTimeout: 1000,
          lazyConnect: false,
          keepAlive: 30000,
          onConnect: () => console.log('Bull Redis connected successfully'),
          onReady: () => console.log('Bull Redis ready to accept commands'),
          onError: (err: any) =>
            console.error('Bull Redis connection error:', err),
          onClose: () => console.log('Bull Redis connection closed'),
        };

        console.log('Bull Redis configuration:', {
          host: redisConfig.host,
          port: redisConfig.port,
          db: redisConfig.db,
        });

        return {
          redis: redisConfig,
          defaultJobOptions: {
            removeOnComplete: 50, // Keep 50 completed jobs
            removeOnFail: 100, // Keep 100 failed jobs
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
    BullModule.registerQueue({
      name: QueueName.BULK_OPERATION,
    }),
    BullModule.registerQueue({
      name: QueueName.FIRST_TIMER_NOTIFICATIONS,
    }),
    BullModule.registerQueue({
      name: QueueName.FIRST_TIMER_AUTOMATION,
    }),
    BullModule.registerQueue({
      name: QueueName.AUDIT_LOGS,
    }),
    BullModule.registerQueue({
      name: QueueName.EMAIL_NOTIFICATIONS,
    }),
    NotificationsModule,
    forwardRef(() => AuditLogsModule),
  ],
  controllers: [QueueController],
  providers: [
    // BulkOperationProcessor, // Temporarily disabled due to circular dependencies
    FirstTimerNotificationProcessor,
    // FirstTimerAutomationProcessor, // Temporarily disabled due to circular dependencies
    AuditLogProcessor,
    EmailNotificationProcessor,
    QueueService,
  ],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
