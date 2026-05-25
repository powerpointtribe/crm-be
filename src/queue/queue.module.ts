import { Module, forwardRef, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import * as Redis from 'ioredis';
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
import { EmailTemplateSharedModule } from '../bulk-email/email-template-shared.module';
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
    // Configure Bull with Redis - using createClient to add keep-alive PINGs
    // to prevent network proxies/firewalls from dropping idle connections
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get('REDIS_HOST', 'localhost');
        const redisPort = configService.get('REDIS_PORT', 6379);
        const redisPassword = configService.get('REDIS_PASSWORD');
        const redisDb = configService.get('REDIS_DB', 0);

        logger.log(`Bull Redis configuration: host=${redisHost}, port=${redisPort}, db=${redisDb}`);

        const redisOptions: Redis.RedisOptions = {
          host: redisHost,
          port: Number(redisPort),
          password: redisPassword || undefined,
          db: Number(redisDb),
          maxRetriesPerRequest: null, // Required for Bull
          enableReadyCheck: false, // Faster startup
          connectTimeout: 10000, // 10s connection timeout
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 1000, 15000);
            if (times <= 5) {
              logger.warn(`Redis connection retry #${times} in ${delay}ms...`);
            } else if (times % 10 === 0) {
              logger.error(`Redis still reconnecting (attempt #${times})...`);
            }
            return delay;
          },
        };

        return {
          redis: redisOptions,
          createClient: (type: string, config?: Redis.RedisOptions) => {
            logger.log(`createClient called: type=${type}`);
            const opts = config || redisOptions;
            const client = new Redis.default(opts);
            // Send periodic PINGs to prevent idle connection drops by network proxies/firewalls.
            // bclient uses BRPOP (blocking) so it stays active naturally.
            if (type !== 'bclient') {
              let pingInterval: ReturnType<typeof setInterval>;
              client.on('ready', () => {
                pingInterval = setInterval(() => {
                  client.ping().catch(() => {});
                }, 2000);
              });
              client.on('close', () => {
                if (pingInterval) clearInterval(pingInterval);
              });
              client.on('end', () => {
                if (pingInterval) clearInterval(pingInterval);
              });
            }
            return client;
          },
          // Short drain delay keeps bclient (BRPOP) connections active,
          // preventing network proxies from dropping idle TCP connections
          settings: {
            drainDelay: 1, // 1 second BRPOP timeout (default: 5)
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
    EmailTemplateSharedModule,
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
