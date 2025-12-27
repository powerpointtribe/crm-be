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
   * Access control is now handled by permission system
   */
  canAccessModule(member: Member, module: DashboardModule): boolean {
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
   * Check leadership-based access
   * Note: Leadership-based access is now handled by the role-based permission system
   */
  private checkLeadershipBasedAccess(
    member: Member,
    module: DashboardModule,
  ): boolean {
    switch (module) {
      case DashboardModule.FIRST_TIMERS:
        // Only GIA unit members can access
        return member.unitType === UnitType.GIA;

      case DashboardModule.MEMBERS:
        // GIA can see all members for integration
        return member.unitType === UnitType.GIA;

      case DashboardModule.UNITS:
        // Access handled by role-based permissions
        return false;

      case DashboardModule.MINISTRIES:
        // Access handled by role-based permissions
        return false;

      case DashboardModule.USER_MANAGEMENT:
        // Access handled by role-based permissions
        return false;

      default:
        return false;
    }
  }

  /**
   * Check if member can perform specific action on a resource
   * Access control is now handled by permission system
   */
  canPerformAction(
    member: Member,
    action: string,
    resourceType: string,
    resourceId?: string,
  ): boolean {
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
    switch (action) {
      case 'view':
        // Can view if has access to members module
        return this.canAccessModule(member, DashboardModule.MEMBERS);

      case 'edit':
        // GIA can edit for integration purposes
        // Other access handled by role-based permissions
        return member.unitType === UnitType.GIA;

      case 'delete':
        // Access handled by role-based permissions
        return false;

      default:
        return false;
    }
  }

  private checkFirstTimerResourceAccess(
    member: Member,
    action: string,
    resourceId?: string,
  ): boolean {
    // Only GIA can access first-timers via unit-based access
    // Other access handled by role-based permissions
    return member.unitType === UnitType.GIA;
  }

  private checkGroupResourceAccess(
    member: Member,
    action: string,
    resourceId?: string,
  ): boolean {
    switch (action) {
      case 'view':
        return this.canAccessModule(member, DashboardModule.UNITS);

      case 'manage':
        // Access handled by role-based permissions
        return false;

      default:
        return false;
    }
  }

  /**
   * Filter data based on member's access level
   * Access control is now handled by permission system
   */
  filterDataByAccess<T>(member: Member, data: T[], resourceType: string): T[] {
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
