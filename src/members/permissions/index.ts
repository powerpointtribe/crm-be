/**
 * Members Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum MembersPermission {
  // CREATE operations
  CREATE_MEMBER = 'members:create',
  REGISTER_MEMBER = 'members:register',

  // READ operations
  VIEW_MEMBERS = 'members:view',
  VIEW_ALL_MEMBERS = 'members:view-all',
  VIEW_MEMBER_DETAILS = 'members:view-details',
  VIEW_MEMBER_STATS = 'members:view-stats',
  VIEW_OWN_PROFILE = 'members:view-own-profile',
  VIEW_DISTRICT_MEMBERS = 'members:view-district',
  EXPORT_MEMBERS = 'members:export',

  // UPDATE operations
  UPDATE_MEMBER = 'members:update',
  UPDATE_OWN_PROFILE = 'members:update-own-profile',
  UPDATE_MEMBER_STATUS = 'members:update-status',
  UPDATE_MEMBER_ROLES = 'members:update-roles',
  ASSIGN_DISTRICT = 'members:assign-district',
  ASSIGN_UNIT = 'members:assign-unit',
  ASSIGN_MINISTRY = 'members:assign-ministry',

  // DELETE operations
  DELETE_MEMBER = 'members:delete',
  SOFT_DELETE_MEMBER = 'members:soft-delete',
  RESTORE_MEMBER = 'members:restore',

  // SPECIAL operations
  UPLOAD_MEMBER_PHOTO = 'members:upload-photo',
  MANAGE_MEMBER_FAMILY = 'members:manage-family',
  VIEW_MEMBER_ENGAGEMENT = 'members:view-engagement',
  UPDATE_SPIRITUAL_JOURNEY = 'members:update-spiritual-journey',
}

/**
 * Permission metadata for endpoint mapping
 */
export const MembersPermissionMetadata = {
  [MembersPermission.CREATE_MEMBER]: {
    path: '/members',
    method: 'POST',
    description: 'Create a new member',
  },
  [MembersPermission.VIEW_MEMBERS]: {
    path: '/members',
    method: 'GET',
    description: 'View members (scoped to own groups)',
  },
  [MembersPermission.VIEW_ALL_MEMBERS]: {
    path: '/members',
    method: 'GET',
    description: 'View all members across all units, ministries, and branches',
  },
  [MembersPermission.VIEW_MEMBER_DETAILS]: {
    path: '/members/:id',
    method: 'GET',
    description: 'View specific member details',
  },
  [MembersPermission.VIEW_MEMBER_STATS]: {
    path: '/members/stats',
    method: 'GET',
    description: 'View member statistics',
  },
  [MembersPermission.VIEW_OWN_PROFILE]: {
    path: '/members/my-profile',
    method: 'GET',
    description: 'View own profile',
  },
  [MembersPermission.UPDATE_MEMBER]: {
    path: '/members/:id',
    method: 'PATCH',
    description: 'Update member information',
  },
  [MembersPermission.UPDATE_OWN_PROFILE]: {
    path: '/members/my-profile',
    method: 'PATCH',
    description: 'Update own profile',
  },
  [MembersPermission.DELETE_MEMBER]: {
    path: '/members/:id',
    method: 'DELETE',
    description: 'Delete a member',
  },
  [MembersPermission.EXPORT_MEMBERS]: {
    path: '/members/export',
    method: 'GET',
    description: 'Export members data',
  },
};
