import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  QueueName,
  FirstTimerNotificationJobData,
  JobType,
} from '../../common/interfaces/queue-job.interface';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
@Processor(QueueName.FIRST_TIMER_NOTIFICATIONS)
export class FirstTimerNotificationProcessor {
  private readonly logger = new Logger(FirstTimerNotificationProcessor.name);

  constructor(private notificationsService: NotificationsService) {
    this.logger.log('FirstTimerNotificationProcessor initialized');
  }

  @Process(JobType.FIRST_TIMER_THANK_YOU_EMAIL)
  async handleThankYouEmail(job: Job<FirstTimerNotificationJobData>) {
    this.logger.log(
      `Processing thank you email for first-timer: ${job.data.firstTimerId}`,
    );

    try {
      const { additionalData } = job.data;
      const { email, firstName, lastName } = additionalData || {};

      if (!email) {
        this.logger.warn(
          `First-timer ${job.data.firstTimerId} has no email data provided`,
        );
        return { success: false, reason: 'No email data provided' };
      }

      await this.notificationsService.sendFirstTimerThankYouEmail({
        email,
        firstName: firstName || 'Friend',
        lastName: lastName || '',
      });

      this.logger.log(`Thank you email sent successfully to ${email}`);
      return { success: true, email };
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
      const {
        firstTimerName,
        giaLeaderEmail,
        giaLeaderName,
        memberName,
        conversionDate,
      } = additionalData || {};

      if (!firstTimerName || !giaLeaderEmail || !giaLeaderName) {
        this.logger.warn(`Missing data for conversion notification`);
        return {
          success: false,
          reason: 'Missing first-timer or GIA leader data',
        };
      }

      await this.notificationsService.sendConversionNotification({
        giaLeaderEmail,
        giaLeaderName,
        firstTimerName,
        memberName: memberName || 'New Member',
        conversionDate: conversionDate || new Date().toLocaleDateString(),
      });

      this.logger.log(
        `Conversion notification sent to GIA leader ${giaLeaderEmail}`,
      );

      return { success: true, giaLeaderEmail };
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

      const { email, firstName, lastName, interestedInJoining } =
        additionalData || {};

      if (!email) {
        this.logger.warn(
          `First-timer ${firstTimerId} has no email data provided`,
        );
        return { success: false, reason: 'No email data provided' };
      }

      // Send reminder based on type
      if (reminderType === 'weekly_meeting' && interestedInJoining) {
        await this.notificationsService.sendWeeklyMeetingReminder({
          email,
          firstName: firstName || 'Friend',
          lastName: lastName || '',
          meetingDetails: additionalData?.meetingDetails,
        });

        this.logger.log(
          `Weekly meeting reminder sent to ${firstName} ${lastName}`,
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
      const { message, email, firstName, lastName, messageSent } =
        additionalData || {};

      if (!email) {
        this.logger.warn(
          `First-timer ${firstTimerId} has no email data provided`,
        );
        return { success: false, reason: 'No email data provided' };
      }

      // Check if message was already sent
      if (messageSent) {
        this.logger.warn(`Message already sent to first-timer ${firstTimerId}`);
        return { success: false, reason: 'Message already sent' };
      }

      // Use the provided message or default
      const messageToSend = message || 'Thank you for visiting our church!';

      try {
        await this.notificationsService.sendCustomFirstTimerMessage({
          email,
          firstName: firstName || 'Friend',
          lastName: lastName || '',
          customMessage: messageToSend,
        });

        // Note: Message history tracking would be updated here
        // This is handled separately to avoid circular dependencies

        this.logger.log(`Message sent to ${email}`);
        return { success: true, email };
      } catch (emailError) {
        this.logger.error(
          `Failed to send first-timer message: ${emailError.message}`,
        );

        // Note: Message history failure tracking would be updated here
        // This is handled separately to avoid circular dependencies

        throw emailError;
      }
    } catch (error) {
      this.logger.error(
        `Failed to process first-timer message job: ${error.message}`,
      );
      throw error;
    }
  }

  // Legacy assignment notification processors removed
  // Use SEND_MEMBER_FOLLOWUP_ASSIGNMENT instead

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

  @Process(JobType.SEND_MEMBER_FOLLOWUP_ASSIGNMENT)
  async handleMemberFollowupAssignment(
    job: Job<FirstTimerNotificationJobData>,
  ) {
    this.logger.log(
      `Processing member followup assignment notification for job: ${job.id}`,
    );

    try {
      const { additionalData } = job.data;
      const {
        memberEmail,
        memberName,
        firstTimers,
        assignmentType,
        assignedBy,
      } = additionalData || {};

      if (!memberEmail || !firstTimers?.length) {
        this.logger.warn(
          'Missing required data for member followup assignment notification',
        );
        return {
          success: false,
          reason: 'Missing member email or first-timers data',
        };
      }

      await this.notificationsService.sendMemberFollowupAssignmentNotification({
        memberEmail,
        memberName: memberName || 'Team Member',
        firstTimers: firstTimers.map((ft: any) => ({
          firstName: ft.firstName,
          lastName: ft.lastName,
          phone: ft.phone,
          email: ft.email,
          dateOfVisit: ft.dateOfVisit
            ? new Date(ft.dateOfVisit).toLocaleDateString()
            : new Date().toLocaleDateString(),
        })),
        assignmentType: assignmentType || 'followup', // 'followup' or 'assignment'
        assignedBy: assignedBy || 'Church Leadership',
      });

      this.logger.log(
        `Member followup assignment notification sent to ${memberEmail}`,
      );
      return { success: true, memberEmail, count: firstTimers.length };
    } catch (error) {
      this.logger.error(
        `Failed to send member followup assignment notification: ${error.message}`,
      );
      throw error;
    }
  }
}
