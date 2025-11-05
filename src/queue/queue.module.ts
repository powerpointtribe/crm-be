import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueName } from '../common/interfaces/queue-job.interface';
import { BulkOperationProcessor } from './processors/bulk-operation.processor';
import { FirstTimerNotificationProcessor } from './processors/first-timer-notification.processor';
import { FirstTimerAutomationProcessor } from './processors/first-timer-automation.processor';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { MembersModule } from '../members/members.module';
import { FirstTimersModule } from '../first-timers/first-timers.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxLoadingTimeout: 1000,
          lazyConnect: true,
          keepAlive: 30000,
        },
        defaultJobOptions: {
          removeOnComplete: 50, // Keep 50 completed jobs
          removeOnFail: 100, // Keep 100 failed jobs
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
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
    forwardRef(() => MembersModule),
    forwardRef(() => FirstTimersModule),
    NotificationsModule,
  ],
  controllers: [QueueController],
  providers: [
    BulkOperationProcessor,
    FirstTimerNotificationProcessor,
    FirstTimerAutomationProcessor,
    QueueService,
  ],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
