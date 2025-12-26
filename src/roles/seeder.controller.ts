import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { RolesSeederService } from './services/roles-seeder.service';
import { EndpointDiscoveryService } from './services/endpoint-discovery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermission } from './decorators/require-permission.decorator';
import { RolesModulePermission } from './permissions';

/**
 * Controller for seeding roles and permissions
 * Only accessible by super admins
 */
@Controller('roles/seeder')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SeederController {
  constructor(
    private readonly seederService: RolesSeederService,
    private readonly endpointDiscoveryService: EndpointDiscoveryService,
  ) {}

  /**
   * Seed all permissions from module enums
   */
  @Post('permissions')
  @RequirePermission(RolesModulePermission.SEED_PERMISSIONS)
  async seedPermissions() {
    await this.seederService.seedPermissions();
    return {
      message: 'Permissions seeded successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Seed default system roles
   */
  @Post('roles')
  @RequirePermission(RolesModulePermission.SEED_ROLES)
  async seedRoles() {
    await this.seederService.seedRoles();
    return {
      message: 'Roles seeded successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Seed both permissions and roles
   */
  @Post('all')
  @RequirePermission(RolesModulePermission.SEED_ROLES)
  async seedAll() {
    await this.seederService.seed();
    return {
      message: 'All roles and permissions seeded successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get seeding statistics
   */
  @Get('stats')
  @RequirePermission(RolesModulePermission.VIEW_SEEDER_STATS)
  async getStats() {
    const stats = await this.seederService.getStats();
    return {
      stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Discover all endpoints and auto-register missing permissions
   * Also syncs Super Admin with all permissions
   */
  @Post('discover-endpoints')
  @RequirePermission(RolesModulePermission.SEED_PERMISSIONS)
  async discoverEndpoints() {
    const report = await this.endpointDiscoveryService.discoverAndRegisterPermissions();
    return {
      message: 'Endpoint discovery completed',
      report: {
        totalEndpoints: report.totalEndpoints,
        protectedEndpoints: report.protectedEndpoints,
        publicEndpoints: report.publicEndpoints,
        unprotectedEndpoints: report.unprotectedEndpoints,
        newPermissionsCreated: report.newPermissionsCreated,
        existingPermissionsUpdated: report.existingPermissionsUpdated,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get endpoint report without making changes
   */
  @Get('endpoints')
  @RequirePermission(RolesModulePermission.VIEW_SEEDER_STATS)
  async getEndpoints() {
    const report = await this.endpointDiscoveryService.getEndpointReport();
    return {
      protected: report.protected.map((e) => ({
        path: e.fullPath,
        method: e.httpMethod,
        permission: e.permission,
        controller: e.controller,
      })),
      public: report.public.map((e) => ({
        path: e.fullPath,
        method: e.httpMethod,
        controller: e.controller,
      })),
      unprotected: report.unprotected.map((e) => ({
        path: e.fullPath,
        method: e.httpMethod,
        controller: e.controller,
        suggestedPermission: e.generatedPermission,
      })),
      summary: {
        protected: report.protected.length,
        public: report.public.length,
        unprotected: report.unprotected.length,
        total: report.protected.length + report.public.length + report.unprotected.length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate that all endpoints have permissions
   */
  @Get('validate')
  @RequirePermission(RolesModulePermission.VIEW_SEEDER_STATS)
  async validateEndpoints() {
    const validation = await this.endpointDiscoveryService.validateEndpointPermissions();
    return {
      isValid: validation.isValid,
      missingPermissions: validation.missingPermissions.map((e) => ({
        path: e.fullPath,
        method: e.httpMethod,
        controller: e.controller,
        methodName: e.method,
        suggestedPermission: e.generatedPermission,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Sync Super Admin role with all permissions
   */
  @Post('sync-super-admin')
  @RequirePermission(RolesModulePermission.SEED_ROLES)
  async syncSuperAdmin() {
    await this.endpointDiscoveryService.updateSuperAdminPermissions();
    const stats = await this.seederService.getStats();
    return {
      message: 'Super Admin role synced with all permissions',
      totalPermissions: stats.permissions.total,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Fix permission module names to match frontend expectations
   */
  @Post('fix-module-names')
  @RequirePermission(RolesModulePermission.SEED_PERMISSIONS)
  async fixModuleNames() {
    const result = await this.endpointDiscoveryService.fixPermissionModuleNames();
    return {
      message: `Fixed ${result.fixed} permissions with incorrect module names`,
      fixed: result.fixed,
      permissions: result.permissions,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Full sync: fix modules, discover endpoints, sync super admin
   */
  @Post('full-sync')
  @RequirePermission(RolesModulePermission.SEED_ROLES)
  async fullSync() {
    // 1. Fix module names
    const fixResult = await this.endpointDiscoveryService.fixPermissionModuleNames();

    // 2. Discover and register permissions
    const discoveryReport = await this.endpointDiscoveryService.discoverAndRegisterPermissions();

    // 3. Sync super admin
    await this.endpointDiscoveryService.updateSuperAdminPermissions();

    const stats = await this.seederService.getStats();

    return {
      message: 'Full sync completed successfully',
      moduleNamesFixed: fixResult.fixed,
      endpointsDiscovered: discoveryReport.totalEndpoints,
      newPermissionsCreated: discoveryReport.newPermissionsCreated,
      totalPermissions: stats.permissions.total,
      timestamp: new Date().toISOString(),
    };
  }
}
