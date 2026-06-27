/**
 * Bulk Email Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum BulkEmailPermission {
  // Template operations
  VIEW_TEMPLATES = 'bulk-email:view-templates',
  CREATE_TEMPLATE = 'bulk-email:create-template',
  UPDATE_TEMPLATE = 'bulk-email:update-template',
  DELETE_TEMPLATE = 'bulk-email:delete-template',

  // Campaign operations
  VIEW_CAMPAIGNS = 'bulk-email:view-campaigns',
  CREATE_CAMPAIGN = 'bulk-email:create-campaign',
  UPDATE_CAMPAIGN = 'bulk-email:update-campaign',
  DELETE_CAMPAIGN = 'bulk-email:delete-campaign',

  // Campaign actions
  SEND_CAMPAIGN = 'bulk-email:send-campaign',
  SCHEDULE_CAMPAIGN = 'bulk-email:schedule-campaign',
  CANCEL_CAMPAIGN = 'bulk-email:cancel-campaign',

  // Form template operations
  VIEW_FORMS = 'bulk-email:view-forms',
  CREATE_FORM = 'bulk-email:create-form',
  UPDATE_FORM = 'bulk-email:update-form',
  DELETE_FORM = 'bulk-email:delete-form',

  // Logs and stats
  VIEW_SEND_LOGS = 'bulk-email:view-send-logs',
  PREVIEW_RECIPIENTS = 'bulk-email:preview-recipients',
  VIEW_STATS = 'bulk-email:view-stats',
}

/**
 * Permission metadata for endpoint mapping
 */
export const BulkEmailPermissionMetadata = {
  // Template permissions
  [BulkEmailPermission.VIEW_TEMPLATES]: {
    path: '/bulk-email/templates',
    method: 'GET',
    description: 'View all email templates',
  },
  [BulkEmailPermission.CREATE_TEMPLATE]: {
    path: '/bulk-email/templates',
    method: 'POST',
    description: 'Create a new email template',
  },
  [BulkEmailPermission.UPDATE_TEMPLATE]: {
    path: '/bulk-email/templates/:id',
    method: 'PATCH',
    description: 'Update an email template',
  },
  [BulkEmailPermission.DELETE_TEMPLATE]: {
    path: '/bulk-email/templates/:id',
    method: 'DELETE',
    description: 'Delete an email template',
  },

  // Campaign permissions
  [BulkEmailPermission.VIEW_CAMPAIGNS]: {
    path: '/bulk-email/campaigns',
    method: 'GET',
    description: 'View all email campaigns',
  },
  [BulkEmailPermission.CREATE_CAMPAIGN]: {
    path: '/bulk-email/campaigns',
    method: 'POST',
    description: 'Create a new email campaign',
  },
  [BulkEmailPermission.UPDATE_CAMPAIGN]: {
    path: '/bulk-email/campaigns/:id',
    method: 'PATCH',
    description: 'Update a draft campaign',
  },
  [BulkEmailPermission.DELETE_CAMPAIGN]: {
    path: '/bulk-email/campaigns/:id',
    method: 'DELETE',
    description: 'Delete a campaign',
  },

  // Form template permissions
  [BulkEmailPermission.VIEW_FORMS]: {
    path: '/bulk-email/forms',
    method: 'GET',
    description: 'View all form templates',
  },
  [BulkEmailPermission.CREATE_FORM]: {
    path: '/bulk-email/forms',
    method: 'POST',
    description: 'Create a new form template',
  },
  [BulkEmailPermission.UPDATE_FORM]: {
    path: '/bulk-email/forms/:id',
    method: 'PATCH',
    description: 'Update a form template',
  },
  [BulkEmailPermission.DELETE_FORM]: {
    path: '/bulk-email/forms/:id',
    method: 'DELETE',
    description: 'Delete a form template',
  },

  // Campaign action permissions
  [BulkEmailPermission.SEND_CAMPAIGN]: {
    path: '/bulk-email/campaigns/:id/send',
    method: 'POST',
    description: 'Send a campaign immediately',
  },
  [BulkEmailPermission.SCHEDULE_CAMPAIGN]: {
    path: '/bulk-email/campaigns/:id/schedule',
    method: 'POST',
    description: 'Schedule a campaign for later',
  },
  [BulkEmailPermission.CANCEL_CAMPAIGN]: {
    path: '/bulk-email/campaigns/:id/cancel',
    method: 'POST',
    description: 'Cancel a scheduled campaign',
  },

  // Logs and stats permissions
  [BulkEmailPermission.VIEW_SEND_LOGS]: {
    path: '/bulk-email/campaigns/:id/logs',
    method: 'GET',
    description: 'View campaign delivery logs',
  },
  [BulkEmailPermission.PREVIEW_RECIPIENTS]: {
    path: '/bulk-email/campaigns/:id/preview',
    method: 'POST',
    description: 'Preview campaign recipients',
  },
  [BulkEmailPermission.VIEW_STATS]: {
    path: '/bulk-email/statistics',
    method: 'GET',
    description: 'View bulk email statistics',
  },
};
