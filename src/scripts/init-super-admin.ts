import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RolesSeederService } from '../roles/services/roles-seeder.service';
import { RolesService } from '../roles/services/roles.service';
import { MembersService } from '../members/members.service';
import { Logger } from '@nestjs/common';

/**
 * One-time initialization script to:
 * 1. Seed all permissions
 * 2. Create/update super_admin role with all permissions
 * 3. Assign super_admin role to admin@church.com
 *
 * This script is idempotent - it can be run multiple times safely
 */
async function initializeSuperAdmin() {
  const logger = new Logger('InitSuperAdmin');

  logger.log('Starting super admin initialization...');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // Get required services
    const rolesSeederService = app.get(RolesSeederService);
    const rolesService = app.get(RolesService);
    const membersService = app.get(MembersService);

    // Step 1: Seed all permissions
    logger.log('Step 1: Seeding permissions...');
    await rolesSeederService.seedPermissions();
    logger.log('✓ Permissions seeded successfully');

    // Step 2: Seed roles (including super_admin)
    logger.log('Step 2: Seeding roles...');
    await rolesSeederService.seedRoles();
    logger.log('✓ Roles seeded successfully');

    // Step 3: Find super_admin role
    logger.log('Step 3: Finding super_admin role...');
    const superAdminRole = await rolesService.findBySlug('super-admin');

    if (!superAdminRole) {
      throw new Error('Super admin role not found after seeding');
    }

    // Cast to any to access _id from Mongoose document
    const roleId = (superAdminRole as any)._id;
    logger.log(`✓ Found super_admin role: ${roleId}`);

    // Step 4: Find admin@church.com user
    logger.log('Step 4: Finding admin@church.com user...');
    const adminUser = await membersService.findByEmail('admin@church.com');

    if (!adminUser) {
      logger.error('✗ User admin@church.com not found');
      logger.warn('Please create a user with email admin@church.com first');
      return;
    }

    logger.log(`✓ Found user: ${adminUser.firstName} ${adminUser.lastName} (${adminUser.email})`);

    // Step 5: Assign super_admin role to the user
    logger.log('Step 5: Assigning super_admin role to user...');

    // Check if user already has the super_admin role
    if (adminUser.role?.toString() === roleId.toString()) {
      logger.log('✓ User already has super_admin role');
    } else {
      // Assign the role (type cast to bypass DTO validation)
      await membersService.update(adminUser._id.toString(), {
        role: roleId,
      } as any);
      logger.log('✓ Super admin role assigned successfully');
    }

    // Step 6: Display statistics
    logger.log('\n=== Initialization Complete ===');
    const stats = await rolesSeederService.getStats();
    logger.log(`Total Permissions: ${stats.permissions.total}`);
    logger.log(`Active Permissions: ${stats.permissions.active}`);
    logger.log(`Public Permissions: ${stats.permissions.public}`);
    logger.log(`Total Roles: ${stats.roles.total}`);
    logger.log(`System Roles: ${stats.roles.system}`);
    logger.log(`Custom Roles: ${stats.roles.custom}`);
    logger.log(`\nAdmin User: ${adminUser.email}`);
    logger.log(`Admin Role: ${superAdminRole.name}`);
    logger.log('================================\n');

  } catch (error) {
    logger.error('Failed to initialize super admin:', error.message);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the script
initializeSuperAdmin()
  .then(() => {
    console.log('✓ Super admin initialization completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Super admin initialization failed:', error);
    process.exit(1);
  });
