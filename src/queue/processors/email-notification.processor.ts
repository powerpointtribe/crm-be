import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  QueueName,
  EmailNotificationJobData,
  FinanceEmailJobData,
  JobType,
} from '../../common/interfaces/queue-job.interface';
import { NotificationsService } from '../../notifications/notifications.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserInvitation,
  UserInvitationDocument,
} from '../../user-invitations/schemas/user-invitation.schema';

@Injectable()
@Processor(QueueName.EMAIL_NOTIFICATIONS)
export class EmailNotificationProcessor {
  private readonly logger = new Logger(EmailNotificationProcessor.name);

  constructor(
    private notificationsService: NotificationsService,
    @InjectModel(UserInvitation.name)
    private invitationModel: Model<UserInvitationDocument>,
  ) {
    this.logger.log('EmailNotificationProcessor initialized');
  }

  @Process(JobType.USER_INVITATION_EMAIL)
  async handleUserInvitationEmail(job: Job<EmailNotificationJobData>) {
    this.logger.log(
      `Processing user invitation email for invitation: ${job.data.invitationId}`,
    );

    try {
      const {
        invitationId,
        memberEmail,
        memberFirstName,
        memberLastName,
        roleDisplayName,
        temporaryPassword,
      } = job.data;

      // Build the email HTML
      const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">Welcome to the Church Management Platform!</h1>
        <p>Dear ${memberFirstName} ${memberLastName},</p>
        <p>You have been invited to access our Church Management Platform. We're excited to have you on board!</p>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Your Login Credentials</h3>
          <p><strong>Email:</strong> ${memberEmail}</p>
          <p><strong>Temporary Password:</strong> <code style="background: #e9ecef; padding: 5px 10px; border-radius: 4px; font-size: 1.1em;">${temporaryPassword}</code></p>
          <p><strong>Role Assigned:</strong> ${roleDisplayName}</p>
        </div>

        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="margin-top: 0;">Important Security Notice:</h4>
          <ul style="margin: 10px 0;">
            <li>Please log in within 7 days using these credentials</li>
            <li>You will be required to change your password on first login</li>
            <li>Keep your credentials secure and do not share them</li>
          </ul>
        </div>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${process.env.FRONTEND_URL || 'https://your-church-platform.com'}/login"
             style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Log In Now
          </a>
        </div>

        <p>If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>

        <p>Blessings,<br/>The Powerpoint Tribe Leadership Team</p>
      </div>
    `;

      // Send the email
      await this.notificationsService['emailProvider'].sendEmail({
        to: memberEmail,
        subject: 'Welcome to Church Management Platform - Your Access Credentials',
        html,
      });

      // Update invitation to mark email as sent
      await this.invitationModel.findByIdAndUpdate(invitationId, {
        emailSent: true,
        emailSentAt: new Date(),
      });

      this.logger.log(
        `User invitation email sent successfully to ${memberEmail}`,
      );
      return { success: true, email: memberEmail, invitationId };
    } catch (error) {
      this.logger.error(
        `Failed to send user invitation email: ${error.message}`,
      );
      throw error;
    }
  }

  @Process(JobType.USER_INVITATION_RESEND_EMAIL)
  async handleUserInvitationResendEmail(job: Job<EmailNotificationJobData>) {
    this.logger.log(
      `Processing user invitation resend email for invitation: ${job.data.invitationId}`,
    );

    try {
      // Reuse the same logic as the initial invitation email
      return await this.handleUserInvitationEmail(job);
    } catch (error) {
      this.logger.error(
        `Failed to resend user invitation email: ${error.message}`,
      );
      throw error;
    }
  }

  // ============== Finance Email Handlers ==============
  // These handlers process pre-generated HTML emails for finance notifications

  /**
   * Generic finance email handler - sends emails to all recipients
   * Uses Promise.allSettled for parallel sending without failing on individual errors
   */
  private async processFinanceEmail(
    job: Job<FinanceEmailJobData>,
    jobDescription: string,
  ): Promise<{ success: boolean; sent: number; failed: number }> {
    const { requisitionId, emailHtml, emailSubject, recipients, metadata } =
      job.data;

    this.logger.log(
      `Processing ${jobDescription} for requisition ${requisitionId} to ${recipients.length} recipient(s)`,
    );

    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        await this.notificationsService['emailProvider'].sendEmail({
          to: recipient.email,
          subject: emailSubject,
          html: emailHtml,
        });
        return recipient.email;
      }),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    // Log failures for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.warn(
          `Failed to send ${jobDescription} to ${recipients[index].email}: ${result.reason?.message || 'Unknown error'}`,
        );
      }
    });

    this.logger.log(
      `${jobDescription} completed for requisition ${requisitionId}: ${sent} sent, ${failed} failed`,
    );

    return { success: failed === 0, sent, failed };
  }

  @Process(JobType.FINANCE_NOTIFY_APPROVERS)
  async handleFinanceNotifyApprovers(job: Job<FinanceEmailJobData>) {
    return this.processFinanceEmail(job, 'approver notification');
  }

  @Process(JobType.FINANCE_NOTIFY_REQUESTOR_APPROVAL)
  async handleFinanceNotifyRequestorApproval(job: Job<FinanceEmailJobData>) {
    return this.processFinanceEmail(job, 'approval notification to requestor');
  }

  @Process(JobType.FINANCE_NOTIFY_REQUESTOR_REJECTION)
  async handleFinanceNotifyRequestorRejection(job: Job<FinanceEmailJobData>) {
    return this.processFinanceEmail(job, 'rejection notification to requestor');
  }

  @Process(JobType.FINANCE_NOTIFY_DISBURSERS)
  async handleFinanceNotifyDisbursers(job: Job<FinanceEmailJobData>) {
    return this.processFinanceEmail(job, 'disburser notification');
  }

  @Process(JobType.FINANCE_NOTIFY_REQUESTOR_DISBURSEMENT)
  async handleFinanceNotifyRequestorDisbursement(
    job: Job<FinanceEmailJobData>,
  ) {
    return this.processFinanceEmail(
      job,
      'disbursement notification to requestor',
    );
  }

  @Process(JobType.FINANCE_NOTIFY_DISBURSE_CONFIRMATION)
  async handleFinanceNotifyDisburseConfirmation(job: Job<FinanceEmailJobData>) {
    return this.processFinanceEmail(
      job,
      'disbursement confirmation to finance team',
    );
  }

  @Process(JobType.FINANCE_NOTIFY_REQUESTOR_SUBMISSION)
  async handleFinanceNotifyRequestorSubmission(job: Job<FinanceEmailJobData>) {
    return this.processFinanceEmail(
      job,
      'submission confirmation to requestor',
    );
  }

  @Process(JobType.FINANCE_NOTIFY_APPROVER_DISBURSEMENT)
  async handleFinanceNotifyApproverDisbursement(job: Job<FinanceEmailJobData>) {
    return this.processFinanceEmail(
      job,
      'disbursement notification to approver',
    );
  }

  @Process(JobType.FINANCE_NOTIFY_DISBURSER_COMPLETION)
  async handleFinanceNotifyDisburserCompletion(job: Job<FinanceEmailJobData>) {
    return this.processFinanceEmail(
      job,
      'disbursement completion confirmation to disburser',
    );
  }
}
