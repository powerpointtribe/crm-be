/**
 * Module identifiers for role-based module assignment
 * When a module is assigned to a role, all VIEW permissions for that module are granted
 */
export enum ModuleIdentifier {
  MEMBERS = 'members',
  FIRST_TIMERS = 'first-timers',
  GROUPS = 'groups',
  ATTENDANCE = 'attendance',
  MINISTRIES = 'ministries',
  UNITS = 'units',
  SERVICE_REPORTS = 'service-reports',
  INVENTORY = 'inventory',
  WORKERS_TRAINING = 'workers-training',
  DASHBOARD = 'dashboard',
  AUDIT_LOGS = 'audit-logs',
  BRANCHES = 'branches',
  EVENTS = 'events',
  FINANCE = 'finance',
  LIBRARY = 'library',
  BULK_EMAIL = 'bulk-email',
  BULK_OPERATIONS = 'bulk-operations',
  ACTIVITY_TRACKER = 'activity-tracker',
  ROLES = 'roles',
  USER_MANAGEMENT = 'users',
  QUEUE = 'queue',
  NOTIFICATIONS = 'notifications',
  STORE = 'store',
}

/**
 * Display names for modules (used in UI)
 */
export const MODULE_DISPLAY_NAMES: Record<string, string> = {
  [ModuleIdentifier.MEMBERS]: 'Members',
  [ModuleIdentifier.FIRST_TIMERS]: 'First Timers',
  [ModuleIdentifier.GROUPS]: 'Groups/Districts',
  [ModuleIdentifier.ATTENDANCE]: 'Attendance',
  [ModuleIdentifier.MINISTRIES]: 'Ministries',
  [ModuleIdentifier.UNITS]: 'Units',
  [ModuleIdentifier.SERVICE_REPORTS]: 'Service Reports',
  [ModuleIdentifier.INVENTORY]: 'Inventory',
  [ModuleIdentifier.WORKERS_TRAINING]: 'Workers Training',
  [ModuleIdentifier.DASHBOARD]: 'Dashboard',
  [ModuleIdentifier.AUDIT_LOGS]: 'Audit Logs',
  [ModuleIdentifier.BRANCHES]: 'Branches',
  [ModuleIdentifier.EVENTS]: 'Events',
  [ModuleIdentifier.FINANCE]: 'Finance',
  [ModuleIdentifier.LIBRARY]: 'Library',
  [ModuleIdentifier.BULK_EMAIL]: 'Bulk Email',
  [ModuleIdentifier.BULK_OPERATIONS]: 'Bulk Operations',
  [ModuleIdentifier.ACTIVITY_TRACKER]: 'Activity Tracker',
  [ModuleIdentifier.ROLES]: 'Roles & Permissions',
  [ModuleIdentifier.USER_MANAGEMENT]: 'User Management',
  [ModuleIdentifier.QUEUE]: 'Queue Management',
  [ModuleIdentifier.NOTIFICATIONS]: 'Notifications',
  [ModuleIdentifier.STORE]: 'Store',
};

/**
 * Map modules to their dashboard stat keys
 * Used to filter dashboard stats based on accessible modules
 */
export const MODULE_DASHBOARD_STATS: Record<string, string[]> = {
  [ModuleIdentifier.MEMBERS]: ['totalMembers', 'activeMembers', 'recentMembers'],
  [ModuleIdentifier.FIRST_TIMERS]: ['totalFirstTimers', 'recentFirstTimers'],
  [ModuleIdentifier.GROUPS]: ['totalGroups', 'recentGroups'],
  [ModuleIdentifier.SERVICE_REPORTS]: ['serviceReports', 'totalAttendance'],
  [ModuleIdentifier.EVENTS]: ['totalEvents', 'recentEvents'],
};

/**
 * Get all available modules as an array of objects with identifier and displayName
 */
export function getAvailableModules(): Array<{ identifier: string; displayName: string }> {
  return Object.values(ModuleIdentifier).map((identifier) => ({
    identifier,
    displayName: MODULE_DISPLAY_NAMES[identifier] || identifier,
  }));
}
