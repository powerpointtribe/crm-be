import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-roles.enums';

/**
 * @deprecated This guard is deprecated and will be removed in a future version.
 * Please use PermissionGuard from '../roles/guards/permission.guard' instead.
 *
 * The new permission-based system provides:
 * - Granular endpoint-level permissions
 * - Dynamic role creation
 * - Better security and flexibility
 *
 * Migration guide: Replace @Roles() decorator with @RequirePermission() decorator
 * and use PermissionGuard instead of RolesGuard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {
    this.logger.warn(
      'DEPRECATED: RolesGuard is deprecated. Please use PermissionGuard instead.',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    // Log deprecation warning
    const handler = context.getHandler();
    this.logger.warn(
      `DEPRECATED: ${handler.name} is using old RolesGuard. Please migrate to PermissionGuard.`,
    );

    // Super admins have access to everything
    if (
      user.systemRoles &&
      Array.isArray(user.systemRoles) &&
      user.systemRoles.includes(UserRole.ADMIN)
    ) {
      return true;
    }

    // Check if user has any of the required roles
    const hasRole =
      user.systemRoles &&
      Array.isArray(user.systemRoles) &&
      requiredRoles.some((role) => user.systemRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
