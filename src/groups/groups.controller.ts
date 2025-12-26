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
  HttpCode,
  HttpStatus,
  ForbiddenException,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupSearchDto } from './dto/group-search.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { GroupsPermission } from './permissions';
import { GroupType } from '../common/enums/group-types.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { BranchFilterContext } from '../common/services/branch-access.service';

@ApiTags('Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  @Post()
  @RequirePermission(GroupsPermission.CREATE_GROUP)
  @AuditLog({
    action: AuditAction.GROUP_CREATED,
    entityType: AuditEntity.GROUP,
    description: 'Created a new group (district/unit)',
    getEntityId: (result) => result.data._id.toString(),
  })
  @ApiOperation({ summary: 'Create a new group (district/unit)' })
  @ApiResponse({ status: 201, description: 'Group created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid group requirements' })
  @ApiResponse({ status: 409, description: 'Group already exists' })
  async create(@Body() createGroupDto: CreateGroupDto) {
    const group = await this.groupsService.create(createGroupDto);
    return ResponseUtil.success(group, 'Group created successfully');
  }

  @Get()
  @RequirePermission(GroupsPermission.VIEW_GROUPS)
  @ApiOperation({ summary: 'Get all groups with filtering' })
  @ApiResponse({ status: 200, description: 'Groups retrieved successfully' })
  async findAll(@Query() searchDto: GroupSearchDto, @CurrentUser() user: any) {
    // Build branch filter context based on user's permissions
    let branchFilterContext: BranchFilterContext | undefined;

    if (user.role) {
      const userPermissions = await this.userPermissionsService.getUserPermissions(
        user.role._id || user.role,
      );
      branchFilterContext = {
        userPermissions: userPermissions.permissions,
        userBranchId: user.branch?._id || user.branch,
        selectedBranchId: searchDto.branchId,
      };
    } else {
      branchFilterContext = {
        userPermissions: [],
        userBranchId: user.branch?._id || user.branch,
      };
    }

    const groups = await this.groupsService.findAll(searchDto, branchFilterContext);
    return ResponseUtil.success(groups, 'Groups retrieved successfully');
  }

  @Get('stats')
  @RequirePermission(GroupsPermission.VIEW_GROUP_STATS)
  @ApiOperation({ summary: 'Get group statistics' })
  @ApiResponse({
    status: 200,
    description: 'Group stats retrieved successfully',
  })
  async getGroupStats() {
    const stats = await this.groupsService.getGroupStats();
    return ResponseUtil.success(stats, 'Group stats retrieved successfully');
  }

  @Get('districts')
  @RequirePermission(GroupsPermission.VIEW_GROUPS)
  @ApiOperation({ summary: 'Get all districts' })
  @ApiResponse({ status: 200, description: 'Districts retrieved successfully' })
  async getDistricts() {
    const districts = await this.groupsService.findByType(GroupType.DISTRICT);
    return ResponseUtil.success(districts, 'Districts retrieved successfully');
  }

  @Get('units')
  @RequirePermission(GroupsPermission.VIEW_GROUPS)
  @ApiOperation({ summary: 'Get all units' })
  @ApiResponse({ status: 200, description: 'Units retrieved successfully' })
  async getUnits() {
    const units = await this.groupsService.findByType(GroupType.UNIT);
    return ResponseUtil.success(units, 'Units retrieved successfully');
  }

  @Get('districts/needing-pastors')
  @RequirePermission(GroupsPermission.VIEW_GROUPS)
  @ApiOperation({ summary: 'Get districts that need pastors' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Districts needing pastors retrieved successfully',
  })
  async getDistrictsNeedingPastors(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;

    const districts = await this.groupsService.getDistrictsNeedingPastors(
      pageNum,
      limitNum,
    );
    return ResponseUtil.success(
      districts,
      'Districts needing pastors retrieved successfully',
    );
  }

  @Get('units/needing-heads')
  @RequirePermission(GroupsPermission.VIEW_GROUPS)
  @ApiOperation({ summary: 'Get units that need heads' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Units needing heads retrieved successfully',
  })
  async getUnitsNeedingHeads(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;

    const units = await this.groupsService.getUnitsNeedingHeads(
      pageNum,
      limitNum,
    );
    return ResponseUtil.success(
      units,
      'Units needing heads retrieved successfully',
    );
  }

  @Get('my-groups')
  @RequirePermission(GroupsPermission.VIEW_OWN_GROUP)
  @ApiOperation({ summary: 'Get groups led by current user' })
  @ApiResponse({
    status: 200,
    description: 'User groups retrieved successfully',
  })
  async getMyGroups(@CurrentUser() user: any) {
    // This would need to be implemented with proper user-member linking
    // For now, return a placeholder
    const groups = {
      districtsAsPastor: [],
      districtsAsChamp: [],
      unitsAsHead: [],
    };
    return ResponseUtil.success(groups, 'Your groups retrieved successfully');
  }

  @Get(':id')
  @RequirePermission(GroupsPermission.VIEW_GROUP_DETAILS)
  @ApiOperation({ summary: 'Get group by ID' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const group = await this.groupsService.findById(id);

    if (!group) {
      throw new ForbiddenException('Group not found or access denied');
    }

    return ResponseUtil.success(group, 'Group retrieved successfully');
  }

  @Patch(':id')
  @RequirePermission(GroupsPermission.UPDATE_GROUP)
  @AuditLog({
    action: AuditAction.GROUP_UPDATED,
    entityType: AuditEntity.GROUP,
    description: 'Updated group information',
    getEntityId: (result, request) => request.params.id,
  })
  @ApiOperation({ summary: 'Update group' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group updated successfully' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async update(
    @Param('id') id: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @CurrentUser() user: any,
  ) {
    const group = await this.groupsService.update(id, updateGroupDto);
    return ResponseUtil.success(group, 'Group updated successfully');
  }

  // MEMBER MANAGEMENT ENDPOINTS
  @Patch(':id/members/:memberId/add')
  @RequirePermission(GroupsPermission.ADD_GROUP_MEMBER)
  @AuditLog({
    action: AuditAction.GROUP_MEMBER_ADDED,
    entityType: AuditEntity.GROUP,
    description: 'Added member to group',
    severity: 'medium',
    getEntityId: (result, request) => request.params.id,
  })
  @ApiOperation({ summary: 'Add member to group' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({
    status: 200,
    description: 'Member added to group successfully',
  })
  async addMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
  ) {
    const group = await this.groupsService.addMember(id, memberId);
    return ResponseUtil.success(group, 'Member added to group successfully');
  }

  @Patch(':id/members/:memberId/remove')
  @RequirePermission(GroupsPermission.REMOVE_GROUP_MEMBER)
  @AuditLog({
    action: AuditAction.GROUP_MEMBER_REMOVED,
    entityType: AuditEntity.GROUP,
    description: 'Removed member from group',
    severity: 'medium',
    getEntityId: (result, request) => request.params.id,
  })
  @ApiOperation({ summary: 'Remove member from group' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({
    status: 200,
    description: 'Member removed from group successfully',
  })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
  ) {
    const group = await this.groupsService.removeMember(id, memberId);
    return ResponseUtil.success(
      group,
      'Member removed from group successfully',
    );
  }

  // LEADERSHIP ASSIGNMENT ENDPOINTS
  @Patch(':id/assign-district-pastor/:pastorId')
  @RequirePermission(GroupsPermission.ASSIGN_GROUP_LEADER)
  @ApiOperation({ summary: 'Assign district pastor to district' })
  @ApiParam({ name: 'id', description: 'District ID' })
  @ApiParam({ name: 'pastorId', description: 'Pastor Member ID' })
  @ApiResponse({
    status: 200,
    description: 'District pastor assigned successfully',
  })
  async assignDistrictPastor(
    @Param('id') id: string,
    @Param('pastorId') pastorId: string,
  ) {
    const group = await this.groupsService.assignDistrictPastor(id, pastorId);
    return ResponseUtil.success(group, 'District pastor assigned successfully');
  }

  @Patch(':id/assign-unit-head/:headId')
  @RequirePermission(GroupsPermission.ASSIGN_GROUP_LEADER)
  @ApiOperation({ summary: 'Assign unit head to unit' })
  @ApiParam({ name: 'id', description: 'Unit ID' })
  @ApiParam({ name: 'headId', description: 'Unit Head Member ID' })
  @ApiResponse({ status: 200, description: 'Unit head assigned successfully' })
  async assignUnitHead(
    @Param('id') id: string,
    @Param('headId') headId: string,
  ) {
    const group = await this.groupsService.assignUnitHead(id, headId);
    return ResponseUtil.success(group, 'Unit head assigned successfully');
  }

  @Patch(':id/add-champ/:champId')
  @RequirePermission(GroupsPermission.ASSIGN_GROUP_LEADER)
  @ApiOperation({ summary: 'Add champ to district' })
  @ApiParam({ name: 'id', description: 'District ID' })
  @ApiParam({ name: 'champId', description: 'Champ Member ID' })
  @ApiResponse({ status: 200, description: 'Champ added successfully' })
  async addChamp(@Param('id') id: string, @Param('champId') champId: string) {
    const group = await this.groupsService.addChamp(id, champId);
    return ResponseUtil.success(group, 'Champ added successfully');
  }

  @Patch(':id/remove-champ/:champId')
  @RequirePermission(GroupsPermission.ASSIGN_GROUP_LEADER)
  @ApiOperation({ summary: 'Remove champ from district' })
  @ApiParam({ name: 'id', description: 'District ID' })
  @ApiParam({ name: 'champId', description: 'Champ Member ID' })
  @ApiResponse({ status: 200, description: 'Champ removed successfully' })
  async removeChamp(
    @Param('id') id: string,
    @Param('champId') champId: string,
  ) {
    const group = await this.groupsService.removeChamp(id, champId);
    return ResponseUtil.success(group, 'Champ removed successfully');
  }

  // HOSTING MANAGEMENT (DISTRICTS)
  @Patch(':id/hosting')
  @RequirePermission(GroupsPermission.UPDATE_GROUP)
  @ApiOperation({ summary: 'Update hosting information for district' })
  @ApiParam({ name: 'id', description: 'District ID' })
  @ApiResponse({
    status: 200,
    description: 'Hosting information updated successfully',
  })
  async updateHosting(
    @Param('id') id: string,
    @Body() hostingInfo: any,
    @CurrentUser() user: any,
  ) {
    const group = await this.groupsService.updateHosting(id, hostingInfo);
    return ResponseUtil.success(
      group,
      'Hosting information updated successfully',
    );
  }

  @Patch(':id/rotate-host')
  @RequirePermission(GroupsPermission.UPDATE_GROUP)
  @ApiOperation({ summary: 'Rotate to next host for district' })
  @ApiParam({ name: 'id', description: 'District ID' })
  @ApiResponse({ status: 200, description: 'Host rotated successfully' })
  async rotateHost(@Param('id') id: string, @CurrentUser() user: any) {
    const group = await this.groupsService.rotateHost(id);
    return ResponseUtil.success(group, 'Host rotated successfully');
  }

  @Patch(':id/deactivate')
  @RequirePermission(GroupsPermission.UPDATE_GROUP_STATUS)
  @ApiOperation({ summary: 'Deactivate group' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group deactivated successfully' })
  async deactivate(@Param('id') id: string) {
    const group = await this.groupsService.deactivate(id);
    return ResponseUtil.success(group, 'Group deactivated successfully');
  }

  @Patch(':id/activate')
  @RequirePermission(GroupsPermission.UPDATE_GROUP_STATUS)
  @ApiOperation({ summary: 'Activate group' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group activated successfully' })
  async activate(@Param('id') id: string) {
    const group = await this.groupsService.activate(id);
    return ResponseUtil.success(group, 'Group activated successfully');
  }

  @Delete(':id')
  @RequirePermission(GroupsPermission.DELETE_GROUP)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.GROUP,
    description: 'Deleted a group',
    severity: 'high',
    getEntityId: (result, request) => request.params.id,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete group (super admin only)' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 204, description: 'Group deleted successfully' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async remove(@Param('id') id: string) {
    await this.groupsService.remove(id);
    return ResponseUtil.success(null, 'Group deleted successfully');
  }
}
