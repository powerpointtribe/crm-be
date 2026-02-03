import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EmailCampaign, EmailCampaignDocument, CampaignStatus } from './schemas/email-campaign.schema';
import { EmailSendLog, EmailSendLogDocument, EmailSendStatus } from './schemas/email-send-log.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { EmailCampaignService } from './email-campaign.service';
import { QueueName, JobType } from '../common/interfaces/queue-job.interface';
import { EmailProvider } from '../notifications/providers/email.provider';

export interface BulkEmailJobData {
  campaignId: string;
  testEmail?: string;
}

@Injectable()
export class BulkEmailSenderService {
  private readonly logger = new Logger(BulkEmailSenderService.name);

  constructor(
    @InjectModel(EmailCampaign.name)
    private emailCampaignModel: Model<EmailCampaignDocument>,
    @InjectModel(EmailSendLog.name)
    private emailSendLogModel: Model<EmailSendLogDocument>,
    @InjectModel(Member.name)
    private memberModel: Model<MemberDocument>,
    private emailCampaignService: EmailCampaignService,
    @InjectQueue(QueueName.EMAIL_NOTIFICATIONS)
    private emailQueue: Queue,
    private emailProvider: EmailProvider,
  ) {}

  /**
   * Queue a campaign for immediate sending
   */
  async sendCampaign(campaignId: string, testEmail?: string): Promise<{ jobId: string }> {
    const campaign = await this.emailCampaignModel.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign with ID ${campaignId} not found`);
    }

    if (![CampaignStatus.DRAFT, CampaignStatus.SCHEDULED].includes(campaign.status)) {
      throw new Error(`Campaign is not in a sendable state: ${campaign.status}`);
    }

    // Get recipient count for stats
    const recipientCount = await this.emailCampaignService.getRecipientCount(campaign);

    // Update campaign stats
    await this.emailCampaignModel.findByIdAndUpdate(campaignId, {
      $set: { 'stats.totalRecipients': recipientCount },
    });

    // Add job to queue
    const job = await this.emailQueue.add(
      JobType.BULK_EMAIL_CAMPAIGN_SEND,
      {
        campaignId,
        testEmail,
      } as BulkEmailJobData,
      {
        attempts: 1, // Campaign jobs should not retry automatically
        removeOnComplete: true,
      },
    );

    this.logger.log(`Campaign ${campaignId} queued for sending. Job ID: ${job.id}`);

    return { jobId: job.id.toString() };
  }

  /**
   * Process a campaign send (called by queue processor)
   */
  async processCampaignSend(campaignId: string, testEmail?: string): Promise<void> {
    const campaign = await this.emailCampaignModel.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign with ID ${campaignId} not found`);
    }

    this.logger.log(`Starting to process campaign: ${campaign.name}`);

    // Mark campaign as sending
    await this.emailCampaignService.markAsSending(campaignId);

    try {
      // Get all recipients
      const recipients = await this.emailCampaignService.getRecipients(campaign);

      // If test email specified, only send to that
      if (testEmail) {
        await this.sendSingleEmail(campaign, {
          email: testEmail,
          firstName: 'Test',
          lastName: 'User',
        } as any, true);
        this.logger.log(`Test email sent to ${testEmail}`);
        return;
      }

      // Create send logs for all recipients
      const sendLogs = recipients.map((member) => ({
        campaign: campaign._id,
        member: member._id,
        email: member.email,
        status: EmailSendStatus.PENDING,
      }));

      await this.emailSendLogModel.insertMany(sendLogs, { ordered: false }).catch((err) => {
        // Ignore duplicate key errors for retries
        if (err.code !== 11000) throw err;
      });

      // Process in batches
      const batchSize = 50;
      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        const results = await Promise.allSettled(
          batch.map((member) => this.sendSingleEmail(campaign, member)),
        );

        // Update send logs and count results
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const member = batch[j];

          if (result.status === 'fulfilled' && result.value.success) {
            sentCount++;
            await this.emailSendLogModel.findOneAndUpdate(
              { campaign: campaign._id, member: member._id },
              {
                $set: {
                  status: EmailSendStatus.SENT,
                  sentAt: new Date(),
                  messageId: result.value.messageId,
                },
              },
            );
          } else {
            failedCount++;
            const errorMessage =
              result.status === 'rejected'
                ? result.reason?.message
                : result.value?.error || 'Unknown error';

            await this.emailSendLogModel.findOneAndUpdate(
              { campaign: campaign._id, member: member._id },
              {
                $set: {
                  status: EmailSendStatus.FAILED,
                  errorMessage,
                },
              },
            );
          }
        }

        // Update campaign stats after each batch
        await this.emailCampaignModel.findByIdAndUpdate(campaignId, {
          $set: {
            'stats.sent': sentCount,
            'stats.failed': failedCount,
          },
        });

        this.logger.log(
          `Campaign ${campaignId}: Processed batch ${Math.floor(i / batchSize) + 1}, ` +
            `Sent: ${sentCount}, Failed: ${failedCount}`,
        );
      }

      // Mark campaign as sent
      await this.emailCampaignService.markAsSent(campaignId);
      this.logger.log(`Campaign ${campaignId} completed. Sent: ${sentCount}, Failed: ${failedCount}`);
    } catch (error) {
      this.logger.error(`Campaign ${campaignId} failed: ${error.message}`);
      await this.emailCampaignService.markAsFailed(campaignId);
      throw error;
    }
  }

  /**
   * Send a single email
   */
  private async sendSingleEmail(
    campaign: EmailCampaignDocument,
    member: MemberDocument | { email: string; firstName: string; lastName: string },
    isTest: boolean = false,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Prepare email content with variable substitution
      const content = this.substituteVariables(campaign.htmlContent, member);
      const subject = this.substituteVariables(campaign.subject, member);

      this.logger.debug(
        `${isTest ? '[TEST] ' : ''}Sending email to ${member.email}: ${subject}`,
      );

      // Send email using the email provider
      const result = await this.emailProvider.sendEmail({
        to: member.email,
        subject,
        html: content,
      });

      const messageId = result?.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Email sent to ${member.email} - Message ID: ${messageId}`);

      return { success: true, messageId };
    } catch (error) {
      this.logger.error(`Failed to send email to ${member.email}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Substitute template variables in content
   */
  private substituteVariables(
    content: string,
    member: MemberDocument | { email: string; firstName: string; lastName: string; [key: string]: any },
  ): string {
    const data: Record<string, string> = {
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      fullName: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
      email: member.email || '',
      phone: (member as any).phone || '',
      branchName: (member as any).branch?.name || '',
      districtName: (member as any).district?.name || '',
      unitName: (member as any).unit?.name || '',
      membershipStatus: (member as any).membershipStatus || '',
      dateJoined: (member as any).dateJoined
        ? new Date((member as any).dateJoined).toLocaleDateString()
        : '',
    };

    return content.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return data[variable] || match;
    });
  }

  /**
   * Process scheduled campaigns (called by cron job)
   */
  async processScheduledCampaigns(): Promise<void> {
    const now = new Date();

    const dueCampaigns = await this.emailCampaignModel.find({
      status: CampaignStatus.SCHEDULED,
      scheduledAt: { $lte: now },
    });

    for (const campaign of dueCampaigns) {
      this.logger.log(`Processing scheduled campaign: ${campaign.name}`);
      await this.sendCampaign(campaign._id.toString());
    }
  }
}
