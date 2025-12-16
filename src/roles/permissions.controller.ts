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
} from '@nestjs/common';
import { PermissionsService } from './services/permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermission } from './decorators/require-permission.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RolesModulePermission } from './permissions';

@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @RequirePermission(RolesModulePermission.CREATE_PERMISSION)
  create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.create(createPermissionDto);
  }

  @Get()
  @RequirePermission(RolesModulePermission.VIEW_PERMISSIONS)
  findAll(
    @Query('module') module?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('isActive') isActive?: string,
    @Query('isPublic') isPublic?: string,
  ) {
    const filters: any = {};
    if (module) filters.module = module;
    if (resource) filters.resource = resource;
    if (action) filters.action = action;
    if (isActive) filters.isActive = isActive === 'true';
    if (isPublic) filters.isPublic = isPublic === 'true';

    return this.permissionsService.findAll(filters);
  }

  @Get('by-module')
  @RequirePermission(RolesModulePermission.VIEW_PERMISSIONS)
  getPermissionsByModule() {
    return this.permissionsService.getPermissionsByModule();
  }

  @Get('public')
  @Public()
  getPublicEndpoints() {
    return this.permissionsService.getPublicEndpoints();
  }

  @Get(':id')
  @RequirePermission(RolesModulePermission.VIEW_PERMISSION_DETAILS)
  findOne(@Param('id') id: string) {
    return this.permissionsService.findById(id);
  }

  @Patch(':id')
  @RequirePermission(RolesModulePermission.UPDATE_PERMISSION)
  update(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(id, updatePermissionDto);
  }

  @Delete(':id')
  @RequirePermission(RolesModulePermission.DELETE_PERMISSION)
  remove(@Param('id') id: string) {
    return this.permissionsService.delete(id);
  }
}
