/**
 * Units Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum UnitsPermission {
  // CREATE operations
  CREATE_UNIT = 'units:create',

  // READ operations
  VIEW_UNITS = 'units:view',
  VIEW_UNIT_DETAILS = 'units:view-details',
  VIEW_UNIT_MEMBERS = 'units:view-members',
  VIEW_UNIT_STATS = 'units:view-stats',
  VIEW_OWN_UNIT = 'units:view-own',

  // UPDATE operations
  UPDATE_UNIT = 'units:update',
  ASSIGN_UNIT_HEAD = 'units:assign-head',
  ADD_UNIT_MEMBER = 'units:add-member',
  REMOVE_UNIT_MEMBER = 'units:remove-member',
  UPDATE_UNIT_TYPE = 'units:update-type',

  // DELETE operations
  DELETE_UNIT = 'units:delete',
  ARCHIVE_UNIT = 'units:archive',
  RESTORE_UNIT = 'units:restore',

  // SPECIAL operations
  MANAGE_UNIT_STRUCTURE = 'units:manage-structure',
  VIEW_UNIT_HIERARCHY = 'units:view-hierarchy',
}

export const UnitsPermissionMetadata = {
  [UnitsPermission.CREATE_UNIT]: {
    path: '/units',
    method: 'POST',
    description: 'Create a new unit',
  },
  [UnitsPermission.VIEW_UNITS]: {
    path: '/units',
    method: 'GET',
    description: 'View all units',
  },
  [UnitsPermission.VIEW_UNIT_DETAILS]: {
    path: '/units/:id',
    method: 'GET',
    description: 'View specific unit details',
  },
  [UnitsPermission.UPDATE_UNIT]: {
    path: '/units/:id',
    method: 'PATCH',
    description: 'Update unit information',
  },
  [UnitsPermission.DELETE_UNIT]: {
    path: '/units/:id',
    method: 'DELETE',
    description: 'Delete a unit',
  },
};
