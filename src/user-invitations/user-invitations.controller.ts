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
import { UserInvitationsService } from './user-invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { CreateOperationalInvitationDto } from './dto/create-operational-invitation.dto';
import { RevokeInvitationDto } from './dto/revoke-invitation.dto';
import { UpdateInvitationRoleDto } from './dto/update-invitation-role.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { InvitationQueryDto } from './dto/invitation-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';

@ApiTags('User Invitations')
@ApiBearerAuth()
@Controller('user-invitations')
@UseGuards(JwtAuthGuard)
export class UserInvitationsController {
  constructor(private readonly invitationsService: UserInvitationsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('users:invite')
  @ApiOperation({ summary: 'Create a new user invitation' })
  @ApiResponse({
    status: 201,
    description: 'Invitation created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Member or role not found' })
  @ApiResponse({ status: 409, description: 'Conflict - member already invited or has access' })
  async create(@Body() createInvitationDto: CreateInvitationDto, @Request() req) {
    const invitation = await this.invitationsService.create(
      createInvitationDto,
      req.user.id,
    );

    return {
      success: true,
      message: 'Invitation created and email sent successfully',
      data: invitation,
    };
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('users:view')
  @ApiOperation({ summary: 'Get all invitations with filters' })
  @ApiResponse({ status: 200, description: 'Invitations retrieved successfully' })
  async findAll(@Query() queryDto: InvitationQueryDto) {
    const result = await this.invitationsService.findAll(queryDto);

    return {
      success: true,
      message: 'Invitations retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('statistics')
  @UseGuards(PermissionGuard)
  @RequirePermission('users:view')
  @ApiOperation({ summary: 'Get invitation statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStatistics() {
    const stats = await this.invitationsService.getStatistics();

    return {
      success: true,
      message: 'Statistics retrieved successfully',
      data: stats,
    };
  }

  @Post('operational')
  @UseGuards(PermissionGuard)
  @RequirePermission('users:invite')
  @ApiOperation({ summary: 'Create an operational user and send invitation' })
  @ApiResponse({
    status: 201,
    description: 'Operational user created and invitation sent',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async createOperationalUser(
    @Body() dto: CreateOperationalInvitationDto,
    @Request() req,
  ) {
    const invitation = await this.invitationsService.createOperationalUser(
      dto,
      req.user.id,
    );

    return {
      success: true,
      message: 'Operational user created and invitation sent successfully',
      data: invitation,
    };
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('users:view')
  @ApiOperation({ summary: 'Get invitation by ID' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Invitation retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async findById(@Param('id') id: string) {
    const invitation = await this.invitationsService.findById(id);

    return {
      success: true,
      message: 'Invitation retrieved successfully',
      data: invitation,
    };
  }

  @Post(':id/resend')
  @UseGuards(PermissionGuard)
  @RequirePermission('users:invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend invitation email' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Invitation email resent successfully' })
  @ApiResponse({ status: 400, description: 'Cannot resend - invitation not pending or expired' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async resend(@Param('id') id: string) {
    const invitation = await this.invitationsService.resendInvitation(id);

    return {
      success: true,
      message: 'Invitation email resent successfully',
      data: invitation,
    };
  }

  @Patch(':id/revoke')
  @UseGuards(PermissionGuard)
  @RequirePermission('users:invite')
  @ApiOperation({ summary: 'Revoke invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Invitation revoked successfully' })
  @ApiResponse({ status: 400, description: 'Cannot revoke - invitation not pending' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async revoke(
    @Param('id') id: string,
    @Body() revokeDto: RevokeInvitationDto,
  ) {
    const invitation = await this.invitationsService.revokeInvitation(id, revokeDto);

    return {
      success: true,
      message: 'Invitation revoked successfully',
      data: invitation,
    };
  }

  @Patch(':id/role')
  @UseGuards(PermissionGuard)
  @RequirePermission('users:invite')
  @ApiOperation({ summary: 'Update invitation role' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Invitation role updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot update - invitation not pending' })
  @ApiResponse({ status: 404, description: 'Invitation or role not found' })
  async updateRole(
    @Param('id') id: string,
    @Body() updateDto: UpdateInvitationRoleDto,
  ) {
    const invitation = await this.invitationsService.updateRole(id, updateDto);

    return {
      success: true,
      message: 'Invitation role updated successfully',
      data: invitation,
    };
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('users:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 204, description: 'Invitation deleted successfully' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async delete(@Param('id') id: string) {
    await this.invitationsService.findById(id); // Verify it exists
    // You can implement actual deletion logic here
    // For now, we'll keep the invitation records for audit purposes
    throw new Error('Delete operation not implemented - use revoke instead');
  }

  // USER ACCESS MANAGEMENT ENDPOINTS

  @Get('users/active')
  @UseGuards(PermissionGuard)
  @RequirePermission('users:view')
  @ApiOperation({ summary: 'Get all active users with platform access' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Active users retrieved successfully' })
  async getActiveUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    const result = await this.invitationsService.getActiveUsers({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search,
    });

    return {
      success: true,
      message: 'Active users retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Patch('users/:memberId/role')
  @UseGuards(PermissionGuard)
  @RequirePermission('users:manage')
  @ApiOperation({ summary: 'Update user role' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 404, description: 'Member or role not found' })
  async updateUserRole(
    @Param('memberId') memberId: string,
    @Body() updateDto: UpdateUserRoleDto,
  ) {
    const member = await this.invitationsService.updateUserRole(
      memberId,
      updateDto.roleId,
    );

    return {
      success: true,
      message: 'User role updated successfully',
      data: member,
    };
  }

  @Patch('users/:memberId/deactivate')
  @UseGuards(PermissionGuard)
  @RequirePermission('users:manage')
  @ApiOperation({ summary: 'Deactivate user access' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async deactivateUser(@Param('memberId') memberId: string) {
    const member = await this.invitationsService.deactivateUser(memberId);

    return {
      success: true,
      message: 'User access deactivated successfully',
      data: member,
    };
  }

  @Patch('users/:memberId/activate')
  @UseGuards(PermissionGuard)
  @RequirePermission('users:manage')
  @ApiOperation({ summary: 'Activate user access' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async activateUser(@Param('memberId') memberId: string) {
    const member = await this.invitationsService.activateUser(memberId);

    return {
      success: true,
      message: 'User access activated successfully',
      data: member,
    };
  }

  @Delete('users/:memberId/access')
  @UseGuards(PermissionGuard)
  @RequirePermission('users:delete')
  @ApiOperation({ summary: 'Delete user access permanently' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({ status: 200, description: 'User access deleted successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async deleteUserAccess(@Param('memberId') memberId: string) {
    const member = await this.invitationsService.deleteUserAccess(memberId);

    return {
      success: true,
      message: 'User access deleted successfully',
      data: member,
    };
  }
}
