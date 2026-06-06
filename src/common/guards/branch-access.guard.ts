import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BranchAccessService, AccessScope } from '../services/branch-access.service';

/**
 * Decorator to specify required access scope for a route
 */
export const REQUIRED_SCOPE_KEY = 'requiredScope';
export const RequireScope = (...scopes: AccessScope[]) =>
  SetMetadata(REQUIRED_SCOPE_KEY, scopes);

/**
 * Decorator to specify that route requires branch context
 */
export const BRANCH_CONTEXT_KEY = 'branchContext';
export const RequireBranchContext = () => SetMetadata(BRANCH_CONTEXT_KEY, true);

/**
 * Decorator to skip branch access check (for public or global routes)
 */
export const SKIP_BRANCH_ACCESS_KEY = 'skipBranchAccess';
export const SkipBranchAccess = () => SetMetadata(SKIP_BRANCH_ACCESS_KEY, true);

@Injectable()
export class BranchAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private branchAccessService: BranchAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if branch access check should be skipped
    const skipBranchAccess = this.reflector.getAllAndOverride<boolean>(
      SKIP_BRANCH_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipBranchAccess) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user, let the auth guard handle it
    if (!user) {
      return true;
    }

    // Get required scopes from decorator
    const requiredScopes = this.reflector.getAllAndOverride<AccessScope[]>(
      REQUIRED_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Get user's access scope
    const userScope = this.branchAccessService.getUserAccessScope(user);

    // If required scopes are specified, check if user has one of them
    if (requiredScopes && requiredScopes.length > 0) {
      const scopeHierarchy = {
        [AccessScope.GLOBAL]: 5,
        [AccessScope.BRANCH]: 4,
        [AccessScope.DISTRICT]: 3,
        [AccessScope.UNIT]: 2,
        [AccessScope.SELF]: 1,
      };

      const userScopeLevel = scopeHierarchy[userScope];
      const hasRequiredScope = requiredScopes.some(
        (scope) => userScopeLevel >= scopeHierarchy[scope],
      );

      if (!hasRequiredScope) {
        throw new ForbiddenException(
          `Insufficient access scope. Required: ${requiredScopes.join(' or ')}. Your scope: ${userScope}`,
        );
      }
    }

    // Check if branch context is required
    const requireBranchContext = this.reflector.getAllAndOverride<boolean>(
      BRANCH_CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requireBranchContext) {
      // Extract branch from request (could be from params, query, or body)
      const branchId =
        request.params?.branchId ||
        request.query?.branchId ||
        request.body?.branchId ||
        request.body?.branch;

      if (branchId) {
        // Check if user can access this branch
        const accessResult = this.branchAccessService.canAccessResource(user, {
          branchId,
        });

        if (!accessResult.hasAccess) {
          throw new ForbiddenException(
            accessResult.reason || 'Access denied to this campus',
          );
        }
      }
    }

    // Check district context if provided in request
    const districtId =
      request.params?.districtId ||
      request.query?.districtId ||
      request.body?.districtId ||
      request.body?.district;

    if (districtId) {
      const branchId =
        request.params?.branchId ||
        request.query?.branchId ||
        request.body?.branchId ||
        request.body?.branch;

      const accessResult = this.branchAccessService.canAccessResource(user, {
        branchId,
        districtId,
      });

      if (!accessResult.hasAccess) {
        throw new ForbiddenException(
          accessResult.reason || 'Access denied to this district',
        );
      }
    }

    // Attach access filters to request for use in controllers/services
    request.accessFilters = this.branchAccessService.getAccessFilters(user);
    request.accessScope = userScope;

    return true;
  }
}

/**
 * Helper guard specifically for invitation routes
 */
@Injectable()
export class InvitationAccessGuard implements CanActivate {
  constructor(private branchAccessService: BranchAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Let auth guard handle this
    }

    // For invitation creation, check if user can invite to the target branch/district
    if (request.method === 'POST' && request.body) {
      const { branchId, districtId, branch, district } = request.body;
      const targetBranch = branchId || branch;
      const targetDistrict = districtId || district;

      const canInvite = this.branchAccessService.canInviteUser(user, {
        branchId: targetBranch,
        districtId: targetDistrict,
      });

      if (!canInvite.hasAccess) {
        throw new ForbiddenException(
          canInvite.reason || 'You do not have permission to invite users',
        );
      }

      // Attach allowed filters for the controller to use
      request.invitationFilters = canInvite.filters;
    }

    return true;
  }
}
