/**
 * Queue Management Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum QueuePermission {
  // READ operations
  VIEW_JOB_STATUS = 'queue:view-job-status',
  VIEW_JOB_HISTORY = 'queue:view-job-history',
  VIEW_QUEUE_STATS = 'queue:view-stats',

  // DELETE operations
  CANCEL_JOB = 'queue:cancel-job',
}

export const QueuePermissionMetadata = {
  [QueuePermission.VIEW_JOB_STATUS]: {
    path: '/queue/jobs/:jobId/status',
    method: 'GET',
    description: 'View job status by ID',
  },
  [QueuePermission.VIEW_JOB_HISTORY]: {
    path: '/queue/jobs/history',
    method: 'GET',
    description: 'View job history for current user',
  },
  [QueuePermission.CANCEL_JOB]: {
    path: '/queue/jobs/:jobId',
    method: 'DELETE',
    description: 'Cancel a job',
  },
  [QueuePermission.VIEW_QUEUE_STATS]: {
    path: '/queue/stats',
    method: 'GET',
    description: 'View queue statistics',
  },
};
