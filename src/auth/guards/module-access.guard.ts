import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_ACCESS_KEY } from '../../common/decorators/roles.decorator';
import { DashboardModule } from '../../common/enums/dashboard-modules.enums';
import { AccessControlService } from '../../common/services/access-control.service';

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private accessControlService: AccessControlService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredModule = this.reflector.getAllAndOverride<DashboardModule>(
      MODULE_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModule) {
      return true; // No module restriction
    }

    const { user: member } = context.switchToHttp().getRequest();

    if (!member) {
      throw new ForbiddenException('Authentication required');
    }

    const hasAccess = this.accessControlService.canAccessModule(
      member,
      requiredModule,
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        `Access denied: You don't have permission to access the ${requiredModule} module`,
      );
    }

    return true;
  }
}
