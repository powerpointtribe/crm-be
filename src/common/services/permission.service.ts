import { Injectable } from '@nestjs/common';
import { UserRole } from '../enums/user-roles.enums';

export interface AccessControlContext {
  user: any;
  resourceUnitId?: string;
  resourceDistrictId?: string;
  requiredRoles?: UserRole[];
  allowSelfAccess?: boolean;
  resourceOwnerId?: string;
}

export interface PermissionResult {
  hasAccess: boolean;
  filters?: {
    unitId?: string;
    districtId?: string;
  };
  reason?: string;
}

@Injectable()
export class PermissionService {
  /**
   * Check if user has access to a resource and return appropriate filters
   */
  checkResourceAccess(context: AccessControlContext): PermissionResult {
    const {
      user,
      resourceUnitId,
      resourceDistrictId,
      requiredRoles = [],
      allowSelfAccess = false,
      resourceOwnerId,
    } = context;

    // Super admin and admin have access to everything
    if (
      user.systemRoles?.includes(UserRole.SUPER_ADMIN) ||
      user.systemRoles?.includes(UserRole.ADMIN)
    ) {
      return { hasAccess: true };
    }

    // Check if user has any of the required roles
    if (requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.some((role) =>
        user.systemRoles?.includes(role),
      );
      if (!hasRequiredRole) {
        return {
          hasAccess: false,
          reason: `Requires one of: ${requiredRoles.join(', ')}`,
        };
      }
    }

    // Check self-access if allowed
    if (
      allowSelfAccess &&
      resourceOwnerId &&
      user._id?.toString() === resourceOwnerId
    ) {
      return { hasAccess: true };
    }

    // Pastor access - now uses role-based permissions
    if (user.systemRoles?.includes(UserRole.PASTOR)) {
      // Pastors have access - specific district filtering now handled by RoleAssignment
      return { hasAccess: true };
    }

    // Unit-level access
    if (user.unit) {
      const unitId = user.unit.toString();

      // If resource has a specific unit, check if it matches
      if (resourceUnitId) {
        if (resourceUnitId === unitId) {
          return { hasAccess: true };
        } else {
          return {
            hasAccess: false,
            reason: 'Resource belongs to different unit',
          };
        }
      }

      // Return unit filter for queries
      return {
        hasAccess: true,
        filters: { unitId },
      };
    }

    return {
      hasAccess: false,
      reason: 'No sufficient permissions or organizational association',
    };
  }

  /**
   * Get access filters for listing resources
   */
  getListAccessFilters(user: any): {
    unitId?: string;
    districtId?: string;
  } {
    // Super admin and admin see everything
    if (
      user.systemRoles?.includes(UserRole.SUPER_ADMIN) ||
      user.systemRoles?.includes(UserRole.ADMIN)
    ) {
      return {};
    }

    // Pastor access - now uses role-based permissions
    if (user.systemRoles?.includes(UserRole.PASTOR)) {
      // Pastors have access - specific district filtering now handled by RoleAssignment
      return {};
    }

    // Unit-level access
    if (user.unit) {
      return {
        unitId: user.unit.toString(),
      };
    }

    return {};
  }

  /**
   * Check if user can perform specific inventory operations
   */
  checkInventoryPermissions(
    user: any,
    operation: 'create' | 'update' | 'delete' | 'view' | 'movement',
    options: {
      restrictedMovementTypes?: string[];
      itemUnitId?: string;
      itemDistrictId?: string;
    } = {},
  ): PermissionResult {
    const baseAccess = this.checkResourceAccess({
      user,
      resourceUnitId: options.itemUnitId,
      resourceDistrictId: options.itemDistrictId,
    });

    if (!baseAccess.hasAccess) {
      return baseAccess;
    }

    switch (operation) {
      case 'create':
      case 'update':
        return this.checkResourceAccess({
          user,
          requiredRoles: [
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
            UserRole.PASTOR,
          ],
          resourceUnitId: options.itemUnitId,
          resourceDistrictId: options.itemDistrictId,
        });

      case 'delete':
        return this.checkResourceAccess({
          user,
          requiredRoles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
          resourceUnitId: options.itemUnitId,
          resourceDistrictId: options.itemDistrictId,
        });

      case 'movement':
        // Check if it's a restricted movement type
        if (
          options.restrictedMovementTypes?.length &&
          !user.systemRoles?.includes(UserRole.ADMIN) &&
          !user.systemRoles?.includes(UserRole.SUPER_ADMIN)
        ) {
          return {
            hasAccess: false,
            reason: `Restricted movement types require admin privileges`,
          };
        }

        return this.checkResourceAccess({
          user,
          requiredRoles: [
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
            UserRole.PASTOR,
            UserRole.DIRECTOR,
          ],
          resourceUnitId: options.itemUnitId,
          resourceDistrictId: options.itemDistrictId,
        });

      case 'view':
        return baseAccess;

      default:
        return { hasAccess: false, reason: 'Unknown operation' };
    }
  }

  /**
   * Check if user can access audit logs
   */
  checkAuditLogAccess(
    user: any,
    logUnitId?: string,
    logDistrictId?: string,
  ): PermissionResult {
    return this.checkResourceAccess({
      user,
      requiredRoles: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PASTOR],
      resourceUnitId: logUnitId,
      resourceDistrictId: logDistrictId,
    });
  }

  /**
   * Apply access control filters to a query object
   */
  applyAccessFilters<T extends Record<string, any>>(
    query: T,
    user: any,
    options: {
      unitField?: string;
      districtField?: string;
      forceFilters?: boolean;
    } = {},
  ): T {
    const {
      unitField = 'assignedUnit',
      districtField = 'assignedDistrict',
      forceFilters = false,
    } = options;

    const filters = this.getListAccessFilters(user);

    // Only apply filters if user doesn't have admin access or if forced
    if (
      forceFilters ||
      (!user.systemRoles?.includes(UserRole.SUPER_ADMIN) &&
        !user.systemRoles?.includes(UserRole.ADMIN))
    ) {
      if (filters.districtId) {
        (query as any)[districtField] = filters.districtId;
      } else if (filters.unitId) {
        (query as any)[unitField] = filters.unitId;
      }
    }

    return query;
  }

  /**
   * Validate transfer permissions for inventory movements
   */
  validateTransferPermissions(
    user: any,
    fromUnit?: string,
    fromDistrict?: string,
    toUnit?: string,
    toDistrict?: string,
  ): PermissionResult {
    // Super admin can transfer anywhere
    if (user.systemRoles?.includes(UserRole.SUPER_ADMIN)) {
      return { hasAccess: true };
    }

    // Admin can transfer within their scope
    if (user.systemRoles?.includes(UserRole.ADMIN)) {
      return { hasAccess: true };
    }

    // Pastor can transfer - specific district restrictions now handled by RoleAssignment
    if (user.systemRoles?.includes(UserRole.PASTOR)) {
      return { hasAccess: true };
    }

    // Unit leaders can only transfer from their unit
    if (user.unit) {
      const userUnit = user.unit.toString();

      if (fromUnit && fromUnit !== userUnit) {
        return {
          hasAccess: false,
          reason: 'Can only transfer from your own unit',
        };
      }

      return { hasAccess: true };
    }

    return {
      hasAccess: false,
      reason: 'Insufficient permissions for transfer operation',
    };
  }
}
