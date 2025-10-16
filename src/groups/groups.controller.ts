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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupSearchDto } from './dto/group-search.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-roles.enums';
import { GroupType } from '../common/enums/group-types.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';

@ApiTags('Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Create a new group (district/unit)' })
  @ApiResponse({ status: 201, description: 'Group created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid group requirements' })
  @ApiResponse({ status: 409, description: 'Group already exists' })
  async create(@Body() createGroupDto: CreateGroupDto) {
    const group = await this.groupsService.create(createGroupDto);
    return ResponseUtil.success(group, 'Group created successfully');
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.PASTOR,
    UserRole.LXL,
  )
  @ApiOperation({ summary: 'Get all groups with filtering' })
  @ApiResponse({ status: 200, description: 'Groups retrieved successfully' })
  async findAll(@Query() searchDto: GroupSearchDto) {
    const groups = await this.groupsService.findAll(searchDto);
    return ResponseUtil.success(groups, 'Groups retrieved successfully');
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(
    UserRole.ADMIN,
    UserRole.PASTOR,
    UserRole.LXL,
    UserRole.LXL,
  )
  @ApiOperation({ summary: 'Get all districts' })
  @ApiResponse({ status: 200, description: 'Districts retrieved successfully' })
  async getDistricts() {
    const districts = await this.groupsService.findByType(GroupType.DISTRICT);
    return ResponseUtil.success(districts, 'Districts retrieved successfully');
  }

  @Get('units')
  @Roles(
    UserRole.ADMIN,
    UserRole.PASTOR,
    UserRole.LXL,
    UserRole.LXL,
  )
  @ApiOperation({ summary: 'Get all units' })
  @ApiResponse({ status: 200, description: 'Units retrieved successfully' })
  async getUnits() {
    const units = await this.groupsService.findByType(GroupType.UNIT);
    return ResponseUtil.success(units, 'Units retrieved successfully');
  }

  @Get('districts/needing-pastors')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Get districts that need pastors' })
  @ApiResponse({
    status: 200,
    description: 'Districts needing pastors retrieved successfully',
  })
  async getDistrictsNeedingPastors() {
    const districts = await this.groupsService.getDistrictsNeedingPastors();
    return ResponseUtil.success(
      districts,
      'Districts needing pastors retrieved successfully',
    );
  }

  @Get('units/needing-heads')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Get units that need heads' })
  @ApiResponse({
    status: 200,
    description: 'Units needing heads retrieved successfully',
  })
  async getUnitsNeedingHeads() {
    const units = await this.groupsService.getUnitsNeedingHeads();
    return ResponseUtil.success(
      units,
      'Units needing heads retrieved successfully',
    );
  }

  @Get('my-groups')
  @Roles(UserRole.ADMIN, UserRole.LXL)
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
  @Roles(
    UserRole.ADMIN,
    UserRole.PASTOR,
    UserRole.LXL,
    UserRole.LXL,
  )
  @ApiOperation({ summary: 'Get group by ID' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    // Add authorization check for group leaders
    const group = await this.groupsService.findById(id);

    if (!group) {
      throw new ForbiddenException('Group not found or access denied');
    }

    // Check if group leader has access to this specific group
    if (user.roles === UserRole.LXL) {
      // TODO: Implement proper authorization check
      // For now, allow access to all groups for group leaders
    }

    return ResponseUtil.success(group, 'Group retrieved successfully');
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL, UserRole.LXL)
  @ApiOperation({ summary: 'Update group' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group updated successfully' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async update(
    @Param('id') id: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @CurrentUser() user: any,
  ) {
    // Group leaders can only update their own groups
    if (user.roles === UserRole.LXL) {
      // TODO: Add authorization check to ensure user leads this group
    }

    const group = await this.groupsService.update(id, updateGroupDto);
    return ResponseUtil.success(group, 'Group updated successfully');
  }

  // MEMBER MANAGEMENT ENDPOINTS
  @Patch(':id/members/:memberId/add')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL, UserRole.LXL)
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
    // Authorization check for group leaders
    if (user.roles === UserRole.LXL) {
      // TODO: Check if user leads this group
    }

    const group = await this.groupsService.addMember(id, memberId);
    return ResponseUtil.success(group, 'Member added to group successfully');
  }

  @Patch(':id/members/:memberId/remove')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL, UserRole.LXL)
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
    // Authorization check for group leaders
    if (user.roles === UserRole.LXL) {
      // TODO: Check if user leads this group
    }

    const group = await this.groupsService.removeMember(id, memberId);
    return ResponseUtil.success(
      group,
      'Member removed from group successfully',
    );
  }

  // LEADERSHIP ASSIGNMENT ENDPOINTS
  @Patch(':id/assign-district-pastor/:pastorId')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Add champ to district' })
  @ApiParam({ name: 'id', description: 'District ID' })
  @ApiParam({ name: 'champId', description: 'Champ Member ID' })
  @ApiResponse({ status: 200, description: 'Champ added successfully' })
  async addChamp(@Param('id') id: string, @Param('champId') champId: string) {
    const group = await this.groupsService.addChamp(id, champId);
    return ResponseUtil.success(group, 'Champ added successfully');
  }

  @Patch(':id/remove-champ/:champId')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL, UserRole.LXL)
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
    // Group leaders can only update hosting for their districts
    if (user.roles === UserRole.LXL) {
      // TODO: Check if user is district pastor for this district
    }

    const group = await this.groupsService.updateHosting(id, hostingInfo);
    return ResponseUtil.success(
      group,
      'Hosting information updated successfully',
    );
  }

  @Patch(':id/rotate-host')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL, UserRole.LXL)
  @ApiOperation({ summary: 'Rotate to next host for district' })
  @ApiParam({ name: 'id', description: 'District ID' })
  @ApiResponse({ status: 200, description: 'Host rotated successfully' })
  async rotateHost(@Param('id') id: string, @CurrentUser() user: any) {
    // Group leaders can only rotate hosts for their districts
    if (user.roles === UserRole.LXL) {
      // TODO: Check if user is district pastor for this district
    }

    const group = await this.groupsService.rotateHost(id);
    return ResponseUtil.success(group, 'Host rotated successfully');
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Deactivate group' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group deactivated successfully' })
  async deactivate(@Param('id') id: string) {
    const group = await this.groupsService.deactivate(id);
    return ResponseUtil.success(group, 'Group deactivated successfully');
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Activate group' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group activated successfully' })
  async activate(@Param('id') id: string) {
    const group = await this.groupsService.activate(id);
    return ResponseUtil.success(group, 'Group activated successfully');
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
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
