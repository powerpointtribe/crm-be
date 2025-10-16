import { UserRole, ROLE_HIERARCHY, LXL_ROLES } from '../enums/user-roles.enums';
import {
  DashboardModule,
  UNIT_MODULE_ACCESS,
  ROLE_MODULE_ACCESS,
  UnitType,
} from '../enums/dashboard-modules.enums';
import { User } from '../../users/schemas/user.schema';
import { Unit, UnitDocument } from '../../units/schemas/unit.schema';

export class RoleUtils {
  static hasRole(user: User, role: UserRole): boolean {
    return user.roles.includes(role);
  }

  static hasAnyRole(user: User, roles: UserRole[]): boolean {
    return user.roles.some((userRole) => roles.includes(userRole));
  }

  static hasAllRoles(user: User, roles: UserRole[]): boolean {
    return roles.every((role) => user.roles.includes(role));
  }

  static canAccessDashboard(user: User): boolean {
    // Only LXL members and above can access dashboard
    return this.isLXLMember(user) || this.hasRole(user, UserRole.ADMIN);
  }

  static canAccessModule(
    user: User,
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
      user.leaderOfUnit?.toString() === userUnit._id?.toString()
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

  static getAccessibleModules(user: User, userUnit?: Unit): DashboardModule[] {
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
      user.leaderOfUnit?.toString() === userUnit?._id?.toString()
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

  static canBeUnitLeader(user: User): boolean {
    return this.hasAnyRole(user, LXL_ROLES);
  }

  static canManageMinistry(user: User, ministryId?: string): boolean {
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

  static canManageUser(currentUser: User, targetUser: User): boolean {
    if (this.hasRole(currentUser, UserRole.ADMIN)) return true;

    const currentUserMaxLevel = Math.max(
      ...currentUser.roles.map((role) => ROLE_HIERARCHY[role]),
    );
    const targetUserMaxLevel = Math.max(
      ...targetUser.roles.map((role) => ROLE_HIERARCHY[role]),
    );

    return currentUserMaxLevel > targetUserMaxLevel;
  }

  static getHighestRole(user: User): UserRole {
    let highestRole = UserRole.MEMBER;
    let highestLevel = ROLE_HIERARCHY[UserRole.MEMBER];

    for (const role of user.roles) {
      if (ROLE_HIERARCHY[role] > highestLevel) {
        highestLevel = ROLE_HIERARCHY[role];
        highestRole = role;
      }
    }

    return highestRole;
  }

  static isLXLMember(user: User): boolean {
    return this.hasAnyRole(user, LXL_ROLES);
  }

  static isDCWorker(user: User): boolean {
    return this.hasRole(user, UserRole.DC);
  }

  static canViewUserDetails(currentUser: User, targetUser: User): boolean {
    if (this.hasRole(currentUser, UserRole.ADMIN)) return true;

    if (this.hasRole(currentUser, UserRole.PASTOR)) return true;

    if (this.hasRole(currentUser, UserRole.DIRECTOR)) {
      return !!(
        targetUser &&
        targetUser.ministry &&
        currentUser.directorOfMinistries?.some(
          (id) => id.toString() === targetUser.ministry?.toString(),
        )
      );
    }

    if (currentUser.leaderOfUnit) {
      return (
        targetUser.unit?.toString() === currentUser.leaderOfUnit.toString()
      );
    }

    return false;
  }
}
