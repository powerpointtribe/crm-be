import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Permission, PermissionDocument } from '../schemas/permission.schema';
import { Role, RoleDocument } from '../schemas/role.schema';
import {
  PERMISSION_KEY,
  PERMISSIONS_KEY,
} from '../decorators/require-permission.decorator';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';

interface DiscoveredEndpoint {
  controller: string;
  controllerPath: string;
  method: string;
  methodPath: string;
  httpMethod: string;
  fullPath: string;
  permission: string | null;
  isPublic: boolean;
  generatedPermission?: string;
}

interface DiscoveryReport {
  totalEndpoints: number;
  protectedEndpoints: number;
  publicEndpoints: number;
  unprotectedEndpoints: number;
  newPermissionsCreated: number;
  existingPermissionsUpdated: number;
  endpoints: DiscoveredEndpoint[];
}

@Injectable()
export class EndpointDiscoveryService {
  private readonly logger = new Logger(EndpointDiscoveryService.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
    @InjectModel(Role.name)
    private roleModel: Model<RoleDocument>,
  ) {}

  /**
   * Map NestJS RequestMethod enum to HTTP method string
   */
  private getHttpMethodString(method: RequestMethod): string {
    const methodMap: { [key: number]: string } = {
      [RequestMethod.GET]: 'GET',
      [RequestMethod.POST]: 'POST',
      [RequestMethod.PUT]: 'PUT',
      [RequestMethod.DELETE]: 'DELETE',
      [RequestMethod.PATCH]: 'PATCH',
      [RequestMethod.OPTIONS]: 'OPTIONS',
      [RequestMethod.HEAD]: 'HEAD',
      [RequestMethod.ALL]: 'ALL',
    };
    return methodMap[method] || 'GET';
  }

  /**
   * Map controller names to frontend-expected module names
   * This ensures permissions are grouped correctly for the frontend
   */
  private readonly controllerToModuleMap: Record<string, string> = {
    // Core modules
    'members': 'members',
    'first-timers': 'first-timers',
    'groups': 'units',  // Frontend expects 'units' for groups
    'units': 'units',
    'ministries': 'ministries',
    'branches': 'branches',
    'inventory': 'inventory',
    'inventory-category': 'inventory',
    'inventory-item': 'inventory',
    'inventory-movement': 'inventory',
    // Roles & permissions
    'roles': 'roles',
    'permissions': 'roles',
    'role-assignment': 'roles',
    'seeder': 'roles',
    'user-permissions': 'roles',
    // Other modules
    'attendance': 'attendance',
    'service-reports': 'service-reports',
    'dashboard': 'dashboard',
    'audit-logs': 'audit-logs',
    'bulk-operations': 'bulk-operations',
    'notifications': 'notifications',
    'queue': 'queue',
    'upload': 'upload',
    'user-invitations': 'user-management',
    'workers-training': 'workers-training',
    'cohort': 'workers-training',
    'worker-trainee': 'workers-training',
    'activity-tracker': 'activity-tracker',
    'message-drafts': 'first-timers',
    // Auth (usually public, but map anyway)
    'auth': 'auth',
    'app': 'system',
  };

  /**
   * Generate a permission name from controller and method info
   */
  private generatePermissionName(
    controllerName: string,
    methodName: string,
    httpMethod: string,
  ): string {
    // Convert controller name to kebab-case (e.g., MembersController -> members)
    const controllerKey = controllerName
      .replace(/Controller$/, '')
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');

    // Map to frontend-expected module name
    const moduleName = this.controllerToModuleMap[controllerKey] || controllerKey;

    // Convert method name to action (e.g., findAll -> find-all)
    let action = methodName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');

    // Map common method names to standard actions based on HTTP method
    const actionMap: Record<string, string> = {
      // Standard CRUD
      create: 'create',
      'find-all': 'view',
      'find-one': 'view-details',
      'find-by-id': 'view-details',
      update: 'update',
      remove: 'delete',
      delete: 'delete',
      // Common variations
      'get-all': 'view',
      'get-by-id': 'view-details',
      'get-one': 'view-details',
      list: 'view',
      index: 'view',
      show: 'view-details',
      store: 'create',
      edit: 'update',
      destroy: 'delete',
      // Stats and reports
      'get-stats': 'view-stats',
      stats: 'view-stats',
      statistics: 'view-stats',
      report: 'view-report',
      export: 'export',
    };

    action = actionMap[action] || action;

    // If action still contains the module name, remove it for cleaner permission
    // e.g., "get-members" -> "view" for members controller
    const moduleKeywords = moduleName.split('-');
    for (const keyword of moduleKeywords) {
      if (action.includes(keyword)) {
        action = action.replace(keyword, '').replace(/^-|-$/g, '').replace(/--/g, '-');
        if (!action) action = this.mapHttpMethodToAction(httpMethod);
      }
    }

    return `${moduleName}:${action || this.mapHttpMethodToAction(httpMethod)}`;
  }

  /**
   * Map HTTP method to a default action
   */
  private mapHttpMethodToAction(httpMethod: string): string {
    const map: Record<string, string> = {
      GET: 'view',
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete',
    };
    return map[httpMethod] || 'access';
  }

  /**
   * Generate display name from permission name
   */
  private generateDisplayName(permissionName: string): string {
    return permissionName
      .split(':')
      .map((part) =>
        part
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
      )
      .join(' - ');
  }

  /**
   * Discover all controller endpoints in the application
   */
  async discoverEndpoints(): Promise<DiscoveredEndpoint[]> {
    const endpoints: DiscoveredEndpoint[] = [];

    // Get all controller instances
    const controllers = this.discoveryService.getControllers();

    for (const wrapper of controllers) {
      const { instance, metatype } = wrapper;

      if (!instance || !metatype) {
        continue;
      }

      const controllerName = metatype.name;

      // Get controller path
      const controllerPath =
        this.reflector.get<string>(PATH_METADATA, metatype) || '';

      // Check if entire controller is public
      const isControllerPublic =
        this.reflector.get<boolean>(IS_PUBLIC_KEY, metatype) || false;

      // Scan all methods in the controller
      const methodNames = this.metadataScanner.getAllMethodNames(
        Object.getPrototypeOf(instance),
      );

      for (const methodName of methodNames) {
        const methodRef = instance[methodName];

        if (!methodRef) {
          continue;
        }

        // Get HTTP method metadata
        const httpMethodMeta = this.reflector.get<RequestMethod>(
          METHOD_METADATA,
          methodRef,
        );

        // Skip if not an HTTP handler (no HTTP method decorator)
        if (httpMethodMeta === undefined) {
          continue;
        }

        const httpMethod = this.getHttpMethodString(httpMethodMeta);

        // Get method path
        const methodPath =
          this.reflector.get<string>(PATH_METADATA, methodRef) || '';

        // Build full path
        const fullPath = this.normalizePath(
          `/${controllerPath}/${methodPath}`,
        );

        // Check if method is public
        const isMethodPublic =
          this.reflector.get<boolean>(IS_PUBLIC_KEY, methodRef) || false;
        const isPublic = isControllerPublic || isMethodPublic;

        // Get required permission
        const singlePermission = this.reflector.get<string>(
          PERMISSION_KEY,
          methodRef,
        );
        const multiplePermissions = this.reflector.get<
          string[] | { all: string[] }
        >(PERMISSIONS_KEY, methodRef);

        let permission: string | null = null;
        if (singlePermission) {
          permission = singlePermission;
        } else if (Array.isArray(multiplePermissions)) {
          permission = multiplePermissions[0]; // Take first for display
        } else if (
          multiplePermissions &&
          typeof multiplePermissions === 'object' &&
          'all' in multiplePermissions
        ) {
          permission = multiplePermissions.all[0]; // Take first for display
        }

        // Generate permission name for unprotected endpoints
        const generatedPermission =
          !permission && !isPublic
            ? this.generatePermissionName(
                controllerName,
                methodName,
                httpMethod,
              )
            : undefined;

        endpoints.push({
          controller: controllerName,
          controllerPath,
          method: methodName,
          methodPath,
          httpMethod,
          fullPath,
          permission,
          isPublic,
          generatedPermission,
        });
      }
    }

    return endpoints;
  }

  /**
   * Normalize path by removing duplicate slashes
   */
  private normalizePath(path: string): string {
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  /**
   * Discover endpoints and auto-register missing permissions
   */
  async discoverAndRegisterPermissions(): Promise<DiscoveryReport> {
    const endpoints = await this.discoverEndpoints();

    const report: DiscoveryReport = {
      totalEndpoints: endpoints.length,
      protectedEndpoints: 0,
      publicEndpoints: 0,
      unprotectedEndpoints: 0,
      newPermissionsCreated: 0,
      existingPermissionsUpdated: 0,
      endpoints,
    };

    for (const endpoint of endpoints) {
      if (endpoint.isPublic) {
        report.publicEndpoints++;
        continue;
      }

      // Get the correct module name using the mapping
      const controllerKey = endpoint.controller
        .replace(/Controller$/, '')
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '');
      const moduleName = this.controllerToModuleMap[controllerKey] || controllerKey;

      // Handle endpoints with explicit @RequirePermission decorator
      if (endpoint.permission) {
        report.protectedEndpoints++;

        // Ensure the explicitly required permission exists in database
        const existing = await this.permissionModel.findOne({
          name: endpoint.permission,
        });

        if (!existing) {
          const [resource, action] = endpoint.permission.split(':');
          await this.permissionModel.create({
            name: endpoint.permission,
            displayName: this.generateDisplayName(endpoint.permission),
            description: `Permission for ${endpoint.httpMethod} ${endpoint.fullPath}`,
            module: moduleName,
            resource,
            action,
            endpoint: { path: endpoint.fullPath, method: endpoint.httpMethod },
            isActive: true,
            isPublic: false,
            metadata: { autoGenerated: true, fromDecorator: true },
          });
          report.newPermissionsCreated++;
        }
        continue;
      }

      // Handle unprotected endpoints - generate permission for them
      report.unprotectedEndpoints++;

      if (endpoint.generatedPermission) {
        const existing = await this.permissionModel.findOne({
          name: endpoint.generatedPermission,
        });

        const [resource, action] = endpoint.generatedPermission.split(':');

        if (!existing) {
          await this.permissionModel.create({
            name: endpoint.generatedPermission,
            displayName: this.generateDisplayName(endpoint.generatedPermission),
            description: `Auto-generated permission for ${endpoint.httpMethod} ${endpoint.fullPath}`,
            module: moduleName,
            resource,
            action,
            endpoint: { path: endpoint.fullPath, method: endpoint.httpMethod },
            isActive: true,
            isPublic: false,
            metadata: { autoGenerated: true },
          });
          report.newPermissionsCreated++;
        }
      }
    }

    if (report.newPermissionsCreated > 0) {
      this.logger.log(`Created ${report.newPermissionsCreated} new permissions`);
    }

    return report;
  }

  /**
   * Update Super Admin role to have all permissions
   */
  async updateSuperAdminPermissions(): Promise<void> {
    const allPermissions = await this.permissionModel.find({ isActive: true });
    const permissionIds = allPermissions.map((p) => p._id);

    const result = await this.roleModel.updateOne(
      { slug: 'super-admin' },
      {
        $set: {
          permissions: permissionIds,
          updatedAt: new Date(),
        },
      },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(
        `Super Admin role updated with ${permissionIds.length} permissions`,
      );
    }
  }

  /**
   * Get a report of all endpoints without logging
   */
  async getEndpointReport(): Promise<{
    protected: DiscoveredEndpoint[];
    public: DiscoveredEndpoint[];
    unprotected: DiscoveredEndpoint[];
  }> {
    const endpoints = await this.discoverEndpoints();

    return {
      protected: endpoints.filter((e) => e.permission && !e.isPublic),
      public: endpoints.filter((e) => e.isPublic),
      unprotected: endpoints.filter((e) => !e.permission && !e.isPublic),
    };
  }

  /**
   * Validate that all non-public endpoints have permissions
   */
  async validateEndpointPermissions(): Promise<{
    isValid: boolean;
    missingPermissions: DiscoveredEndpoint[];
  }> {
    const endpoints = await this.discoverEndpoints();
    const missingPermissions = endpoints.filter(
      (e) => !e.permission && !e.isPublic,
    );

    return {
      isValid: missingPermissions.length === 0,
      missingPermissions,
    };
  }

  /**
   * Fix existing permissions that have wrong module names
   * This updates permissions to use the correct frontend-expected module names
   */
  async fixPermissionModuleNames(): Promise<{
    fixed: number;
    permissions: { name: string; oldModule: string; newModule: string }[];
  }> {
    this.logger.log('Fixing permission module names...');

    const allPermissions = await this.permissionModel.find({});
    const fixed: { name: string; oldModule: string; newModule: string }[] = [];

    // Reverse mapping: find what module a permission resource should belong to
    const resourceToModuleMap: Record<string, string> = {
      // Core modules
      'members': 'members',
      'first-timers': 'first-timers',
      'groups': 'units',
      'units': 'units',
      'ministries': 'ministries',
      'branches': 'branches',
      'inventory': 'inventory',
      // Roles & permissions
      'roles': 'roles',
      'permissions': 'roles',
      'role-assignment': 'roles',
      'role-assignments': 'roles',
      'seeder': 'roles',
      'user-permissions': 'roles',
      // Other modules
      'attendance': 'attendance',
      'service-reports': 'service-reports',
      'dashboard': 'dashboard',
      'audit-logs': 'audit-logs',
      'bulk-operations': 'bulk-operations',
      'notifications': 'notifications',
      'queue': 'queue',
      'upload': 'upload',
      'user-invitations': 'user-management',
      'user-management': 'user-management',
      'workers-training': 'workers-training',
      'cohort': 'workers-training',
      'cohorts': 'workers-training',
      'worker-trainee': 'workers-training',
      'activity-tracker': 'activity-tracker',
      'message-drafts': 'first-timers',
      'auth': 'auth',
      'app': 'system',
    };

    for (const permission of allPermissions) {
      // Get the resource from permission name (e.g., 'members:create' -> 'members')
      const [resource] = permission.name.split(':');
      const expectedModule = resourceToModuleMap[resource] || resource;

      if (permission.module !== expectedModule) {
        await this.permissionModel.updateOne(
          { _id: permission._id },
          { $set: { module: expectedModule } },
        );
        fixed.push({
          name: permission.name,
          oldModule: permission.module,
          newModule: expectedModule,
        });
      }
    }

    if (fixed.length > 0) {
      this.logger.log(`Fixed ${fixed.length} permissions with wrong module names`);
    } else {
      this.logger.log('All permissions have correct module names');
    }

    return { fixed: fixed.length, permissions: fixed };
  }

  /**
   * Get module name for a controller
   */
  getModuleNameForController(controllerName: string): string {
    const controllerKey = controllerName
      .replace(/Controller$/, '')
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
    return this.controllerToModuleMap[controllerKey] || controllerKey;
  }
}
