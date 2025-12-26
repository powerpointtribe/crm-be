import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import {
  QueueName,
  JobType,
  BulkOperationJobData,
  JobProgress,
  JobResult,
  FirstTimerNotificationJobData,
  FirstTimerAutomationJobData,
  EmailNotificationJobData,
} from '../common/interfaces/queue-job.interface';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    // @InjectQueue(QueueName.BULK_OPERATION)
    // private bulkOperationQueue: Queue<BulkOperationJobData>,
    @InjectQueue(QueueName.FIRST_TIMER_NOTIFICATIONS)
    private firstTimerNotificationQueue: Queue<FirstTimerNotificationJobData>,
    // @InjectQueue(QueueName.FIRST_TIMER_AUTOMATION)
    // private firstTimerAutomationQueue: Queue<FirstTimerAutomationJobData>,
    @InjectQueue(QueueName.EMAIL_NOTIFICATIONS)
    private emailNotificationQueue: Queue<EmailNotificationJobData>,
  ) {}

  // Temporarily disabled - bulk operation queue not registered
  async addBulkOperationJob(
    jobType: JobType,
    csvContent: string,
    options: any,
    userId: string,
    metadata: { filename?: string; totalRows?: number } = {},
  ): Promise<Job<BulkOperationJobData>> {
    throw new Error(
      'Bulk operations are temporarily disabled due to Redis connection limits. Please increase Redis maxclients or contact administrator.',
    );
  }

  // Temporarily disabled - bulk operation queue not registered
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress?: JobProgress;
    result?: JobResult;
    error?: string;
  }> {
    return {
      status: 'unavailable',
      error:
        'Job status unavailable - bulk operations queue temporarily disabled',
    };
  }

  // Temporarily disabled - bulk operation queue not registered
  async getJobHistory(
    userId: string,
    limit: number = 10,
    skip: number = 0,
  ): Promise<Job[]> {
    this.logger.warn(
      'Job history unavailable - bulk operations queue temporarily disabled',
    );
    return [];
  }

  // Temporarily disabled - bulk operation queue not registered
  async cancelJob(jobId: string, userId: string): Promise<boolean> {
    throw new Error(
      'Job cancellation unavailable - bulk operations queue temporarily disabled',
    );
  }

  // Temporarily disabled - bulk operation queue not registered
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    this.logger.warn(
      'Queue stats unavailable - bulk operations queue temporarily disabled',
    );
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
  }

  // First Timer specific methods
  async addDelayedJob(jobType: string, data: any, delay: number): Promise<Job> {
    const job = await this.firstTimerNotificationQueue.add(jobType, data, {
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log(
      `Delayed job ${jobType} added with ${delay}ms delay for first timer ${data.firstTimerId}`,
    );
    return job;
  }

  async addJob(jobType: string, data: any): Promise<Job> {
    const job = await this.firstTimerNotificationQueue.add(jobType, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log(`Job ${jobType} added for first timer ${data.firstTimerId}`);
    return job;
  }

  // Temporarily disabled - first timer automation queue not registered
  async addAutomationJob(
    jobType: string,
    data: FirstTimerAutomationJobData,
    options?: any,
  ): Promise<Job> {
    throw new Error(
      'First timer automation is temporarily disabled due to Redis connection limits. Please increase Redis maxclients or contact administrator.',
    );
  }

  // Temporarily disabled - first timer automation queue not registered
  async scheduleRecurringJob(
    jobType: string,
    data: FirstTimerAutomationJobData,
    cronExpression: string,
  ): Promise<Job> {
    throw new Error(
      'Recurring job scheduling is temporarily disabled due to Redis connection limits. Please increase Redis maxclients or contact administrator.',
    );
  }

  private getJobPriority(jobType: JobType): number {
    // Higher priority for smaller operations
    switch (jobType) {
      case JobType.BULK_FIRST_TIMER_CREATE:
        return 10; // Highest priority
      case JobType.BULK_MEMBER_CREATE:
      case JobType.BULK_MEMBER_UPDATE:
        return 5; // Medium priority
      case JobType.BULK_USER_CREATE:
      case JobType.BULK_USER_UPDATE:
        return 1; // Lower priority (users might be larger datasets)
      default:
        return 1;
    }
  }

  // Email notification methods
  async addEmailNotificationJob(
    jobType: JobType,
    data: EmailNotificationJobData,
  ): Promise<Job<EmailNotificationJobData>> {
    const job = await this.emailNotificationQueue.add(jobType, data, {
      attempts: 3, // Retry up to 3 times if it fails
      backoff: {
        type: 'exponential',
        delay: 5000, // Start with 5 second delay, then 10s, 20s
      },
      removeOnComplete: true,
      removeOnFail: false, // Keep failed jobs for debugging
    });

    this.logger.log(
      `Email notification job ${jobType} added for ${data.memberEmail}`,
    );
    return job;
  }

  async addUserInvitationEmailJob(
    invitationData: EmailNotificationJobData,
  ): Promise<Job<EmailNotificationJobData>> {
    return this.addEmailNotificationJob(
      JobType.USER_INVITATION_EMAIL,
      invitationData,
    );
  }

  async addUserInvitationResendEmailJob(
    invitationData: EmailNotificationJobData,
  ): Promise<Job<EmailNotificationJobData>> {
    return this.addEmailNotificationJob(
      JobType.USER_INVITATION_RESEND_EMAIL,
      invitationData,
    );
  }
}
