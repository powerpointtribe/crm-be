import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RolesSeederService } from './roles-seeder.service';
import { RolesService } from './roles.service';
import { EndpointDiscoveryService } from './endpoint-discovery.service';
import { MembersService } from '../../members/members.service';

/**
 * Service to automatically initialize super admin on first startup
 * This runs once when the application starts if initialization is needed
 *
 * Also handles:
 * - Auto-discovery of new endpoints
 * - Auto-registration of missing permissions
 * - Syncing Super Admin role with all permissions
 */
@Injectable()
export class AutoInitService implements OnModuleInit {
  private readonly logger = new Logger(AutoInitService.name);
  private initializationInProgress = false;

  constructor(
    private readonly rolesSeederService: RolesSeederService,
    private readonly rolesService: RolesService,
    private readonly endpointDiscoveryService: EndpointDiscoveryService,
    private readonly membersService: MembersService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Check if auto-initialization is enabled
    const autoInit = this.configService.get<string>('AUTO_INIT_SUPER_ADMIN', 'true');

    if (autoInit !== 'true') {
      this.logger.log('Auto-initialization is disabled');
      return;
    }

    // Prevent multiple simultaneous initializations
    if (this.initializationInProgress) {
      return;
    }

    // Run initialization in background (non-blocking)
    this.initializationInProgress = true;
    setImmediate(() => {
      this.initializeIfNeeded()
        .catch((error) => {
          this.logger.error('Auto-initialization failed:', error.message);
        })
        .finally(() => {
          this.initializationInProgress = false;
        });
    });
  }

  private async initializeIfNeeded(): Promise<void> {
    try {
      // Check if roles exist
      const stats = await this.rolesSeederService.getStats();

      const needsRolesInit =
        stats.roles.total === 0 ||
        stats.roles.system === 0;

      if (needsRolesInit) {
        this.logger.log('🚀 Starting automatic system initialization...');

        // Seed roles first (roles need to exist before we assign permissions)
        this.logger.log('Seeding roles...');
        await this.rolesSeederService.seedRoles();

        // Assign super_admin role to admin@church.com if user exists
        await this.assignSuperAdminRole();
      } else {
        this.logger.log('System roles already initialized');
      }

      // Always run endpoint discovery to:
      // 1. Discover all endpoints and create permissions
      // 2. Update Super Admin with all permissions
      this.logger.log('🔍 Running endpoint discovery...');
      await this.discoverAndSyncPermissions();

      // Display final statistics
      const finalStats = await this.rolesSeederService.getStats();
      this.logger.log('✓ System initialization/sync completed successfully');
      this.logger.log(`  - Permissions: ${finalStats.permissions.total}`);
      this.logger.log(`  - Roles: ${finalStats.roles.total}`);
      this.logger.log(`  - System Roles: ${finalStats.roles.system}`);
    } catch (error) {
      this.logger.error('Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Discover new endpoints and sync permissions
   * This runs on every startup to ensure:
   * 1. Permissions from constants are seeded (only on first run or if few permissions exist)
   * 2. Existing permission module names are correct
   * 3. New endpoints get permissions auto-generated
   * 4. Super Admin always has ALL permissions
   */
  private async discoverAndSyncPermissions(): Promise<void> {
    try {
      // Only seed from constants if very few permissions exist (first startup scenario)
      const stats = await this.rolesSeederService.getStats();
      if (stats.permissions.total < 50) {
        this.logger.log('Few permissions found, seeding from constants...');
        await this.rolesSeederService.seedPermissions();
      }

      // Discover endpoints and auto-register missing permissions (fast operation)
      const report = await this.endpointDiscoveryService.discoverAndRegisterPermissions();

      if (report.newPermissionsCreated > 0) {
        this.logger.log(
          `✓ Created ${report.newPermissionsCreated} new permissions`,
        );
      }

      // Always ensure Super Admin has all permissions
      await this.endpointDiscoveryService.updateSuperAdminPermissions();
      this.logger.log('✓ Super Admin role synced with all permissions');
    } catch (error) {
      this.logger.error('Permission sync failed:', error.message);
      // Don't throw - this shouldn't break startup
    }
  }

  private async assignSuperAdminRole(): Promise<void> {
    try {
      // Find admin@church.com user
      const adminUser = await this.membersService.findByEmail(
        'admin@church.com',
      );

      if (!adminUser) {
        this.logger.warn(
          'User admin@church.com not found - skipping role assignment',
        );
        this.logger.warn(
          'Run "npm run init:super-admin" after creating the admin user',
        );
        return;
      }

      // Find super_admin role by slug
      const superAdminRole = await this.rolesService.findBySlug('super-admin');

      if (!superAdminRole) {
        this.logger.error('Super admin role not found after seeding');
        return;
      }

      // Cast to any to access _id from Mongoose document
      const roleId = (superAdminRole as any)._id;

      // Check if user already has the role
      if (adminUser.role?.toString() === roleId.toString()) {
        this.logger.log('✓ admin@church.com already has super_admin role');
        return;
      }

      // Assign the role (type cast to bypass DTO validation)
      await this.membersService.update(adminUser._id.toString(), {
        role: roleId,
      } as any);

      this.logger.log(
        `✓ Super admin role assigned to ${adminUser.email}`,
      );
    } catch (error) {
      this.logger.error('Failed to assign super admin role:', error.message);
      // Don't throw - this is optional
    }
  }
}
