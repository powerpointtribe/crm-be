import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, RoleDocument } from '../schemas/role.schema';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { AssignPermissionsDto } from '../dto/assign-permissions.dto';
import { PermissionsService } from './permissions.service';
import { ModulePermissionsService } from './module-permissions.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name)
    private roleModel: Model<RoleDocument>,
    private permissionsService: PermissionsService,
    private modulePermissionsService: ModulePermissionsService,
  ) {}

  /**
   * Create a new role
   */
  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    // Generate slug from name
    const slug = createRoleDto.name.toLowerCase().replace(/\s+/g, '-');

    // Check if role with same name or slug already exists
    const existingRole = await this.roleModel.findOne({
      $or: [{ name: createRoleDto.name }, { slug }],
    });

    if (existingRole) {
      throw new ConflictException(
        `Role with name '${createRoleDto.name}' already exists`,
      );
    }

    // Collect all permission IDs
    let allPermissionIds: string[] = [...(createRoleDto.permissions || [])];

    // If modules are provided, auto-assign view permissions for those modules
    if (createRoleDto.modules && createRoleDto.modules.length > 0) {
      // Validate modules
      const validation = this.modulePermissionsService.validateModules(createRoleDto.modules);
      if (!validation.valid) {
        throw new BadRequestException(
          `Invalid modules: ${validation.invalidModules.join(', ')}`,
        );
      }

      // Get view permission IDs for the selected modules
      const modulePermissionIds = await this.modulePermissionsService.getViewPermissionIdsForModules(
        createRoleDto.modules,
      );

      // Merge with existing permissions (avoid duplicates)
      const existingIdSet = new Set(allPermissionIds);
      modulePermissionIds.forEach((id) => {
        const idStr = id.toString();
        if (!existingIdSet.has(idStr)) {
          allPermissionIds.push(idStr);
        }
      });
    }

    // Validate all permissions exist
    if (allPermissionIds.length > 0) {
      await this.validatePermissions(allPermissionIds);
    }

    const role = new this.roleModel({
      ...createRoleDto,
      slug,
      permissions: allPermissionIds.map((id) => new Types.ObjectId(id)),
    });

    return role.save();
  }

  /**
   * Find all roles with optional filters
   */
  async findAll(filters?: {
    isActive?: boolean;
    isSystemRole?: boolean;
  }): Promise<Role[]> {
    const query: any = {};

    if (filters) {
      if (filters.isActive !== undefined) query.isActive = filters.isActive;
      if (filters.isSystemRole !== undefined)
        query.isSystemRole = filters.isSystemRole;
    }

    return this.roleModel
      .find(query)
      .populate('permissions')
      .populate('parentRole')
      .sort({ level: -1, name: 1 });
  }

  /**
   * Find role by ID with populated permissions
   */
  async findById(id: string, populatePermissions = true): Promise<Role> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid role ID');
    }

    const role = await this.roleModel
      .findById(id)
      .populate({
        path: 'permissions',
        model: 'Permission',
      })
      .populate({
        path: 'parentRole',
        model: 'Role',
      })
      .exec();

    if (!role) {
      throw new NotFoundException(`Role with ID '${id}' not found`);
    }

    return role;
  }

  /**
   * Find role by name
   */
  async findByName(name: string): Promise<Role> {
    const role = await this.roleModel
      .findOne({ name })
      .populate('permissions')
      .populate('parentRole');

    if (!role) {
      throw new NotFoundException(`Role with name '${name}' not found`);
    }

    return role;
  }

  /**
   * Find role by slug
   */
  async findBySlug(slug: string): Promise<Role> {
    const role = await this.roleModel
      .findOne({ slug })
      .populate('permissions')
      .populate('parentRole');

    if (!role) {
      throw new NotFoundException(`Role with slug '${slug}' not found`);
    }

    return role;
  }

  /**
   * Update a role
   */
  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid role ID');
    }

    const role = await this.roleModel.findById(id);

    if (!role) {
      throw new NotFoundException(`Role with ID '${id}' not found`);
    }

    // Prevent modification of system roles
    if (role.isSystemRole) {
      throw new ForbiddenException('System roles cannot be modified');
    }

    // Check if new name conflicts with existing
    if (updateRoleDto.name) {
      const slug = updateRoleDto.name.toLowerCase().replace(/\s+/g, '-');

      const existingRole = await this.roleModel.findOne({
        $or: [{ name: updateRoleDto.name }, { slug }],
        _id: { $ne: id },
      });

      if (existingRole) {
        throw new ConflictException(
          `Role with name '${updateRoleDto.name}' already exists`,
        );
      }

      updateRoleDto['slug'] = slug;
    }

    // Handle module-based permission updates
    let finalPermissionIds: string[] | undefined = updateRoleDto.permissions;

    if (updateRoleDto.modules !== undefined) {
      // Validate modules if provided
      if (updateRoleDto.modules.length > 0) {
        const validation = this.modulePermissionsService.validateModules(updateRoleDto.modules);
        if (!validation.valid) {
          throw new BadRequestException(
            `Invalid modules: ${validation.invalidModules.join(', ')}`,
          );
        }
      }

      // Get view permission IDs for the new modules
      const modulePermissionIds = await this.modulePermissionsService.getViewPermissionIdsForModules(
        updateRoleDto.modules,
      );

      // Start with module permissions
      const permissionIdSet = new Set(modulePermissionIds.map((id) => id.toString()));

      // Add any explicitly provided permissions
      if (updateRoleDto.permissions) {
        updateRoleDto.permissions.forEach((id) => permissionIdSet.add(id));
      }

      finalPermissionIds = Array.from(permissionIdSet);
    }

    // Validate permissions if provided
    if (finalPermissionIds && finalPermissionIds.length > 0) {
      await this.validatePermissions(finalPermissionIds);
    }

    // Build update object
    const updateData: any = { ...updateRoleDto };
    if (finalPermissionIds !== undefined) {
      updateData.permissions = finalPermissionIds.map((id) => new Types.ObjectId(id));
    }

    const updatedRole = await this.roleModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('permissions')
      .populate('parentRole');

    if (!updatedRole) {
      throw new NotFoundException(`Role with ID '${id}' not found`);
    }

    return updatedRole;
  }

  /**
   * Assign permissions to a role
   */
  async assignPermissions(
    roleId: string,
    assignPermissionsDto: AssignPermissionsDto,
  ): Promise<Role> {
    if (!Types.ObjectId.isValid(roleId)) {
      throw new BadRequestException('Invalid role ID');
    }

    const role = await this.roleModel.findById(roleId);

    if (!role) {
      throw new NotFoundException(`Role with ID '${roleId}' not found`);
    }

    // Prevent modification of system roles
    if (role.isSystemRole) {
      throw new ForbiddenException(
        'System role permissions cannot be modified',
      );
    }

    // Validate all permissions exist
    await this.validatePermissions(assignPermissionsDto.permissionIds);

    // Convert to ObjectIds
    const permissionObjectIds = assignPermissionsDto.permissionIds.map(
      (id) => new Types.ObjectId(id),
    );

    role.permissions = permissionObjectIds;
    await role.save();

    const updatedRole = await this.roleModel
      .findById(roleId)
      .populate('permissions')
      .populate('parentRole');

    if (!updatedRole) {
      throw new NotFoundException(`Role with ID '${roleId}' not found`);
    }

    return updatedRole;
  }

  /**
   * Add permissions to a role (without replacing existing)
   */
  async addPermissions(
    roleId: string,
    assignPermissionsDto: AssignPermissionsDto,
  ): Promise<Role> {
    if (!Types.ObjectId.isValid(roleId)) {
      throw new BadRequestException('Invalid role ID');
    }

    const role = await this.roleModel.findById(roleId);

    if (!role) {
      throw new NotFoundException(`Role with ID '${roleId}' not found`);
    }

    // Prevent modification of system roles
    if (role.isSystemRole) {
      throw new ForbiddenException(
        'System role permissions cannot be modified',
      );
    }

    // Validate all permissions exist
    await this.validatePermissions(assignPermissionsDto.permissionIds);

    // Convert to ObjectIds
    const newPermissionObjectIds = assignPermissionsDto.permissionIds.map(
      (id) => new Types.ObjectId(id),
    );

    // Add only new permissions (avoid duplicates)
    const existingIds = role.permissions.map((p) => p.toString());
    const permissionsToAdd = newPermissionObjectIds.filter(
      (id) => !existingIds.includes(id.toString()),
    );

    role.permissions.push(...permissionsToAdd);
    await role.save();

    const updatedRole = await this.roleModel
      .findById(roleId)
      .populate('permissions')
      .populate('parentRole');

    if (!updatedRole) {
      throw new NotFoundException(`Role with ID '${roleId}' not found`);
    }

    return updatedRole;
  }

  /**
   * Remove permissions from a role
   */
  async removePermissions(
    roleId: string,
    permissionIds: string[],
  ): Promise<Role> {
    if (!Types.ObjectId.isValid(roleId)) {
      throw new BadRequestException('Invalid role ID');
    }

    const role = await this.roleModel.findById(roleId);

    if (!role) {
      throw new NotFoundException(`Role with ID '${roleId}' not found`);
    }

    // Prevent modification of system roles
    if (role.isSystemRole) {
      throw new ForbiddenException(
        'System role permissions cannot be modified',
      );
    }

    // Remove specified permissions
    const idsToRemove = permissionIds.map((id) => id.toString());
    role.permissions = role.permissions.filter(
      (p) => !idsToRemove.includes(p.toString()),
    );

    await role.save();

    const updatedRole = await this.roleModel
      .findById(roleId)
      .populate('permissions')
      .populate('parentRole');

    if (!updatedRole) {
      throw new NotFoundException(`Role with ID '${roleId}' not found`);
    }

    return updatedRole;
  }

  /**
   * Delete a role
   */
  async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid role ID');
    }

    const role = await this.roleModel.findById(id);

    if (!role) {
      throw new NotFoundException(`Role with ID '${id}' not found`);
    }

    // Prevent deletion of system roles
    if (role.isSystemRole) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    await this.roleModel.deleteOne({ _id: id });
  }

  /**
   * Get all permissions for a role (including inherited from parent)
   */
  async getRolePermissions(roleId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(roleId)) {
      throw new BadRequestException('Invalid role ID');
    }

    const role = await this.roleModel
      .findById(roleId)
      .populate('permissions')
      .populate({
        path: 'parentRole',
        populate: { path: 'permissions' },
      });

    if (!role) {
      throw new NotFoundException(`Role with ID '${roleId}' not found`);
    }

    const permissions = [...role.permissions];

    // Add parent role permissions if exists
    if (role.parentRole) {
      const parentRole = role.parentRole as any;
      if (parentRole.permissions) {
        permissions.push(...parentRole.permissions);
      }
    }

    // Remove duplicates
    const uniquePermissions = Array.from(
      new Map(permissions.map((p: any) => [p._id.toString(), p])).values(),
    );

    return uniquePermissions;
  }

  /**
   * Check if a role has a specific permission
   */
  async hasPermission(
    roleId: string,
    permissionName: string,
  ): Promise<boolean> {
    const permissions = await this.getRolePermissions(roleId);
    return permissions.some((p: any) => p.name === permissionName);
  }

  /**
   * Validate that all permission IDs exist
   */
  private async validatePermissions(permissionIds: string[]): Promise<void> {
    const permissions = await this.permissionsService.findByIds(permissionIds);

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permission IDs are invalid');
    }
  }
}
