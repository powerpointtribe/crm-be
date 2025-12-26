import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model, Types } from 'mongoose';
import { Logger } from '@nestjs/common';
import { Permission, PermissionDocument } from '../roles/schemas/permission.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { EndpointDiscoveryService } from '../roles/services/endpoint-discovery.service';
import { RolesSeederService } from '../roles/services/roles-seeder.service';

/**
 * Script to sync Super Admin role with ALL permissions in the system.
 *
 * This script:
 * 1. Ensures roles are seeded
 * 2. Discovers all endpoints and auto-registers permissions
 * 3. Updates the Super Admin role to include ALL permissions
 *
 * Run with: npm run sync:super-admin-permissions
 */
async function syncSuperAdminPermissions() {
  const logger = new Logger('SyncSuperAdminPermissions');

  logger.log('Starting Super Admin permissions sync...');
  logger.log('=========================================');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // Get services and models
    const permissionModel = app.get<Model<PermissionDocument>>('PermissionModel');
    const roleModel = app.get<Model<RoleDocument>>('RoleModel');
    const endpointDiscoveryService = app.get(EndpointDiscoveryService);
    const rolesSeederService = app.get(RolesSeederService);

    // Step 1: Ensure roles are seeded
    logger.log('\n[Step 1/5] Ensuring roles are seeded...');
    await rolesSeederService.seedRoles();
    logger.log('Roles seeded');

    // Step 2: Fix permission module names
    logger.log('\n[Step 2/5] Fixing permission module names...');
    const fixResult = await endpointDiscoveryService.fixPermissionModuleNames();
    if (fixResult.fixed > 0) {
      logger.log(`Fixed ${fixResult.fixed} permissions with incorrect module names`);
      for (const p of fixResult.permissions) {
        logger.log(`  - ${p.name}: ${p.oldModule} → ${p.newModule}`);
      }
    } else {
      logger.log('All permissions have correct module names');
    }

    // Step 3: Discover endpoints and auto-register permissions
    logger.log('\n[Step 3/5] Discovering endpoints and registering permissions...');
    const discoveryReport = await endpointDiscoveryService.discoverAndRegisterPermissions();

    logger.log(`\nEndpoint Discovery Report:`);
    logger.log(`  Total endpoints: ${discoveryReport.totalEndpoints}`);
    logger.log(`  Protected (with @RequirePermission): ${discoveryReport.protectedEndpoints}`);
    logger.log(`  Public (with @Public): ${discoveryReport.publicEndpoints}`);
    logger.log(`  Unprotected (auto-registered): ${discoveryReport.unprotectedEndpoints}`);
    logger.log(`  New permissions created: ${discoveryReport.newPermissionsCreated}`);
    logger.log(`  Existing permissions updated: ${discoveryReport.existingPermissionsUpdated}`);

    // Step 4: Fetch all active permissions
    logger.log('\n[Step 4/5] Fetching all permissions...');
    const allPermissions = await permissionModel.find({ isActive: true }).exec();

    if (allPermissions.length === 0) {
      logger.warn('No permissions found in the database!');
      return;
    }

    logger.log(`Found ${allPermissions.length} active permissions`);

    // Group permissions by module for display
    const permissionsByModule: Record<string, string[]> = {};
    for (const perm of allPermissions) {
      if (!permissionsByModule[perm.module]) {
        permissionsByModule[perm.module] = [];
      }
      permissionsByModule[perm.module].push(perm.name);
    }

    logger.log('\nPermissions by module:');
    for (const [module, perms] of Object.entries(permissionsByModule).sort()) {
      logger.log(`  - ${module}: ${perms.length} permissions`);
    }

    // Step 5: Update Super Admin role with all permissions
    logger.log('\n[Step 5/5] Updating Super Admin role...');
    const superAdminRole = await roleModel.findOne({ slug: 'super-admin' }).exec();

    if (!superAdminRole) {
      logger.error('Super Admin role not found!');
      return;
    }

    logger.log(`Found Super Admin role: ${superAdminRole.name} (ID: ${superAdminRole._id})`);
    logger.log(`Current permissions count: ${superAdminRole.permissions?.length || 0}`);

    const allPermissionIds: Types.ObjectId[] = allPermissions.map((p) => p._id);

    const result = await roleModel.updateOne(
      { _id: superAdminRole._id },
      {
        $set: {
          permissions: allPermissionIds,
          updatedAt: new Date(),
        }
      }
    );

    if (result.modifiedCount > 0) {
      logger.log('Super Admin role updated successfully!');
    } else if (result.matchedCount > 0) {
      logger.log('Super Admin role already has all permissions (no changes needed)');
    } else {
      logger.error('Failed to update Super Admin role');
      return;
    }

    // Verify the update
    const updatedRole = await roleModel
      .findOne({ slug: 'super-admin' })
      .populate('permissions')
      .exec();

    logger.log('\n=========================================');
    logger.log('SYNC COMPLETE');
    logger.log('=========================================');
    logger.log(`Super Admin Role: ${updatedRole?.name}`);
    logger.log(`Total Permissions Assigned: ${updatedRole?.permissions?.length || 0}`);
    logger.log(`Modules Covered: ${Object.keys(permissionsByModule).length}`);
    logger.log('\nModules with full access:');
    for (const module of Object.keys(permissionsByModule).sort()) {
      logger.log(`  ✓ ${module}`);
    }
    logger.log('=========================================');

  } catch (error) {
    logger.error('Failed to sync Super Admin permissions:', error.message);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the script
syncSuperAdminPermissions()
  .then(() => {
    console.log('\n✓ Super Admin permissions sync completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Super Admin permissions sync failed:', error);
    process.exit(1);
  });
