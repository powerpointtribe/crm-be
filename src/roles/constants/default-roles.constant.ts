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
    ],
  },
  {
    name: 'Pastor',
    slug: 'pastor',
    displayName: 'Pastor',
    description: 'Church pastor with access to pastoral and leadership functions.',
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
