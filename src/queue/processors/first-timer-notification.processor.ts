import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  QueueName,
  FirstTimerNotificationJobData,
} from '../../common/interfaces/queue-job.interface';
import { FirstTimersService } from '../../first-timers/first-timers.service';
import { MembersService } from '../../members/members.service';

@Injectable()
@Processor(QueueName.FIRST_TIMER_NOTIFICATIONS)
export class FirstTimerNotificationProcessor {
  private readonly logger = new Logger(FirstTimerNotificationProcessor.name);

  constructor(
    private firstTimersService: FirstTimersService,
    private membersService: MembersService,
  ) {}

  @Process('first-timer-thank-you-email')
  async handleThankYouEmail(job: Job<string>) {
    this.logger.log(`Processing thank you email for first-timer: ${job.data}`);

    try {
      const firstTimer = await this.firstTimersService.findById(job.data);
      if (!firstTimer || !firstTimer.email) {
        this.logger.warn(`First-timer ${job.data} not found or has no email`);
        return;
      }

      // TODO: Integrate with actual email service (e.g., Resend)
      this.logger.log(`Sending thank you email to ${firstTimer.email}`);

      // Here you would integrate with your email service
      // await this.emailService.sendThankYouEmail(firstTimer);

      return { success: true, email: firstTimer.email };
    } catch (error) {
      this.logger.error(`Failed to send thank you email: ${error.message}`);
      throw error;
    }
  }

  @Process('first-timer-conversion-notification')
  async handleConversionNotification(job: Job<any>) {
    this.logger.log(`Processing conversion notification for job: ${job.id}`);

    try {
      const { firstTimerId, giaLeaderId, memberRecordId } = job.data;

      const [firstTimer, giaLeader, member] = await Promise.all([
        this.firstTimersService.findById(firstTimerId),
        this.membersService.findById(giaLeaderId),
        this.membersService.findById(memberRecordId),
      ]);

      if (!firstTimer || !giaLeader) {
        this.logger.warn(`Missing data for conversion notification`);
        return;
      }

      // TODO: Send email notification to GIA leader
      this.logger.log(
        `Notifying GIA leader ${giaLeader.email} about conversion of ${firstTimer.firstName} ${firstTimer.lastName}`,
      );

      // Here you would integrate with your email service
      // await this.emailService.sendConversionNotification(giaLeader, firstTimer, member);

      return { success: true, giaLeaderEmail: giaLeader.email };
    } catch (error) {
      this.logger.error(
        `Failed to send conversion notification: ${error.message}`,
      );
      throw error;
    }
  }

  @Process('first-timer-follow-up-reminder')
  async handleFollowUpReminder(job: Job<any>) {
    this.logger.log(`Processing follow-up reminder for job: ${job.id}`);

    try {
      const { firstTimerId, reminderType } = job.data;

      const firstTimer = await this.firstTimersService.findById(firstTimerId);
      if (!firstTimer) {
        this.logger.warn(`First-timer ${firstTimerId} not found`);
        return;
      }

      // Send reminder based on type (email/SMS)
      if (reminderType === 'weekly_meeting' && firstTimer.interestedInJoining) {
        this.logger.log(
          `Sending weekly meeting reminder to ${firstTimer.firstName} ${firstTimer.lastName}`,
        );

        // TODO: Send reminder email/SMS
        // await this.emailService.sendWeeklyMeetingReminder(firstTimer);

        // Update reminder count
        await this.firstTimersService.updateReminderCount(firstTimerId);
      }

      return { success: true, firstTimerId };
    } catch (error) {
      this.logger.error(`Failed to send follow-up reminder: ${error.message}`);
      throw error;
    }
  }

  @Process('district-pastor-notification')
  async handleDistrictPastorNotification(job: Job<any>) {
    this.logger.log(
      `Processing district pastor notification for job: ${job.id}`,
    );

    try {
      const { memberId, districtId } = job.data;

      // TODO: Find district pastor and send notification
      this.logger.log(`Notifying district pastor about new member assignment`);

      // Here you would:
      // 1. Find the district pastor for the given district
      // 2. Get member details
      // 3. Send notification email

      return { success: true, memberId, districtId };
    } catch (error) {
      this.logger.error(
        `Failed to send district pastor notification: ${error.message}`,
      );
      throw error;
    }
  }
}
