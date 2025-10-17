import { UserRole, ROLE_HIERARCHY, LXL_ROLES } from '../enums/user-roles.enums';
import {
  DashboardModule,
  UNIT_MODULE_ACCESS,
  ROLE_MODULE_ACCESS,
  UnitType,
} from '../enums/dashboard-modules.enums';
import { Member } from '../../members/schemas/member.schema';
import { Unit, UnitDocument } from '../../units/schemas/unit.schema';

export class RoleUtils {
  static hasRole(user: Member, role: UserRole): boolean {
    return user.systemRoles.includes(role);
  }

  static hasAnyRole(user: Member, roles: UserRole[]): boolean {
    return user.systemRoles.some((userRole) => roles.includes(userRole));
  }

  static hasAllRoles(user: Member, roles: UserRole[]): boolean {
    return roles.every((role) => user.systemRoles.includes(role));
  }

  static canAccessDashboard(user: Member): boolean {
    // Only LXL members and above can access dashboard
    return this.isLXLMember(user) || this.hasRole(user, UserRole.ADMIN);
  }

  static canAccessModule(
    user: Member,
    module: DashboardModule,
    userUnit?: UnitDocument,
  ): boolean {
    // Admin can access everything
    if (this.hasRole(user, UserRole.ADMIN)) {
      return true;
    }

    // Check role-based access first
    if (this.hasRole(user, UserRole.PASTOR)) {
      return ROLE_MODULE_ACCESS.pastor.includes(module);
    }

    if (this.hasRole(user, UserRole.DIRECTOR)) {
      return ROLE_MODULE_ACCESS.director.includes(module);
    }

    // Check unit-based access for unit leaders
    if (
      userUnit &&
      user.leadershipRoles?.leadsUnit?.toString() === userUnit._id?.toString()
    ) {
      const unitModules = UNIT_MODULE_ACCESS[userUnit.unitType];
      return unitModules?.includes(module) || false;
    }

    // LXL members without specific units have limited access
    if (this.isLXLMember(user)) {
      const basicModules = [
        DashboardModule.MEMBERS,
        DashboardModule.EVENTS,
        DashboardModule.REPORTS,
      ];
      return basicModules.includes(module);
    }

    return false;
  }

  static getAccessibleModules(user: Member, userUnit?: Unit): DashboardModule[] {
    // Admin can access everything
    if (this.hasRole(user, UserRole.ADMIN)) {
      return ROLE_MODULE_ACCESS.admin;
    }

    let accessibleModules: DashboardModule[] = [];

    // Role-based modules
    if (this.hasRole(user, UserRole.PASTOR)) {
      accessibleModules = [...ROLE_MODULE_ACCESS.pastor];
    } else if (this.hasRole(user, UserRole.DIRECTOR)) {
      accessibleModules = [...ROLE_MODULE_ACCESS.director];
    }

    // Unit-based modules (for unit leaders)
    if (
      userUnit &&
      user.leadershipRoles?.leadsUnit?.toString() === userUnit?._id?.toString()
    ) {
      const unitModules = UNIT_MODULE_ACCESS[userUnit.unitType] || [];
      accessibleModules = [...new Set([...accessibleModules, ...unitModules])];
    }

    // Basic LXL access if no other permissions
    if (accessibleModules.length === 0 && this.isLXLMember(user)) {
      accessibleModules = [
        DashboardModule.MEMBERS,
        DashboardModule.EVENTS,
        DashboardModule.REPORTS,
      ];
    }

    return accessibleModules;
  }

  static canBeUnitLeader(user: Member): boolean {
    return this.hasAnyRole(user, LXL_ROLES);
  }

  static canManageMinistry(user: Member, ministryId?: string): boolean {
    if (this.hasRole(user, UserRole.ADMIN)) return true;

    if (this.hasRole(user, UserRole.DIRECTOR)) {
      if (!ministryId) return true; // Can manage in general
      return !!user.directorOfMinistries?.some(
        (id) => id.toString() === ministryId,
      );
    }

    if (this.hasRole(user, UserRole.PASTOR)) {
      return true; // Pastors can manage all ministries
    }

    return false;
  }

  static canManageMember(currentMember: Member, targetMember: Member): boolean {
    if (this.hasRole(currentMember, UserRole.ADMIN)) return true;

    const currentMemberMaxLevel = Math.max(
      ...currentMember.systemRoles.map((role) => ROLE_HIERARCHY[role]),
    );
    const targetMemberMaxLevel = Math.max(
      ...targetMember.systemRoles.map((role) => ROLE_HIERARCHY[role]),
    );

    return currentMemberMaxLevel > targetMemberMaxLevel;
  }

  static getHighestRole(user: Member): UserRole {
    let highestRole = UserRole.MEMBER;
    let highestLevel = ROLE_HIERARCHY[UserRole.MEMBER];

    for (const role of user.systemRoles) {
      if (ROLE_HIERARCHY[role] > highestLevel) {
        highestLevel = ROLE_HIERARCHY[role];
        highestRole = role;
      }
    }

    return highestRole;
  }

  static isLXLMember(user: Member): boolean {
    return this.hasAnyRole(user, LXL_ROLES);
  }

  static isDCWorker(user: Member): boolean {
    return this.hasRole(user, UserRole.DC);
  }

  static canViewMemberDetails(currentMember: Member, targetMember: Member): boolean {
    if (this.hasRole(currentMember, UserRole.ADMIN)) return true;

    if (this.hasRole(currentMember, UserRole.PASTOR)) return true;

    if (this.hasRole(currentMember, UserRole.DIRECTOR)) {
      return !!(
        targetMember &&
        targetMember.ministries &&
        currentMember.directorOfMinistries?.some(
          (ministryId) => targetMember.ministries?.includes(ministryId.toString()),
        )
      );
    }

    if (currentMember.leadershipRoles?.leadsUnit) {
      return (
        targetMember.unit?.toString() === currentMember.leadershipRoles.leadsUnit.toString()
      );
    }

    return false;
  }
}
