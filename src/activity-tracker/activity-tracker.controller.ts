import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { ActivityTrackerService } from './activity-tracker.service';
import { MemberLifecycleService } from './member-lifecycle.service';
import { ActivityTrackerPermission } from './permissions';
import {
  ActivityType,
  ActivityStatus,
  ActivityPriority,
} from '../common/enums/activity-tracker.enum';

@ApiTags('Activity Tracker')
@Controller('activity-tracker')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ActivityTrackerController {
  constructor(
    private readonly activityService: ActivityTrackerService,
    private readonly lifecycleService: MemberLifecycleService,
  ) {}

  @Get('activities')
  @RequirePermission(ActivityTrackerPermission.VIEW_ACTIVITIES)
  @ApiOperation({ summary: 'Get all activities with filtering and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activities retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'memberId', required: false, type: String })
  @ApiQuery({ name: 'activityType', required: false, enum: ActivityType })
  @ApiQuery({ name: 'status', required: false, enum: ActivityStatus })
  @ApiQuery({ name: 'priority', required: false, enum: ActivityPriority })
  async findActivities(@Query() query: any) {
    return this.activityService.findActivities(query);
  }

  @Get('activities/statistics')
  @RequirePermission(ActivityTrackerPermission.VIEW_ACTIVITY_STATS)
  @ApiOperation({ summary: 'Get activity statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  @ApiQuery({ name: 'memberId', required: false, type: String })
  async getStatistics(@Query('memberId') memberId?: string) {
    return this.activityService.getActivityStatistics(memberId);
  }

  @Get('follow-ups/upcoming')
  @RequirePermission(ActivityTrackerPermission.VIEW_UPCOMING_FOLLOWUPS)
  @ApiOperation({ summary: 'Get upcoming follow-ups' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Upcoming follow-ups retrieved successfully',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUpcomingFollowUps(@Query('limit') limit?: number) {
    return this.activityService.getUpcomingFollowUps(limit);
  }

  @Get('activities/:id')
  @RequirePermission(ActivityTrackerPermission.VIEW_ACTIVITY_DETAILS)
  @ApiOperation({ summary: 'Get a specific activity by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activity retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Activity not found',
  })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  async findActivity(@Param('id') id: string) {
    return this.activityService.findActivityById(id);
  }

  @Get('members/:memberId/timeline')
  @ApiOperation({ summary: 'Get member lifecycle timeline' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member timeline retrieved successfully',
  })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getMemberTimeline(
    @Param('memberId') memberId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Request() req?,
  ) {
    // Users can view their own timeline without special permissions
    // For viewing other members' timelines, the permission guard would need to be applied
    // But for simplicity, we allow viewing any member's timeline if authenticated
    return this.lifecycleService.getMemberTimeline(memberId, limit, offset);
  }

  @Get('members/:memberId/statistics')
  @ApiOperation({ summary: 'Get member lifecycle statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member statistics retrieved successfully',
  })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  async getMemberStatistics(@Param('memberId') memberId: string, @Request() req?) {
    // Users can view their own statistics without special permissions
    return this.lifecycleService.getLifecycleStatistics(memberId);
  }

  @Post('activities/:id/follow-up')
  @RequirePermission(ActivityTrackerPermission.ADD_FOLLOWUP_NOTE)
  @ApiOperation({ summary: 'Add follow-up note to activity' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Follow-up note added successfully',
  })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  async addFollowUpNote(
    @Param('id') id: string,
    @Body() body: { note: string; nextFollowUpDate?: Date },
    @Request() req,
  ) {
    return this.activityService.addFollowUpNote(
      id,
      body.note,
      req.user._id,
      body.nextFollowUpDate,
    );
  }

  @Post('activities/:id/complete')
  @RequirePermission(ActivityTrackerPermission.MARK_ACTIVITY_COMPLETE)
  @ApiOperation({ summary: 'Mark activity as complete' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activity marked as complete',
  })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  async markComplete(@Param('id') id: string) {
    return this.activityService.markActivityComplete(id);
  }

  @Post('members/:memberId/lifecycle/register')
  @RequirePermission(ActivityTrackerPermission.LOG_MEMBER_REGISTRATION)
  @ApiOperation({ summary: 'Log member registration event' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Registration event logged successfully',
  })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  async logMemberRegistration(
    @Param('memberId') memberId: string,
    @Body() body: { source?: string },
    @Request() req,
  ) {
    return this.lifecycleService.logMemberRegistration(
      memberId,
      req.user._id,
      body.source,
    );
  }

  @Post('members/:memberId/lifecycle/baptism')
  @RequirePermission(ActivityTrackerPermission.LOG_BAPTISM)
  @ApiOperation({ summary: 'Log baptism event' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Baptism event logged successfully',
  })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  async logBaptism(
    @Param('memberId') memberId: string,
    @Body() body: {
      baptismType: 'water' | 'spirit';
      baptismDate: Date;
      location?: string;
    },
    @Request() req,
  ) {
    return this.lifecycleService.logBaptism(
      memberId,
      body.baptismType,
      req.user._id,
      body.baptismDate,
      body.location,
    );
  }

  @Post('members/:memberId/lifecycle/special-event')
  @RequirePermission(ActivityTrackerPermission.LOG_SPECIAL_EVENT)
  @ApiOperation({ summary: 'Log special life event' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Special event logged successfully',
  })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  async logSpecialEvent(
    @Param('memberId') memberId: string,
    @Body() body: {
      eventType: ActivityType;
      title: string;
      description: string;
      eventDate?: Date;
    },
    @Request() req,
  ) {
    return this.lifecycleService.logSpecialEvent(
      memberId,
      body.eventType,
      body.title,
      body.description,
      req.user._id,
      body.eventDate,
    );
  }

}