import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RolesSeederService } from './roles-seeder.service';
import { RolesService } from './roles.service';
import { MembersService } from '../../members/members.service';

/**
 * Service to automatically initialize super admin on first startup
 * This runs once when the application starts if initialization is needed
 */
@Injectable()
export class AutoInitService implements OnModuleInit {
  private readonly logger = new Logger(AutoInitService.name);
  private initializationInProgress = false;

  constructor(
    private readonly rolesSeederService: RolesSeederService,
    private readonly rolesService: RolesService,
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

    try {
      this.initializationInProgress = true;
      await this.initializeIfNeeded();
    } catch (error) {
      this.logger.error('Auto-initialization failed:', error.message);
    } finally {
      this.initializationInProgress = false;
    }
  }

  private async initializeIfNeeded(): Promise<void> {
    try {
      // Check if super_admin role exists and has permissions
      const stats = await this.rolesSeederService.getStats();

      const needsInit =
        stats.permissions.total === 0 ||
        stats.roles.total === 0 ||
        stats.roles.system === 0;

      if (!needsInit) {
        this.logger.log('System already initialized, skipping auto-init');
        return;
      }

      this.logger.log('🚀 Starting automatic system initialization...');

      // Step 1: Seed permissions
      this.logger.log('Seeding permissions...');
      await this.rolesSeederService.seedPermissions();

      // Step 2: Seed roles
      this.logger.log('Seeding roles...');
      await this.rolesSeederService.seedRoles();

      // Step 3: Assign super_admin role to admin@church.com if user exists
      await this.assignSuperAdminRole();

      // Display final statistics
      const finalStats = await this.rolesSeederService.getStats();
      this.logger.log('✓ System initialization completed successfully');
      this.logger.log(`  - Permissions: ${finalStats.permissions.total}`);
      this.logger.log(`  - Roles: ${finalStats.roles.total}`);
      this.logger.log(`  - System Roles: ${finalStats.roles.system}`);
    } catch (error) {
      this.logger.error('Initialization failed:', error.message);
      throw error;
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
