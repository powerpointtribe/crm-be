import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, RoleDocument } from '../schemas/role.schema';
import { Permission, PermissionDocument } from '../schemas/permission.schema';

export interface UserPermissionsResponse {
  role: {
    id: string;
    name: string;
    displayName: string;
    level: number;
  };
  permissions: string[];
  permissionsGrouped: Record<string, string[]>;
}

@Injectable()
export class UserPermissionsService {
  constructor(
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
  ) {}

  /**
   * Get all permissions for a user based on their role
   * This is used by the frontend to determine what UI elements to show
   */
  async getUserPermissions(
    roleId: string | Types.ObjectId,
  ): Promise<UserPermissionsResponse> {
    const objectId =
      typeof roleId === 'string' ? new Types.ObjectId(roleId) : roleId;

    const role = await this.roleModel
      .findOne({ _id: objectId, isActive: true })
      .exec();

    if (!role) {
      throw new Error('Role not found or inactive');
    }

    const allPermissions = new Set<string>();
    const permissionsGrouped: Record<string, string[]> = {};

    // Fetch permissions manually to avoid populate issues
    if (role.permissions && role.permissions.length > 0) {
      const permissionDocs = await this.permissionModel.find({
        _id: { $in: role.permissions },
        isActive: true,
      });

      for (const perm of permissionDocs) {
        allPermissions.add(perm.name);

        // Group by module
        if (!permissionsGrouped[perm.module]) {
          permissionsGrouped[perm.module] = [];
        }
        permissionsGrouped[perm.module].push(perm.name);
      }
    }

    // Add parent role's permissions if exists
    if (role.parentRole) {
      const parentRole = await this.roleModel.findById(role.parentRole).exec();
      if (parentRole && parentRole.permissions && parentRole.permissions.length > 0) {
        const parentPermissionDocs = await this.permissionModel.find({
          _id: { $in: parentRole.permissions },
          isActive: true,
        });

        for (const perm of parentPermissionDocs) {
          allPermissions.add(perm.name);

          // Group by module
          if (!permissionsGrouped[perm.module]) {
            permissionsGrouped[perm.module] = [];
          }
          if (!permissionsGrouped[perm.module].includes(perm.name)) {
            permissionsGrouped[perm.module].push(perm.name);
          }
        }
      }
    }

    return {
      role: {
        id: role._id.toString(),
        name: role.name,
        displayName: role.displayName,
        level: role.level,
      },
      permissions: Array.from(allPermissions),
      permissionsGrouped,
    };
  }

  /**
   * Check if a user has a specific permission
   */
  async hasPermission(
    roleId: string | Types.ObjectId,
    permissionName: string,
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(roleId);
    return userPermissions.permissions.includes(permissionName);
  }

  /**
   * Check if a user has access to a module
   */
  async hasModuleAccess(
    roleId: string | Types.ObjectId,
    moduleName: string,
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(roleId);
    return moduleName in userPermissions.permissionsGrouped;
  }

  /**
   * Get accessible modules for a user
   */
  async getAccessibleModules(
    roleId: string | Types.ObjectId,
  ): Promise<string[]> {
    const userPermissions = await this.getUserPermissions(roleId);
    return Object.keys(userPermissions.permissionsGrouped);
  }
}
