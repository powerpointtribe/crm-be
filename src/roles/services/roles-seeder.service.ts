import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Permission, PermissionDocument } from '../schemas/permission.schema';
import { Role, RoleDocument } from '../schemas/role.schema';
import { ALL_PERMISSIONS, PUBLIC_ENDPOINTS } from '../constants/permissions.constant';
import { DEFAULT_ROLES } from '../constants/default-roles.constant';

@Injectable()
export class RolesSeederService {
  private readonly logger = new Logger(RolesSeederService.name);

  constructor(
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
    @InjectModel(Role.name)
    private roleModel: Model<RoleDocument>,
  ) {}

  /**
   * Seed all permissions from module permission enums
   */
  async seedPermissions(): Promise<void> {
    this.logger.log('Starting permissions seeding...');

    try {
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const permissionDto of ALL_PERMISSIONS) {
        // Mark public endpoints
        if (PUBLIC_ENDPOINTS.includes(permissionDto.name)) {
          permissionDto.isPublic = true;
        }

        // Check if permission already exists
        const existing = await this.permissionModel.findOne({
          name: permissionDto.name,
        });

        if (existing) {
          // Update existing permission
          await this.permissionModel.updateOne(
            { _id: existing._id },
            { $set: permissionDto },
          );
          updatedCount++;
        } else {
          // Create new permission
          await this.permissionModel.create(permissionDto);
          createdCount++;
        }
      }

      this.logger.log(
        `Permissions seeding completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`,
      );
    } catch (error) {
      this.logger.error('Error seeding permissions:', error);
      throw error;
    }
  }

  /**
   * Check if a permission name is a view/read-only permission
   * View permissions include: view*, export*, and similar read-only actions
   */
  private isViewPermission(permissionName: string): boolean {
    const viewPatterns = [
      ':view',
      ':export',
      '-view',
      '-export',
      ':view-',
      ':preview', // preview is read-only
      ':download', // download is read-only
    ];
    return viewPatterns.some((pattern) => permissionName.includes(pattern));
  }

  /**
   * Seed default system roles
   */
  async seedRoles(): Promise<void> {
    this.logger.log('Starting roles seeding...');

    try {
      let createdCount = 0;
      let updatedCount = 0;

      for (const roleConfig of DEFAULT_ROLES) {
        // Check if role already exists
        const existing = await this.roleModel.findOne({ slug: roleConfig.slug });

        // Get permission IDs
        let permissionIds: Types.ObjectId[] = [];

        if (roleConfig.permissions.includes('*')) {
          // Super admin gets all permissions (minus excluded non-view ones)
          const allPermissions = await this.permissionModel.find({
            isActive: true,
          });
          const excludePrefixes = roleConfig.excludePermissions || [];
          const excludeExact = new Set(roleConfig.excludeExactPermissions || []);
          const filtered = (excludePrefixes.length > 0 || excludeExact.size > 0)
            ? allPermissions.filter((p) => {
                if (excludeExact.has(p.name)) return false;
                const matchesExclude = excludePrefixes.some((prefix) => p.name.startsWith(prefix));
                return !matchesExclude || this.isViewPermission(p.name);
              })
            : allPermissions;
          permissionIds = filtered.map((p) => p._id);
        } else if (roleConfig.permissions.includes('view:*')) {
          // Roles with view:* get all view/export permissions plus any additional specific permissions
          const allPermissions = await this.permissionModel.find({
            isActive: true,
          });

          // Get all view permissions
          const viewPermissions = allPermissions.filter((p) =>
            this.isViewPermission(p.name),
          );

          // Get additional specific permissions (excluding the 'view:*' marker)
          const additionalPermissionNames = roleConfig.permissions.filter(
            (p) => p !== 'view:*',
          );
          const additionalPermissions = additionalPermissionNames.length > 0
            ? allPermissions.filter((p) =>
                additionalPermissionNames.includes(p.name),
              )
            : [];

          // Combine view permissions with additional permissions (using Set to avoid duplicates)
          const permissionIdSet = new Set<string>();
          viewPermissions.forEach((p) => permissionIdSet.add(p._id.toString()));
          additionalPermissions.forEach((p) =>
            permissionIdSet.add(p._id.toString()),
          );

          permissionIds = Array.from(permissionIdSet).map(
            (id) => new Types.ObjectId(id),
          );

          this.logger.log(
            `Role "${roleConfig.name}" assigned ${viewPermissions.length} view permissions + ${additionalPermissions.length} additional permissions`,
          );
        } else {
          // Get specific permissions
          const permissions = await this.permissionModel.find({
            name: { $in: roleConfig.permissions },
            isActive: true,
          });
          permissionIds = permissions.map((p) => p._id);
        }

        const roleData = {
          name: roleConfig.name,
          slug: roleConfig.slug,
          displayName: roleConfig.displayName,
          description: roleConfig.description,
          level: roleConfig.level,
          isSystemRole: roleConfig.isSystemRole,
          colorCode: roleConfig.colorCode,
          permissions: permissionIds,
          isActive: true,
        };

        if (existing) {
          // Update existing role (only if it's a system role)
          if (existing.isSystemRole) {
            await this.roleModel.updateOne(
              { _id: existing._id },
              { $set: roleData },
            );
            updatedCount++;
          }
        } else {
          // Create new role
          await this.roleModel.create(roleData);
          createdCount++;
        }
      }

      this.logger.log(
        `Roles seeding completed: ${createdCount} created, ${updatedCount} updated`,
      );
    } catch (error) {
      this.logger.error('Error seeding roles:', error);
      throw error;
    }
  }

  /**
   * Seed both permissions and roles
   */
  async seed(): Promise<void> {
    this.logger.log('Starting complete roles and permissions seeding...');

    try {
      // Seed permissions first
      await this.seedPermissions();

      // Then seed roles (which reference permissions)
      await this.seedRoles();

      this.logger.log('Complete seeding finished successfully!');
    } catch (error) {
      this.logger.error('Error during seeding:', error);
      throw error;
    }
  }

  /**
   * Get seeding statistics
   */
  async getStats(): Promise<{
    permissions: { total: number; active: number; public: number };
    roles: { total: number; system: number; custom: number };
  }> {
    const [
      totalPermissions,
      activePermissions,
      publicPermissions,
      totalRoles,
      systemRoles,
    ] = await Promise.all([
      this.permissionModel.countDocuments(),
      this.permissionModel.countDocuments({ isActive: true }),
      this.permissionModel.countDocuments({ isPublic: true }),
      this.roleModel.countDocuments(),
      this.roleModel.countDocuments({ isSystemRole: true }),
    ]);

    return {
      permissions: {
        total: totalPermissions,
        active: activePermissions,
        public: publicPermissions,
      },
      roles: {
        total: totalRoles,
        system: systemRoles,
        custom: totalRoles - systemRoles,
      },
    };
  }
}
