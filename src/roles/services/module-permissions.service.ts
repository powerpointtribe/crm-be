import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Permission, PermissionDocument } from '../schemas/permission.schema';
import { getAvailableModules, MODULE_DISPLAY_NAMES } from '../constants/modules.constant';

/**
 * Service for handling module-based permission operations
 * Used when assigning modules to roles to auto-grant view permissions
 */
@Injectable()
export class ModulePermissionsService {
  // View-related actions that should be granted when a module is assigned
  private readonly VIEW_ACTIONS = ['view', 'read', 'view-stats', 'list', 'view-details'];

  constructor(
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
  ) {}

  /**
   * Get all VIEW permissions for a specific module
   */
  async getViewPermissionsForModule(module: string): Promise<Permission[]> {
    return this.permissionModel.find({
      module,
      action: { $in: this.VIEW_ACTIONS },
      isActive: true,
    });
  }

  /**
   * Get all VIEW permission IDs for multiple modules
   * Used when creating/updating a role with module assignments
   */
  async getViewPermissionIdsForModules(modules: string[]): Promise<Types.ObjectId[]> {
    if (!modules || modules.length === 0) {
      return [];
    }

    const permissions = await this.permissionModel.find({
      module: { $in: modules },
      action: { $in: this.VIEW_ACTIONS },
      isActive: true,
    });

    return permissions.map((p) => p._id as Types.ObjectId);
  }

  /**
   * Get all unique modules from the permissions collection
   */
  async getAllModulesFromDatabase(): Promise<string[]> {
    const modules = await this.permissionModel.distinct('module', { isActive: true });
    return modules.sort();
  }

  /**
   * Get all available modules with their display names
   * Returns the predefined list from constants
   */
  getAllModulesWithDisplayNames(): Array<{ identifier: string; displayName: string }> {
    return getAvailableModules();
  }

  /**
   * Extract accessible modules from a list of permission names
   * Used to determine which modules a user has access to based on their permissions
   */
  getAccessibleModulesFromPermissionNames(permissionNames: string[]): string[] {
    const moduleSet = new Set<string>();

    permissionNames.forEach((permName) => {
      // Permission format: "module:action" e.g., "members:view"
      const [module, action] = permName.split(':');
      if (module && this.VIEW_ACTIONS.includes(action)) {
        moduleSet.add(module);
      }
    });

    return Array.from(moduleSet);
  }

  /**
   * Extract accessible modules from Permission documents
   */
  getAccessibleModulesFromPermissions(permissions: Permission[]): string[] {
    const moduleSet = new Set<string>();

    permissions.forEach((p) => {
      if (this.VIEW_ACTIONS.includes(p.action)) {
        moduleSet.add(p.module);
      }
    });

    return Array.from(moduleSet);
  }

  /**
   * Check if a module exists in the available modules list
   */
  isValidModule(module: string): boolean {
    return Object.keys(MODULE_DISPLAY_NAMES).includes(module);
  }

  /**
   * Validate that all provided modules are valid
   */
  validateModules(modules: string[]): { valid: boolean; invalidModules: string[] } {
    const invalidModules = modules.filter((m) => !this.isValidModule(m));
    return {
      valid: invalidModules.length === 0,
      invalidModules,
    };
  }
}
