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
};
