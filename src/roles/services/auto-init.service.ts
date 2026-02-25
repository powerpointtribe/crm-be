import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { RolesSeederService } from './roles-seeder.service';
import { RolesService } from './roles.service';
import { EndpointDiscoveryService } from './endpoint-discovery.service';
import { MembersService } from '../../members/members.service';
import {
  UserInvitation,
  UserInvitationDocument,
  InvitationStatus,
} from '../../user-invitations/schemas/user-invitation.schema';
import { Branch, BranchDocument } from '../../branches/schemas/branch.schema';

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
    @InjectModel(UserInvitation.name)
    private readonly invitationModel: Model<UserInvitationDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async onModuleInit() {
    this.logger.log('🔧 AutoInitService.onModuleInit() called');

    // Check if auto-initialization is enabled
    const autoInit = this.configService.get<string>(
      'AUTO_INIT_SUPER_ADMIN',
      'true',
    );
    this.logger.log(`AUTO_INIT_SUPER_ADMIN = ${autoInit}`);

    if (autoInit !== 'true') {
      this.logger.log('Auto-initialization is disabled');
      return;
    }

    // Prevent multiple simultaneous initializations
    if (this.initializationInProgress) {
      this.logger.log('Initialization already in progress, skipping');
      return;
    }

    // Run initialization in background (non-blocking)
    this.initializationInProgress = true;
    setImmediate(() => {
      this.initializeIfNeeded()
        .catch((error) => {
          this.logger.error('Auto-initialization failed:', error.message);
          this.logger.error('Stack trace:', error.stack);
        })
        .finally(() => {
          this.initializationInProgress = false;
        });
    });
  }

  private async initializeIfNeeded(): Promise<void> {
    this.logger.log('🚀 initializeIfNeeded() started');
    try {
      // Check current stats
      const stats = await this.rolesSeederService.getStats();
      this.logger.log(
        `Current stats - Roles: ${stats.roles.total}, Permissions: ${stats.permissions.total}`,
      );

      // Always seed permissions first (roles need permissions to exist)
      this.logger.log('🔑 Seeding permissions...');
      await this.rolesSeederService.seedPermissions();

      // Run endpoint discovery to register any new permissions
      this.logger.log('🔍 Running endpoint discovery...');
      await this.discoverAndSyncPermissions();

      const needsRolesInit =
        stats.roles.total === 0 || stats.roles.system === 0;

      if (needsRolesInit) {
        this.logger.log('🚀 Starting automatic system initialization...');

        // Seed roles (now permissions exist)
        this.logger.log('Seeding roles...');
        await this.rolesSeederService.seedRoles();
      } else {
        // Always update system roles to ensure permissions are current
        this.logger.log('Updating system roles with current permissions...');
        await this.rolesSeederService.seedRoles();
      }

      // Always ensure super admin exists and has proper access
      this.logger.log('🔐 Checking super admin setup...');
      await this.assignSuperAdminRole();

      // Note: Finance Manager is no longer a system role
      // It should be created as a custom role via API if needed
      // See PRODUCTION_SETUP_GUIDE.md for instructions

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
   * 1. New endpoints get permissions auto-generated
   * 2. Super Admin always has ALL permissions
   */
  private async discoverAndSyncPermissions(): Promise<void> {
    try {
      // Discover endpoints and auto-register missing permissions (fast operation)
      const report =
        await this.endpointDiscoveryService.discoverAndRegisterPermissions();

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
      const adminEmail = this.configService.get<string>(
        'SUPER_ADMIN_EMAIL',
        'admin@church.com',
      );
      const adminPassword = this.configService.get<string>(
        'SUPER_ADMIN_PASSWORD',
      );
      const adminFirstName = this.configService.get<string>(
        'SUPER_ADMIN_FIRST_NAME',
        'Super',
      );
      const adminLastName = this.configService.get<string>(
        'SUPER_ADMIN_LAST_NAME',
        'Admin',
      );

      this.logger.log(`📧 SUPER_ADMIN_EMAIL = ${adminEmail}`);
      this.logger.log(
        `🔑 SUPER_ADMIN_PASSWORD = ${adminPassword ? '[SET]' : '[NOT SET]'}`,
      );

      // Find or create a default branch first (required for member creation)
      let defaultBranch = await this.branchModel.findOne({ isActive: true });

      if (!defaultBranch) {
        this.logger.log('Creating default headquarters branch...');
        defaultBranch = await this.branchModel.create({
          name: 'Anthony',
          slug: 'anthony',
          description: 'Main PPT campus',
          address: {
            street: '300 ikorodu Rood, anthony Bus stop',
            city: 'Lagos',
            state: 'Lagos',
            country: 'Nigeria',
          },
          isActive: true,
          isMainBranch: true,
        });
        this.logger.log('✓ Created default headquarters branch');
      }

      // Find or create admin user
      let adminUser = await this.membersService.findByEmail(adminEmail);

      if (!adminUser && adminPassword) {
        // Create the super admin member
        this.logger.log(`Creating super admin member: ${adminEmail}...`);
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        adminUser = await this.membersService.create({
          email: adminEmail,
          password: hashedPassword,
          firstName: adminFirstName,
          lastName: adminLastName,
          phone: '0000000000',
          dateOfBirth: '1990-01-01', // Default date of birth for super admin
          gender: 'male',
          address: {
            state: 'Lagos',
          },
          branch: defaultBranch._id, // Assign to default branch
          isActive: true,
        } as any);
        this.logger.log(`✓ Created super admin member: ${adminEmail}`);
      }

      if (!adminUser) {
        this.logger.warn(
          'Super admin not created. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD environment variables.',
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
      if (adminUser.role?.toString() !== roleId.toString()) {
        // Assign the role (type cast to bypass DTO validation)
        await this.membersService.update(adminUser._id.toString(), {
          role: roleId,
        } as any);
        this.logger.log(`✓ Super admin role assigned to ${adminEmail}`);
      } else {
        this.logger.log(`✓ ${adminEmail} already has super_admin role`);
      }

      // Create ACCEPTED invitation if none exists (required for login with invitation check)
      const existingInvitation = await this.invitationModel.findOne({
        member: adminUser._id,
        status: { $in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
      });

      if (!existingInvitation) {
        // Find or create a default branch for the super admin
        let defaultBranch = await this.branchModel.findOne({ isActive: true });

        if (!defaultBranch) {
          // Create a default headquarters branch
          this.logger.log('Creating default headquarters branch...');
          defaultBranch = await this.branchModel.create({
            name: 'Headquarters',
            slug: 'headquarters',
            description: 'Main headquarters branch',
            address: {
              street: 'Main Street',
              city: 'City',
              state: 'State',
              country: 'Country',
            },
            isActive: true,
            isMainBranch: true,
          });
          this.logger.log('✓ Created default headquarters branch');
        }

        await this.invitationModel.create({
          member: adminUser._id,
          role: roleId,
          branch: defaultBranch._id,
          temporaryPassword: 'N/A', // Not used for bootstrap
          status: InvitationStatus.ACCEPTED,
          invitedBy: adminUser._id, // Self-invited for bootstrap
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          acceptedAt: new Date(),
          emailSent: true,
        });
        this.logger.log(`✓ Created accepted invitation for ${adminEmail}`);
      } else {
        this.logger.log(`✓ ${adminEmail} already has a valid invitation`);
      }
    } catch (error) {
      this.logger.error('Failed to assign super admin role:', error.message);
      this.logger.error('Stack:', error.stack);
      // Don't throw - this is optional
    }
  }

  /**
   * DEPRECATED: Finance Manager auto-initialization removed
   *
   * Finance Manager is now a custom role, not a system role.
   * To create a Finance Manager account:
   *
   * 1. Create the custom Finance Manager role via API:
   *    POST /api/v1/roles
   *    {
   *      "name": "Finance Manager",
   *      "slug": "finance-manager",
   *      "isSystemRole": false,
   *      "permissions": [...finance permissions...]
   *    }
   *
   * 2. Create a member account
   * 3. Invite the member with the Finance Manager role
   *
   * See PRODUCTION_SETUP_GUIDE.md for complete instructions.
   */
}
