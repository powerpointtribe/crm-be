import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, RoleDocument } from '../schemas/role.schema';
import { Permission, PermissionDocument } from '../schemas/permission.schema';
import { Member, MemberDocument } from '../../members/schemas/member.schema';
import { getPermissionsForMembershipStatus } from '../constants/membership-permissions.constant';

export interface UserPermissionsResponse {
  role: {
    id: string;
    name: string;
    displayName: string;
    level: number;
  };
  membershipStatus?: string;
  permissions: string[];
  rolePermissions: string[];
  membershipPermissions: string[];
  permissionsGrouped: Record<string, string[]>;
}

@Injectable()
export class UserPermissionsService {
  constructor(
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
  ) {}

  /**
   * Get all permissions for a user based on their role and membership status
   * This is used by the frontend to determine what UI elements to show
   *
   * @param roleId The user's role ID
   * @param membershipStatus Optional membership status for auto-granted permissions
   */
  async getUserPermissions(
    roleId: string | Types.ObjectId,
    membershipStatus?: string,
  ): Promise<UserPermissionsResponse> {
    const objectId =
      typeof roleId === 'string' ? new Types.ObjectId(roleId) : roleId;

    const role = await this.roleModel
      .findOne({ _id: objectId, isActive: true })
      .exec();

    if (!role) {
      throw new Error('Role not found or inactive');
    }

    const rolePermissions = new Set<string>();
    const permissionsGrouped: Record<string, string[]> = {};

    // Fetch permissions manually to avoid populate issues
    if (role.permissions && role.permissions.length > 0) {
      const permissionDocs = await this.permissionModel.find({
        _id: { $in: role.permissions },
        isActive: true,
      });

      for (const perm of permissionDocs) {
        rolePermissions.add(perm.name);

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
          rolePermissions.add(perm.name);

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

    // Get membership-based permissions (auto-granted based on membershipStatus)
    const membershipPermissions = membershipStatus
      ? getPermissionsForMembershipStatus(membershipStatus)
      : [];

    // Add membership permissions to grouped permissions
    for (const permName of membershipPermissions) {
      const moduleName = permName.split(':')[0];
      if (!permissionsGrouped[moduleName]) {
        permissionsGrouped[moduleName] = [];
      }
      if (!permissionsGrouped[moduleName].includes(permName)) {
        permissionsGrouped[moduleName].push(permName);
      }
    }

    // Combine all permissions
    const allPermissions = new Set([...rolePermissions, ...membershipPermissions]);

    return {
      role: {
        id: role._id.toString(),
        name: role.name,
        displayName: role.displayName,
        level: role.level,
      },
      membershipStatus,
      permissions: Array.from(allPermissions),
      rolePermissions: Array.from(rolePermissions),
      membershipPermissions,
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

  /**
   * Get all members who have a specific permission
   * This is used for sending notifications to users with certain permissions
   */
  async getMembersWithPermission(
    permissionName: string,
    branchId?: string,
  ): Promise<MemberDocument[]> {
    // First, find the permission
    const permission = await this.permissionModel.findOne({
      name: permissionName,
      isActive: true,
    });

    if (!permission) {
      return [];
    }

    // Find all roles that have this permission (including parent roles)
    const rolesWithPermission = await this.roleModel.find({
      permissions: permission._id,
      isActive: true,
    });

    const roleIds = rolesWithPermission.map((role) => role._id);

    // Also check for roles that inherit from roles with this permission
    const childRoles = await this.roleModel.find({
      parentRole: { $in: roleIds },
      isActive: true,
    });

    const allRoleIds = [...roleIds, ...childRoles.map((role) => role._id)];

    // Find members with these roles
    const query: any = {
      role: { $in: allRoleIds },
      isActive: true,
      email: { $exists: true, $nin: [null, ''] },
    };

    if (branchId) {
      query.branch = new Types.ObjectId(branchId);
    }

    return this.memberModel
      .find(query)
      .populate('role', 'name displayName')
      .populate('branch', 'name')
      .exec();
  }
}
