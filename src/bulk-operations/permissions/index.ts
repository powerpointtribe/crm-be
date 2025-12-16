/**
 * Bulk Operations Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum BulkOperationsPermission {
  // READ operations
  DOWNLOAD_TEMPLATE = 'bulk-operations:download-template',
  VIEW_OPERATIONS_HISTORY = 'bulk-operations:view-history',
  VIEW_OPERATIONS_STATS = 'bulk-operations:view-stats',
  VIEW_AVAILABLE_TEMPLATES = 'bulk-operations:view-templates',

  // CREATE/UPDATE operations
  UPLOAD_BULK_DATA = 'bulk-operations:upload',
  PREVIEW_BULK_OPERATION = 'bulk-operations:preview',
  EXPORT_ENTITIES = 'bulk-operations:export',
  UPDATE_TEMPLATE = 'bulk-operations:update-template',
}

export const BulkOperationsPermissionMetadata = {
  [BulkOperationsPermission.DOWNLOAD_TEMPLATE]: {
    path: '/bulk-operations/templates/:entityType',
    method: 'GET',
    description: 'Download CSV template for bulk operations',
  },
  [BulkOperationsPermission.UPLOAD_BULK_DATA]: {
    path: '/bulk-operations/upload/:entityType',
    method: 'POST',
    description: 'Upload CSV file for bulk operations',
  },
  [BulkOperationsPermission.VIEW_OPERATIONS_HISTORY]: {
    path: '/bulk-operations/operations',
    method: 'GET',
    description: 'View bulk operations history',
  },
  [BulkOperationsPermission.VIEW_OPERATIONS_STATS]: {
    path: '/bulk-operations/stats',
    method: 'GET',
    description: 'View bulk operations statistics',
  },
  [BulkOperationsPermission.PREVIEW_BULK_OPERATION]: {
    path: '/bulk-operations/preview/:entityType',
    method: 'POST',
    description: 'Preview bulk operation without executing',
  },
  [BulkOperationsPermission.EXPORT_ENTITIES]: {
    path: '/bulk-operations/export/:entityType',
    method: 'GET',
    description: 'Export entities as CSV',
  },
  [BulkOperationsPermission.UPDATE_TEMPLATE]: {
    path: '/bulk-operations/templates/:entityType',
    method: 'PATCH',
    description: 'Update CSV template',
  },
  [BulkOperationsPermission.VIEW_AVAILABLE_TEMPLATES]: {
    path: '/bulk-operations/templates',
    method: 'GET',
    description: 'View available templates',
  },
};
