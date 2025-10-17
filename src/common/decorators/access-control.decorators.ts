import { SetMetadata } from '@nestjs/common';
import { DashboardModule, UnitType } from '../enums/dashboard-modules.enums';
import { UserRole } from '../enums/user-roles.enums';

// Module access decorators
export const MODULE_ACCESS_KEY = 'module_access';
export const RequireModule = (module: DashboardModule) =>
  SetMetadata(MODULE_ACCESS_KEY, module);

// Unit type requirement decorators
export const UNIT_TYPE_KEY = 'unit_type';
export const RequireUnitType = (...unitTypes: UnitType[]) =>
  SetMetadata(UNIT_TYPE_KEY, unitTypes);

// System role requirement decorators
export const SYSTEM_ROLES_KEY = 'system_roles';
export const RequireSystemRoles = (...roles: UserRole[]) =>
  SetMetadata(SYSTEM_ROLES_KEY, roles);

// Leadership role requirement decorators
export const LEADERSHIP_ROLES_KEY = 'leadership_roles';
export const RequireLeadershipRole = (
  role: 'district_pastor' | 'unit_head' | 'champ',
) => SetMetadata(LEADERSHIP_ROLES_KEY, role);

// Resource access decorators
export const RESOURCE_ACCESS_KEY = 'resource_access';
export const RequireResourceAccess = (resourceType: string, action: string) =>
  SetMetadata(RESOURCE_ACCESS_KEY, { resourceType, action });

// Convenience decorators for specific modules
export const RequireFirstTimersAccess = () =>
  RequireModule(DashboardModule.FIRST_TIMERS);
export const RequireMembersAccess = () =>
  RequireModule(DashboardModule.MEMBERS);
export const RequireGroupsAccess = () => RequireModule(DashboardModule.UNITS);
export const RequireMinistriesAccess = () =>
  RequireModule(DashboardModule.MINISTRIES);
export const RequireReportsAccess = () =>
  RequireModule(DashboardModule.REPORTS);
export const RequireUserManagementAccess = () =>
  RequireModule(DashboardModule.USER_MANAGEMENT);

// Convenience decorators for unit types
export const RequireGIA = () => RequireUnitType(UnitType.GIA);
export const RequireDistrictAccess = () => RequireUnitType(UnitType.DISTRICT);
export const RequireMinistryUnit = () =>
  RequireUnitType(UnitType.MINISTRY_UNIT);
export const RequireLeadershipUnit = () =>
  RequireUnitType(UnitType.LEADERSHIP_UNIT);

// Convenience decorators for leadership roles
export const RequireDistrictPastor = () =>
  RequireLeadershipRole('district_pastor');
export const RequireUnitHead = () => RequireLeadershipRole('unit_head');
export const RequireChamp = () => RequireLeadershipRole('champ');

// Combined access decorators
export const RequireGIAOrLeadership = () => {
  // Custom decorator that allows GIA unit members OR any leadership role
  return SetMetadata('gia_or_leadership', true);
};

export const RequireAdminOrPastor = () =>
  RequireSystemRoles(UserRole.ADMIN, UserRole.PASTOR);

// Resource-specific decorators
export const RequireMemberEdit = () => RequireResourceAccess('member', 'edit');
export const RequireMemberDelete = () =>
  RequireResourceAccess('member', 'delete');
export const RequireFirstTimerManage = () =>
  RequireResourceAccess('first-timer', 'manage');
export const RequireGroupManage = () =>
  RequireResourceAccess('group', 'manage');

// Self-access decorator (can only access own resources)
export const SELF_ACCESS_KEY = 'self_access';
export const AllowSelfAccess = () => SetMetadata(SELF_ACCESS_KEY, true);

// Ministry management decorator
export const MINISTRY_MANAGEMENT_KEY = 'ministry_management';
export const RequireMinistryManagement = (ministryId?: string) =>
  SetMetadata(MINISTRY_MANAGEMENT_KEY, ministryId);

// Public access decorator (no authentication required)
export const PUBLIC_ACCESS_KEY = 'public_access';
export const PublicAccess = () => SetMetadata(PUBLIC_ACCESS_KEY, true);
