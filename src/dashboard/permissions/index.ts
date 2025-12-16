/**
 * Dashboard Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum DashboardPermission {
  // Dashboard Access
  VIEW_DASHBOARD = 'dashboard:view',

  // Module Access
  VIEW_MODULES = 'dashboard:view-modules',

  // Overview and Stats
  VIEW_OVERVIEW = 'dashboard:view-overview',
  VIEW_STATS = 'dashboard:view-stats',
  VIEW_QUICK_STATS = 'dashboard:view-quick-stats',

  // Analytics
  VIEW_GROWTH_ANALYTICS = 'dashboard:view-growth-analytics',
  VIEW_RECENT_ACTIVITY = 'dashboard:view-recent-activity',
  VIEW_DEMOGRAPHICS = 'dashboard:view-demographics',

  // Activity and Tasks
  VIEW_ACTIVITY_FEED = 'dashboard:view-activity-feed',
  VIEW_PENDING_TASKS = 'dashboard:view-pending-tasks',

  // Module-specific dashboard views
  VIEW_FIRST_TIMERS_DASHBOARD = 'dashboard:view-first-timers',
  VIEW_MEMBERS_DASHBOARD = 'dashboard:view-members',
  VIEW_FINANCES_DASHBOARD = 'dashboard:view-finances',
  VIEW_SETTINGS_DASHBOARD = 'dashboard:view-settings',
}

export const DashboardPermissionMetadata = {
  [DashboardPermission.VIEW_DASHBOARD]: {
    path: '/dashboard',
    method: 'GET',
    description: 'Access dashboard',
  },
  [DashboardPermission.VIEW_MODULES]: {
    path: '/dashboard/modules',
    method: 'GET',
    description: 'View accessible modules',
  },
  [DashboardPermission.VIEW_OVERVIEW]: {
    path: '/dashboard/overview',
    method: 'GET',
    description: 'View dashboard overview',
  },
  [DashboardPermission.VIEW_STATS]: {
    path: '/dashboard/stats',
    method: 'GET',
    description: 'View statistics',
  },
};
