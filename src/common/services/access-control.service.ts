import { Injectable } from '@nestjs/common';
import {
  DashboardModule,
  UnitType,
  UNIT_MODULE_ACCESS,
  ROLE_MODULE_ACCESS,
} from '../enums/dashboard-modules.enums';
import { UserRole } from '../enums/user-roles.enums';
import { Member, MemberDocument } from '../../members/schemas/member.schema';

export interface AccessControlContext {
  member: Member;
  resourceId?: string;
  resourceType?: string;
}

@Injectable()
export class AccessControlService {
  /**
   * Check if a member can access a specific module
   */
  canAccessModule(member: Member, module: DashboardModule): boolean {
    // Admin can access everything
    if (member.systemRoles.includes(UserRole.ADMIN)) {
      return true;
    }

    // Check role-based access
    const roleAccess = this.checkRoleBasedAccess(member, module);
    if (roleAccess) {
      return true;
    }

    // Check unit-based access
    const unitAccess = this.checkUnitBasedAccess(member, module);
    if (unitAccess) {
      return true;
    }

    // Check leadership-based access
    const leadershipAccess = this.checkLeadershipBasedAccess(member, module);
    if (leadershipAccess) {
      return true;
    }

    return false;
  }

  /**
   * Get all modules a member can access
   */
  getAccessibleModules(member: Member): DashboardModule[] {
    const accessibleModules: DashboardModule[] = [];

    for (const module of Object.values(DashboardModule)) {
      if (this.canAccessModule(member, module)) {
        accessibleModules.push(module);
      }
    }

    return accessibleModules;
  }

  /**
   * Check role-based access (pastor, director, etc.)
   */
  private checkRoleBasedAccess(
    member: Member,
    module: DashboardModule,
  ): boolean {
    for (const role of member.systemRoles) {
      const roleModules = ROLE_MODULE_ACCESS[role];
      if (roleModules && roleModules.includes(module)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check unit-based access (GIA can see first-timers, etc.)
   */
  private checkUnitBasedAccess(
    member: Member,
    module: DashboardModule,
  ): boolean {
    if (!member.unitType) {
      return false;
    }

    const unitModules = UNIT_MODULE_ACCESS[member.unitType];
    return unitModules && unitModules.includes(module);
  }

  /**
   * Check leadership-based access (district pastors, unit heads, etc.)
   */
  private checkLeadershipBasedAccess(
    member: Member,
    module: DashboardModule,
  ): boolean {
    const { leadershipRoles } = member;

    switch (module) {
      case DashboardModule.FIRST_TIMERS:
        // Only GIA unit members and leadership can access
        return (
          member.unitType === UnitType.GIA ||
          leadershipRoles.isDistrictPastor ||
          leadershipRoles.isUnitHead
        );

      case DashboardModule.MEMBERS:
        // District pastors can see their district members
        // Unit heads can see their unit members
        // GIA can see all members for integration
        return (
          leadershipRoles.isDistrictPastor ||
          leadershipRoles.isUnitHead ||
          leadershipRoles.isChamp ||
          member.unitType === UnitType.GIA
        );

      case DashboardModule.UNITS:
        // Leadership and pastors can manage units
        return (
          leadershipRoles.isDistrictPastor ||
          leadershipRoles.isUnitHead ||
          member.systemRoles.includes(UserRole.PASTOR) ||
          member.systemRoles.includes(UserRole.LXL)
        );

      case DashboardModule.MINISTRIES:
        // Directors can manage their ministries
        return (
          (member.directorOfMinistries &&
            member.directorOfMinistries.length > 0) ||
          member.systemRoles.includes(UserRole.DIRECTOR) ||
          member.systemRoles.includes(UserRole.PASTOR)
        );

      case DashboardModule.USER_MANAGEMENT:
        // Only high-level leadership can manage users
        return (
          leadershipRoles.isDistrictPastor ||
          member.systemRoles.includes(UserRole.PASTOR) ||
          member.systemRoles.includes(UserRole.ADMIN)
        );

      default:
        return false;
    }
  }

  /**
   * Check if member can perform specific action on a resource
   */
  canPerformAction(
    member: Member,
    action: string,
    resourceType: string,
    resourceId?: string,
  ): boolean {
    // Admin can do everything
    if (member.systemRoles.includes(UserRole.ADMIN)) {
      return true;
    }

    switch (resourceType) {
      case 'member':
        return this.checkMemberResourceAccess(member, action, resourceId);

      case 'first-timer':
        return this.checkFirstTimerResourceAccess(member, action, resourceId);

      case 'group':
        return this.checkGroupResourceAccess(member, action, resourceId);

      default:
        return false;
    }
  }

  private checkMemberResourceAccess(
    member: Member,
    action: string,
    resourceId?: string,
  ): boolean {
    const { leadershipRoles } = member;

    switch (action) {
      case 'view':
        // Can view if has access to members module
        return this.canAccessModule(member, DashboardModule.MEMBERS);

      case 'edit':
        // District pastors can edit their district members
        // Unit heads can edit their unit members
        // GIA can edit for integration purposes
        return (
          leadershipRoles.isDistrictPastor ||
          leadershipRoles.isUnitHead ||
          member.unitType === UnitType.GIA
        );

      case 'delete':
        // Only high-level roles can delete
        return (
          member.systemRoles.includes(UserRole.PASTOR) ||
          member.systemRoles.includes(UserRole.ADMIN)
        );

      default:
        return false;
    }
  }

  private checkFirstTimerResourceAccess(
    member: Member,
    action: string,
    resourceId?: string,
  ): boolean {
    // Only GIA and leadership can access first-timers
    return (
      member.unitType === UnitType.GIA ||
      member.leadershipRoles.isDistrictPastor ||
      member.leadershipRoles.isUnitHead ||
      member.systemRoles.includes(UserRole.PASTOR)
    );
  }

  private checkGroupResourceAccess(
    member: Member,
    action: string,
    resourceId?: string,
  ): boolean {
    const { leadershipRoles } = member;

    switch (action) {
      case 'view':
        return this.canAccessModule(member, DashboardModule.UNITS);

      case 'manage':
        // Can manage if they lead the group or are high-level leadership
        return (
          leadershipRoles.isDistrictPastor ||
          leadershipRoles.isUnitHead ||
          member.systemRoles.includes(UserRole.PASTOR) ||
          member.systemRoles.includes(UserRole.LXL)
        );

      default:
        return false;
    }
  }

  /**
   * Filter data based on member's access level
   */
  filterDataByAccess<T>(member: Member, data: T[], resourceType: string): T[] {
    // Admin sees everything
    if (member.systemRoles.includes(UserRole.ADMIN)) {
      return data;
    }

    // Apply resource-specific filtering logic here
    // This would be expanded based on specific business rules
    return data;
  }

  /**
   * Check if member can access their own profile vs others
   */
  canAccessProfile(member: MemberDocument, targetMemberId: string): boolean {
    // Can always access own profile
    if (member._id.toString() === targetMemberId) {
      return true;
    }

    // Check if has general member access
    return this.canAccessModule(member, DashboardModule.MEMBERS);
  }
}
