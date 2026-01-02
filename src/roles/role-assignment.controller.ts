import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RoleAssignmentService } from './services/role-assignment.service';
import {
  CreateRoleAssignmentDto,
  UpdateRoleAssignmentDto,
  RoleAssignmentQueryDto,
  BulkRoleAssignmentDto,
} from './dto/role-assignment.dto';
import { ScopeType } from './schemas/role-assignment.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermission } from './decorators/require-permission.decorator';
import { RolesModulePermission } from './permissions';
import { ResponseUtil } from '../common/utils/response.util';

@ApiTags('Role Assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('role-assignments')
export class RoleAssignmentController {
  constructor(
    private readonly roleAssignmentService: RoleAssignmentService,
  ) {}

  @Post()
  @RequirePermission(RolesModulePermission.CREATE_ROLE_ASSIGNMENT)
  @ApiOperation({ summary: 'Create a new role assignment' })
  @ApiResponse({
    status: 201,
    description: 'Role assignment created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 409,
    description: 'Assignment already exists',
  })
  async create(
    @Body() createDto: CreateRoleAssignmentDto,
    @Request() req,
  ) {
    const assignment = await this.roleAssignmentService.create(
      createDto,
      req.user?.sub || req.user?._id,
    );
    return ResponseUtil.success(
      assignment,
      'Role assignment created successfully',
    );
  }

  @Post('bulk')
  @RequirePermission(RolesModulePermission.BULK_ASSIGN_ROLES)
  @ApiOperation({ summary: 'Bulk assign a role to multiple members' })
  @ApiResponse({
    status: 201,
    description: 'Bulk assignment completed',
  })
  async bulkAssign(
    @Body() bulkDto: BulkRoleAssignmentDto,
    @Request() req,
  ) {
    const result = await this.roleAssignmentService.bulkAssign(
      bulkDto,
      req.user?.sub || req.user?._id,
    );
    return ResponseUtil.success(
      result,
      `Bulk assignment completed: ${result.success} successful, ${result.failed} failed`,
    );
  }

  @Get()
  @RequirePermission(RolesModulePermission.VIEW_ROLE_ASSIGNMENTS)
  @ApiOperation({ summary: 'Get all role assignments with optional filters' })
  @ApiQuery({ name: 'memberId', required: false })
  @ApiQuery({ name: 'roleId', required: false })
  @ApiQuery({ name: 'scopeType', required: false, enum: ScopeType })
  @ApiQuery({ name: 'scopeId', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isPrimary', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Role assignments retrieved successfully',
  })
  async findAll(@Query() queryDto: RoleAssignmentQueryDto) {
    const assignments = await this.roleAssignmentService.findAll(queryDto);
    return ResponseUtil.success(
      assignments,
      'Role assignments retrieved successfully',
    );
  }

  @Get('member/:memberId')
  @RequirePermission(RolesModulePermission.VIEW_MEMBER_ASSIGNMENTS)
  @ApiOperation({ summary: 'Get all role assignments for a specific member' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Member assignments retrieved successfully',
  })
  async getMemberAssignments(
    @Param('memberId') memberId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const assignments = await this.roleAssignmentService.getMemberAssignments(
      memberId,
      activeOnly !== 'false',
    );
    return ResponseUtil.success(
      assignments,
      'Member assignments retrieved successfully',
    );
  }

  @Get('member/:memberId/primary')
  @RequirePermission(RolesModulePermission.VIEW_MEMBER_ASSIGNMENTS)
  @ApiOperation({ summary: 'Get the primary role assignment for a member' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({
    status: 200,
    description: 'Primary assignment retrieved successfully',
  })
  async getMemberPrimaryAssignment(@Param('memberId') memberId: string) {
    const assignment =
      await this.roleAssignmentService.getMemberPrimaryAssignment(memberId);
    return ResponseUtil.success(
      assignment,
      'Primary assignment retrieved successfully',
    );
  }

  @Get('member/:memberId/access-filter')
  @RequirePermission(RolesModulePermission.VIEW_MEMBER_ASSIGNMENTS)
  @ApiOperation({
    summary: 'Get access filter for a member (for data filtering)',
  })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({
    status: 200,
    description: 'Access filter retrieved successfully',
  })
  async getMemberAccessFilter(@Param('memberId') memberId: string) {
    const filter =
      await this.roleAssignmentService.getMemberAccessFilter(memberId);
    return ResponseUtil.success(
      filter,
      'Access filter retrieved successfully',
    );
  }

  @Get('scope/:scopeType/:scopeId')
  @RequirePermission(RolesModulePermission.VIEW_SCOPE_ASSIGNMENTS)
  @ApiOperation({ summary: 'Get all members with access to a specific scope' })
  @ApiParam({ name: 'scopeType', enum: ScopeType })
  @ApiParam({ name: 'scopeId', description: 'Scope entity ID' })
  @ApiResponse({
    status: 200,
    description: 'Scope assignments retrieved successfully',
  })
  async getScopeAssignments(
    @Param('scopeType') scopeType: ScopeType,
    @Param('scopeId') scopeId: string,
  ) {
    const assignments =
      await this.roleAssignmentService.getMembersWithScopeAccess(
        scopeType,
        scopeId,
      );
    return ResponseUtil.success(
      assignments,
      'Scope assignments retrieved successfully',
    );
  }

  @Get('role/:roleId')
  @RequirePermission(RolesModulePermission.VIEW_ROLE_ASSIGNMENTS)
  @ApiOperation({ summary: 'Get all members with a specific role' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiQuery({ name: 'scopeType', required: false, enum: ScopeType })
  @ApiQuery({ name: 'scopeId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Role members retrieved successfully',
  })
  async getMembersWithRole(
    @Param('roleId') roleId: string,
    @Query('scopeType') scopeType?: ScopeType,
    @Query('scopeId') scopeId?: string,
  ) {
    const assignments = await this.roleAssignmentService.getMembersWithRole(
      roleId,
      scopeType,
      scopeId,
    );
    return ResponseUtil.success(
      assignments,
      'Role members retrieved successfully',
    );
  }

  @Get(':id')
  @RequirePermission(RolesModulePermission.VIEW_ROLE_ASSIGNMENTS)
  @ApiOperation({ summary: 'Get a specific role assignment by ID' })
  @ApiParam({ name: 'id', description: 'Role assignment ID' })
  @ApiResponse({
    status: 200,
    description: 'Role assignment retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Role assignment not found',
  })
  async findOne(@Param('id') id: string) {
    const assignment = await this.roleAssignmentService.findById(id);
    return ResponseUtil.success(
      assignment,
      'Role assignment retrieved successfully',
    );
  }

  @Patch(':id')
  @RequirePermission(RolesModulePermission.UPDATE_ROLE_ASSIGNMENT)
  @ApiOperation({ summary: 'Update a role assignment' })
  @ApiParam({ name: 'id', description: 'Role assignment ID' })
  @ApiResponse({
    status: 200,
    description: 'Role assignment updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Role assignment not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateRoleAssignmentDto,
  ) {
    const assignment = await this.roleAssignmentService.update(id, updateDto);
    return ResponseUtil.success(
      assignment,
      'Role assignment updated successfully',
    );
  }

  @Delete(':id')
  @RequirePermission(RolesModulePermission.DELETE_ROLE_ASSIGNMENT)
  @ApiOperation({ summary: 'Deactivate a role assignment' })
  @ApiParam({ name: 'id', description: 'Role assignment ID' })
  @ApiResponse({
    status: 200,
    description: 'Role assignment deactivated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Role assignment not found',
  })
  async deactivate(@Param('id') id: string, @Request() req) {
    const assignment = await this.roleAssignmentService.deactivate(
      id,
      req.user?.sub || req.user?._id,
    );
    return ResponseUtil.success(
      assignment,
      'Role assignment deactivated successfully',
    );
  }

  @Delete(':id/permanent')
  @RequirePermission(RolesModulePermission.DELETE_ROLE_ASSIGNMENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a role assignment' })
  @ApiParam({ name: 'id', description: 'Role assignment ID' })
  @ApiResponse({
    status: 204,
    description: 'Role assignment deleted permanently',
  })
  @ApiResponse({
    status: 404,
    description: 'Role assignment not found',
  })
  async delete(@Param('id') id: string) {
    await this.roleAssignmentService.delete(id);
  }

  @Get('check/:memberId/:scopeType/:scopeId')
  @RequirePermission(RolesModulePermission.VIEW_MEMBER_ASSIGNMENTS)
  @ApiOperation({ summary: 'Check if a member has access to a specific scope' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiParam({ name: 'scopeType', enum: ScopeType })
  @ApiParam({ name: 'scopeId', description: 'Scope entity ID' })
  @ApiResponse({
    status: 200,
    description: 'Access check completed',
  })
  async checkAccess(
    @Param('memberId') memberId: string,
    @Param('scopeType') scopeType: ScopeType,
    @Param('scopeId') scopeId: string,
  ) {
    const hasAccess = await this.roleAssignmentService.memberHasScopeAccess(
      memberId,
      scopeType,
      scopeId,
    );
    return ResponseUtil.success(
      { hasAccess },
      hasAccess ? 'Member has access' : 'Member does not have access',
    );
  }
}
