import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { FirstTimerAutomationJobData } from '../common/interfaces/queue-job.interface';

@Injectable()
export class FirstTimerSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(FirstTimerSchedulerService.name);

  constructor(private queueService: QueueService) {}

  async onModuleInit() {
    await this.setupRecurringJobs();
  }

  private async setupRecurringJobs() {
    try {
      // Daily status transition check (runs at 2 AM every day)
      const statusTransitionData: FirstTimerAutomationJobData = {
        type: 'status_transition',
        checkDate: new Date(),
      };

      await this.queueService.scheduleRecurringJob(
        'first-timer-status-transition',
        statusTransitionData,
        '0 2 * * *', // 2 AM daily
      );

      // Weekly reminder check (runs at 8 AM every Monday)
      const weeklyReminderData: FirstTimerAutomationJobData = {
        type: 'weekly_reminder',
        checkDate: new Date(),
      };

      await this.queueService.scheduleRecurringJob(
        'first-timer-weekly-reminder',
        weeklyReminderData,
        '0 8 * * 1', // 8 AM every Monday
      );

      // Follow-up check (runs at 9 AM every day)
      const followUpCheckData: FirstTimerAutomationJobData = {
        type: 'follow_up_reminder',
        checkDate: new Date(),
      };

      await this.queueService.scheduleRecurringJob(
        'first-timer-follow-up-check',
        followUpCheckData,
        '0 9 * * *', // 9 AM daily
      );

      this.logger.log('First-timer recurring jobs set up successfully');
    } catch (error) {
      this.logger.error('Failed to set up recurring jobs:', error);
    }
  }

  // Manual trigger methods for testing
  async triggerStatusTransition() {
    const data: FirstTimerAutomationJobData = {
      type: 'status_transition',
      checkDate: new Date(),
    };

    return this.queueService.addAutomationJob(
      'first-timer-status-transition',
      data,
    );
  }

  async triggerWeeklyReminder() {
    const data: FirstTimerAutomationJobData = {
      type: 'weekly_reminder',
      checkDate: new Date(),
    };

    return this.queueService.addAutomationJob(
      'first-timer-weekly-reminder',
      data,
    );
  }

  async triggerFollowUpCheck() {
    const data: FirstTimerAutomationJobData = {
      type: 'follow_up_reminder',
      checkDate: new Date(),
    };

    return this.queueService.addAutomationJob(
      'first-timer-follow-up-check',
      data,
    );
  }
}
