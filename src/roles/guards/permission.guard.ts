import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PERMISSION_KEY, PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { Role, RoleDocument } from '../schemas/role.schema';
import { Permission, PermissionDocument } from '../schemas/permission.schema';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permission(s) from decorator
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<
      string[] | { all: string[] }
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // If no permission requirement, allow access
    if (!requiredPermission && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Check if user has a role assigned
    if (!user.role) {
      throw new ForbiddenException('User has no role assigned');
    }

    // Get all user's permissions from their role
    // user.role can be either an ObjectId or a populated role object
    const roleId = user.role._id || user.role;
    const userPermissions = await this.getUserPermissions(roleId);

    // Check single permission
    if (requiredPermission) {
      if (this.hasPermission(userPermissions, requiredPermission)) {
        return true;
      }
      throw new ForbiddenException(
        `Permission '${requiredPermission}' is required`,
      );
    }

    // Check multiple permissions
    if (requiredPermissions) {
      // Check if all permissions are required
      if (
        typeof requiredPermissions === 'object' &&
        'all' in requiredPermissions
      ) {
        const allRequired = requiredPermissions.all;
        const hasAllPermissions = allRequired.every((perm) =>
          this.hasPermission(userPermissions, perm),
        );

        if (hasAllPermissions) {
          return true;
        }
        throw new ForbiddenException(
          `All of the following permissions are required: ${allRequired.join(', ')}`,
        );
      }

      // Check if any permission is sufficient
      if (Array.isArray(requiredPermissions)) {
        const hasAnyPermission = requiredPermissions.some((perm) =>
          this.hasPermission(userPermissions, perm),
        );

        if (hasAnyPermission) {
          return true;
        }
        throw new ForbiddenException(
          `One of the following permissions is required: ${requiredPermissions.join(', ')}`,
        );
      }
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  /**
   * Get all permissions for user's role (including inherited permissions from parent role)
   */
  private async getUserPermissions(
    roleId: string | Types.ObjectId,
  ): Promise<string[]> {
    const objectId =
      typeof roleId === 'string' ? new Types.ObjectId(roleId) : roleId;

    const role = await this.roleModel
      .findOne({ _id: objectId, isActive: true })
      .exec();

    if (!role) {
      throw new ForbiddenException('User role not found or inactive');
    }

    const allPermissions = new Set<string>();

    // Fetch permissions manually to avoid populate issues
    if (role.permissions && role.permissions.length > 0) {
      const permissionDocs = await this.permissionModel.find({
        _id: { $in: role.permissions },
        isActive: true,
      });

      permissionDocs.forEach(perm => {
        allPermissions.add(perm.name);
      });
    }

    // Add parent role's permissions if exists
    if (role.parentRole) {
      const parentRole = role.parentRole as any;
      if (parentRole.permissions) {
        for (const permission of parentRole.permissions) {
          if (permission.isActive) {
            allPermissions.add(permission.name);
          }
        }
      }
    }

    return Array.from(allPermissions);
  }

  /**
   * Check if user has a specific permission
   */
  private hasPermission(
    userPermissions: string[],
    requiredPermission: string,
  ): boolean {
    return userPermissions.includes(requiredPermission);
  }
}
