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
  ActivityLogJobData,
  FinanceEmailJobData,
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
    @InjectQueue(QueueName.ACTIVITY_LOGS)
    private activityLogQueue: Queue<ActivityLogJobData>,
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

  // Finance email notification methods (non-blocking, fire-and-forget)

  /**
   * Queue a finance email notification job (non-blocking)
   * @param data - Finance email job data including recipients and email content
   * @returns The queued job, or null if queueing failed (logged but not thrown)
   */
  async addFinanceEmailJob(
    data: FinanceEmailJobData,
  ): Promise<Job<FinanceEmailJobData> | null> {
    try {
      // Cast to any since Bull queue handles different job types via job name
      // The processor will receive the correct FinanceEmailJobData type
      const job = await this.emailNotificationQueue.add(
        data.jobType,
        data as any,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log(
        `Finance email job ${data.jobType} queued for requisition ${data.requisitionId} to ${data.recipients.length} recipient(s)`,
      );
      return job as unknown as Job<FinanceEmailJobData>;
    } catch (error) {
      // Log but don't throw - email should not block the main operation
      this.logger.error(
        `Failed to queue finance email job ${data.jobType} for requisition ${data.requisitionId}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Queue approval notification to approvers (non-blocking)
   */
  async queueApproverNotification(
    requisitionId: string,
    emailHtml: string,
    emailSubject: string,
    recipients: Array<{ email: string; name?: string }>,
  ): Promise<void> {
    await this.addFinanceEmailJob({
      jobType: JobType.FINANCE_NOTIFY_APPROVERS,
      requisitionId,
      emailHtml,
      emailSubject,
      recipients,
      metadata: { actionType: 'notification' },
    });
  }

  /**
   * Queue approval notification to requestor (non-blocking)
   */
  async queueRequestorApprovalNotification(
    requisitionId: string,
    emailHtml: string,
    emailSubject: string,
    recipients: Array<{ email: string; name?: string }>,
  ): Promise<void> {
    await this.addFinanceEmailJob({
      jobType: JobType.FINANCE_NOTIFY_REQUESTOR_APPROVAL,
      requisitionId,
      emailHtml,
      emailSubject,
      recipients,
      metadata: { actionType: 'approval' },
    });
  }

  /**
   * Queue rejection notification to requestor (non-blocking)
   */
  async queueRequestorRejectionNotification(
    requisitionId: string,
    emailHtml: string,
    emailSubject: string,
    recipients: Array<{ email: string; name?: string }>,
  ): Promise<void> {
    await this.addFinanceEmailJob({
      jobType: JobType.FINANCE_NOTIFY_REQUESTOR_REJECTION,
      requisitionId,
      emailHtml,
      emailSubject,
      recipients,
      metadata: { actionType: 'rejection' },
    });
  }

  /**
   * Queue disbursement notification to disbursers (non-blocking)
   */
  async queueDisburserNotification(
    requisitionId: string,
    emailHtml: string,
    emailSubject: string,
    recipients: Array<{ email: string; name?: string }>,
  ): Promise<void> {
    await this.addFinanceEmailJob({
      jobType: JobType.FINANCE_NOTIFY_DISBURSERS,
      requisitionId,
      emailHtml,
      emailSubject,
      recipients,
      metadata: { actionType: 'notification' },
    });
  }

  /**
   * Queue disbursement confirmation to requestor (non-blocking)
   */
  async queueRequestorDisbursementNotification(
    requisitionId: string,
    emailHtml: string,
    emailSubject: string,
    recipients: Array<{ email: string; name?: string }>,
  ): Promise<void> {
    await this.addFinanceEmailJob({
      jobType: JobType.FINANCE_NOTIFY_REQUESTOR_DISBURSEMENT,
      requisitionId,
      emailHtml,
      emailSubject,
      recipients,
      metadata: { actionType: 'disbursement' },
    });
  }

  /**
   * Queue disbursement confirmation to finance team (non-blocking)
   */
  async queueDisburseConfirmationNotification(
    requisitionId: string,
    emailHtml: string,
    emailSubject: string,
    recipients: Array<{ email: string; name?: string }>,
  ): Promise<void> {
    await this.addFinanceEmailJob({
      jobType: JobType.FINANCE_NOTIFY_DISBURSE_CONFIRMATION,
      requisitionId,
      emailHtml,
      emailSubject,
      recipients,
      metadata: { actionType: 'disbursement' },
    });
  }

  /**
   * Queue submission confirmation to requestor (non-blocking)
   */
  async queueRequestorSubmissionNotification(
    requisitionId: string,
    emailHtml: string,
    emailSubject: string,
    recipients: Array<{ email: string; name?: string }>,
  ): Promise<void> {
    await this.addFinanceEmailJob({
      jobType: JobType.FINANCE_NOTIFY_REQUESTOR_SUBMISSION,
      requisitionId,
      emailHtml,
      emailSubject,
      recipients,
      metadata: { actionType: 'notification' },
    });
  }

  /**
   * Queue disbursement notification to approver (non-blocking)
   */
  async queueApproverDisbursementNotification(
    requisitionId: string,
    emailHtml: string,
    emailSubject: string,
    recipients: Array<{ email: string; name?: string }>,
  ): Promise<void> {
    await this.addFinanceEmailJob({
      jobType: JobType.FINANCE_NOTIFY_APPROVER_DISBURSEMENT,
      requisitionId,
      emailHtml,
      emailSubject,
      recipients,
      metadata: { actionType: 'disbursement' },
    });
  }

  /**
   * Queue disbursement completion confirmation to disburser (non-blocking)
   */
  async queueDisburserCompletionNotification(
    requisitionId: string,
    emailHtml: string,
    emailSubject: string,
    recipients: Array<{ email: string; name?: string }>,
  ): Promise<void> {
    await this.addFinanceEmailJob({
      jobType: JobType.FINANCE_NOTIFY_DISBURSER_COMPLETION,
      requisitionId,
      emailHtml,
      emailSubject,
      recipients,
      metadata: { actionType: 'disbursement' },
    });
  }

  /**
   * Schedule a follow-up reminder to be sent at a specific date/time
   * @param data - The reminder data including first timer and assigned person info
   * @param scheduledDate - The date/time when the reminder should be sent
   */
  async scheduleFollowUpReminder(
    data: {
      firstTimerId: string;
      assignedPersonEmail: string;
      assignedPersonName: string;
      firstTimerName: string;
      firstTimerPhone: string;
      firstTimerEmail?: string;
      followUpNotes?: string;
    },
    scheduledDate: Date,
  ): Promise<Job<FirstTimerNotificationJobData>> {
    const now = new Date();
    const delay = scheduledDate.getTime() - now.getTime();

    // Don't schedule if the date is in the past
    if (delay <= 0) {
      this.logger.warn(
        `Scheduled date ${scheduledDate} is in the past, skipping reminder for first timer ${data.firstTimerId}`,
      );
      throw new Error('Cannot schedule a reminder in the past');
    }

    const scheduledTimeFormatted = scheduledDate.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const jobData: FirstTimerNotificationJobData = {
      firstTimerId: data.firstTimerId,
      type: 'reminder',
      recipientEmail: data.assignedPersonEmail,
      additionalData: {
        assignedPersonEmail: data.assignedPersonEmail,
        assignedPersonName: data.assignedPersonName,
        firstTimerName: data.firstTimerName,
        firstTimerPhone: data.firstTimerPhone,
        firstTimerEmail: data.firstTimerEmail,
        followUpNotes: data.followUpNotes,
        scheduledTime: scheduledTimeFormatted,
      },
    };

    const job = await this.firstTimerNotificationQueue.add(
      JobType.SCHEDULED_FOLLOW_UP_REMINDER,
      jobData,
      {
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
        jobId: `followup-reminder-${data.firstTimerId}-${scheduledDate.getTime()}`,
      },
    );

    this.logger.log(
      `Scheduled follow-up reminder for first timer ${data.firstTimerId} at ${scheduledTimeFormatted} (delay: ${Math.round(delay / 1000 / 60)} minutes)`,
    );

    return job;
  }

  // Activity Log Methods - Queue-based async logging
  private async addActivityLogJob(
    jobType: JobType,
    data: ActivityLogJobData,
  ): Promise<Job<ActivityLogJobData>> {
    const job = await this.activityLogQueue.add(jobType, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.debug(
      `Activity log job ${jobType} queued for member ${data.memberId}`,
    );
    return job;
  }

  async logGroupMemberAddition(
    memberId: string,
    initiatedBy: string,
    groupId: string,
    groupName: string,
    groupType: string,
    isFirstAssignment?: boolean,
  ): Promise<Job<ActivityLogJobData>> {
    this.logger.log(`[logGroupMemberAddition] memberId=${memberId}, initiatedBy=${initiatedBy}, groupId=${groupId}, groupName=${groupName}, groupType=${groupType}`);
    const job = await this.addActivityLogJob(JobType.LOG_GROUP_MEMBER_ADDITION, {
      jobType: JobType.LOG_GROUP_MEMBER_ADDITION,
      memberId,
      initiatedBy,
      data: {
        groupId,
        groupName,
        groupType,
        isFirstAssignment,
      },
    });
    this.logger.log(`[logGroupMemberAddition] Job created with id: ${job.id}`);
    return job;
  }

  async logGroupMemberRemoval(
    memberId: string,
    initiatedBy: string,
    groupId: string,
    groupName: string,
    groupType: string,
    reason?: string,
  ): Promise<Job<ActivityLogJobData>> {
    return this.addActivityLogJob(JobType.LOG_GROUP_MEMBER_REMOVAL, {
      jobType: JobType.LOG_GROUP_MEMBER_REMOVAL,
      memberId,
      initiatedBy,
      data: {
        groupId,
        groupName,
        groupType,
        reason,
      },
    });
  }

  async logMembershipStatusChange(
    memberId: string,
    initiatedBy: string,
    fromStatus: string,
    toStatus: string,
    reason?: string,
  ): Promise<Job<ActivityLogJobData>> {
    return this.addActivityLogJob(JobType.LOG_MEMBERSHIP_STATUS_CHANGE, {
      jobType: JobType.LOG_MEMBERSHIP_STATUS_CHANGE,
      memberId,
      initiatedBy,
      data: {
        fromStatus,
        toStatus,
        reason,
      },
    });
  }

  async logRoleAssignment(
    memberId: string,
    initiatedBy: string,
    roleId: string,
    roleName: string,
    scopeType: string,
    scopeId?: string,
    scopeName?: string,
    isPrimary?: boolean,
  ): Promise<Job<ActivityLogJobData>> {
    return this.addActivityLogJob(JobType.LOG_ROLE_ASSIGNMENT, {
      jobType: JobType.LOG_ROLE_ASSIGNMENT,
      memberId,
      initiatedBy,
      data: {
        roleId,
        roleName,
        scopeType,
        scopeId,
        scopeName,
        isPrimary,
      },
    });
  }

  async logRoleRemoval(
    memberId: string,
    initiatedBy: string,
    roleName: string,
    reason?: string,
  ): Promise<Job<ActivityLogJobData>> {
    return this.addActivityLogJob(JobType.LOG_ROLE_REMOVAL, {
      jobType: JobType.LOG_ROLE_REMOVAL,
      memberId,
      initiatedBy,
      data: {
        roleName,
        reason,
      },
    });
  }

  async logMemberRegistration(
    memberId: string,
    initiatedBy: string,
    source?: string,
    dateJoined?: Date,
  ): Promise<Job<ActivityLogJobData>> {
    return this.addActivityLogJob(JobType.LOG_MEMBER_REGISTRATION, {
      jobType: JobType.LOG_MEMBER_REGISTRATION,
      memberId,
      initiatedBy,
      data: {
        source,
        dateJoined: dateJoined?.toISOString(),
      },
    });
  }

  async logUnitAssignment(
    memberId: string,
    initiatedBy: string,
    unitId: string,
    unitName: string,
    previousUnitId?: string,
    previousUnitName?: string,
    isFirstAssignment?: boolean,
  ): Promise<Job<ActivityLogJobData>> {
    return this.addActivityLogJob(JobType.LOG_UNIT_ASSIGNMENT, {
      jobType: JobType.LOG_UNIT_ASSIGNMENT,
      memberId,
      initiatedBy,
      data: {
        unitId,
        unitName,
        previousUnitId,
        previousUnitName,
        isFirstAssignment,
      },
    });
  }

  async logDistrictAssignment(
    memberId: string,
    initiatedBy: string,
    districtId: string,
    districtName: string,
    previousDistrictId?: string,
    previousDistrictName?: string,
  ): Promise<Job<ActivityLogJobData>> {
    return this.addActivityLogJob(JobType.LOG_DISTRICT_ASSIGNMENT, {
      jobType: JobType.LOG_DISTRICT_ASSIGNMENT,
      memberId,
      initiatedBy,
      data: {
        districtId,
        districtName,
        previousDistrictId,
        previousDistrictName,
      },
    });
  }

  async logFirstTimerConversion(
    memberId: string,
    initiatedBy: string,
    firstTimerId: string,
    firstTimerDate?: Date,
  ): Promise<Job<ActivityLogJobData>> {
    return this.addActivityLogJob(JobType.LOG_FIRST_TIMER_CONVERSION, {
      jobType: JobType.LOG_FIRST_TIMER_CONVERSION,
      memberId,
      initiatedBy,
      data: {
        firstTimerId,
        firstTimerDate: firstTimerDate?.toISOString(),
      },
    });
  }
}
