/**
 * Audit Logs Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum AuditLogsPermission {
  // READ operations
  VIEW_AUDIT_LOGS = 'audit-logs:view',
  VIEW_AUDIT_LOG_DETAILS = 'audit-logs:view-details',
  VIEW_AUDIT_STATISTICS = 'audit-logs:view-statistics',
  EXPORT_AUDIT_LOGS = 'audit-logs:export',

  // DELETE operations
  CLEANUP_OLD_LOGS = 'audit-logs:cleanup',
}

export const AuditLogsPermissionMetadata = {
  [AuditLogsPermission.VIEW_AUDIT_LOGS]: {
    path: '/audit-logs',
    method: 'GET',
    description: 'View all audit logs',
  },
  [AuditLogsPermission.VIEW_AUDIT_LOG_DETAILS]: {
    path: '/audit-logs/:id',
    method: 'GET',
    description: 'View specific audit log details',
  },
  [AuditLogsPermission.VIEW_AUDIT_STATISTICS]: {
    path: '/audit-logs/statistics',
    method: 'GET',
    description: 'View audit log statistics',
  },
  [AuditLogsPermission.EXPORT_AUDIT_LOGS]: {
    path: '/audit-logs/export',
    method: 'GET',
    description: 'Export audit logs',
  },
  [AuditLogsPermission.CLEANUP_OLD_LOGS]: {
    path: '/audit-logs/cleanup',
    method: 'DELETE',
    description: 'Delete old audit logs',
  },
};
