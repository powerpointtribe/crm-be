import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';
export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Decorator to require a specific permission for an endpoint
 * @param permission - The permission name (e.g., 'members:create')
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);

/**
 * Decorator to require any one of multiple permissions for an endpoint
 * @param permissions - Array of permission names
 */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator to require all of multiple permissions for an endpoint
 * @param permissions - Array of permission names
 */
export const RequireAllPermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, { all: permissions });
