import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import {
  QueueName,
  JobType,
  BulkOperationJobData,
  JobProgress,
  JobResult,
} from '../common/interfaces/queue-job.interface';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QueueName.BULK_OPERATION)
    private bulkOperationQueue: Queue<BulkOperationJobData>,
  ) {}

  async addBulkOperationJob(
    jobType: JobType,
    csvContent: string,
    options: any,
    userId: string,
    metadata: { filename?: string; totalRows?: number } = {},
  ): Promise<Job<BulkOperationJobData>> {
    const jobData: BulkOperationJobData = {
      jobType,
      csvContent,
      options,
      userId,
      metadata: {
        ...metadata,
        timestamp: new Date(),
      },
    };

    const job = await this.bulkOperationQueue.add(jobType, jobData, {
      priority: this.getJobPriority(jobType),
      delay: 0,
    });

    this.logger.log(`Bulk operation job ${job.id} added for user ${userId}`);
    return job;
  }

  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress?: JobProgress;
    result?: JobResult;
    error?: string;
  }> {
    try {
      const job = await this.bulkOperationQueue.getJob(jobId);

      if (!job) {
        return { status: 'not_found' };
      }

      const state = await job.getState();
      const progress = job.progress() as JobProgress;
      const result = job.returnvalue as JobResult;
      const error = job.failedReason;

      return {
        status: state,
        progress,
        result,
        error,
      };
    } catch (error) {
      this.logger.error(`Error getting job status for ${jobId}:`, error);
      return { status: 'error', error: error.message };
    }
  }

  async getJobHistory(userId: string, limit: number = 10): Promise<Job[]> {
    try {
      const jobs = await this.bulkOperationQueue.getJobs(
        ['completed', 'failed', 'active', 'waiting'],
        0,
        limit * 2, // Get more jobs to filter by user
      );

      return jobs.filter((job) => job.data.userId === userId).slice(0, limit);
    } catch (error) {
      this.logger.error(`Error getting job history for user ${userId}:`, error);
      return [];
    }
  }

  async cancelJob(jobId: string, userId: string): Promise<boolean> {
    try {
      const job = await this.bulkOperationQueue.getJob(jobId);

      if (!job) {
        return false;
      }

      // Check if the job belongs to the user
      if (job.data.userId !== userId) {
        throw new Error('Unauthorized to cancel this job');
      }

      const state = await job.getState();
      if (['completed', 'failed'].includes(state)) {
        return false; // Cannot cancel completed/failed jobs
      }

      await job.remove();
      this.logger.log(`Job ${jobId} cancelled by user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error cancelling job ${jobId}:`, error);
      throw error;
    }
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const waiting = await this.bulkOperationQueue.getWaiting();
      const active = await this.bulkOperationQueue.getActive();
      const completed = await this.bulkOperationQueue.getCompleted();
      const failed = await this.bulkOperationQueue.getFailed();
      const delayed = await this.bulkOperationQueue.getDelayed();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    } catch (error) {
      this.logger.error('Error getting queue stats:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
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
}
