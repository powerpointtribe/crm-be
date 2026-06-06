/**
 * Branches Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum BranchesPermission {
  // CREATE operations
  CREATE_BRANCH = 'branches:create',

  // READ operations
  VIEW_BRANCHES = 'branches:view',
  VIEW_BRANCH_DETAILS = 'branches:view-details',
  VIEW_ALL_BRANCHES = 'branches:view-all', // Can view and switch between all branches

  // UPDATE operations
  UPDATE_BRANCH = 'branches:update',
  ASSIGN_PASTOR = 'branches:assign-pastor',

  // DELETE operations
  DELETE_BRANCH = 'branches:delete',
}

/**
 * Permission metadata for endpoint mapping
 */
export const BranchesPermissionMetadata = {
  [BranchesPermission.CREATE_BRANCH]: {
    path: '/branches',
    method: 'POST',
    description: 'Create a new campus',
  },
  [BranchesPermission.VIEW_BRANCHES]: {
    path: '/branches',
    method: 'GET',
    description: 'View all campuses',
  },
  [BranchesPermission.VIEW_BRANCH_DETAILS]: {
    path: '/branches/:id',
    method: 'GET',
    description: 'View specific campus details',
  },
  [BranchesPermission.VIEW_ALL_BRANCHES]: {
    path: '/branches/all',
    method: 'GET',
    description: 'View and switch between all campuses',
  },
  [BranchesPermission.UPDATE_BRANCH]: {
    path: '/branches/:id',
    method: 'PATCH',
    description: 'Update campus information',
  },
  [BranchesPermission.ASSIGN_PASTOR]: {
    path: '/branches/:id/assign-pastor',
    method: 'PATCH',
    description: 'Assign pastor to campus',
  },
  [BranchesPermission.DELETE_BRANCH]: {
    path: '/branches/:id',
    method: 'DELETE',
    description: 'Delete/deactivate a campus',
  },
};
