export enum QueueName {
  BULK_OPERATION = 'bulk-operation',
  FIRST_TIMER_NOTIFICATIONS = 'first-timer-notifications',
  FIRST_TIMER_AUTOMATION = 'first-timer-automation',
  AUDIT_LOGS = 'audit-logs',
  EMAIL_NOTIFICATIONS = 'email-notifications',
  ACTIVITY_LOGS = 'activity-logs',
  ENTRY_IMPORT = 'entry-import',
}

export enum JobType {
  BULK_MEMBER_CREATE = 'bulk-member-create',
  BULK_MEMBER_UPDATE = 'bulk-member-update',
  BULK_USER_CREATE = 'bulk-user-create',
  BULK_USER_UPDATE = 'bulk-user-update',
  BULK_FIRST_TIMER_CREATE = 'bulk-first-timer-create',

  // Bulk Email jobs
  BULK_EMAIL_CAMPAIGN_SEND = 'bulk-email-campaign-send',

  // First Timer specific jobs
  FIRST_TIMER_THANK_YOU_EMAIL = 'first-timer-thank-you-email',
  FIRST_TIMER_CONVERSION_NOTIFICATION = 'first-timer-conversion-notification',
  FIRST_TIMER_FOLLOW_UP_REMINDER = 'first-timer-follow-up-reminder',
  FIRST_TIMER_STATUS_TRANSITION = 'first-timer-status-transition',
  FIRST_TIMER_WEEKLY_REMINDER = 'first-timer-weekly-reminder',
  DISTRICT_PASTOR_NOTIFICATION = 'district-pastor-notification',

  // Assignment jobs
  CREATE_MEMBER_FROM_FIRST_TIMER = 'create-member-from-first-timer',
  SEND_MEMBER_FOLLOWUP_ASSIGNMENT = 'send-member-followup-assignment',

  // Scheduled reminder jobs
  SCHEDULED_FOLLOW_UP_REMINDER = 'scheduled-follow-up-reminder',

  // Audit log jobs
  AUDIT_LOG_CREATE = 'audit-log-create',

  // Email notification jobs
  USER_INVITATION_EMAIL = 'user-invitation-email',
  USER_INVITATION_RESEND_EMAIL = 'user-invitation-resend-email',

  // Finance email notification jobs
  FINANCE_NOTIFY_APPROVERS = 'finance-notify-approvers',
  FINANCE_NOTIFY_REQUESTOR_APPROVAL = 'finance-notify-requestor-approval',
  FINANCE_NOTIFY_REQUESTOR_REJECTION = 'finance-notify-requestor-rejection',
  FINANCE_NOTIFY_DISBURSERS = 'finance-notify-disbursers',
  FINANCE_NOTIFY_REQUESTOR_DISBURSEMENT = 'finance-notify-requestor-disbursement',
  FINANCE_NOTIFY_DISBURSE_CONFIRMATION = 'finance-notify-disburse-confirmation',
  FINANCE_NOTIFY_REQUESTOR_SUBMISSION = 'finance-notify-requestor-submission',
  FINANCE_NOTIFY_APPROVER_DISBURSEMENT = 'finance-notify-approver-disbursement',
  FINANCE_NOTIFY_DISBURSER_COMPLETION = 'finance-notify-disburser-completion',

  // Entry Import jobs
  ENTRY_IMPORT_PROCESS = 'entry-import-process',
  ENTRY_IMPORT_ITEM_PROCESS = 'entry-import-item-process',

  // Event email jobs
  EVENT_REGISTRATION_CONFIRMATION = 'event-registration-confirmation',
  PARTNER_INQUIRY_CONFIRMATION = 'partner-inquiry-confirmation',
  PARTNER_INQUIRY_NOTIFICATION = 'partner-inquiry-notification',
  EVENT_REMINDER = 'event-reminder',
  BULK_REGISTRATION_EMAIL = 'bulk-registration-email',
  BULK_PARTNER_EMAIL = 'bulk-partner-email',

  // Activity log jobs
  LOG_GROUP_MEMBER_ADDITION = 'log-group-member-addition',
  LOG_GROUP_MEMBER_REMOVAL = 'log-group-member-removal',
  LOG_MEMBERSHIP_STATUS_CHANGE = 'log-membership-status-change',
  LOG_ROLE_ASSIGNMENT = 'log-role-assignment',
  LOG_ROLE_REMOVAL = 'log-role-removal',
  LOG_MEMBER_REGISTRATION = 'log-member-registration',
  LOG_UNIT_ASSIGNMENT = 'log-unit-assignment',
  LOG_DISTRICT_ASSIGNMENT = 'log-district-assignment',
  LOG_FIRST_TIMER_CONVERSION = 'log-first-timer-conversion',
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
  type: 'status_transition' | 'follow_up_reminder' | 'weekly_reminder' | 'auto_archive';
  firstTimerId?: string;
  targetStatus?: string;
  checkDate?: Date;
}

// Audit log job data interface
export interface AuditLogJobData {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  auditData: {
    description?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    metadata?: any;
    oldValues?: any;
    newValues?: any;
  };
}

// Email notification job data interface
export interface EmailNotificationJobData {
  type: 'user_invitation' | 'user_invitation_resend';
  invitationId: string;
  memberEmail: string;
  memberFirstName: string;
  memberLastName: string;
  roleDisplayName: string;
  temporaryPassword: string;
  metadata?: {
    invitedById?: string;
    notes?: string;
    accountType?: string;
  };
}

// Activity log job data interface
export interface ActivityLogJobData {
  jobType: JobType;
  memberId: string;
  initiatedBy: string;
  data: {
    // Group member addition/removal
    groupId?: string;
    groupName?: string;
    groupType?: string;

    // Membership status change
    fromStatus?: string;
    toStatus?: string;
    reason?: string;

    // Role assignment
    roleId?: string;
    roleName?: string;
    scopeType?: string;
    scopeId?: string;
    scopeName?: string;
    isPrimary?: boolean;

    // Unit/District assignment
    unitId?: string;
    unitName?: string;
    previousUnitId?: string;
    previousUnitName?: string;
    districtId?: string;
    districtName?: string;
    previousDistrictId?: string;
    previousDistrictName?: string;
    isFirstAssignment?: boolean;

    // First timer conversion
    firstTimerId?: string;
    firstTimerDate?: string;

    // Member registration
    source?: string;
    dateJoined?: string;

    // Additional metadata
    notes?: string;
  };
}

// Finance email notification job data interface
export interface FinanceEmailJobData {
  jobType: JobType;
  requisitionId: string;
  // Email content
  emailHtml: string;
  emailSubject: string;
  // Recipients
  recipients: Array<{
    email: string;
    name?: string;
  }>;
  // Optional metadata for logging
  metadata?: {
    actionType?: 'approval' | 'rejection' | 'disbursement' | 'notification';
    initiatedBy?: string;
    requisitionAmount?: number;
  };
}

// Entry Import job data interfaces
export interface EntryImportJobData {
  entryImportId: string;
  branchId?: string;
}

export interface EntryImportItemJobData {
  entryImportId: string;
  entryImportItemId: string;
  branchId?: string;
}

// Event email job data interfaces
export interface EventRegistrationConfirmationJobData {
  registrationId: string;
  email: string;
  firstName: string;
  lastName: string;
  eventTitle: string;
  eventDate: Date;
  eventLocation?: string;
  checkInCode: string;
  customFieldResponses?: Map<string, string>;
  confirmationTemplateId?: string;
  senderEmail?: string;
  senderName?: string;
}

export interface PartnerInquiryJobData {
  partnerId: string;
  partnerEmail: string;
  partnerName: string;
  partnerCompany?: string;
  partnerPhone?: string;
  eventTitle: string;
  interestDetails?: string;
  adminEmail?: string; // For admin notifications
}

export interface EventReminderJobData {
  registrationId: string;
  email: string;
  firstName: string;
  lastName: string;
  eventTitle: string;
  eventDate: Date;
  eventLocation?: string;
  checkInCode: string;
  daysUntil: number;
  senderEmail?: string;
  senderName?: string;
}

export interface BulkEventEmailJobData {
  eventId: string;
  eventTitle: string;
  subject: string;
  message: string;
  registrations?: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    checkInCode?: string;
    customFieldResponses?: any;
  }>;
  partners?: Array<{
    id: string;
    email: string;
    name: string;
    company?: string;
  }>;
  scheduledFor?: string;
}
