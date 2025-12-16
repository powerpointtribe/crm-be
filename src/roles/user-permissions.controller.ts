import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { UserPermissionsService } from './services/user-permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controller for user permissions
 * Used by frontend to determine what UI elements to show
 */
@Controller('user-permissions')
@UseGuards(JwtAuthGuard)
export class UserPermissionsController {
  constructor(
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  /**
   * Get current user's permissions
   * Frontend calls this to know what the user can access
   */
  @Get('me')
  async getMyPermissions(@Request() req) {
    return this.userPermissionsService.getUserPermissions(req.user.role);
  }

  /**
   * Get accessible modules for current user
   */
  @Get('me/modules')
  async getMyAccessibleModules(@Request() req) {
    const modules = await this.userPermissionsService.getAccessibleModules(
      req.user.role,
    );
    return { modules };
  }

  /**
   * Check if current user has specific permission
   */
  @Get('me/check/:permission')
  async checkMyPermission(@Request() req, @Request() params: any) {
    const hasPermission = await this.userPermissionsService.hasPermission(
      req.user.role,
      params.permission,
    );
    return { hasPermission };
  }
}
