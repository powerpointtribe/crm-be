/**
 * User Management Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum UserManagementPermission {
  // User Invitation CREATE operations
  INVITE_USER = 'users:invite',

  // User Invitation READ operations
  VIEW_USERS = 'users:view',
  VIEW_INVITATIONS = 'users:view-invitations',
  VIEW_INVITATION_DETAILS = 'users:view-invitation-details',
  VIEW_STATISTICS = 'users:view-statistics',

  // User Invitation UPDATE operations
  RESEND_INVITATION = 'users:resend-invitation',
  REVOKE_INVITATION = 'users:revoke-invitation',
  UPDATE_INVITATION_ROLE = 'users:update-invitation-role',

  // User Access Management operations
  MANAGE_USERS = 'users:manage',
  UPDATE_USER_ROLE = 'users:update-user-role',
  ACTIVATE_USER = 'users:activate',
  DEACTIVATE_USER = 'users:deactivate',

  // User DELETE operations
  DELETE_USER = 'users:delete',
  DELETE_INVITATION = 'users:delete-invitation',
}

export const UserManagementPermissionMetadata = {
  [UserManagementPermission.INVITE_USER]: {
    path: '/user-invitations',
    method: 'POST',
    description: 'Invite a user to the platform',
  },
  [UserManagementPermission.VIEW_USERS]: {
    path: '/user-invitations/users/active',
    method: 'GET',
    description: 'View all active users',
  },
  [UserManagementPermission.VIEW_INVITATIONS]: {
    path: '/user-invitations',
    method: 'GET',
    description: 'View all user invitations',
  },
  [UserManagementPermission.VIEW_INVITATION_DETAILS]: {
    path: '/user-invitations/:id',
    method: 'GET',
    description: 'View specific invitation details',
  },
  [UserManagementPermission.VIEW_STATISTICS]: {
    path: '/user-invitations/statistics',
    method: 'GET',
    description: 'View invitation statistics',
  },
  [UserManagementPermission.RESEND_INVITATION]: {
    path: '/user-invitations/:id/resend',
    method: 'POST',
    description: 'Resend invitation email',
  },
  [UserManagementPermission.REVOKE_INVITATION]: {
    path: '/user-invitations/:id/revoke',
    method: 'PATCH',
    description: 'Revoke a pending invitation',
  },
  [UserManagementPermission.UPDATE_INVITATION_ROLE]: {
    path: '/user-invitations/:id/role',
    method: 'PATCH',
    description: 'Update invitation role',
  },
  [UserManagementPermission.MANAGE_USERS]: {
    path: '/user-invitations/users/:memberId/role',
    method: 'PATCH',
    description: 'Manage user access and roles',
  },
  [UserManagementPermission.UPDATE_USER_ROLE]: {
    path: '/user-invitations/users/:memberId/role',
    method: 'PATCH',
    description: 'Update user role',
  },
  [UserManagementPermission.ACTIVATE_USER]: {
    path: '/user-invitations/users/:memberId/activate',
    method: 'PATCH',
    description: 'Activate user access',
  },
  [UserManagementPermission.DEACTIVATE_USER]: {
    path: '/user-invitations/users/:memberId/deactivate',
    method: 'PATCH',
    description: 'Deactivate user access',
  },
  [UserManagementPermission.DELETE_USER]: {
    path: '/user-invitations/users/:memberId/access',
    method: 'DELETE',
    description: 'Permanently delete user access',
  },
  [UserManagementPermission.DELETE_INVITATION]: {
    path: '/user-invitations/:id',
    method: 'DELETE',
    description: 'Delete an invitation',
  },
};
