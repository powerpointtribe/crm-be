/**
 * Default system roles configuration
 * Only Super Admin is created by default as a system role.
 * All other roles should be created by administrators as custom roles.
 */

export interface DefaultRoleConfig {
  name: string;
  slug: string;
  displayName: string;
  description: string;
  level: number;
  isSystemRole: boolean;
  colorCode?: string;
  permissions: string[]; // Permission names
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
      'System administrator with broad permissions except critical system settings.',
    level: 90,
    isSystemRole: true,
    colorCode: '#F59E0B',
    permissions: [
      // Members
      'members:create',
      'members:view',
      'members:view-details',
      'members:view-stats',
      'members:update',
      'members:delete',
      'members:export',
      'members:assign-district',
      'members:assign-unit',
      'members:assign-ministry',

      // Ministries
      'ministries:create',
      'ministries:view',
      'ministries:view-details',
      'ministries:update',
      'ministries:delete',
      'ministries:assign-director',

      // Units
      'units:create',
      'units:view',
      'units:view-details',
      'units:update',
      'units:delete',
      'units:assign-head',

      // First Timers
      'first-timers:create',
      'first-timers:view',
      'first-timers:view-details',
      'first-timers:view-stats',
      'first-timers:update',
      'first-timers:delete',
      'first-timers:assign',

      // Attendance
      'attendance:create',
      'attendance:view',
      'attendance:view-stats',
      'attendance:update',
      'attendance:delete',

      // Groups
      'groups:create',
      'groups:view',
      'groups:view-details',
      'groups:update',
      'groups:delete',

      // Branches
      'branches:create',
      'branches:view',
      'branches:view-details',
      'branches:update',
      'branches:delete',

      // Inventory
      'inventory:create-item',
      'inventory:view-items',
      'inventory:update-item',
      'inventory:delete-item',

      // Service Reports
      'service-reports:create',
      'service-reports:view',
      'service-reports:view-details',
      'service-reports:update',
      'service-reports:approve',

      // User Management
      'users:view',
      'users:invite',
      'users:manage',

      // Roles Management
      'roles:view-roles',
      'roles:view-permissions',
      'roles:create-role',
      'roles:update-role',
      'roles:assign-role',

      // Audit Logs
      'audit-logs:view',
      'audit-logs:view-details',
      'audit-logs:view-statistics',
      'audit-logs:export',

      // Finance - Full admin access
      'finance:view-requisitions',
      'finance:view-requisition-details',
      'finance:view-my-requisitions',
      'finance:view-pending-approvals',
      'finance:view-pending-disbursements',
      'finance:create-requisition',
      'finance:update-requisition',
      'finance:delete-requisition',
      'finance:approve-requisition',
      'finance:reject-requisition',
      'finance:disburse',
      'finance:view-expense-categories',
      'finance:create-expense-category',
      'finance:update-expense-category',
      'finance:delete-expense-category',
      'finance:manage-expense-categories',
      'finance:view-form-fields',
      'finance:manage-form-fields',
      'finance:view-reports',
      'finance:export-reports',
      'finance:view-dashboard',
    ],
  },
];
