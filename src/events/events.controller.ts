import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
import { Public } from '../common/decorators/public.decorator';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { BranchFilterContext } from '../common/services/branch-access.service';

import { EventsService } from './events.service';
import { EventsPermission } from './permissions';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventSearchDto } from './dto/event-search.dto';
import {
  AddCommitteeMemberDto,
  UpdateCommitteeMemberDto,
} from './dto/add-committee-member.dto';
import {
  CreateRegistrationDto,
  UpdateRegistrationStatusDto,
  RegistrationSearchDto,
} from './dto/create-registration.dto';
import { PublicRegistrationDto } from './dto/public-registration.dto';
import {
  CreateSessionDto,
  UpdateSessionDto,
  RecordSessionAttendanceDto,
  BulkRecordAttendanceDto,
  RecordAssessmentResultDto,
  SessionSearchDto,
} from './dto/session.dto';
import {
  EventAnalyticsQueryDto,
  TrendAnalyticsQueryDto,
  ParticipantAccountabilityQueryDto,
} from './dto/event-analytics.dto';

@Controller('events')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  // ========== EVENT CRUD ENDPOINTS ==========

  @Post()
  @RequirePermission(EventsPermission.CREATE_EVENT)
  @AuditLog({
    action: AuditAction.EVENT_CREATED,
    entityType: AuditEntity.EVENT,
    description: 'Created a new event',
    getEntityId: (result) => result._id.toString(),
  })
  async create(@Body() createEventDto: CreateEventDto, @Request() req) {
    // Set organizer to current user if not provided
    if (!createEventDto.organizer) {
      createEventDto.organizer = req.user._id?.toString();
    }
    return this.eventsService.create(createEventDto);
  }

  @Get()
  @RequirePermission(EventsPermission.VIEW_EVENTS)
  async findAll(@Query() query: EventSearchDto, @Request() req) {
    try {
      const { user: currentMember } = req;

      // Build branch filter context based on user's permissions
      let branchFilterContext: BranchFilterContext | undefined;

      if (currentMember.role) {
        const userPermissions = await this.userPermissionsService.getUserPermissions(
          currentMember.role._id || currentMember.role,
        );

        branchFilterContext = {
          userPermissions: userPermissions.permissions,
          userBranchId: currentMember.branch?._id || currentMember.branch,
          selectedBranchId: query.branchId,
        };
      } else {
        // No role - filter by user's branch only
        branchFilterContext = {
          userPermissions: [],
          userBranchId: currentMember.branch?._id || currentMember.branch,
        };
      }

      return await this.eventsService.findAll(query, branchFilterContext);
    } catch (error) {
      throw new BadRequestException('Failed to fetch events');
    }
  }

  // ========== PUBLIC ENDPOINTS (No Auth) - MUST BE BEFORE :id ROUTES ==========

  @Get('public/:slug')
  @Public()
  async getPublicEvent(@Param('slug') slug: string) {
    const event = await this.eventsService.findBySlug(slug);

    // Return limited public information
    return {
      _id: event._id,
      title: event.title,
      description: event.description,
      type: event.type,
      status: event.status,
      startDate: event.startDate,
      endDate: event.endDate,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      bannerImage: event.bannerImage,
      contactEmail: event.contactEmail,
      contactPhone: event.contactPhone,
      websiteUrl: event.websiteUrl,
      registrationSettings: {
        isOpen: event.registrationSettings?.isOpen,
        maxAttendees: event.registrationSettings?.maxAttendees,
        deadline: event.registrationSettings?.deadline,
        customFields: event.registrationSettings?.customFields,
      },
      registrationCount: event.registrationCount,
      branch: event.branch,
    };
  }

  @Post('public/:slug/register')
  @Public()
  async publicRegister(
    @Param('slug') slug: string,
    @Body() dto: PublicRegistrationDto,
  ) {
    const registration = await this.eventsService.publicRegister(slug, dto);

    // Return limited information
    return {
      success: true,
      message: 'Registration successful',
      registration: {
        _id: registration._id,
        status: registration.status,
        checkInCode: registration.checkInCode,
        attendeeInfo: {
          firstName: registration.attendeeInfo.firstName,
          lastName: registration.attendeeInfo.lastName,
        },
      },
    };
  }

  @Post('public/:slug/partner')
  @Public()
  async submitPartnership(
    @Param('slug') slug: string,
    @Body() partnerDto: { name: string; company?: string; email: string; phone: string; interestDetails: string },
  ) {
    const result = await this.eventsService.submitPartnership(slug, partnerDto);

    return {
      success: true,
      message: 'Partnership inquiry submitted successfully',
    };
  }

  // ========== ANALYTICS ENDPOINTS - MUST BE BEFORE :id ROUTES ==========

  @Get('analytics/overview')
  @RequirePermission(EventsPermission.VIEW_EVENTS)
  async getOverviewStats(@Query() query: EventAnalyticsQueryDto, @Request() req) {
    const branchId = req.user.branch?._id || req.user.branch;
    return this.eventsService.getOverviewStats(branchId, query);
  }

  @Get('analytics/trends')
  @RequirePermission(EventsPermission.VIEW_EVENTS)
  async getAttendanceTrends(@Query() query: TrendAnalyticsQueryDto, @Request() req) {
    const branchId = query.branchId || req.user.branch?._id || req.user.branch;
    return this.eventsService.getAttendanceTrends(branchId, query);
  }

  @Get('analytics/engagement')
  @RequirePermission(EventsPermission.VIEW_EVENTS)
  async getMemberEngagement(@Query() query: EventAnalyticsQueryDto, @Request() req) {
    const branchId = req.user.branch?._id || req.user.branch;
    return this.eventsService.getMemberEngagementAnalytics(branchId, query);
  }

  @Get('analytics/dashboard')
  @RequirePermission(EventsPermission.VIEW_EVENTS)
  async getDashboardAnalytics(@Query() query: EventAnalyticsQueryDto, @Request() req) {
    const branchId = req.user.branch?._id || req.user.branch;
    return this.eventsService.getDashboardAnalytics(branchId, query);
  }

  // ========== SESSION ENDPOINTS (without event id) - MUST BE BEFORE :id ROUTES ==========

  @Get('sessions/:sessionId')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  async getSessionById(@Param('sessionId') sessionId: string) {
    return this.eventsService.getSessionById(sessionId);
  }

  @Patch('sessions/:sessionId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  @AuditLog({
    action: AuditAction.EVENT_UPDATED,
    entityType: AuditEntity.EVENT,
    description: 'Updated session',
    getEntityId: (result, request) => request.params.sessionId,
  })
  async updateSession(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.eventsService.updateSession(sessionId, dto);
  }

  @Delete('sessions/:sessionId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  @AuditLog({
    action: AuditAction.EVENT_UPDATED,
    entityType: AuditEntity.EVENT,
    description: 'Deleted session',
    severity: 'high',
    getEntityId: (result, request) => request.params.sessionId,
  })
  async deleteSession(@Param('sessionId') sessionId: string) {
    await this.eventsService.deleteSession(sessionId);
    return { message: 'Session deleted successfully' };
  }

  // ========== SESSION ATTENDANCE ENDPOINTS - MUST BE BEFORE :id ROUTES ==========

  @Post('sessions/:sessionId/attendance')
  @RequirePermission(EventsPermission.CHECK_IN)
  @AuditLog({
    action: AuditAction.EVENT_CHECK_IN,
    entityType: AuditEntity.EVENT_REGISTRATION,
    description: 'Recorded session attendance',
  })
  async recordSessionAttendance(
    @Param('sessionId') sessionId: string,
    @Body() dto: RecordSessionAttendanceDto,
  ) {
    return this.eventsService.recordSessionAttendance(sessionId, dto);
  }

  @Post('sessions/:sessionId/attendance/bulk')
  @RequirePermission(EventsPermission.CHECK_IN)
  @AuditLog({
    action: AuditAction.EVENT_CHECK_IN,
    entityType: AuditEntity.EVENT_REGISTRATION,
    description: 'Recorded bulk session attendance',
  })
  async recordBulkAttendance(
    @Param('sessionId') sessionId: string,
    @Body() dto: BulkRecordAttendanceDto,
  ) {
    return this.eventsService.bulkRecordAttendance(sessionId, dto);
  }

  @Post('sessions/:sessionId/assessment')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  @AuditLog({
    action: AuditAction.EVENT_UPDATED,
    entityType: AuditEntity.EVENT,
    description: 'Recorded assessment result',
  })
  async recordAssessmentResult(
    @Param('sessionId') sessionId: string,
    @Body() dto: RecordAssessmentResultDto,
  ) {
    return this.eventsService.recordAssessmentResult(sessionId, dto);
  }

  @Get('sessions/:sessionId/attendance')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  async getSessionAttendance(@Param('sessionId') sessionId: string) {
    return this.eventsService.getSessionAttendance(sessionId);
  }

  // ========== DYNAMIC EVENT ROUTES (:id) ==========

  @Get(':id')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  async findOne(@Param('id') id: string) {
    return this.eventsService.findById(id);
  }

  @Get(':id/stats')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  async getEventStats(@Param('id') id: string) {
    return this.eventsService.getEventStats(id);
  }

  @Patch(':id')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  @AuditLog({
    action: AuditAction.EVENT_UPDATED,
    entityType: AuditEntity.EVENT,
    description: 'Updated event information',
    getEntityId: (result, request) => request.params.id,
  })
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, updateEventDto);
  }

  @Delete(':id')
  @RequirePermission(EventsPermission.DELETE_EVENT)
  @AuditLog({
    action: AuditAction.EVENT_DELETED,
    entityType: AuditEntity.EVENT,
    description: 'Deleted an event',
    severity: 'high',
    getEntityId: (result, request) => request.params.id,
  })
  async remove(@Param('id') id: string) {
    await this.eventsService.remove(id);
    return { message: 'Event deleted successfully' };
  }

  // ========== COMMITTEE MANAGEMENT ENDPOINTS ==========

  @Post(':id/committee')
  @RequirePermission(EventsPermission.MANAGE_COMMITTEE)
  @AuditLog({
    action: AuditAction.EVENT_UPDATED,
    entityType: AuditEntity.EVENT,
    description: 'Added committee member to event',
    getEntityId: (result, request) => request.params.id,
  })
  async addCommitteeMember(
    @Param('id') id: string,
    @Body() dto: AddCommitteeMemberDto,
  ) {
    return this.eventsService.addCommitteeMember(id, dto);
  }

  @Patch(':id/committee/:memberId')
  @RequirePermission(EventsPermission.MANAGE_COMMITTEE)
  @AuditLog({
    action: AuditAction.EVENT_UPDATED,
    entityType: AuditEntity.EVENT,
    description: 'Updated committee member role',
    getEntityId: (result, request) => request.params.id,
  })
  async updateCommitteeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateCommitteeMemberDto,
  ) {
    return this.eventsService.updateCommitteeMember(id, memberId, dto);
  }

  @Delete(':id/committee/:memberId')
  @RequirePermission(EventsPermission.MANAGE_COMMITTEE)
  @AuditLog({
    action: AuditAction.EVENT_UPDATED,
    entityType: AuditEntity.EVENT,
    description: 'Removed committee member from event',
    getEntityId: (result, request) => request.params.id,
  })
  async removeCommitteeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.eventsService.removeCommitteeMember(id, memberId);
  }

  // ========== REGISTRATION MANAGEMENT ENDPOINTS ==========

  @Get(':id/registrations')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  async getRegistrations(
    @Param('id') id: string,
    @Query() query: RegistrationSearchDto,
  ) {
    return this.eventsService.getRegistrations(id, query);
  }

  @Post(':id/registrations')
  @RequirePermission(EventsPermission.CREATE_REGISTRATION)
  @AuditLog({
    action: AuditAction.EVENT_REGISTRATION_CREATED,
    entityType: AuditEntity.EVENT_REGISTRATION,
    description: 'Created a registration for event',
    getEntityId: (result) => result._id.toString(),
  })
  async createRegistration(
    @Param('id') id: string,
    @Body() dto: CreateRegistrationDto,
  ) {
    return this.eventsService.createRegistration(id, dto);
  }

  @Patch(':id/registrations/:regId')
  @RequirePermission(EventsPermission.UPDATE_REGISTRATION)
  @AuditLog({
    action: AuditAction.EVENT_REGISTRATION_UPDATED,
    entityType: AuditEntity.EVENT_REGISTRATION,
    description: 'Updated registration status',
    getEntityId: (result, request) => request.params.regId,
  })
  async updateRegistrationStatus(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @Body() dto: UpdateRegistrationStatusDto,
  ) {
    return this.eventsService.updateRegistrationStatus(id, regId, dto);
  }

  @Patch(':id/registrations/:regId/check-in')
  @RequirePermission(EventsPermission.CHECK_IN)
  @AuditLog({
    action: AuditAction.EVENT_CHECK_IN,
    entityType: AuditEntity.EVENT_REGISTRATION,
    description: 'Checked in attendee',
    getEntityId: (result, request) => request.params.regId,
  })
  async checkInAttendee(
    @Param('id') id: string,
    @Param('regId') regId: string,
  ) {
    return this.eventsService.checkInAttendee(id, regId);
  }

  @Patch(':id/check-in-by-code')
  @RequirePermission(EventsPermission.CHECK_IN)
  @AuditLog({
    action: AuditAction.EVENT_CHECK_IN,
    entityType: AuditEntity.EVENT_REGISTRATION,
    description: 'Checked in attendee by code',
  })
  async checkInByCode(
    @Param('id') id: string,
    @Body('checkInCode') checkInCode: string,
  ) {
    return this.eventsService.checkInByCode(id, checkInCode);
  }

  // ========== SESSION MANAGEMENT ENDPOINTS (with event id) ==========

  @Post(':id/sessions')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  @AuditLog({
    action: AuditAction.EVENT_UPDATED,
    entityType: AuditEntity.EVENT,
    description: 'Created a new session for event',
    getEntityId: (result) => result._id.toString(),
  })
  async createSession(
    @Param('id') eventId: string,
    @Body() dto: CreateSessionDto,
  ) {
    dto.event = eventId;
    return this.eventsService.createSession(dto);
  }

  @Get(':id/sessions')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  async getSessions(
    @Param('id') eventId: string,
    @Query() query: SessionSearchDto,
  ) {
    return this.eventsService.getSessions(eventId, query);
  }

  // ========== EVENT-SPECIFIC ANALYTICS ENDPOINTS ==========

  @Get(':id/analytics')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  async getEventAnalytics(@Param('id') id: string) {
    return this.eventsService.getEventAnalytics(id);
  }

  @Get(':id/analytics/registrations')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  async getRegistrationAnalytics(@Param('id') id: string) {
    return this.eventsService.getRegistrationAnalytics(id);
  }

  @Get(':id/analytics/sessions')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  async getSessionAnalytics(@Param('id') id: string) {
    return this.eventsService.getSessionAnalytics(id);
  }

  @Get(':id/analytics/funnel')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  async getRegistrationFunnel(@Param('id') id: string) {
    return this.eventsService.getRegistrationFunnel(id);
  }

  @Get(':id/analytics/check-in')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  async getCheckInAnalytics(@Param('id') id: string) {
    return this.eventsService.getCheckInAnalytics(id);
  }

  @Get(':id/analytics/committee')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  async getCommitteeAnalytics(@Param('id') id: string) {
    return this.eventsService.getCommitteeAnalytics(id);
  }

  @Get(':id/analytics/training')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  async getTrainingCompletionSummary(@Param('id') id: string) {
    return this.eventsService.getTrainingCompletionSummary(id);
  }

  @Get(':id/analytics/attendee-progress')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  async getAttendeeProgress(@Param('id') id: string) {
    return this.eventsService.getAttendeeProgress(id);
  }

  // ========== PARTICIPANT ACCOUNTABILITY ENDPOINTS ==========

  @Get(':id/accountability')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  async getParticipantAccountability(
    @Param('id') id: string,
    @Query() query: ParticipantAccountabilityQueryDto,
  ) {
    return this.eventsService.getParticipantAccountability(id, query);
  }

  @Get(':id/accountability/report')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  async getTrainingAccountabilityReport(
    @Param('id') id: string,
    @Query() query: ParticipantAccountabilityQueryDto,
  ) {
    return this.eventsService.getTrainingAccountabilityReport(id, query);
  }
}
