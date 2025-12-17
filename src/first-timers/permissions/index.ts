/**
 * First Timers Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum FirstTimersPermission {
  // CREATE operations
  CREATE_FIRST_TIMER = 'first-timers:create',
  REGISTER_VISITOR = 'first-timers:register-visitor',

  // READ operations
  VIEW_FIRST_TIMERS = 'first-timers:view',
  VIEW_FIRST_TIMER_DETAILS = 'first-timers:view-details',
  VIEW_FIRST_TIMER_STATS = 'first-timers:view-stats',
  VIEW_ASSIGNED_FIRST_TIMERS = 'first-timers:view-assigned',
  EXPORT_FIRST_TIMERS = 'first-timers:export',

  // UPDATE operations
  UPDATE_FIRST_TIMER = 'first-timers:update',
  ASSIGN_FIRST_TIMER = 'first-timers:assign',
  UPDATE_FOLLOW_UP_STATUS = 'first-timers:update-follow-up',
  ADD_CALL_REPORT = 'first-timers:add-call-report',
  UPDATE_INTEGRATION_STAGE = 'first-timers:update-integration-stage',

  // DELETE operations
  DELETE_FIRST_TIMER = 'first-timers:delete',
  ARCHIVE_FIRST_TIMER = 'first-timers:archive',

  // SPECIAL operations
  VIEW_CALL_REPORTS = 'first-timers:view-call-reports',
  CONVERT_TO_MEMBER = 'first-timers:convert-to-member',
}

export const FirstTimersPermissionMetadata = {
  [FirstTimersPermission.CREATE_FIRST_TIMER]: {
    path: '/first-timers',
    method: 'POST',
    description: 'Create a new first timer record',
  },
  [FirstTimersPermission.REGISTER_VISITOR]: {
    path: '/first-timers/register',
    method: 'POST',
    description: 'Public visitor registration',
  },
  [FirstTimersPermission.VIEW_FIRST_TIMERS]: {
    path: '/first-timers',
    method: 'GET',
    description: 'View all first timers',
  },
  [FirstTimersPermission.VIEW_FIRST_TIMER_DETAILS]: {
    path: '/first-timers/:id',
    method: 'GET',
    description: 'View specific first timer details',
  },
  [FirstTimersPermission.UPDATE_FIRST_TIMER]: {
    path: '/first-timers/:id',
    method: 'PATCH',
    description: 'Update first timer information',
  },
  [FirstTimersPermission.DELETE_FIRST_TIMER]: {
    path: '/first-timers/:id',
    method: 'DELETE',
    description: 'Delete a first timer',
  },
};
