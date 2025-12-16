/**
 * Ministries Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum MinistriesPermission {
  // CREATE operations
  CREATE_MINISTRY = 'ministries:create',

  // READ operations
  VIEW_MINISTRIES = 'ministries:view',
  VIEW_MINISTRY_DETAILS = 'ministries:view-details',
  VIEW_MINISTRY_MEMBERS = 'ministries:view-members',
  VIEW_MINISTRY_STATS = 'ministries:view-stats',
  VIEW_OWN_MINISTRY = 'ministries:view-own',

  // UPDATE operations
  UPDATE_MINISTRY = 'ministries:update',
  ASSIGN_MINISTRY_DIRECTOR = 'ministries:assign-director',
  ADD_MINISTRY_MEMBER = 'ministries:add-member',
  REMOVE_MINISTRY_MEMBER = 'ministries:remove-member',
  UPDATE_MINISTRY_STATUS = 'ministries:update-status',

  // DELETE operations
  DELETE_MINISTRY = 'ministries:delete',
  ARCHIVE_MINISTRY = 'ministries:archive',
  RESTORE_MINISTRY = 'ministries:restore',

  // SPECIAL operations
  MANAGE_MINISTRY_EVENTS = 'ministries:manage-events',
  MANAGE_MINISTRY_BUDGET = 'ministries:manage-budget',
  VIEW_MINISTRY_REPORTS = 'ministries:view-reports',
}

export const MinistriesPermissionMetadata = {
  [MinistriesPermission.CREATE_MINISTRY]: {
    path: '/ministries',
    method: 'POST',
    description: 'Create a new ministry',
  },
  [MinistriesPermission.VIEW_MINISTRIES]: {
    path: '/ministries',
    method: 'GET',
    description: 'View all ministries',
  },
  [MinistriesPermission.VIEW_MINISTRY_DETAILS]: {
    path: '/ministries/:id',
    method: 'GET',
    description: 'View specific ministry details',
  },
  [MinistriesPermission.UPDATE_MINISTRY]: {
    path: '/ministries/:id',
    method: 'PATCH',
    description: 'Update ministry information',
  },
  [MinistriesPermission.DELETE_MINISTRY]: {
    path: '/ministries/:id',
    method: 'DELETE',
    description: 'Delete a ministry',
  },
};
