/**
 * Default system roles configuration
 * These roles will be created during initial seeding
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

      // Audit Logs
      'audit-logs:view',
      'audit-logs:view-details',
      'audit-logs:view-statistics',
      'audit-logs:export',
    ],
  },
  {
    name: 'Senior Pastor',
    slug: 'senior-pastor',
    displayName: 'Senior Pastor',
    description:
      'Senior Pastor with global oversight across all branches and districts. Full access to all data organization-wide.',
    level: 95,
    isSystemRole: true,
    colorCode: '#7C3AED',
    permissions: [
      // Members - Full global access
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
      'members:assign-branch',

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

      // First Timers - Full access
      'first-timers:create',
      'first-timers:view',
      'first-timers:view-details',
      'first-timers:view-stats',
      'first-timers:update',
      'first-timers:delete',
      'first-timers:assign',
      'first-timers:view-assigned',
      'first-timers:update-follow-up',
      'first-timers:add-call-report',
      'first-timers:view-call-reports',
      'first-timers:convert-to-member',

      // Attendance
      'attendance:create',
      'attendance:view',
      'attendance:view-stats',
      'attendance:update',
      'attendance:delete',

      // Groups/Districts
      'groups:create',
      'groups:view',
      'groups:view-details',
      'groups:update',
      'groups:delete',

      // Branches - Full access
      'branches:create',
      'branches:view',
      'branches:view-details',
      'branches:update',
      'branches:delete',
      'branches:assign-pastor',

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
      'users:delete',

      // Roles Management
      'roles:view-roles',
      'roles:view-permissions',
      'roles:assign-role',

      // Audit Logs
      'audit-logs:view',
      'audit-logs:view-details',
      'audit-logs:view-statistics',
      'audit-logs:export',

      // Inventory
      'inventory:view-items',
      'inventory:create-item',
      'inventory:update-item',
    ],
  },
  {
    name: 'Branch Pastor',
    slug: 'branch-pastor',
    displayName: 'Branch Pastor',
    description:
      'Branch Pastor with full access to all data within their assigned branch only.',
    level: 85,
    isSystemRole: true,
    colorCode: '#8B5CF6',
    permissions: [
      // Members - Branch scoped
      'members:create',
      'members:view',
      'members:view-branch', // Branch-scoped view
      'members:view-details',
      'members:view-stats',
      'members:update',
      'members:assign-district',
      'members:assign-unit',
      'members:assign-ministry',

      // First Timers - Branch scoped
      'first-timers:create',
      'first-timers:view',
      'first-timers:view-branch', // Branch-scoped view
      'first-timers:view-details',
      'first-timers:view-stats',
      'first-timers:update',
      'first-timers:assign',
      'first-timers:view-assigned',
      'first-timers:update-follow-up',
      'first-timers:add-call-report',
      'first-timers:view-call-reports',
      'first-timers:convert-to-member',

      // Attendance - Branch scoped
      'attendance:create',
      'attendance:view',
      'attendance:view-branch',
      'attendance:view-stats',
      'attendance:update',

      // Groups/Districts - Branch scoped
      'groups:create',
      'groups:view',
      'groups:view-branch',
      'groups:view-details',
      'groups:update',

      // Ministries - Branch scoped
      'ministries:view',
      'ministries:view-details',
      'ministries:view-branch',
      'ministries:assign-director',

      // Units - Branch scoped
      'units:create',
      'units:view',
      'units:view-branch',
      'units:view-details',
      'units:update',
      'units:assign-head',

      // Service Reports - Branch scoped
      'service-reports:create',
      'service-reports:view',
      'service-reports:view-branch',
      'service-reports:view-details',
      'service-reports:update',
      'service-reports:approve',
      'service-reports:submit',

      // User Management - Branch scoped
      'users:view',
      'users:view-branch',
      'users:invite',
      'users:invite-branch', // Can only invite within branch

      // Audit Logs
      'audit-logs:view',
      'audit-logs:view-details',
      'audit-logs:view-statistics',

      // Inventory - Branch scoped
      'inventory:view-items',
      'inventory:view-branch',
      'inventory:create-item',
      'inventory:update-item',
    ],
  },
  {
    name: 'Assistant Pastor',
    slug: 'assistant-pastor',
    displayName: 'Assistant Pastor',
    description:
      'Assistant Pastor assigned to specific districts within a branch. Can view branch-level data but only manage their assigned districts.',
    level: 70,
    isSystemRole: true,
    colorCode: '#6366F1',
    permissions: [
      // Members - District scoped within branch
      'members:view',
      'members:view-branch', // Can view branch members (read-only)
      'members:view-district', // Can manage district members
      'members:view-details',
      'members:view-stats',
      'members:update', // Only for district members (enforced in service)
      'members:assign-unit',

      // First Timers - District scoped
      'first-timers:view',
      'first-timers:view-branch', // Can view branch (read-only)
      'first-timers:view-district', // Can manage district
      'first-timers:view-details',
      'first-timers:view-assigned',
      'first-timers:update',
      'first-timers:update-follow-up',
      'first-timers:add-call-report',
      'first-timers:view-call-reports',
      'first-timers:assign',
      'first-timers:convert-to-member',

      // Attendance - District scoped
      'attendance:view',
      'attendance:view-branch',
      'attendance:view-district',
      'attendance:view-stats',
      'attendance:create',
      'attendance:update',

      // Groups - District scoped
      'groups:view',
      'groups:view-own',
      'groups:view-details',
      'groups:update', // Only for assigned districts

      // Service Reports - District scoped
      'service-reports:view',
      'service-reports:view-district',
      'service-reports:view-details',
      'service-reports:submit',

      // Ministries - View only
      'ministries:view',
      'ministries:view-details',

      // Units - District scoped
      'units:view',
      'units:view-district',
      'units:view-details',
      'units:update',
      'units:assign-head',

      // Audit Logs - Limited
      'audit-logs:view',
      'audit-logs:view-details',
    ],
  },
  {
    name: 'Pastor',
    slug: 'pastor',
    displayName: 'Pastor',
    description: 'Legacy pastor role. Maps to Branch Pastor level access.',
    level: 80,
    isSystemRole: true,
    colorCode: '#8B5CF6',
    permissions: [
      'members:view',
      'members:view-details',
      'members:view-stats',
      'members:update',
      'members:assign-district',
      'first-timers:view',
      'first-timers:view-details',
      'first-timers:view-stats',
      'first-timers:assign',
      'attendance:view',
      'attendance:view-stats',
      'service-reports:view',
      'service-reports:view-details',
      'service-reports:approve',
      'groups:view',
      'groups:view-details',
      'ministries:view',
      'ministries:view-details',
      'units:view',
      'units:view-details',

      // Audit Logs
      'audit-logs:view',
      'audit-logs:view-details',
      'audit-logs:view-statistics',
    ],
  },
  {
    name: 'District Pastor',
    slug: 'district-pastor',
    displayName: 'District Pastor',
    description: 'District leader with permissions for their district.',
    level: 60,
    isSystemRole: true,
    colorCode: '#3B82F6',
    permissions: [
      'members:view-district',
      'members:view-details',
      'first-timers:view-assigned',
      'first-timers:view-details',
      'first-timers:update-follow-up',
      'attendance:view-district',
      'service-reports:view-district',
      'service-reports:submit',
      'groups:view-own',
    ],
  },
  {
    name: 'Ministry Director',
    slug: 'ministry-director',
    displayName: 'Ministry Director',
    description: 'Director of a ministry with management permissions.',
    level: 50,
    isSystemRole: true,
    colorCode: '#10B981',
    permissions: [
      'ministries:view-own',
      'ministries:view-members',
      'ministries:add-member',
      'ministries:remove-member',
      'ministries:manage-events',
      'members:view',
      'members:view-details',
    ],
  },
  {
    name: 'Unit Head',
    slug: 'unit-head',
    displayName: 'Unit Head',
    description: 'Leader of a unit with unit management permissions.',
    level: 40,
    isSystemRole: true,
    colorCode: '#06B6D4',
    permissions: [
      'units:view-own',
      'units:view-members',
      'units:add-member',
      'units:remove-member',
      'members:view',
      'members:view-details',
    ],
  },
  {
    name: 'DC',
    slug: 'dc',
    displayName: "David's Company",
    description: 'Worker with basic access to church activities.',
    level: 20,
    isSystemRole: true,
    colorCode: '#84CC16',
    permissions: [
      'members:view',
      'members:view-own-profile',
      'members:update-own-profile',
      'attendance:mark-self',
      'attendance:view-own',
      'first-timers:view-assigned',
      'first-timers:add-call-report',
    ],
  },
  {
    name: 'Member',
    slug: 'member',
    displayName: 'Member',
    description: 'Regular church member with basic access.',
    level: 10,
    isSystemRole: true,
    colorCode: '#64748B',
    permissions: [
      'members:view-own-profile',
      'members:update-own-profile',
      'attendance:view-own',
      'attendance:mark-self',
    ],
  },
];
