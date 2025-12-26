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
        const Redis = require('ioredis');

        const redisConfig = {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
          maxRetriesPerRequest: null, // Required for Bull
          enableReadyCheck: false,
        };

        console.log('Bull Redis configuration:', {
          host: redisConfig.host,
          port: redisConfig.port,
          db: redisConfig.db,
        });

        // Create shared connection factory
        const createClient = (type: string) => {
          console.log(`Creating Bull ${type} connection`);
          const client = new Redis(redisConfig);

          client.on('error', (err: any) => {
            console.error(`Bull Redis ${type} error:`, err.message);
          });

          client.on('connect', () => {
            console.log(`Bull Redis ${type} connected`);
          });

          client.on('ready', () => {
            console.log(`Bull Redis ${type} ready`);
          });

          return client;
        };

        return {
          createClient,
          defaultJobOptions: {
            removeOnComplete: 50,
            removeOnFail: 100,
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
      name: QueueName.AUDIT_LOGS,
    }),
    BullModule.registerQueue({
      name: QueueName.EMAIL_NOTIFICATIONS,
    }),
    BullModule.registerQueue({
      name: QueueName.FIRST_TIMER_NOTIFICATIONS,
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
