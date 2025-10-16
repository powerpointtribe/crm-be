import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RESOURCE_ACCESS_KEY,
  ResourceAccessConfig,
} from '../../common/decorators/resource-access.decorator';
import { UserRole } from '../../common/enums/user-roles.enums';

@Injectable()
export class ResourceAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resourceConfig =
      this.reflector.getAllAndOverride<ResourceAccessConfig>(
        RESOURCE_ACCESS_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!resourceConfig) {
      return true; // No resource restrictions
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const params = request.params;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super admins and pastors have access to everything
    if ([UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL].includes(user.roles)) {
      return true;
    }

    return this.checkResourceAccess(user, resourceConfig, params);
  }

  private async checkResourceAccess(
    user: any,
    config: ResourceAccessConfig,
    params: any,
  ): Promise<boolean> {
    const { resource, operation, allowSelfAccess } = config;

    switch (user.roles) {
      case UserRole.LXL:
        // For now, allow GROUP_LEADER access - we'll implement detailed checks in the controller
        return true;

      case UserRole.MEMBER:
        return this.checkMemberAccess(user, resource, params, allowSelfAccess);

      default:
        return false;
    }
  }

  private checkFollowUpTeamAccess(
    resource: string,
    operation: string,
  ): boolean {
    // Follow-up team can read all members but only write to first-timers and basic member info
    if (resource === 'member' && operation === 'read') return true;
    if (resource === 'member' && operation === 'write') return true; // Limited write access
    return false;
  }

  private async checkMemberAccess(
    user: any,
    resource: string,
    params: any,
    allowSelfAccess?: boolean,
  ): Promise<boolean> {
    if (!allowSelfAccess) return false;

    // For now, we'll implement a simple check
    // In a full implementation, you'd need to link User and Member records properly
    if (resource === 'member' && params.id) {
      // This is a simplified check - you may need to implement proper user-member linking
      return true; // Allow for now, implement detailed check later
    }

    return false;
  }
}
