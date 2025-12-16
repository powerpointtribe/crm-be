import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Permission, PermissionDocument } from '../schemas/permission.schema';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
  ) {}

  /**
   * Create a new permission
   */
  async create(createPermissionDto: CreatePermissionDto): Promise<Permission> {
    // Check if permission with same name already exists
    const existingPermission = await this.permissionModel.findOne({
      name: createPermissionDto.name,
    });

    if (existingPermission) {
      throw new ConflictException(
        `Permission with name '${createPermissionDto.name}' already exists`,
      );
    }

    // Check if endpoint already has a permission (unless it's public or has no endpoint)
    if (!createPermissionDto.isPublic && createPermissionDto.endpoint) {
      const existingEndpoint = await this.permissionModel.findOne({
        'endpoint.path': createPermissionDto.endpoint.path,
        'endpoint.method': createPermissionDto.endpoint.method,
      });

      if (existingEndpoint) {
        throw new ConflictException(
          `Endpoint ${createPermissionDto.endpoint.method} ${createPermissionDto.endpoint.path} already has a permission assigned`,
        );
      }
    }

    const permission = new this.permissionModel(createPermissionDto);
    return permission.save();
  }

  /**
   * Create multiple permissions at once (for seeding)
   */
  async createMany(
    createPermissionDtos: CreatePermissionDto[],
  ): Promise<Permission[]> {
    const permissions = await Promise.all(
      createPermissionDtos.map(async (dto) => {
        // Check if permission already exists
        const existing = await this.permissionModel.findOne({ name: dto.name });
        if (existing) {
          return existing;
        }
        const permission = new this.permissionModel(dto);
        return permission.save();
      }),
    );

    return permissions;
  }

  /**
   * Find all permissions with optional filters
   */
  async findAll(filters?: {
    module?: string;
    resource?: string;
    action?: string;
    isActive?: boolean;
    isPublic?: boolean;
  }): Promise<Permission[]> {
    const query: any = {};

    if (filters) {
      if (filters.module) query.module = filters.module;
      if (filters.resource) query.resource = filters.resource;
      if (filters.action) query.action = filters.action;
      if (filters.isActive !== undefined) query.isActive = filters.isActive;
      if (filters.isPublic !== undefined) query.isPublic = filters.isPublic;
    }

    return this.permissionModel.find(query).sort({ module: 1, resource: 1, action: 1 });
  }

  /**
   * Find permission by ID
   */
  async findById(id: string): Promise<Permission> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid permission ID');
    }

    const permission = await this.permissionModel.findById(id);

    if (!permission) {
      throw new NotFoundException(`Permission with ID '${id}' not found`);
    }

    return permission;
  }

  /**
   * Find permission by name
   */
  async findByName(name: string): Promise<Permission> {
    const permission = await this.permissionModel.findOne({ name });

    if (!permission) {
      throw new NotFoundException(`Permission with name '${name}' not found`);
    }

    return permission;
  }

  /**
   * Find permissions by endpoint
   */
  async findByEndpoint(path: string, method: string): Promise<Permission> {
    const permission = await this.permissionModel.findOne({
      'endpoint.path': path,
      'endpoint.method': method,
    });

    if (!permission) {
      throw new NotFoundException(
        `Permission for endpoint ${method} ${path} not found`,
      );
    }

    return permission;
  }

  /**
   * Find permissions by IDs
   */
  async findByIds(ids: string[]): Promise<Permission[]> {
    const objectIds = ids.map((id) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Invalid permission ID: ${id}`);
      }
      return new Types.ObjectId(id);
    });

    return this.permissionModel.find({ _id: { $in: objectIds } });
  }

  /**
   * Get permissions grouped by module
   */
  async getPermissionsByModule(): Promise<
    Record<string, Permission[]>
  > {
    const permissions = await this.permissionModel
      .find({ isActive: true })
      .sort({ module: 1, resource: 1, action: 1 });

    const grouped: Record<string, Permission[]> = {};

    permissions.forEach((permission) => {
      if (!grouped[permission.module]) {
        grouped[permission.module] = [];
      }
      grouped[permission.module].push(permission);
    });

    return grouped;
  }

  /**
   * Update a permission
   */
  async update(
    id: string,
    updatePermissionDto: UpdatePermissionDto,
  ): Promise<Permission> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid permission ID');
    }

    // Check if new name conflicts with existing
    if (updatePermissionDto.name) {
      const existingPermission = await this.permissionModel.findOne({
        name: updatePermissionDto.name,
        _id: { $ne: id },
      });

      if (existingPermission) {
        throw new ConflictException(
          `Permission with name '${updatePermissionDto.name}' already exists`,
        );
      }
    }

    const permission = await this.permissionModel.findByIdAndUpdate(
      id,
      updatePermissionDto,
      { new: true },
    );

    if (!permission) {
      throw new NotFoundException(`Permission with ID '${id}' not found`);
    }

    return permission;
  }

  /**
   * Delete a permission
   */
  async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid permission ID');
    }

    const result = await this.permissionModel.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Permission with ID '${id}' not found`);
    }
  }

  /**
   * Check if an endpoint is public
   */
  async isEndpointPublic(path: string, method: string): Promise<boolean> {
    const permission = await this.permissionModel.findOne({
      'endpoint.path': path,
      'endpoint.method': method,
    });

    return permission ? permission.isPublic : false;
  }

  /**
   * Get all public endpoints
   */
  async getPublicEndpoints(): Promise<Permission[]> {
    return this.permissionModel.find({ isPublic: true, isActive: true });
  }
}
