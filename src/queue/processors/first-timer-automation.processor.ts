import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  QueueName,
  FirstTimerAutomationJobData,
} from '../../common/interfaces/queue-job.interface';
import { FirstTimersService } from '../../first-timers/first-timers.service';
import { QueueService } from '../queue.service';
import { EngagementStatus } from '../../common/enums/engagement-status.enum';

@Injectable()
@Processor(QueueName.FIRST_TIMER_AUTOMATION)
export class FirstTimerAutomationProcessor {
  private readonly logger = new Logger(FirstTimerAutomationProcessor.name);

  constructor(
    private firstTimersService: FirstTimersService,
    private queueService: QueueService,
  ) {}

  @Process('first-timer-status-transition')
  async handleStatusTransition(job: Job<FirstTimerAutomationJobData>) {
    this.logger.log(`Processing status transition check: ${job.id}`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 14); // 14 days ago

      // Find first-timers that have been in NEW or FOLLOWING_UP status for more than 14 days
      const staleFirstTimers =
        await this.firstTimersService.findStaleFirstTimers(cutoffDate);

      for (const firstTimer of staleFirstTimers) {
        this.logger.log(
          `Transitioning first-timer ${firstTimer._id} to NOT_JOINED status`,
        );

        await this.firstTimersService.update(
          (firstTimer._id as string).toString(),
          { status: EngagementStatus.NOT_JOINED },
        );
      }

      return {
        success: true,
        processed: staleFirstTimers.length,
        cutoffDate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process status transitions: ${error.message}`,
      );
      throw error;
    }
  }

  @Process('first-timer-weekly-reminder')
  async handleWeeklyReminder(job: Job<FirstTimerAutomationJobData>) {
    this.logger.log(`Processing weekly reminder check: ${job.id}`);

    try {
      // Find first-timers who are interested in joining and haven't received too many reminders
      const interestedFirstTimers =
        await this.firstTimersService.findInterestedFirstTimers();

      for (const firstTimer of interestedFirstTimers) {
        // Check if it's been a week since last reminder
        const lastReminderDate =
          firstTimer.lastReminderSent || firstTimer.createdAt;
        const daysSinceLastReminder = Math.floor(
          (Date.now() - lastReminderDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Send reminder if it's been 6+ days and less than 3 reminders sent
        if (daysSinceLastReminder >= 6 && firstTimer.remindersSent < 3) {
          // Schedule reminder for tomorrow (day before meeting)
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(10, 0, 0, 0); // 10 AM tomorrow

          const delay = tomorrow.getTime() - Date.now();

          await this.queueService.addDelayedJob(
            'first-timer-follow-up-reminder',
            {
              firstTimerId: firstTimer._id,
              reminderType: 'weekly_meeting',
            },
            delay,
          );

          this.logger.log(
            `Scheduled weekly reminder for ${firstTimer.firstName} ${firstTimer.lastName}`,
          );
        }
      }

      return {
        success: true,
        processed: interestedFirstTimers.length,
      };
    } catch (error) {
      this.logger.error(`Failed to process weekly reminders: ${error.message}`);
      throw error;
    }
  }

  @Process('first-timer-follow-up-check')
  async handleFollowUpCheck(job: Job<FirstTimerAutomationJobData>) {
    this.logger.log(`Processing follow-up check: ${job.id}`);

    try {
      // Find first-timers who need follow-up
      const needingFollowUpResult =
        await this.firstTimersService.getNeedingFollowUp();

      for (const firstTimer of needingFollowUpResult.data) {
        // Send notification to assigned follow-up person or GIA leader
        const assignedPersonId =
          firstTimer.followUpPerson ||
          firstTimer.assignedTo ||
          firstTimer.giaLeader;

        if (assignedPersonId) {
          await this.queueService.addJob('follow-up-task-notification', {
            firstTimerId: firstTimer._id,
            assignedPersonId,
            type: 'follow_up_needed',
          });

          this.logger.log(
            `Sent follow-up notification for ${firstTimer.firstName} ${firstTimer.lastName}`,
          );
        }
      }

      return {
        success: true,
        processed: needingFollowUpResult.total,
      };
    } catch (error) {
      this.logger.error(`Failed to process follow-up checks: ${error.message}`);
      throw error;
    }
  }
}
