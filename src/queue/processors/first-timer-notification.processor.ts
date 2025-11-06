import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  QueueName,
  FirstTimerNotificationJobData,
  JobType,
} from '../../common/interfaces/queue-job.interface';
import { FirstTimersService } from '../../first-timers/first-timers.service';
import { FirstTimerMessagingService } from '../../first-timers/first-timer-messaging.service';
import { MembersService } from '../../members/members.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
@Processor(QueueName.FIRST_TIMER_NOTIFICATIONS)
export class FirstTimerNotificationProcessor {
  private readonly logger = new Logger(FirstTimerNotificationProcessor.name);

  constructor(
    private firstTimersService: FirstTimersService,
    private firstTimerMessagingService: FirstTimerMessagingService,
    private membersService: MembersService,
    private notificationsService: NotificationsService,
  ) {}

  @Process(JobType.FIRST_TIMER_THANK_YOU_EMAIL)
  async handleThankYouEmail(job: Job<FirstTimerNotificationJobData>) {
    this.logger.log(
      `Processing thank you email for first-timer: ${job.data.firstTimerId}`,
    );

    try {
      const firstTimer = await this.firstTimersService.findById(
        job.data.firstTimerId,
      );
      if (!firstTimer || !firstTimer.email) {
        this.logger.warn(
          `First-timer ${job.data.firstTimerId} not found or has no email`,
        );
        return { success: false, reason: 'First-timer not found or no email' };
      }

      await this.notificationsService.sendFirstTimerThankYouEmail({
        email: firstTimer.email,
        firstName: firstTimer.firstName,
        lastName: firstTimer.lastName,
      });

      this.logger.log(
        `Thank you email sent successfully to ${firstTimer.email}`,
      );
      return { success: true, email: firstTimer.email };
    } catch (error) {
      this.logger.error(`Failed to send thank you email: ${error.message}`);
      throw error;
    }
  }

  @Process(JobType.FIRST_TIMER_CONVERSION_NOTIFICATION)
  async handleConversionNotification(job: Job<FirstTimerNotificationJobData>) {
    this.logger.log(`Processing conversion notification for job: ${job.id}`);

    try {
      const { firstTimerId, additionalData } = job.data;
      const { giaLeaderId, memberRecordId } = additionalData || {};

      const [firstTimer, giaLeader, member] = await Promise.all([
        this.firstTimersService.findById(firstTimerId),
        giaLeaderId ? this.membersService.findById(giaLeaderId) : null,
        memberRecordId ? this.membersService.findById(memberRecordId) : null,
      ]);

      if (!firstTimer || !giaLeader) {
        this.logger.warn(`Missing data for conversion notification`);
        return {
          success: false,
          reason: 'Missing first-timer or GIA leader data',
        };
      }

      await this.notificationsService.sendConversionNotification({
        giaLeaderEmail: giaLeader.email,
        giaLeaderName: `${giaLeader.firstName} ${giaLeader.lastName}`,
        firstTimerName: `${firstTimer.firstName} ${firstTimer.lastName}`,
        memberName: member
          ? `${member.firstName} ${member.lastName}`
          : 'New Member',
        conversionDate: new Date().toLocaleDateString(),
      });

      this.logger.log(
        `Conversion notification sent to GIA leader ${giaLeader.email}`,
      );

      return { success: true, giaLeaderEmail: giaLeader.email };
    } catch (error) {
      this.logger.error(
        `Failed to send conversion notification: ${error.message}`,
      );
      throw error;
    }
  }

  @Process(JobType.FIRST_TIMER_FOLLOW_UP_REMINDER)
  async handleFollowUpReminder(job: Job<FirstTimerNotificationJobData>) {
    this.logger.log(`Processing follow-up reminder for job: ${job.id}`);

    try {
      const { firstTimerId, additionalData } = job.data;
      const { reminderType } = additionalData || {};

      const firstTimer = await this.firstTimersService.findById(firstTimerId);
      if (!firstTimer) {
        this.logger.warn(`First-timer ${firstTimerId} not found`);
        return { success: false, reason: 'First-timer not found' };
      }

      if (!firstTimer.email) {
        this.logger.warn(`First-timer ${firstTimerId} has no email address`);
        return { success: false, reason: 'No email address' };
      }

      // Send reminder based on type
      if (reminderType === 'weekly_meeting' && firstTimer.interestedInJoining) {
        await this.notificationsService.sendWeeklyMeetingReminder({
          email: firstTimer.email,
          firstName: firstTimer.firstName,
          lastName: firstTimer.lastName,
          meetingDetails: additionalData?.meetingDetails,
        });

        // Update reminder count
        await this.firstTimersService.updateReminderCount(firstTimerId);

        this.logger.log(
          `Weekly meeting reminder sent to ${firstTimer.firstName} ${firstTimer.lastName}`,
        );
      }

      return { success: true, firstTimerId, reminderType };
    } catch (error) {
      this.logger.error(`Failed to send follow-up reminder: ${error.message}`);
      throw error;
    }
  }

  @Process(JobType.DISTRICT_PASTOR_NOTIFICATION)
  async handleDistrictPastorNotification(
    job: Job<FirstTimerNotificationJobData>,
  ) {
    this.logger.log(
      `Processing district pastor notification for job: ${job.id}`,
    );

    try {
      const { additionalData } = job.data;
      const {
        memberId,
        districtId,
        newMembers,
        districtName,
        pastorEmail,
        pastorName,
      } = additionalData || {};

      if (!pastorEmail || !newMembers?.length) {
        this.logger.warn(
          'Missing required data for district pastor notification',
        );
        return {
          success: false,
          reason: 'Missing pastor email or member data',
        };
      }

      await this.notificationsService.sendDistrictPastorNotification({
        pastorEmail,
        pastorName: pastorName || 'Pastor',
        newMembers: newMembers.map((member: any) => ({
          firstName: member.firstName,
          lastName: member.lastName,
          phone: member.phone,
          email: member.email,
          integratedDate:
            member.integratedDate || new Date().toLocaleDateString(),
        })),
        districtName: districtName || 'Your District',
      });

      this.logger.log(`District pastor notification sent to ${pastorEmail}`);
      return { success: true, pastorEmail, memberCount: newMembers.length };
    } catch (error) {
      this.logger.error(
        `Failed to send district pastor notification: ${error.message}`,
      );
      throw error;
    }
  }

  // New processors for additional job types
  @Process(JobType.SEND_FIRST_TIMER_MESSAGE)
  async handleSendFirstTimerMessage(job: Job<FirstTimerNotificationJobData>) {
    this.logger.log(`Processing first-timer message for job: ${job.id}`);

    try {
      const { firstTimerId, additionalData } = job.data;
      const { message, scheduledTime } = additionalData || {};

      const firstTimer = await this.firstTimersService.findById(firstTimerId);
      if (!firstTimer || !firstTimer.email) {
        this.logger.warn(
          `First-timer ${firstTimerId} not found or has no email`,
        );
        return { success: false, reason: 'First-timer not found or no email' };
      }

      // Check if message was already sent
      if (firstTimer.messageSent) {
        this.logger.warn(`Message already sent to first-timer ${firstTimerId}`);
        return { success: false, reason: 'Message already sent' };
      }

      // Use the pre-filled message or provided message
      const messageToSend = message || firstTimer.preFilledMessage || 'Thank you for visiting our church!';

      try {
        await this.notificationsService.sendCustomFirstTimerMessage({
          email: firstTimer.email,
          firstName: firstTimer.firstName,
          lastName: firstTimer.lastName,
          customMessage: messageToSend,
        });

        // Update first timer as message sent
        await this.firstTimersService.updateMessageSent(firstTimerId);

        // Update message history to mark as sent
        const sentAt = new Date();
        await this.firstTimerMessagingService.updateMessageHistoryAsSent(
          firstTimerId,
          sentAt,
          messageToSend
        );

        this.logger.log(`Message sent to ${firstTimer.email}`);
        return { success: true, email: firstTimer.email };
      } catch (emailError) {
        this.logger.error(
          `Failed to send first-timer message: ${emailError.message}`,
        );

        // Update message history to mark as failed
        try {
          await this.firstTimerMessagingService.updateMessageHistoryAsFailed(
            firstTimerId,
            messageToSend,
            emailError.message
          );
        } catch (historyError) {
          this.logger.error(`Failed to update message history as failed: ${historyError.message}`);
        }

        throw emailError;
      }
    } catch (error) {
      this.logger.error(
        `Failed to process first-timer message job: ${error.message}`,
      );
      throw error;
    }
  }

  @Process(JobType.SEND_ASSIGNMENT_NOTIFICATION)
  async handleAssignmentNotification(job: Job<FirstTimerNotificationJobData>) {
    this.logger.log(`Processing assignment notification for job: ${job.id}`);

    try {
      const { additionalData } = job.data;
      const { assigneeEmail, assigneeName, firstTimers, assignedBy } =
        additionalData || {};

      if (!assigneeEmail || !firstTimers?.length) {
        this.logger.warn('Missing required data for assignment notification');
        return {
          success: false,
          reason: 'Missing assignee email or first-timers data',
        };
      }

      await this.notificationsService.sendFirstTimerAssignmentNotification({
        assigneeEmail,
        assigneeName: assigneeName || 'Team Member',
        firstTimers: firstTimers.map((ft: any) => ({
          firstName: ft.firstName,
          lastName: ft.lastName,
          phone: ft.phone,
          email: ft.email,
          dateOfVisit: ft.dateOfVisit || new Date().toLocaleDateString(),
        })),
        assignedBy: assignedBy || 'Church Leadership',
      });

      this.logger.log(`Assignment notification sent to ${assigneeEmail}`);
      return { success: true, assigneeEmail, count: firstTimers.length };
    } catch (error) {
      this.logger.error(
        `Failed to send assignment notification: ${error.message}`,
      );
      throw error;
    }
  }

  @Process(JobType.SEND_BULK_ASSIGNMENT_NOTIFICATION)
  async handleBulkAssignmentNotification(
    job: Job<FirstTimerNotificationJobData>,
  ) {
    this.logger.log(
      `Processing bulk assignment notification for job: ${job.id}`,
    );

    try {
      const { additionalData } = job.data;
      const { assigneeEmail, assigneeName, assignments, assignedBy } =
        additionalData || {};

      if (!assigneeEmail || !assignments?.length) {
        this.logger.warn(
          'Missing required data for bulk assignment notification',
        );
        return {
          success: false,
          reason: 'Missing assignee email or assignments data',
        };
      }

      await this.notificationsService.sendBulkAssignmentNotification({
        assigneeEmail,
        assigneeName: assigneeName || 'Team Member',
        assignments,
        assignedBy: assignedBy || 'Church Leadership',
      });

      this.logger.log(`Bulk assignment notification sent to ${assigneeEmail}`);
      return { success: true, assigneeEmail, count: assignments.length };
    } catch (error) {
      this.logger.error(
        `Failed to send bulk assignment notification: ${error.message}`,
      );
      throw error;
    }
  }

  @Process(JobType.CREATE_MEMBER_FROM_FIRST_TIMER)
  async handleCreateMemberFromFirstTimer(
    job: Job<FirstTimerNotificationJobData>,
  ) {
    this.logger.log(
      `Processing member creation notification for job: ${job.id}`,
    );

    try {
      const { firstTimerId, additionalData } = job.data;
      const { adminEmail, adminName, memberName, memberEmail, conversionDate } =
        additionalData || {};

      if (!adminEmail) {
        this.logger.warn(
          'Missing admin email for member creation notification',
        );
        return { success: false, reason: 'Missing admin email' };
      }

      await this.notificationsService.sendMemberCreationNotification({
        adminEmail,
        adminName: adminName || 'Administrator',
        memberName: memberName || 'New Member',
        memberEmail: memberEmail || '',
        firstTimerId,
        conversionDate: conversionDate || new Date().toLocaleDateString(),
      });

      this.logger.log(`Member creation notification sent to ${adminEmail}`);
      return { success: true, adminEmail, firstTimerId };
    } catch (error) {
      this.logger.error(
        `Failed to send member creation notification: ${error.message}`,
      );
      throw error;
    }
  }
}
