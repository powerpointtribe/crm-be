import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-roles.enums';
import { DashboardModule } from '../enums/dashboard-modules.enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const DASHBOARD_ACCESS_KEY = 'dashboard_access';
export const DashboardAccess = () => SetMetadata(DASHBOARD_ACCESS_KEY, true);

export const MODULE_ACCESS_KEY = 'module_access';
export const ModuleAccess = (module: DashboardModule) =>
  SetMetadata(MODULE_ACCESS_KEY, module);

export const LXL_ONLY_KEY = 'lxl_only';
export const LXLOnly = () => SetMetadata(LXL_ONLY_KEY, true);

export const MINISTRY_MANAGEMENT_KEY = 'ministry_management';
export const MinistryManagement = (ministryId?: string) =>
  SetMetadata(MINISTRY_MANAGEMENT_KEY, ministryId);

// Convenience decorators for specific modules
export const FirstTimersAccess = () =>
  ModuleAccess(DashboardModule.FIRST_TIMERS);
export const MembersAccess = () => ModuleAccess(DashboardModule.MEMBERS);
export const UnitsAccess = () => ModuleAccess(DashboardModule.UNITS);
export const MinistriesAccess = () => ModuleAccess(DashboardModule.MINISTRIES);
export const EventsAccess = () => ModuleAccess(DashboardModule.EVENTS);
export const ReportsAccess = () => ModuleAccess(DashboardModule.REPORTS);
export const FinancesAccess = () => ModuleAccess(DashboardModule.FINANCES);
export const CommunicationsAccess = () =>
  ModuleAccess(DashboardModule.COMMUNICATIONS);
export const UserManagementAccess = () =>
  ModuleAccess(DashboardModule.USER_MANAGEMENT);
export const SystemSettingsAccess = () =>
  ModuleAccess(DashboardModule.SYSTEM_SETTINGS);
