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

// Singleton Redis connections to minimize connection count
let sharedClient: any = null;
let sharedSubscriber: any = null;

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
          // Connection optimization settings
          lazyConnect: true, // Don't connect until first command
          enableOfflineQueue: true, // Queue commands when disconnected
          connectTimeout: 10000,
          disconnectTimeout: 2000,
          // Keep-alive to reduce reconnections
          keepAlive: 30000,
          // Reduce retry overhead
          retryStrategy: (times: number) => {
            if (times > 3) {
              console.warn(`Redis connection retry attempt ${times}, backing off...`);
              return Math.min(times * 1000, 30000); // Max 30 second backoff
            }
            return Math.min(times * 200, 2000);
          },
        };

        console.log('Bull Redis configuration:', {
          host: redisConfig.host,
          port: redisConfig.port,
          db: redisConfig.db,
        });

        // Create shared connection factory - reuses connections across queues
        const createClient = (type: string) => {
          // Reuse client connection for 'client' type (commands)
          if (type === 'client') {
            if (!sharedClient) {
              console.log('Creating shared Bull client connection');
              sharedClient = new Redis(redisConfig);
              sharedClient.on('error', (err: any) => {
                console.error('Bull Redis client error:', err.message);
              });
              sharedClient.on('connect', () => {
                console.log('Bull Redis client connected');
              });
            }
            return sharedClient;
          }

          // Reuse subscriber connection for 'subscriber' type
          if (type === 'subscriber') {
            if (!sharedSubscriber) {
              console.log('Creating shared Bull subscriber connection');
              sharedSubscriber = new Redis(redisConfig);
              sharedSubscriber.on('error', (err: any) => {
                console.error('Bull Redis subscriber error:', err.message);
              });
              sharedSubscriber.on('connect', () => {
                console.log('Bull Redis subscriber connected');
              });
            }
            return sharedSubscriber;
          }

          // For 'bclient' (blocking client), create new but with lazy connect
          console.log(`Creating Bull ${type} connection (on-demand)`);
          const client = new Redis({ ...redisConfig, lazyConnect: true });

          client.on('error', (err: any) => {
            console.error(`Bull Redis ${type} error:`, err.message);
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
    BullModule.registerQueue({
      name: QueueName.ACTIVITY_LOGS,
    }),
    NotificationsModule,
    forwardRef(() => AuditLogsModule),
    forwardRef(() => ActivityTrackerModule),
  ],
  controllers: [QueueController],
  providers: [
    // BulkOperationProcessor, // Temporarily disabled due to circular dependencies
    FirstTimerNotificationProcessor,
    // FirstTimerAutomationProcessor, // Temporarily disabled due to circular dependencies
    AuditLogProcessor,
    EmailNotificationProcessor,
    ActivityLogProcessor,
    QueueService,
  ],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
