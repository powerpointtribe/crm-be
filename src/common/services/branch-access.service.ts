import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  UserRole,
  GLOBAL_ACCESS_ROLES,
  BRANCH_SCOPED_ROLES,
  DISTRICT_SCOPED_ROLES,
} from '../enums/user-roles.enums';

/**
 * Permission required to view all branches and switch between them
 */
export const VIEW_ALL_BRANCHES_PERMISSION = 'branches:view-all';

/**
 * Branch filter context for permission-based filtering
 */
export interface BranchFilterContext {
  userPermissions: string[];
  userBranchId?: string | Types.ObjectId;
  selectedBranchId?: string; // From query param (only used if user has view-all permission)
}

/**
 * Result of branch filter calculation
 */
export interface BranchFilterResult {
  shouldFilter: boolean;
  branchId?: Types.ObjectId;
  canViewAll: boolean;
}

/**
 * Access scope levels for RBAC
 */
export enum AccessScope {
  GLOBAL = 'global', // Senior Pastor, Admin, Super Admin
  BRANCH = 'branch', // Branch Pastor
  DISTRICT = 'district', // Assistant Pastor, District Pastor
  UNIT = 'unit', // Unit Head
  SELF = 'self', // Regular member - only their own data
}

/**
 * Result of access control check
 */
export interface BranchAccessResult {
  hasAccess: boolean;
  scope: AccessScope;
  filters: {
    branchId?: string | Types.ObjectId;
    districtIds?: (string | Types.ObjectId)[];
    districtId?: string | Types.ObjectId;
    unitId?: string | Types.ObjectId;
    memberId?: string | Types.ObjectId;
  };
  reason?: string;
}

/**
 * User context for access control
 */
export interface UserAccessContext {
  _id: string | Types.ObjectId;
  systemRoles?: UserRole[];
  membershipStatus?: string;
  branch?: string | Types.ObjectId;
  district?: string | Types.ObjectId;
  unit?: string | Types.ObjectId;
  assignedDistricts?: (string | Types.ObjectId)[];
}

@Injectable()
export class BranchAccessService {
  /**
   * Determine the access scope for a user
   */
  getUserAccessScope(user: UserAccessContext): AccessScope {
    if (!user || !user.systemRoles) {
      return AccessScope.SELF;
    }

    // Check for global access roles (Senior Pastor, Admin, Super Admin)
    if (user.systemRoles.some((role) => GLOBAL_ACCESS_ROLES.includes(role))) {
      return AccessScope.GLOBAL;
    }

    // Check for branch-scoped roles (Branch Pastor)
    if (user.systemRoles.some((role) => BRANCH_SCOPED_ROLES.includes(role))) {
      return AccessScope.BRANCH;
    }

    // Check for district-scoped roles (Assistant Pastor)
    if (user.systemRoles.some((role) => DISTRICT_SCOPED_ROLES.includes(role))) {
      return AccessScope.DISTRICT;
    }

    // Check membership status for leadership levels
    if (user.membershipStatus === 'PASTOR' || user.membershipStatus === 'DIRECTOR') {
      return AccessScope.DISTRICT;
    }

    // If user has a unit assignment, they have unit scope
    if (user.unit) {
      return AccessScope.UNIT;
    }

    return AccessScope.SELF;
  }

  /**
   * Get access filters for querying data based on user's role and assignments
   */
  getAccessFilters(user: UserAccessContext): BranchAccessResult {
    const scope = this.getUserAccessScope(user);

    switch (scope) {
      case AccessScope.GLOBAL:
        return {
          hasAccess: true,
          scope: AccessScope.GLOBAL,
          filters: {},
        };

      case AccessScope.BRANCH:
        if (!user.branch) {
          return {
            hasAccess: false,
            scope: AccessScope.BRANCH,
            filters: {},
            reason: 'Campus Pastor has no campus assignment',
          };
        }
        return {
          hasAccess: true,
          scope: AccessScope.BRANCH,
          filters: {
            branchId: user.branch,
          },
        };

      case AccessScope.DISTRICT:
        if (!user.branch) {
          return {
            hasAccess: false,
            scope: AccessScope.DISTRICT,
            filters: {},
            reason: 'User has no campus assignment',
          };
        }

        // Assistant Pastors can have multiple assigned districts
        if (user.assignedDistricts && user.assignedDistricts.length > 0) {
          return {
            hasAccess: true,
            scope: AccessScope.DISTRICT,
            filters: {
              branchId: user.branch,
              districtIds: user.assignedDistricts,
            },
          };
        }

        // Fall back to user's own district
        if (user.district) {
          return {
            hasAccess: true,
            scope: AccessScope.DISTRICT,
            filters: {
              branchId: user.branch,
              districtId: user.district,
            },
          };
        }

        return {
          hasAccess: false,
          scope: AccessScope.DISTRICT,
          filters: { branchId: user.branch },
          reason: 'No district assignment for district-scoped role',
        };

      case AccessScope.UNIT:
        if (!user.unit) {
          return {
            hasAccess: false,
            scope: AccessScope.UNIT,
            filters: {},
            reason: 'User has no unit assignment',
          };
        }
        return {
          hasAccess: true,
          scope: AccessScope.UNIT,
          filters: {
            branchId: user.branch,
            unitId: user.unit,
          },
        };

      case AccessScope.SELF:
      default:
        return {
          hasAccess: true,
          scope: AccessScope.SELF,
          filters: {
            memberId: user._id,
          },
        };
    }
  }

  /**
   * Check if user can access a specific resource
   */
  canAccessResource(
    user: UserAccessContext,
    resource: {
      branchId?: string | Types.ObjectId;
      districtId?: string | Types.ObjectId;
      unitId?: string | Types.ObjectId;
      ownerId?: string | Types.ObjectId;
    },
  ): BranchAccessResult {
    const accessResult = this.getAccessFilters(user);

    if (!accessResult.hasAccess) {
      return accessResult;
    }

    switch (accessResult.scope) {
      case AccessScope.GLOBAL:
        return { ...accessResult, hasAccess: true };

      case AccessScope.BRANCH:
        if (
          resource.branchId &&
          accessResult.filters.branchId?.toString() !==
            resource.branchId?.toString()
        ) {
          return {
            ...accessResult,
            hasAccess: false,
            reason: 'Resource belongs to a different campus',
          };
        }
        return { ...accessResult, hasAccess: true };

      case AccessScope.DISTRICT:
        // Check branch first
        if (
          resource.branchId &&
          accessResult.filters.branchId?.toString() !==
            resource.branchId?.toString()
        ) {
          return {
            ...accessResult,
            hasAccess: false,
            reason: 'Resource belongs to a different campus',
          };
        }

        // Check district
        if (resource.districtId) {
          if (accessResult.filters.districtIds) {
            const hasDistrictAccess = accessResult.filters.districtIds.some(
              (id) => id.toString() === resource.districtId?.toString(),
            );
            if (!hasDistrictAccess) {
              return {
                ...accessResult,
                hasAccess: false,
                reason: 'Resource belongs to a district not assigned to user',
              };
            }
          } else if (
            accessResult.filters.districtId &&
            accessResult.filters.districtId?.toString() !==
              resource.districtId?.toString()
          ) {
            return {
              ...accessResult,
              hasAccess: false,
              reason: 'Resource belongs to a different district',
            };
          }
        }
        return { ...accessResult, hasAccess: true };

      case AccessScope.UNIT:
        if (
          resource.unitId &&
          accessResult.filters.unitId?.toString() !== resource.unitId?.toString()
        ) {
          return {
            ...accessResult,
            hasAccess: false,
            reason: 'Resource belongs to a different unit',
          };
        }
        return { ...accessResult, hasAccess: true };

      case AccessScope.SELF:
        if (
          resource.ownerId &&
          accessResult.filters.memberId?.toString() !==
            resource.ownerId?.toString()
        ) {
          return {
            ...accessResult,
            hasAccess: false,
            reason: 'Resource belongs to another member',
          };
        }
        return { ...accessResult, hasAccess: true };

      default:
        return {
          ...accessResult,
          hasAccess: false,
          reason: 'Unknown access scope',
        };
    }
  }

  /**
   * Build MongoDB query filters based on user's access scope
   */
  buildQueryFilters(
    user: UserAccessContext,
    options: {
      branchField?: string;
      districtField?: string;
      unitField?: string;
      ownerField?: string;
    } = {},
  ): Record<string, any> {
    const {
      branchField = 'branch',
      districtField = 'district',
      unitField = 'unit',
      ownerField = 'createdBy',
    } = options;

    const accessResult = this.getAccessFilters(user);

    if (!accessResult.hasAccess) {
      // Return a filter that matches nothing
      return { _id: { $exists: false } };
    }

    const filters: Record<string, any> = {};

    switch (accessResult.scope) {
      case AccessScope.GLOBAL:
        // No filters - can see everything
        break;

      case AccessScope.BRANCH:
        if (accessResult.filters.branchId) {
          filters[branchField] = new Types.ObjectId(
            accessResult.filters.branchId.toString(),
          );
        }
        break;

      case AccessScope.DISTRICT:
        if (accessResult.filters.branchId) {
          filters[branchField] = new Types.ObjectId(
            accessResult.filters.branchId.toString(),
          );
        }
        if (accessResult.filters.districtIds) {
          filters[districtField] = {
            $in: accessResult.filters.districtIds.map(
              (id) => new Types.ObjectId(id.toString()),
            ),
          };
        } else if (accessResult.filters.districtId) {
          filters[districtField] = new Types.ObjectId(
            accessResult.filters.districtId.toString(),
          );
        }
        break;

      case AccessScope.UNIT:
        if (accessResult.filters.branchId) {
          filters[branchField] = new Types.ObjectId(
            accessResult.filters.branchId.toString(),
          );
        }
        if (accessResult.filters.unitId) {
          filters[unitField] = new Types.ObjectId(
            accessResult.filters.unitId.toString(),
          );
        }
        break;

      case AccessScope.SELF:
        if (accessResult.filters.memberId) {
          filters[ownerField] = new Types.ObjectId(
            accessResult.filters.memberId.toString(),
          );
        }
        break;
    }

    return filters;
  }

  /**
   * Check if user can invite other users (branch-scoped for Branch Pastors)
   */
  canInviteUser(
    inviter: UserAccessContext,
    inviteeData: {
      branchId?: string | Types.ObjectId;
      districtId?: string | Types.ObjectId;
    },
  ): BranchAccessResult {
    const scope = this.getUserAccessScope(inviter);

    switch (scope) {
      case AccessScope.GLOBAL:
        // Senior Pastor, Admin, Super Admin can invite anyone
        return {
          hasAccess: true,
          scope,
          filters: {},
        };

      case AccessScope.BRANCH:
        // Branch Pastor can only invite within their branch
        if (!inviter.branch) {
          return {
            hasAccess: false,
            scope,
            filters: {},
            reason: 'Inviter has no campus assignment',
          };
        }
        if (
          inviteeData.branchId &&
          inviter.branch.toString() !== inviteeData.branchId.toString()
        ) {
          return {
            hasAccess: false,
            scope,
            filters: { branchId: inviter.branch },
            reason: 'Cannot invite users to a different campus',
          };
        }
        return {
          hasAccess: true,
          scope,
          filters: { branchId: inviter.branch },
        };

      case AccessScope.DISTRICT:
        // Assistant Pastor can invite within their assigned districts
        if (!inviter.branch) {
          return {
            hasAccess: false,
            scope,
            filters: {},
            reason: 'Inviter has no campus assignment',
          };
        }
        if (
          inviteeData.branchId &&
          inviter.branch.toString() !== inviteeData.branchId.toString()
        ) {
          return {
            hasAccess: false,
            scope,
            filters: {},
            reason: 'Cannot invite users to a different campus',
          };
        }

        // Check district assignment
        if (inviteeData.districtId) {
          const hasDistrictAccess =
            inviter.assignedDistricts?.some(
              (d) => d.toString() === inviteeData.districtId?.toString(),
            ) ||
            inviter.district?.toString() === inviteeData.districtId.toString();

          if (!hasDistrictAccess) {
            return {
              hasAccess: false,
              scope,
              filters: {},
              reason: 'Cannot invite users to a district not assigned to you',
            };
          }
        }

        return {
          hasAccess: true,
          scope,
          filters: {
            branchId: inviter.branch,
            districtIds: inviter.assignedDistricts,
          },
        };

      default:
        return {
          hasAccess: false,
          scope,
          filters: {},
          reason: 'Insufficient permissions to invite users',
        };
    }
  }

  /**
   * Get branches accessible to user
   */
  getAccessibleBranches(user: UserAccessContext): {
    allBranches: boolean;
    branchIds: (string | Types.ObjectId)[];
  } {
    const scope = this.getUserAccessScope(user);

    if (scope === AccessScope.GLOBAL) {
      return { allBranches: true, branchIds: [] };
    }

    if (user.branch) {
      return { allBranches: false, branchIds: [user.branch] };
    }

    return { allBranches: false, branchIds: [] };
  }

  /**
   * Get districts accessible to user within a branch
   */
  getAccessibleDistricts(user: UserAccessContext): {
    allDistricts: boolean;
    districtIds: (string | Types.ObjectId)[];
  } {
    const scope = this.getUserAccessScope(user);

    if (scope === AccessScope.GLOBAL || scope === AccessScope.BRANCH) {
      return { allDistricts: true, districtIds: [] };
    }

    if (scope === AccessScope.DISTRICT) {
      if (user.assignedDistricts && user.assignedDistricts.length > 0) {
        return { allDistricts: false, districtIds: user.assignedDistricts };
      }
      if (user.district) {
        return { allDistricts: false, districtIds: [user.district] };
      }
    }

    return { allDistricts: false, districtIds: [] };
  }

  // =====================================================
  // PERMISSION-BASED BRANCH FILTERING (NEW APPROACH)
  // =====================================================

  /**
   * Calculate branch filter based on user's permissions
   * - Users with 'branches:view-all' permission can see all data or filter by selected branch
   * - Users without the permission are automatically filtered by their assigned branch
   */
  getBranchFilter(context: BranchFilterContext): BranchFilterResult {
    const { userPermissions, userBranchId, selectedBranchId } = context;

    // Check if user has the view-all-branches permission
    const canViewAll = userPermissions.includes(VIEW_ALL_BRANCHES_PERMISSION);

    if (canViewAll) {
      // User can view all branches
      if (selectedBranchId) {
        // User selected a specific branch to filter by
        return {
          shouldFilter: true,
          branchId: new Types.ObjectId(selectedBranchId),
          canViewAll: true,
        };
      }
      // No branch selected - show all data
      return {
        shouldFilter: false,
        canViewAll: true,
      };
    }

    // User doesn't have view-all permission - filter by their assigned branch
    if (userBranchId) {
      return {
        shouldFilter: true,
        branchId:
          typeof userBranchId === 'string'
            ? new Types.ObjectId(userBranchId)
            : userBranchId,
        canViewAll: false,
      };
    }

    // User has no branch assigned - this shouldn't happen but handle gracefully
    // Return a filter that matches nothing
    return {
      shouldFilter: true,
      branchId: new Types.ObjectId('000000000000000000000000'), // Invalid ID
      canViewAll: false,
    };
  }

  /**
   * Apply branch filter to a MongoDB query filter object
   * Returns the modified filter with branch condition added
   * Handles both ObjectId and string branch references for compatibility
   */
  applyBranchFilter<T extends Record<string, any>>(
    filter: T,
    context: BranchFilterContext,
    branchField: string = 'branch',
  ): T {
    const branchFilter = this.getBranchFilter(context);

    if (branchFilter.shouldFilter && branchFilter.branchId) {
      const branchIdString = branchFilter.branchId.toString();
      // Match both ObjectId and string representations for compatibility
      // Some documents may have branch stored as string, others as ObjectId
      return {
        ...filter,
        [branchField]: {
          $in: [branchFilter.branchId, branchIdString],
        },
      };
    }

    return filter;
  }

  /**
   * Check if a user has the view-all-branches permission
   */
  hasViewAllBranchesPermission(userPermissions: string[]): boolean {
    return userPermissions.includes(VIEW_ALL_BRANCHES_PERMISSION);
  }
}
