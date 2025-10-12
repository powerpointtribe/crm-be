import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { QueueName } from '../common/interfaces/queue-job.interface';

@Injectable()
export class BullBoardService implements OnModuleInit {
  private serverAdapter: ExpressAdapter;

  constructor(
    @InjectQueue(QueueName.BULK_OPERATION)
    private bulkOperationQueue: Queue,
    @InjectQueue(QueueName.FIRST_TIMER_NOTIFICATIONS)
    private firstTimerNotificationQueue: Queue,
    @InjectQueue(QueueName.FIRST_TIMER_AUTOMATION)
    private firstTimerAutomationQueue: Queue,
    private configService: ConfigService,
  ) {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');
  }

  onModuleInit() {
    createBullBoard({
      queues: [
        new BullAdapter(this.bulkOperationQueue),
        new BullAdapter(this.firstTimerNotificationQueue),
        new BullAdapter(this.firstTimerAutomationQueue),
      ],
      serverAdapter: this.serverAdapter,
    });
  }

  getRouter() {
    return this.serverAdapter.getRouter();
  }
}