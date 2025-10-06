export enum QueueName {
  BULK_OPERATION = 'bulk-operation',
}

export enum JobType {
  BULK_MEMBER_CREATE = 'bulk-member-create',
  BULK_MEMBER_UPDATE = 'bulk-member-update',
  BULK_USER_CREATE = 'bulk-user-create',
  BULK_USER_UPDATE = 'bulk-user-update',
  BULK_FIRST_TIMER_CREATE = 'bulk-first-timer-create',
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
