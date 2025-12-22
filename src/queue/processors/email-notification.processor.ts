import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  QueueName,
  EmailNotificationJobData,
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

        <p>Blessings,<br/>The Church Leadership Team</p>
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
}
