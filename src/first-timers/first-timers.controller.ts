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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FirstTimersService } from './first-timers.service';
import { CreateFirstTimerDto } from './dto/create-first-timer.dto';
import { AddFollowUpDto } from './dto/add-follow-up.dto';
import { FirstTimerSearchDto } from './dto/first-timer-search.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-roles.enums';
import { EngagementStatus } from '../common/enums/engagement-status.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';

@ApiTags('First Timers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('first-timers')
export class FirstTimersController {
  constructor(private readonly firstTimersService: FirstTimersService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
  )
  @ApiOperation({ summary: 'Register a new first-time visitor' })
  @ApiResponse({
    status: 201,
    description: 'First-timer registered successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone or email already registered',
  })
  async create(@Body() createFirstTimerDto: CreateFirstTimerDto) {
    const firstTimer =
      await this.firstTimersService.create(createFirstTimerDto);
    return ResponseUtil.success(
      firstTimer,
      'First-timer registered successfully',
    );
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
  )
  @ApiOperation({ summary: 'Get all first-timers with advanced filtering' })
  @ApiResponse({
    status: 200,
    description: 'First-timers retrieved successfully',
  })
  async findAll(
    @Query() searchDto: FirstTimerSearchDto,
    @CurrentUser() user: any,
  ) {
    // Filter by assigned user for follow-up team members
    if (user.role === UserRole.FOLLOW_UP_TEAM) {
      // If not specified, show their assigned first-timers
      if (!searchDto.assignedTo) {
        searchDto.assignedTo = user._id;
      }
    }

    const firstTimers = await this.firstTimersService.findAll(searchDto);
    return ResponseUtil.success(
      firstTimers,
      'First-timers retrieved successfully',
    );
  }

  @Get('stats')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
  )
  @ApiOperation({ summary: 'Get first-timer statistics and analytics' })
  @ApiResponse({
    status: 200,
    description: 'First-timer stats retrieved successfully',
  })
  async getFirstTimerStats() {
    const stats = await this.firstTimersService.getFirstTimerStats();
    return ResponseUtil.success(
      stats,
      'First-timer stats retrieved successfully',
    );
  }

  @Get('needing-follow-up')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
  )
  @ApiOperation({ summary: 'Get first-timers needing follow-up' })
  @ApiResponse({
    status: 200,
    description: 'First-timers needing follow-up retrieved successfully',
  })
  async getNeedingFollowUp(@CurrentUser() user: any) {
    let firstTimers = await this.firstTimersService.getNeedingFollowUp();

    // Filter by assigned user for follow-up team
    if (user.role === UserRole.FOLLOW_UP_TEAM) {
      firstTimers = firstTimers.filter(
        (ft) => !ft.assignedTo || ft.assignedTo.toString() === user._id,
      );
    }

    return ResponseUtil.success(
      firstTimers,
      'First-timers needing follow-up retrieved successfully',
    );
  }

  @Get('recent')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
  )
  @ApiOperation({ summary: 'Get recent visitors' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days to look back (default: 7)',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent visitors retrieved successfully',
  })
  async getRecentVisitors(@Query('days') days?: string) {
    const daysBack = days ? parseInt(days) : 7;
    const visitors = await this.firstTimersService.getRecentVisitors(daysBack);
    return ResponseUtil.success(
      visitors,
      'Recent visitors retrieved successfully',
    );
  }

  @Get('my-assignments')
  @Roles(UserRole.FOLLOW_UP_TEAM, UserRole.GROUP_LEADER)
  @ApiOperation({ summary: 'Get first-timers assigned to current user' })
  @ApiResponse({
    status: 200,
    description: 'Assigned first-timers retrieved successfully',
  })
  async getMyAssignments(@CurrentUser() user: any) {
    const assignments = await this.firstTimersService.getByAssignedUser(
      user._id,
    );
    return ResponseUtil.success(
      assignments,
      'Your assignments retrieved successfully',
    );
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
  )
  @ApiOperation({ summary: 'Get first-timer by ID' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({
    status: 200,
    description: 'First-timer retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'First-timer not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const firstTimer = await this.firstTimersService.findById(id);

    if (!firstTimer) {
      return ResponseUtil.error('First-timer not found');
    }

    // Check access for follow-up team - they can only see their assignments
    if (user.role === UserRole.FOLLOW_UP_TEAM) {
      if (
        firstTimer.assignedTo &&
        firstTimer.assignedTo.toString() !== user._id
      ) {
        return ResponseUtil.error('Access denied - not your assignment');
      }
    }

    return ResponseUtil.success(
      firstTimer,
      'First-timer retrieved successfully',
    );
  }

  @Patch(':id/follow-up')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
  )
  @ApiOperation({ summary: 'Add follow-up record to first-timer' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({ status: 200, description: 'Follow-up added successfully' })
  async addFollowUp(
    @Param('id') id: string,
    @Body() followUpDto: AddFollowUpDto,
    @CurrentUser() user: any,
  ) {
    // Auto-set the contactedBy field to current user
    followUpDto.contactedBy = user._id;

    const firstTimer = await this.firstTimersService.addFollowUp(
      id,
      followUpDto,
    );
    return ResponseUtil.success(firstTimer, 'Follow-up added successfully');
  }

  @Patch(':id/status')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
  )
  @ApiOperation({ summary: 'Update first-timer engagement status' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: EngagementStatus },
  ) {
    const firstTimer = await this.firstTimersService.updateStatus(
      id,
      body.status,
    );
    return ResponseUtil.success(firstTimer, 'Status updated successfully');
  }

  @Patch(':id/assign/:userId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @ApiOperation({ summary: 'Assign first-timer to a follow-up team member' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiParam({ name: 'userId', description: 'User ID to assign to' })
  @ApiResponse({
    status: 200,
    description: 'First-timer assigned successfully',
  })
  async assignToUser(@Param('id') id: string, @Param('userId') userId: string) {
    const firstTimer = await this.firstTimersService.assignToUser(id, userId);
    return ResponseUtil.success(
      firstTimer,
      'First-timer assigned successfully',
    );
  }

  @Patch(':id/convert')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
  )
  @ApiOperation({ summary: 'Convert first-timer to member' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({
    status: 200,
    description: 'First-timer converted to member successfully',
  })
  async convertToMember(
    @Param('id') id: string,
    @Body() body: { memberRecordId: string },
  ) {
    const firstTimer = await this.firstTimersService.convertToMember(
      id,
      body.memberRecordId,
    );
    return ResponseUtil.success(
      firstTimer,
      'First-timer converted to member successfully',
    );
  }

  @Patch(':id/notes')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
  )
  @ApiOperation({ summary: 'Update first-timer notes' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({ status: 200, description: 'Notes updated successfully' })
  async updateNotes(
    @Param('id') id: string,
    @Body() body: { notes: string },
    @CurrentUser() user: any,
  ) {
    // Check access for follow-up team
    if (user.role === UserRole.FOLLOW_UP_TEAM) {
      const firstTimer = await this.firstTimersService.findById(id);
      if (
        firstTimer?.assignedTo &&
        firstTimer.assignedTo.toString() !== user._id
      ) {
        return ResponseUtil.error('Access denied - not your assignment');
      }
    }

    const firstTimer = await this.firstTimersService.updateNotes(
      id,
      body.notes,
    );
    return ResponseUtil.success(firstTimer, 'Notes updated successfully');
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @ApiOperation({ summary: 'Deactivate first-timer record' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({
    status: 200,
    description: 'First-timer deactivated successfully',
  })
  async deactivate(@Param('id') id: string) {
    const firstTimer = await this.firstTimersService.deactivate(id);
    return ResponseUtil.success(
      firstTimer,
      'First-timer deactivated successfully',
    );
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete first-timer (super admin only)' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({ status: 204, description: 'First-timer deleted successfully' })
  @ApiResponse({ status: 404, description: 'First-timer not found' })
  async remove(@Param('id') id: string) {
    await this.firstTimersService.remove(id);
    return ResponseUtil.success(null, 'First-timer deleted successfully');
  }

  @Post('bulk-assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @ApiOperation({ summary: 'Bulk assign first-timers to users' })
  @ApiResponse({
    status: 200,
    description: 'Bulk assignment completed successfully',
  })
  async bulkAssign(
    @Body()
    body: {
      assignments: Array<{ firstTimerId: string; userId: string }>;
    },
  ) {
    const results: Array<{
      success: boolean;
      firstTimer?: any;
      error?: string;
      firstTimerId?: string;
    }> = [];

    for (const assignment of body.assignments) {
      try {
        const firstTimer = await this.firstTimersService.assignToUser(
          assignment.firstTimerId,
          assignment.userId,
        );
        results.push({ success: true, firstTimer });
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message,
          firstTimerId: assignment.firstTimerId,
        });
      }
    }

    return ResponseUtil.success(results, 'Bulk assignment completed');
  }

  @Patch('bulk-status')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
  )
  @ApiOperation({ summary: 'Bulk update status for multiple first-timers' })
  @ApiResponse({
    status: 200,
    description: 'Bulk status update completed successfully',
  })
  async bulkUpdateStatus(
    @Body() body: { firstTimerIds: string[]; status: EngagementStatus },
  ) {
    const results: Array<{
      success: boolean;
      firstTimer?: any;
      error?: string;
      firstTimerId?: string;
    }> = [];

    for (const id of body.firstTimerIds) {
      try {
        const firstTimer = await this.firstTimersService.updateStatus(
          id,
          body.status,
        );
        results.push({ success: true, firstTimer });
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message,
          firstTimerId: id,
        });
      }
    }

    return ResponseUtil.success(results, 'Bulk status update completed');
  }
}
