/**
 * Default system roles configuration
 *
 * SYSTEM ROLES (Built-in, cannot be deleted):
 * - Super Admin: Full system access with all permissions (*)
 * - Admin: Read-only access with all view permissions (view:*)
 *
 * CUSTOM ROLES (Should be created via API as needed):
 * - Senior Pastor, Campus Pastor, Finance Manager, Pastor, Director, LXL
 * - These are NOT system roles and should be created manually or via migration
 *
 * Note: Only Super Admin and Admin are system roles. All other roles should be
 * created as custom roles to allow for organizational flexibility.
 */

export interface DefaultRoleConfig {
  name: string;
  slug: string;
  displayName: string;
  description: string;
  level: number;
  isSystemRole: boolean;
  colorCode?: string;
  permissions: string[]; // Permission names. Special values: '*' = all, 'view:*' = all view permissions
}

export const DEFAULT_ROLES: DefaultRoleConfig[] = [
  {
    name: 'Super Admin',
    slug: 'super-admin',
    displayName: 'Super Administrator',
    description:
      'Full system access with all permissions. Can manage all aspects of the system.',
    level: 100,
    isSystemRole: true,
    colorCode: '#EF4444',
    permissions: ['*'], // All permissions (will be handled specially in seeder)
  },
  {
    name: 'Admin',
    slug: 'admin',
    displayName: 'Administrator',
    description:
      'Read-only administrator with view access to all system data. Cannot create, update, or delete.',
    level: 90,
    isSystemRole: true,
    colorCode: '#F59E0B',
    permissions: ['view:*'], // All view/read-only permissions (handled by seeder)
  },
];

/**
 * DEPRECATED: Senior Pastor, Campus Pastor, and Finance Manager roles
 * have been removed from system roles.
 *
 * To create these as custom roles, use the API:
 *
 * POST /api/v1/roles
 * {
 *   "name": "Senior Pastor",
 *   "slug": "senior-pastor",
 *   "displayName": "Senior Pastor",
 *   "description": "Senior Pastor with view access to all data across all campuses. Can approve requisitions.",
 *   "level": 80,
 *   "isSystemRole": false,
 *   "colorCode": "#8B5CF6",
 *   "permissions": ["view:*", "finance:approve-requisition", "finance:reject-requisition"]
 * }
 *
 * See PRODUCTION_SETUP_GUIDE.md for complete instructions.
 */
