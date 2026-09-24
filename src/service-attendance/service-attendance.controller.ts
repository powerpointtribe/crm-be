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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ServiceAttendanceService } from './service-attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { BulkCheckInDto } from './dto/bulk-check-in.dto';
import { QrCheckInDto } from './dto/qr-check-in.dto';
import { GroupMeetingAttendanceDto } from './dto/group-meeting-attendance.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { ServiceAttendancePermission } from './permissions';

@ApiTags('Service Attendance')
@ApiBearerAuth()
@Controller('service-attendance')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServiceAttendanceController {
  constructor(private readonly attendanceService: ServiceAttendanceService) {}

  @Post('public/verify-leader')
  @Public()
  @ApiOperation({ summary: 'Verify leader credentials and return their groups (no auth required)' })
  async publicVerifyLeader(
    @Body() body: { email: string; password: string },
  ) {
    const data = await this.attendanceService.publicVerifyLeader(
      body.email,
      body.password,
    );
    return { data };
  }

  @Post('public/group-meeting')
  @Public()
  @ApiOperation({ summary: 'Submit group meeting attendance (public, leader email required)' })
  async publicGroupMeeting(
    @Body() body: { email: string; password: string; groupId: string; meetingDate: string; presentMemberIds: string[]; notes?: string },
  ) {
    const verified = await this.attendanceService.publicVerifyLeader(
      body.email,
      body.password,
    );
    const leaderGroups = verified.groups.map((g: any) => g._id.toString());
    if (!leaderGroups.includes(body.groupId)) {
      throw new ForbiddenException('You do not lead this group');
    }
    const result = await this.attendanceService.recordGroupMeeting(
      {
        groupId: body.groupId,
        meetingDate: new Date(body.meetingDate),
        presentMemberIds: body.presentMemberIds,
        notes: body.notes,
      },
      verified.leader._id.toString(),
    );
    return { data: result };
  }

  @Post('qr-check-in')
  @Public()
  @ApiOperation({ summary: 'Self-check-in via QR code (no auth required)' })
  async qrCheckIn(@Body() dto: QrCheckInDto) {
    const result = await this.attendanceService.selfCheckIn(
      dto.identifier,
      dto.serviceDate,
      dto.serviceType,
      dto.branch,
      dto.notes,
      dto.serviceTitle,
    );
    return { data: result };
  }

  @Post()
  @ApiOperation({ summary: 'Record individual attendance' })
  @RequirePermission(ServiceAttendancePermission.RECORD)
  async checkIn(
    @Body() dto: CreateAttendanceDto,
    @CurrentUser() user: any,
  ) {
    const record = await this.attendanceService.checkIn(
      dto,
      user.sub,
      dto.branch || user.branch,
    );
    return { data: record };
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk check-in multiple members' })
  @RequirePermission(ServiceAttendancePermission.BULK_RECORD)
  async bulkCheckIn(
    @Body() dto: BulkCheckInDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.attendanceService.bulkCheckIn(
      dto,
      user.sub,
      user.branch,
    );
    return { data: result };
  }

  @Post('group-meeting')
  @ApiOperation({ summary: 'Record attendance for a district/unit meeting' })
  @RequirePermission(ServiceAttendancePermission.RECORD)
  async recordGroupMeeting(
    @Body() dto: GroupMeetingAttendanceDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.attendanceService.recordGroupMeeting(dto, user.sub);
    return { data: result };
  }

  @Get('group-meeting/overview')
  @ApiOperation({ summary: 'Overview of meeting attendance across all districts/units' })
  @RequirePermission(ServiceAttendancePermission.VIEW)
  async getGroupMeetingOverview(
    @CurrentUser() user: any,
    @Query('branch') branch?: string,
  ) {
    const data = await this.attendanceService.getGroupMeetingOverview(
      branch || user.branch,
    );
    return { data };
  }

  @Get('group-meeting/:groupId/history')
  @ApiOperation({ summary: 'Get meeting attendance history for a group' })
  @RequirePermission(ServiceAttendancePermission.VIEW)
  async getGroupMeetingHistory(
    @Param('groupId') groupId: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.attendanceService.getGroupMeetingHistory(
      groupId,
      limit ? parseInt(limit, 10) : 10,
    );
    return { data };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List distinct service sessions with attendance counts' })
  @RequirePermission(ServiceAttendancePermission.VIEW)
  async getServiceSessions(
    @CurrentUser() user: any,
    @Query('branch') branch?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.attendanceService.getServiceSessions(
      branch || user.branch,
      limit ? parseInt(limit, 10) : 20,
      page ? parseInt(page, 10) : 1,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List attendance records' })
  @RequirePermission(ServiceAttendancePermission.VIEW)
  async findAll(
    @Query() query: QueryAttendanceDto,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.findAll(query, user.branch);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Attendance statistics' })
  @RequirePermission(ServiceAttendancePermission.VIEW_STATS)
  async getStats(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const stats = await this.attendanceService.getStats(
      user.branch,
      startDate,
      endDate,
    );
    return { data: stats };
  }

  @Get('trends')
  @ApiOperation({ summary: 'Attendance trends over time' })
  @RequirePermission(ServiceAttendancePermission.VIEW_STATS)
  async getTrends(
    @CurrentUser() user: any,
    @Query('serviceType') serviceType?: string,
    @Query('months') months?: string,
  ) {
    const data = await this.attendanceService.getTrends(
      user.branch,
      serviceType,
      months ? parseInt(months, 10) : 6,
    );
    return { data };
  }

  @Get('retention')
  @ApiOperation({ summary: 'Retention cohort analysis' })
  @RequirePermission(ServiceAttendancePermission.VIEW_STATS)
  async getRetention(@CurrentUser() user: any) {
    const data = await this.attendanceService.getRetentionCohorts(user.branch);
    return { data };
  }

  @Get('frequency')
  @ApiOperation({ summary: 'Attendance frequency distribution' })
  @RequirePermission(ServiceAttendancePermission.VIEW_STATS)
  async getFrequency(
    @CurrentUser() user: any,
    @Query('days') days?: string,
  ) {
    const data = await this.attendanceService.getAttendanceFrequencyDistribution(
      user.branch,
      days ? parseInt(days, 10) : 90,
    );
    return { data };
  }

  @Get('service')
  @ApiOperation({ summary: 'Get attendees for a specific service' })
  @RequirePermission(ServiceAttendancePermission.VIEW)
  async getServiceAttendees(
    @CurrentUser() user: any,
    @Query('date') date: string,
    @Query('serviceType') serviceType: string,
    @Query('branch') branch?: string,
  ) {
    const data = await this.attendanceService.getServiceAttendees(
      new Date(date),
      serviceType,
      branch || user.branch,
    );
    return { data };
  }

  @Get('member/:memberId')
  @ApiOperation({ summary: 'Get attendance history for a member' })
  @RequirePermission(ServiceAttendancePermission.VIEW_MEMBER_HISTORY)
  async getMemberHistory(
    @Param('memberId') memberId: string,
    @Query() query: QueryAttendanceDto,
  ) {
    return this.attendanceService.findByMember(memberId, query);
  }

  @Get('member/:memberId/summary')
  @ApiOperation({ summary: 'Get attendance summary for a member' })
  @RequirePermission(ServiceAttendancePermission.VIEW_MEMBER_HISTORY)
  async getMemberSummary(
    @Param('memberId') memberId: string,
    @Query('days') days?: string,
  ) {
    const data = await this.attendanceService.getMemberAttendanceSummary(
      memberId,
      days ? parseInt(days, 10) : 90,
    );
    return { data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an attendance record' })
  @RequirePermission(ServiceAttendancePermission.UPDATE)
  async update(
    @Param('id') id: string,
    @Body() updates: Partial<CreateAttendanceDto>,
  ) {
    const record = await this.attendanceService.update(id, updates);
    return { data: record };
  }

  @Post('mark-absent')
  @ApiOperation({ summary: 'Mark all non-present active members as absent for a service' })
  @RequirePermission(ServiceAttendancePermission.BULK_RECORD)
  async markAbsentees(
    @CurrentUser() user: any,
    @Body('serviceDate') serviceDate: string,
    @Body('serviceType') serviceType: string,
    @Body('branch') branch?: string,
  ) {
    const result = await this.attendanceService.markAbsentees(
      branch || user.branch,
      new Date(serviceDate),
      serviceType,
    );
    return { data: result };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attendance record' })
  @RequirePermission(ServiceAttendancePermission.DELETE)
  async delete(@Param('id') id: string) {
    await this.attendanceService.delete(id);
    return { message: 'Attendance record deleted' };
  }
}
