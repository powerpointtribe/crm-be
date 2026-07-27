/**
 * Service Reports Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum ServiceReportsPermission {
  // CREATE operations
  CREATE_REPORT = 'service-reports:create',
  SUBMIT_REPORT = 'service-reports:submit',

  // READ operations
  VIEW_REPORTS = 'service-reports:view',
  VIEW_REPORT_DETAILS = 'service-reports:view-details',
  VIEW_OWN_REPORTS = 'service-reports:view-own',
  VIEW_DISTRICT_REPORTS = 'service-reports:view-district',
  VIEW_REPORT_STATS = 'service-reports:view-stats',
  EXPORT_REPORTS = 'service-reports:export',

  // UPDATE operations
  UPDATE_REPORT = 'service-reports:update',
  UPDATE_ANY_REPORT = 'service-reports:update-any',
  APPROVE_REPORT = 'service-reports:approve',
  REJECT_REPORT = 'service-reports:reject',

  // DELETE operations
  DELETE_REPORT = 'service-reports:delete',

  // SPECIAL operations
  GENERATE_SUMMARY_REPORT = 'service-reports:generate-summary',
  VIEW_REPORT_TRENDS = 'service-reports:view-trends',
  PUBLISH_REPORT = 'service-reports:publish',
}

export const ServiceReportsPermissionMetadata = {
  [ServiceReportsPermission.CREATE_REPORT]: {
    path: '/service-reports',
    method: 'POST',
    description: 'Create a new service report',
  },
  [ServiceReportsPermission.VIEW_REPORTS]: {
    path: '/service-reports',
    method: 'GET',
    description: 'View all service reports',
  },
  [ServiceReportsPermission.VIEW_REPORT_DETAILS]: {
    path: '/service-reports/:id',
    method: 'GET',
    description: 'View specific report details',
  },
  [ServiceReportsPermission.UPDATE_REPORT]: {
    path: '/service-reports/:id',
    method: 'PATCH',
    description: 'Update service report',
  },
  [ServiceReportsPermission.DELETE_REPORT]: {
    path: '/service-reports/:id',
    method: 'DELETE',
    description: 'Delete service report',
  },
};
