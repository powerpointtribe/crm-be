import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueName } from '../common/interfaces/queue-job.interface';
import { BulkOperationProcessor } from './processors/bulk-operation.processor';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { MembersModule } from '../members/members.module';
import { UsersModule } from '../users/users.module';
import { FirstTimersModule } from '../first-timers/first-timers.module';

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
    forwardRef(() => MembersModule),
    forwardRef(() => UsersModule),
    forwardRef(() => FirstTimersModule),
  ],
  controllers: [QueueController],
  providers: [BulkOperationProcessor, QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
