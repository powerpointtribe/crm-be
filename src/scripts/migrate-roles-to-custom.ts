import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RolesService } from '../roles/services/roles.service';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from '../roles/schemas/role.schema';

/**
 * Migration script to convert system roles to custom roles
 *
 * This script converts the following roles from system roles to custom roles:
 * - Senior Pastor
 * - Campus Pastor
 * - Finance Manager
 *
 * WHY: We've restructured the role system to have only 2 system roles:
 * - Super Admin (all permissions)
 * - Admin (all view permissions)
 *
 * All other roles should be custom roles for organizational flexibility.
 *
 * SAFE TO RUN MULTIPLE TIMES: This script is idempotent
 *
 * Usage:
 *   npm run migrate:roles-to-custom
 */
async function migrateRolesToCustom() {
  const logger = new Logger('MigrateRolesToCustom');

  logger.log('🚀 Starting role migration...');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const rolesService = app.get(RolesService);

    // Roles to convert from system to custom
    const rolesToConvert = [
      'senior-pastor',
      'campus-pastor',
      'finance-manager',
    ];

    let convertedCount = 0;
    let skippedCount = 0;

    for (const roleSlug of rolesToConvert) {
      logger.log(`\nProcessing role: ${roleSlug}...`);

      const role = await rolesService.findBySlug(roleSlug);

      if (!role) {
        logger.warn(`  ⚠️  Role "${roleSlug}" not found - skipping`);
        skippedCount++;
        continue;
      }

      if (!role.isSystemRole) {
        logger.log(`  ℹ️  Role "${roleSlug}" is already a custom role - skipping`);
        skippedCount++;
        continue;
      }

      // Convert to custom role
      const roleDocument = role as any;
      await rolesService.update(roleDocument._id.toString(), {
        isSystemRole: false,
      } as any);

      logger.log(`  ✓ Converted "${role.name}" to custom role`);
      convertedCount++;
    }

    // Summary
    logger.log('\n=== Migration Complete ===');
    logger.log(`Roles converted: ${convertedCount}`);
    logger.log(`Roles skipped: ${skippedCount}`);
    logger.log('==========================\n');

    // Display current system roles
    const systemRoles = await rolesService.findAll({
      isSystemRole: true,
    });

    logger.log('Current system roles:');
    for (const role of systemRoles) {
      const roleDoc = role as any;
      logger.log(`  - ${role.name} (${role.slug}) - Level ${role.level}`);
    }

    if (systemRoles.length !== 2) {
      logger.warn(
        `\n⚠️  WARNING: Expected 2 system roles (super-admin, admin), but found ${systemRoles.length}`,
      );
    } else {
      logger.log('\n✅ System roles are correctly configured!');
    }

  } catch (error) {
    logger.error('Migration failed:', error.message);
    logger.error('Stack trace:', error.stack);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the script
migrateRolesToCustom()
  .then(() => {
    console.log('✓ Role migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Role migration failed:', error);
    process.exit(1);
  });
