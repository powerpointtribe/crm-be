import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QueueName, JobType } from '../../common/interfaces/queue-job.interface';
import { BulkEmailSenderService } from '../../bulk-email/bulk-email-sender.service';

export interface BulkEmailJobData {
  campaignId: string;
  testEmail?: string;
}

@Processor(QueueName.EMAIL_NOTIFICATIONS)
export class BulkEmailProcessor {
  private readonly logger = new Logger(BulkEmailProcessor.name);

  constructor(private readonly bulkEmailSenderService: BulkEmailSenderService) {
    this.logger.log('BulkEmailProcessor initialized');
  }

  @Process(JobType.BULK_EMAIL_CAMPAIGN_SEND)
  async handleBulkEmailCampaign(job: Job<BulkEmailJobData>) {
    this.logger.log(`Processing bulk email campaign job: ${job.id}`);

    const { campaignId, testEmail } = job.data;

    try {
      await this.bulkEmailSenderService.processCampaignSend(campaignId, testEmail);

      this.logger.log(
        `Bulk email campaign job ${job.id} completed for campaign ${campaignId}`,
      );

      return { success: true, campaignId };
    } catch (error) {
      this.logger.error(
        `Bulk email campaign job ${job.id} failed: ${error.message}`,
      );
      throw error;
    }
  }

  @OnQueueFailed()
  handleFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed: ${error.message}`,
    );
  }

  @OnQueueCompleted()
  handleCompleted(job: Job, result: any) {
    this.logger.log(`Job ${job.id} of type ${job.name} completed`);
  }
}
