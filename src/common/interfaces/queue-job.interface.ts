export enum QueueName {
  BULK_OPERATION = 'bulk-operation',
  FIRST_TIMER_NOTIFICATIONS = 'first-timer-notifications',
  FIRST_TIMER_AUTOMATION = 'first-timer-automation',
}

export enum JobType {
  BULK_MEMBER_CREATE = 'bulk-member-create',
  BULK_MEMBER_UPDATE = 'bulk-member-update',
  BULK_USER_CREATE = 'bulk-user-create',
  BULK_USER_UPDATE = 'bulk-user-update',
  BULK_FIRST_TIMER_CREATE = 'bulk-first-timer-create',

  // First Timer specific jobs
  FIRST_TIMER_THANK_YOU_EMAIL = 'first-timer-thank-you-email',
  FIRST_TIMER_CONVERSION_NOTIFICATION = 'first-timer-conversion-notification',
  FIRST_TIMER_FOLLOW_UP_REMINDER = 'first-timer-follow-up-reminder',
  FIRST_TIMER_STATUS_TRANSITION = 'first-timer-status-transition',
  FIRST_TIMER_WEEKLY_REMINDER = 'first-timer-weekly-reminder',
  DISTRICT_PASTOR_NOTIFICATION = 'district-pastor-notification',

  // New assignment and messaging jobs
  SEND_FIRST_TIMER_MESSAGE = 'send-first-timer-message',
  SEND_ASSIGNMENT_NOTIFICATION = 'send-assignment-notification',
  SEND_BULK_ASSIGNMENT_NOTIFICATION = 'send-bulk-assignment-notification',
  SEND_DISTRICT_ASSIGNMENT_NOTIFICATION = 'send-district-assignment-notification',
  CREATE_MEMBER_FROM_FIRST_TIMER = 'create-member-from-first-timer',
  SEND_MEMBER_FOLLOWUP_ASSIGNMENT = 'send-member-followup-assignment',
}

export interface BulkOperationJobData {
  jobType: JobType;
  csvContent: string;
  options: any; // Specific to each job type
  userId: string; // User who initiated the job
  metadata: {
    filename?: string;
    totalRows?: number;
    timestamp: Date;
  };
}

export interface JobProgress {
  processedRows: number;
  totalRows: number;
  successCount: number;
  errorCount: number;
  currentRow?: number;
  stage: 'parsing' | 'validating' | 'processing' | 'completed' | 'failed';
  message?: string;
}

export interface JobResult {
  success: boolean;
  result?: any;
  error?: string;
  processedCount: number;
  failedCount: number;
  totalCount: number;
  details?: {
    successfulRecords: any[];
    failedRecords: Array<{
      row: number;
      data: any;
      errors: string[];
    }>;
  };
}

// First Timer specific job data interfaces
export interface FirstTimerNotificationJobData {
  firstTimerId: string;
  type: 'thank_you' | 'conversion' | 'reminder' | 'district_assignment';
  recipientEmail?: string;
  additionalData?: any;
}

export interface FirstTimerAutomationJobData {
  type: 'status_transition' | 'follow_up_reminder' | 'weekly_reminder';
  firstTimerId?: string;
  targetStatus?: string;
  checkDate?: Date;
}
