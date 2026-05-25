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
import { EmailTemplateResolverService } from '../../bulk-email/email-template-resolver.service';
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
    private templateResolver: EmailTemplateResolverService,
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

      const loginUrl = `${process.env.FRONTEND_URL || 'https://pptcrm.powerpointtribe.org'}/login`;

      const { subject, html } = await this.templateResolver.resolveTemplate(
        'auth.user-invitation',
        {
          firstName: memberFirstName,
          lastName: memberLastName,
          email: memberEmail,
          temporaryPassword,
          roleDisplayName,
          loginUrl,
        },
      );

      await this.notificationsService['emailProvider'].sendEmail({
        to: memberEmail,
        subject,
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
