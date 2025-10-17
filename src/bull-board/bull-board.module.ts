import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullBoardService } from './bull-board.service';
import { QueueName } from '../common/interfaces/queue-job.interface';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QueueName.BULK_OPERATION,
    }),
    BullModule.registerQueue({
      name: QueueName.FIRST_TIMER_NOTIFICATIONS,
    }),
    BullModule.registerQueue({
      name: QueueName.FIRST_TIMER_AUTOMATION,
    }),
  ],
  providers: [BullBoardService],
  exports: [BullBoardService],
})
export class BullBoardModule {}
