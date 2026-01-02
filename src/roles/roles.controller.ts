import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RolesService } from './services/roles.service';
import { ModulePermissionsService } from './services/module-permissions.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermission } from './decorators/require-permission.decorator';
import { RolesModulePermission } from './permissions';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly modulePermissionsService: ModulePermissionsService,
  ) {}

  @Post()
  @RequirePermission(RolesModulePermission.CREATE_ROLE)
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.SYSTEM,
    description: 'Created a new role',
    severity: 'high',
    getEntityId: (result) => result._id.toString(),
  })
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Get('available-modules')
  @ApiOperation({ summary: 'Get all available modules for role assignment' })
  @ApiResponse({
    status: 200,
    description: 'List of available modules with their display names',
  })
  @RequirePermission(RolesModulePermission.VIEW_ROLES)
  getAvailableModules() {
    return {
      modules: this.modulePermissionsService.getAllModulesWithDisplayNames(),
    };
  }

  @Get()
  @RequirePermission(RolesModulePermission.VIEW_ROLES)
  findAll(
    @Query('isActive') isActive?: string,
    @Query('isSystemRole') isSystemRole?: string,
  ) {
    const filters: any = {};
    if (isActive) filters.isActive = isActive === 'true';
    if (isSystemRole) filters.isSystemRole = isSystemRole === 'true';

    return this.rolesService.findAll(filters);
  }

  @Get(':id')
  @RequirePermission(RolesModulePermission.VIEW_ROLE_DETAILS)
  async findOne(@Param('id') id: string) {
    const role = await this.rolesService.findById(id, true);
    return role;
  }

  @Get(':id/permissions')
  @RequirePermission(RolesModulePermission.VIEW_ROLE_DETAILS)
  getRolePermissions(@Param('id') id: string) {
    return this.rolesService.getRolePermissions(id);
  }

  @Patch(':id')
  @RequirePermission(RolesModulePermission.UPDATE_ROLE)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.SYSTEM,
    description: 'Updated role information',
    severity: 'high',
    getEntityId: (result, request) => request.params.id,
  })
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Post(':id/permissions/assign')
  @RequirePermission(RolesModulePermission.ASSIGN_PERMISSIONS_TO_ROLE)
  assignPermissions(
    @Param('id') id: string,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ) {
    return this.rolesService.assignPermissions(id, assignPermissionsDto);
  }

  @Post(':id/permissions/add')
  @RequirePermission(RolesModulePermission.ASSIGN_PERMISSIONS_TO_ROLE)
  addPermissions(
    @Param('id') id: string,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ) {
    return this.rolesService.addPermissions(id, assignPermissionsDto);
  }

  @Post(':id/permissions/remove')
  @RequirePermission(RolesModulePermission.ASSIGN_PERMISSIONS_TO_ROLE)
  removePermissions(
    @Param('id') id: string,
    @Body() body: { permissionIds: string[] },
  ) {
    return this.rolesService.removePermissions(id, body.permissionIds);
  }

  @Delete(':id')
  @RequirePermission(RolesModulePermission.DELETE_ROLE)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.SYSTEM,
    description: 'Deleted a role',
    severity: 'critical',
    getEntityId: (result, request) => request.params.id,
  })
  remove(@Param('id') id: string) {
    return this.rolesService.delete(id);
  }
}
