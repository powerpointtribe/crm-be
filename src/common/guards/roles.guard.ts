import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ROLES_KEY,
  DASHBOARD_ACCESS_KEY,
  LXL_ONLY_KEY,
  MINISTRY_MANAGEMENT_KEY,
  MODULE_ACCESS_KEY
} from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-roles.enums';
import { DashboardModule } from '../enums/dashboard-modules.enums';
import { RoleUtils } from '../utils/role.utils';
import { User } from '../../users/schemas/user.schema';
import { Unit, UnitDocument } from '../../units/schemas/unit.schema';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: User = request.user;
    const userUnit: UnitDocument = request.userUnit; // This would be populated by middleware

    if (!user) {
      return false;
    }

    // Check specific roles requirement
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles) {
      return RoleUtils.hasAnyRole(user, requiredRoles);
    }

    // Check module access requirement
    const requiredModule = this.reflector.getAllAndOverride<DashboardModule>(
      MODULE_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredModule) {
      return RoleUtils.canAccessModule(user, requiredModule, userUnit);
    }

    // Check dashboard access requirement
    const requiresDashboardAccess = this.reflector.getAllAndOverride<boolean>(
      DASHBOARD_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiresDashboardAccess) {
      return RoleUtils.canAccessDashboard(user);
    }

    // Check LXL only requirement
    const requiresLXL = this.reflector.getAllAndOverride<boolean>(
      LXL_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiresLXL) {
      return RoleUtils.isLXLMember(user);
    }

    // Check ministry management requirement
    const ministryId = this.reflector.getAllAndOverride<string>(
      MINISTRY_MANAGEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (ministryId !== undefined) {
      return RoleUtils.canManageMinistry(user, ministryId);
    }

    return true;
  }
}
