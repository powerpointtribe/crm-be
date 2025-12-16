import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { RolesSeederService } from './services/roles-seeder.service';
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
  constructor(private readonly seederService: RolesSeederService) {}

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
}
