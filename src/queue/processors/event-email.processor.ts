import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  QueueName,
  JobType,
  EventRegistrationConfirmationJobData,
  PartnerInquiryJobData,
  EventReminderJobData,
  BulkEventEmailJobData,
} from '../../common/interfaces/queue-job.interface';
import { NotificationsService } from '../../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
@Processor(QueueName.EMAIL_NOTIFICATIONS)
export class EventEmailProcessor {
  private readonly logger = new Logger(EventEmailProcessor.name);
  private readonly adminEmail: string;

  constructor(
    private notificationsService: NotificationsService,
    private configService: ConfigService,
  ) {
    this.adminEmail = this.configService.get<string>(
      'ADMIN_EMAIL',
      'admin@powerpointtribe.org'
    );
    this.logger.log('EventEmailProcessor initialized');
  }

  /**
   * Process event registration confirmation emails
   */
  @Process(JobType.EVENT_REGISTRATION_CONFIRMATION)
  async handleRegistrationConfirmation(
    job: Job<EventRegistrationConfirmationJobData>,
  ) {
    this.logger.log(
      `Processing registration confirmation for: ${job.data.registrationId}`,
    );

    try {
      const data = job.data;

      await this.notificationsService.sendEventRegistrationConfirmation({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        eventTitle: data.eventTitle,
        eventDate: data.eventDate,
        eventLocation: data.eventLocation,
        checkInCode: data.checkInCode,
        customFieldResponses: data.customFieldResponses,
      });

      this.logger.log(
        `Registration confirmation sent successfully to ${data.email}`,
      );
      return { success: true, email: data.email };
    } catch (error) {
      this.logger.error(
        `Failed to send registration confirmation: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process partner inquiry confirmation emails (to partner)
   */
  @Process(JobType.PARTNER_INQUIRY_CONFIRMATION)
  async handlePartnerInquiryConfirmation(job: Job<PartnerInquiryJobData>) {
    this.logger.log(
      `Processing partner inquiry confirmation for: ${job.data.partnerId}`,
    );

    try {
      const data = job.data;

      await this.notificationsService.sendPartnerInquiryConfirmation({
        email: data.partnerEmail,
        name: data.partnerName,
        company: data.partnerCompany,
        eventTitle: data.eventTitle,
      });

      this.logger.log(
        `Partner inquiry confirmation sent successfully to ${data.partnerEmail}`,
      );
      return { success: true, email: data.partnerEmail };
    } catch (error) {
      this.logger.error(
        `Failed to send partner inquiry confirmation: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process partner inquiry notification emails (to admin)
   */
  @Process(JobType.PARTNER_INQUIRY_NOTIFICATION)
  async handlePartnerInquiryNotification(job: Job<PartnerInquiryJobData>) {
    this.logger.log(
      `Processing partner inquiry notification for admin: ${job.data.partnerId}`,
    );

    try {
      const data = job.data;
      const adminEmailAddress = data.adminEmail || this.adminEmail;

      await this.notificationsService.sendPartnerInquiryToAdmin({
        adminEmail: adminEmailAddress,
        partnerName: data.partnerName,
        partnerEmail: data.partnerEmail,
        partnerCompany: data.partnerCompany,
        partnerPhone: data.partnerPhone || '',
        eventTitle: data.eventTitle,
        interestDetails: data.interestDetails || '',
        partnerId: data.partnerId,
      });

      this.logger.log(
        `Partner inquiry notification sent successfully to ${adminEmailAddress}`,
      );
      return { success: true, adminEmail: adminEmailAddress };
    } catch (error) {
      this.logger.error(
        `Failed to send partner inquiry notification: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process event reminder emails (T-7, T-3, T-1)
   */
  @Process(JobType.EVENT_REMINDER)
  async handleEventReminder(job: Job<EventReminderJobData>) {
    this.logger.log(
      `Processing event reminder (T-${job.data.daysUntil}) for: ${job.data.registrationId}`,
    );

    try {
      const data = job.data;

      await this.notificationsService.sendEventReminder({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        eventTitle: data.eventTitle,
        eventDate: data.eventDate,
        eventLocation: data.eventLocation,
        checkInCode: data.checkInCode,
        daysUntil: data.daysUntil,
      });

      this.logger.log(
        `Event reminder sent successfully to ${data.email} (T-${data.daysUntil})`,
      );
      return { success: true, email: data.email, daysUntil: data.daysUntil };
    } catch (error) {
      this.logger.error(
        `Failed to send event reminder: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process bulk email to registrations
   */
  @Process(JobType.BULK_REGISTRATION_EMAIL)
  async handleBulkRegistrationEmail(job: Job<BulkEventEmailJobData>) {
    this.logger.log(
      `Processing bulk email to ${job.data.registrations?.length || 0} registrations for event: ${job.data.eventId}`,
    );

    try {
      const { subject, message, registrations = [] } = job.data;
      let sent = 0;
      let failed = 0;

      // Process in batches of 50
      const batchSize = 50;
      for (let i = 0; i < registrations.length; i += batchSize) {
        const batch = registrations.slice(i, i + batchSize);

        const results = await Promise.allSettled(
          batch.map(async (reg) => {
            // Replace template variables
            let personalizedMessage = message
              .replace(/{{firstName}}/g, reg.firstName)
              .replace(/{{lastName}}/g, reg.lastName)
              .replace(/{{checkInCode}}/g, reg.checkInCode || '')
              .replace(/{{email}}/g, reg.email);

            // Replace custom field variables
            if (reg.customFieldResponses) {
              Object.entries(reg.customFieldResponses).forEach(([key, value]) => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                personalizedMessage = personalizedMessage.replace(regex, String(value));
              });
            }

            await this.notificationsService['emailProvider'].sendEmail({
              to: reg.email,
              subject: subject,
              html: personalizedMessage,
            });

            return reg.email;
          }),
        );

        sent += results.filter((r) => r.status === 'fulfilled').length;
        failed += results.filter((r) => r.status === 'rejected').length;

        // Log failures for debugging
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            this.logger.warn(
              `Failed to send bulk email to ${batch[index].email}: ${result.reason?.message || 'Unknown error'}`,
            );
          }
        });

        // Add small delay between batches to avoid rate limits
        if (i + batchSize < registrations.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.logger.log(
        `Bulk registration email completed for event ${job.data.eventId}: ${sent} sent, ${failed} failed`,
      );

      return { success: failed === 0, sent, failed };
    } catch (error) {
      this.logger.error(
        `Failed to process bulk registration email: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process bulk email to partners
   */
  @Process(JobType.BULK_PARTNER_EMAIL)
  async handleBulkPartnerEmail(job: Job<BulkEventEmailJobData>) {
    this.logger.log(
      `Processing bulk email to ${job.data.partners?.length || 0} partners for event: ${job.data.eventId}`,
    );

    try {
      const { subject, message, partners = [] } = job.data;
      let sent = 0;
      let failed = 0;

      // Process in batches of 50
      const batchSize = 50;
      for (let i = 0; i < partners.length; i += batchSize) {
        const batch = partners.slice(i, i + batchSize);

        const results = await Promise.allSettled(
          batch.map(async (partner) => {
            // Replace template variables
            const personalizedMessage = message
              .replace(/{{name}}/g, partner.name)
              .replace(/{{company}}/g, partner.company || '')
              .replace(/{{email}}/g, partner.email);

            await this.notificationsService['emailProvider'].sendEmail({
              to: partner.email,
              subject: subject,
              html: personalizedMessage,
            });

            return partner.email;
          }),
        );

        sent += results.filter((r) => r.status === 'fulfilled').length;
        failed += results.filter((r) => r.status === 'rejected').length;

        // Log failures for debugging
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            this.logger.warn(
              `Failed to send bulk email to partner ${batch[index].email}: ${result.reason?.message || 'Unknown error'}`,
            );
          }
        });

        // Add small delay between batches to avoid rate limits
        if (i + batchSize < partners.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.logger.log(
        `Bulk partner email completed for event ${job.data.eventId}: ${sent} sent, ${failed} failed`,
      );

      return { success: failed === 0, sent, failed };
    } catch (error) {
      this.logger.error(
        `Failed to process bulk partner email: ${error.message}`,
      );
      throw error;
    }
  }
}
