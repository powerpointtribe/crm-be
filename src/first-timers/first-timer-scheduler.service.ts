import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { QueueService } from '../queue/queue.service';
import { FirstTimerAutomationJobData } from '../common/interfaces/queue-job.interface';
import { FirstTimersService } from './first-timers.service';
import { EmailProvider } from '../notifications/providers/email.provider';

@Injectable()
export class FirstTimerSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(FirstTimerSchedulerService.name);

  constructor(
    private queueService: QueueService,
    private firstTimersService: FirstTimersService,
    private emailProvider: EmailProvider,
    private configService: ConfigService,
  ) {}

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

      // Auto-archive check (runs at 3 AM every Sunday - once a week)
      // Archives first timers with >3 follow-ups and 6 months since visit
      const autoArchiveData: FirstTimerAutomationJobData = {
        type: 'auto_archive',
        checkDate: new Date(),
      };

      await this.queueService.scheduleRecurringJob(
        'first-timer-auto-archive',
        autoArchiveData,
        '0 3 * * 0', // 3 AM every Sunday (once a week)
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

  /**
   * Trigger auto-archive process
   * Archives first timers with more than 3 follow-ups and 6 months since first visit
   */
  async triggerAutoArchive() {
    this.logger.log('Triggering auto-archive process...');
    const result = await this.firstTimersService.runAutoArchive();
    this.logger.log(`Auto-archive completed: ${result.archivedCount} first-timers archived`);
    return result;
  }

  // ==================== FOLLOW-UP REMINDER EMAILS ====================

  /**
   * Send follow-up reminder emails daily at 3 PM
   */
  @Cron('0 15 * * *') // 3 PM daily
  async sendFollowUpReminderEmails(): Promise<{
    sent: number;
    failed: number;
    skipped: number;
  }> {
    this.logger.log('Starting daily follow-up reminder email job...');

    const result = { sent: 0, failed: 0, skipped: 0 };

    try {
      const dueFollowUps = await this.firstTimersService.findFollowUpsDueToday();

      if (dueFollowUps.length === 0) {
        this.logger.log('No follow-up reminders due today');
        return result;
      }

      this.logger.log(`Found ${dueFollowUps.length} first-timers with reminders due today`);

      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.example.com';

      for (const { firstTimer, dueFollowUps: followUps } of dueFollowUps) {
        // Get the email of the person who created the follow-up (contactedBy)
        // or fall back to the assigned person
        for (const followUp of followUps) {
          const contactedBy = followUp.contactedBy as any;
          const assignedTo = firstTimer.assignedTo as any;

          // Determine recipient - prefer the person who created the follow-up
          const recipientEmail = contactedBy?.email || assignedTo?.email;
          const recipientName = contactedBy
            ? `${contactedBy.firstName} ${contactedBy.lastName}`
            : assignedTo
              ? `${assignedTo.firstName} ${assignedTo.lastName}`
              : 'Team Member';

          if (!recipientEmail) {
            this.logger.warn(
              `No email found for follow-up reminder for ${firstTimer.firstName} ${firstTimer.lastName}`,
            );
            result.skipped++;
            continue;
          }

          try {
            const firstTimerUrl = `${frontendUrl}/first-timers/${(firstTimer._id as any).toString()}`;

            await this.emailProvider.sendEmail({
              to: recipientEmail,
              subject: `Follow-up Reminder: ${firstTimer.firstName} ${firstTimer.lastName}`,
              html: this.generateFollowUpReminderEmail({
                recipientName,
                firstTimerName: `${firstTimer.firstName} ${firstTimer.lastName}`,
                firstTimerPhone: firstTimer.phone,
                firstTimerEmail: firstTimer.email,
                previousNotes: followUp.notes,
                previousOutcome: followUp.outcome,
                previousMethod: followUp.method,
                firstTimerUrl,
              }),
            });

            this.logger.log(
              `Sent follow-up reminder to ${recipientEmail} for ${firstTimer.firstName} ${firstTimer.lastName}`,
            );
            result.sent++;
          } catch (error) {
            this.logger.error(
              `Failed to send reminder email to ${recipientEmail}: ${error.message}`,
            );
            result.failed++;
          }
        }
      }

      this.logger.log(
        `Follow-up reminder job completed: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Follow-up reminder job failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate HTML email for follow-up reminder
   */
  private generateFollowUpReminderEmail(data: {
    recipientName: string;
    firstTimerName: string;
    firstTimerPhone: string;
    firstTimerEmail?: string;
    previousNotes?: string;
    previousOutcome: string;
    previousMethod: string;
    firstTimerUrl: string;
  }): string {
    const outcomeLabels: Record<string, string> = {
      successful: 'Successful',
      interested: 'Interested',
      no_answer: 'No Answer',
      busy: 'Busy',
      not_interested: 'Not Interested',
      follow_up_needed: 'Follow-up Needed',
    };

    const methodLabels: Record<string, string> = {
      phone: 'Phone Call',
      email: 'Email',
      sms: 'SMS',
      whatsapp: 'WhatsApp',
      visit: 'Home Visit',
      video_call: 'Video Call',
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Follow-up Reminder</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Follow-up Reminder</h1>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin-top: 0;">Hi ${data.recipientName},</p>

          <p>This is a friendly reminder to follow up with <strong>${data.firstTimerName}</strong> today.</p>

          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937; font-size: 16px;">Contact Information</h3>
            <p style="margin: 8px 0;"><strong>Name:</strong> ${data.firstTimerName}</p>
            <p style="margin: 8px 0;"><strong>Phone:</strong> <a href="tel:${data.firstTimerPhone}" style="color: #2563eb;">${data.firstTimerPhone}</a></p>
            ${data.firstTimerEmail ? `<p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${data.firstTimerEmail}" style="color: #2563eb;">${data.firstTimerEmail}</a></p>` : ''}
          </div>

          <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #92400e; font-size: 16px;">Previous Follow-up</h3>
            <p style="margin: 8px 0;"><strong>Method:</strong> ${methodLabels[data.previousMethod] || data.previousMethod}</p>
            <p style="margin: 8px 0;"><strong>Outcome:</strong> ${outcomeLabels[data.previousOutcome] || data.previousOutcome}</p>
            ${data.previousNotes ? `<p style="margin: 8px 0;"><strong>Notes:</strong> ${data.previousNotes}</p>` : ''}
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.firstTimerUrl}" style="display: inline-block; background: #1f2937; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">View First Timer Details</a>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
            This is an automated reminder. If you have already followed up, you can ignore this email.
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p>Sent from Church Management System</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Manually trigger follow-up reminder emails (for testing)
   */
  async triggerFollowUpReminderEmails() {
    this.logger.log('Manually triggering follow-up reminder emails...');
    return this.sendFollowUpReminderEmails();
  }
}
