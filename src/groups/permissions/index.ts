/**
 * Groups Module Permissions
 * Centralized permission definitions tied to endpoints
 * Groups include districts, fellowships, committees, etc.
 */

export enum GroupsPermission {
  // CREATE operations
  CREATE_GROUP = 'groups:create',
  CREATE_DISTRICT = 'groups:create-district',
  CREATE_FELLOWSHIP = 'groups:create-fellowship',

  // READ operations
  VIEW_GROUPS = 'groups:view',
  VIEW_GROUP_DETAILS = 'groups:view-details',
  VIEW_GROUP_MEMBERS = 'groups:view-members',
  VIEW_GROUP_STATS = 'groups:view-stats',
  VIEW_OWN_GROUP = 'groups:view-own',

  // UPDATE operations
  UPDATE_GROUP = 'groups:update',
  ASSIGN_GROUP_LEADER = 'groups:assign-leader',
  ADD_GROUP_MEMBER = 'groups:add-member',
  REMOVE_GROUP_MEMBER = 'groups:remove-member',
  UPDATE_GROUP_STATUS = 'groups:update-status',

  // DELETE operations
  DELETE_GROUP = 'groups:delete',
  ARCHIVE_GROUP = 'groups:archive',
  RESTORE_GROUP = 'groups:restore',

  // SPECIAL operations
  MANAGE_GROUP_HIERARCHY = 'groups:manage-hierarchy',
  VIEW_GROUP_ACTIVITIES = 'groups:view-activities',
}

export const GroupsPermissionMetadata = {
  [GroupsPermission.CREATE_GROUP]: {
    path: '/groups',
    method: 'POST',
    description: 'Create a new group',
  },
  [GroupsPermission.VIEW_GROUPS]: {
    path: '/groups',
    method: 'GET',
    description: 'View all groups',
  },
  [GroupsPermission.VIEW_GROUP_DETAILS]: {
    path: '/groups/:id',
    method: 'GET',
    description: 'View specific group details',
  },
  [GroupsPermission.UPDATE_GROUP]: {
    path: '/groups/:id',
    method: 'PATCH',
    description: 'Update group information',
  },
  [GroupsPermission.DELETE_GROUP]: {
    path: '/groups/:id',
    method: 'DELETE',
    description: 'Delete a group',
  },
};
