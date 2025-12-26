/**
 * Roles and Permissions Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum RolesModulePermission {
  // Role CREATE operations
  CREATE_ROLE = 'roles:create-role',
  CREATE_PERMISSION = 'roles:create-permission',

  // Role READ operations
  VIEW_ROLES = 'roles:view-roles',
  VIEW_ROLE_DETAILS = 'roles:view-role-details',
  VIEW_PERMISSIONS = 'roles:view-permissions',
  VIEW_PERMISSION_DETAILS = 'roles:view-permission-details',
  VIEW_USER_PERMISSIONS = 'roles:view-user-permissions',

  // Role UPDATE operations
  UPDATE_ROLE = 'roles:update-role',
  UPDATE_PERMISSION = 'roles:update-permission',
  ASSIGN_PERMISSIONS_TO_ROLE = 'roles:assign-permissions',
  ASSIGN_ROLE_TO_USER = 'roles:assign-role-to-user',

  // Role DELETE operations
  DELETE_ROLE = 'roles:delete-role',
  DELETE_PERMISSION = 'roles:delete-permission',

  // Seeder operations
  SEED_PERMISSIONS = 'roles:seed-permissions',
  SEED_ROLES = 'roles:seed-roles',
  VIEW_SEEDER_STATS = 'roles:view-seeder-stats',

  // Role Assignment operations
  CREATE_ROLE_ASSIGNMENT = 'roles:create-assignment',
  VIEW_ROLE_ASSIGNMENTS = 'roles:view-assignments',
  UPDATE_ROLE_ASSIGNMENT = 'roles:update-assignment',
  DELETE_ROLE_ASSIGNMENT = 'roles:delete-assignment',
  BULK_ASSIGN_ROLES = 'roles:bulk-assign',
  VIEW_MEMBER_ASSIGNMENTS = 'roles:view-member-assignments',
  VIEW_SCOPE_ASSIGNMENTS = 'roles:view-scope-assignments',
}

export const RolesModulePermissionMetadata = {
  [RolesModulePermission.CREATE_ROLE]: {
    path: '/roles',
    method: 'POST',
    description: 'Create a new role',
  },
  [RolesModulePermission.VIEW_ROLES]: {
    path: '/roles',
    method: 'GET',
    description: 'View all roles',
  },
  [RolesModulePermission.VIEW_ROLE_DETAILS]: {
    path: '/roles/:id',
    method: 'GET',
    description: 'View specific role details',
  },
  [RolesModulePermission.UPDATE_ROLE]: {
    path: '/roles/:id',
    method: 'PATCH',
    description: 'Update role information',
  },
  [RolesModulePermission.DELETE_ROLE]: {
    path: '/roles/:id',
    method: 'DELETE',
    description: 'Delete a role',
  },
  [RolesModulePermission.CREATE_PERMISSION]: {
    path: '/permissions',
    method: 'POST',
    description: 'Create a new permission',
  },
  [RolesModulePermission.VIEW_PERMISSIONS]: {
    path: '/permissions',
    method: 'GET',
    description: 'View all permissions',
  },
  [RolesModulePermission.SEED_PERMISSIONS]: {
    path: '/roles/seeder/permissions',
    method: 'POST',
    description: 'Seed permissions into database',
  },
  [RolesModulePermission.SEED_ROLES]: {
    path: '/roles/seeder/roles',
    method: 'POST',
    description: 'Seed roles into database',
  },
  [RolesModulePermission.CREATE_ROLE_ASSIGNMENT]: {
    path: '/role-assignments',
    method: 'POST',
    description: 'Create a role assignment for a member',
  },
  [RolesModulePermission.VIEW_ROLE_ASSIGNMENTS]: {
    path: '/role-assignments',
    method: 'GET',
    description: 'View all role assignments',
  },
  [RolesModulePermission.UPDATE_ROLE_ASSIGNMENT]: {
    path: '/role-assignments/:id',
    method: 'PATCH',
    description: 'Update a role assignment',
  },
  [RolesModulePermission.DELETE_ROLE_ASSIGNMENT]: {
    path: '/role-assignments/:id',
    method: 'DELETE',
    description: 'Delete/deactivate a role assignment',
  },
  [RolesModulePermission.BULK_ASSIGN_ROLES]: {
    path: '/role-assignments/bulk',
    method: 'POST',
    description: 'Bulk assign roles to multiple members',
  },
  [RolesModulePermission.VIEW_MEMBER_ASSIGNMENTS]: {
    path: '/role-assignments/member/:memberId',
    method: 'GET',
    description: 'View all role assignments for a member',
  },
  [RolesModulePermission.VIEW_SCOPE_ASSIGNMENTS]: {
    path: '/role-assignments/scope/:scopeType/:scopeId',
    method: 'GET',
    description: 'View all assignments for a specific scope',
  },
};
