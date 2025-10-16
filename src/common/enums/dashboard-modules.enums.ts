export enum DashboardModule {
  FIRST_TIMERS = 'first_timers',
  MEMBERS = 'members',
  UNITS = 'units',
  MINISTRIES = 'ministries',
  EVENTS = 'events',
  REPORTS = 'reports',
  FINANCES = 'finances',
  COMMUNICATIONS = 'communications',
  USER_MANAGEMENT = 'user_management',
  SYSTEM_SETTINGS = 'system_settings',
}

export enum UnitType {
  GIA = 'gia', // Guest Integration & Assimilation
  DISTRICT = 'district',
  MINISTRY_UNIT = 'ministry_unit',
  LEADERSHIP_UNIT = 'leadership_unit',
}

// Define which modules each unit type can access
export const UNIT_MODULE_ACCESS = {
  [UnitType.GIA]: [
    DashboardModule.FIRST_TIMERS,
    DashboardModule.MEMBERS,
    DashboardModule.EVENTS,
    DashboardModule.COMMUNICATIONS,
    DashboardModule.REPORTS,
  ],
  [UnitType.DISTRICT]: [
    DashboardModule.MEMBERS,
    DashboardModule.EVENTS,
    DashboardModule.COMMUNICATIONS,
    DashboardModule.REPORTS,
  ],
  [UnitType.MINISTRY_UNIT]: [
    DashboardModule.MEMBERS,
    DashboardModule.EVENTS,
    DashboardModule.MINISTRIES,
    DashboardModule.REPORTS,
  ],
  [UnitType.LEADERSHIP_UNIT]: [
    DashboardModule.MEMBERS,
    DashboardModule.UNITS,
    DashboardModule.EVENTS,
    DashboardModule.REPORTS,
    DashboardModule.USER_MANAGEMENT,
  ],
};

// Modules that different roles can access
export const ROLE_MODULE_ACCESS = {
  // Pastors can access most modules except system settings
  pastor: [
    DashboardModule.FIRST_TIMERS,
    DashboardModule.MEMBERS,
    DashboardModule.UNITS,
    DashboardModule.MINISTRIES,
    DashboardModule.EVENTS,
    DashboardModule.REPORTS,
    DashboardModule.FINANCES,
    DashboardModule.COMMUNICATIONS,
    DashboardModule.USER_MANAGEMENT,
  ],
  // Directors can manage their ministry-related modules
  director: [
    DashboardModule.MEMBERS,
    DashboardModule.UNITS,
    DashboardModule.MINISTRIES,
    DashboardModule.EVENTS,
    DashboardModule.REPORTS,
    DashboardModule.COMMUNICATIONS,
  ],
  // Admin can access everything
  admin: Object.values(DashboardModule),
};