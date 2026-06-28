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
  Headers,
  UnauthorizedException,
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
  UpdateRegistrationDetailsDto,
  RegistrationSearchDto,
} from './dto/create-registration.dto';
import { PublicRegistrationDto } from './dto/public-registration.dto';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import {
  CreateSessionDto,
  UpdateSessionDto,
  RecordSessionAttendanceDto,
  BulkRecordAttendanceDto,
  RecordAssessmentResultDto,
  SessionSearchDto,
} from './dto/session.dto';
import {
  UpdatePartnerStatusDto,
  UpdatePartnerDetailsDto,
  QueryPartnersDto,
  ContactPartnerDto,
} from './dto/partner.dto';
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

      const scopedEventIds = currentMember.scopedEventIds?.length
        ? currentMember.scopedEventIds
        : undefined;

      // Scoped event IDs override branch filtering — the explicit list IS the access control
      return await this.eventsService.findAll(
        query,
        scopedEventIds ? undefined : branchFilterContext,
        scopedEventIds,
      );
    } catch (error) {
      throw new BadRequestException('Failed to fetch events');
    }
  }

  // Events the current member facilitates (committee/organizer) — powers the
  // facilitator dashboard event picker. Admins with MANAGE_EVENTS see all.
  // MUST be declared before the ':id' route below.
  @Get('mine')
  @RequirePermission(EventsPermission.VIEW_EVENTS)
  async myEvents(@Request() req) {
    const currentMember = req.user;
    let canViewAll = false;
    if (currentMember?.role) {
      const userPermissions =
        await this.userPermissionsService.getUserPermissions(
          currentMember.role._id || currentMember.role,
        );
      canViewAll = userPermissions.permissions?.includes(
        EventsPermission.DELETE_EVENT,
      );
    }
    return this.eventsService.getEventsForFacilitator(currentMember, canViewAll);
  }

  // ========== PUBLIC ENDPOINTS (No Auth) - MUST BE BEFORE :id ROUTES ==========

  // Helper to validate API key for events in API integration mode
  private async validateApiKey(slug: string, apiKey?: string) {
    const event = await this.eventsService.findBySlug(slug);
    if (event.registrationSettings?.integrationMode === 'api') {
      if (!apiKey || apiKey !== event.registrationSettings.apiKey) {
        throw new UnauthorizedException(
          'Invalid or missing API key. Include the x-api-key header for API-integrated events.',
        );
      }
    }
    return event;
  }

  @Get('public/:slug')
  @Public()
  async getPublicEvent(
    @Param('slug') slug: string,
    @Headers('x-api-key') apiKey?: string,
  ) {
    const event = await this.validateApiKey(slug, apiKey);

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
        formLayout: event.registrationSettings?.formLayout,
        formSections: event.registrationSettings?.formSections,
        formHeader: event.registrationSettings?.formHeader,
        successMessage: event.registrationSettings?.successMessage,
        termsAndConditions: event.registrationSettings?.termsAndConditions,
        qrCodeEnabled: event.registrationSettings?.qrCodeEnabled,
        formStatus: event.registrationSettings?.formStatus,
        integrationMode: event.registrationSettings?.integrationMode || 'embedded',
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
    @Headers('x-api-key') apiKey?: string,
  ) {
    await this.validateApiKey(slug, apiKey);

    const registration = await this.eventsService.publicRegister(slug, dto);

    return {
      success: true,
      message: `You've been successfully registered, ${registration.attendeeInfo.firstName}! We look forward to seeing you.`,
      registrationId: registration._id,
      applicationToken: registration.applicationToken,
    };
  }

  // ===== Public per-registrant application form (unique token link) =====

  @Get('public/applications/:token')
  @Public()
  async getPublicApplication(@Param('token') token: string) {
    return this.eventsService.getApplicationByToken(token);
  }

  @Patch('public/applications/:token')
  @Public()
  async submitPublicApplication(
    @Param('token') token: string,
    @Body() dto: SubmitApplicationDto,
  ) {
    const registration = await this.eventsService.submitApplicationByToken(
      token,
      dto,
    );

    const firstName = registration.attendeeInfo.firstName;
    return {
      success: true,
      submitted: dto.submit !== false,
      message:
        dto.submit === false
          ? `Saved, ${firstName}. You can come back to this link and finish anytime.`
          : `Thank you, ${firstName}! Your application has been received.`,
    };
  }

  @Post('public/:slug/partner')
  @Public()
  async submitPartnership(
    @Param('slug') slug: string,
    @Body() partnerDto: { name: string; company?: string; email: string; phone: string; interestDetails: string },
    @Headers('x-api-key') apiKey?: string,
  ) {
    await this.validateApiKey(slug, apiKey);

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

  @Post(':id/regenerate-api-key')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async regenerateApiKey(@Param('id') id: string) {
    return this.eventsService.regenerateApiKey(id);
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

  @Get(':id/registrations/:regId/next')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  async getNextRegistration(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @Query('applied') applied?: 'yes' | 'no' | 'any',
  ) {
    return this.eventsService.getNextRegistration(
      id,
      regId,
      applied === 'yes' || applied === 'any' ? applied : 'no',
    );
  }

  @Get(':id/registrations/:regId')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  async getRegistration(
    @Param('id') id: string,
    @Param('regId') regId: string,
  ) {
    return this.eventsService.getRegistrationById(id, regId);
  }

  @Patch(':id/registrations/:regId/accept')
  @RequirePermission(EventsPermission.UPDATE_REGISTRATION)
  async acceptRegistration(
    @Param('id') id: string,
    @Param('regId') regId: string,
  ) {
    const result = await this.eventsService.setAdmission(id, regId, 'accepted');
    return {
      ...result,
      message: result.invitedEmail
        ? `Accepted. Portal invite sent to ${result.invitedEmail}.`
        : 'Accepted.',
    };
  }

  @Patch(':id/registrations/:regId/reject')
  @RequirePermission(EventsPermission.UPDATE_REGISTRATION)
  async rejectRegistration(
    @Param('id') id: string,
    @Param('regId') regId: string,
  ) {
    return this.eventsService.setAdmission(id, regId, 'rejected');
  }

  // Facilitator announcement / broadcast to an event's attendees. Queues one
  // branded email per recipient. Omit registrationIds to email everyone; pass
  // registrationIds (e.g. accepted attendees) to target a subset.
  @Post(':id/announcements')
  @RequirePermission(EventsPermission.SEND_EMAILS)
  async sendAnnouncement(
    @Param('id') id: string,
    @Body()
    body: {
      subject: string;
      message: string;
      registrationIds?: string[];
      scheduledFor?: string;
    },
  ) {
    const result = await this.eventsService.sendBulkEmailToRegistrants(id, {
      subject: body.subject,
      message: body.message,
      registrationIds: body.registrationIds,
      scheduledFor: body.scheduledFor,
    });
    return {
      success: true,
      message: `Announcement queued for ${result.recipientCount} recipient(s).`,
      ...result,
    };
  }

  @Post(':id/registrations/:regId/regenerate-application-link')
  @RequirePermission(EventsPermission.UPDATE_REGISTRATION)
  async regenerateApplicationLink(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @Body() body: { email?: string },
  ) {
    const result = await this.eventsService.regenerateApplicationLink(
      id,
      regId,
      body?.email,
    );
    return {
      success: true,
      message: result.sentTo
        ? `New application link generated and sent to ${result.sentTo}.`
        : 'New application link generated.',
      ...result,
    };
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

  @Patch(':id/registrations/:regId/details')
  @RequirePermission(EventsPermission.UPDATE_REGISTRATION)
  async updateRegistrationDetails(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @Body() dto: UpdateRegistrationDetailsDto,
  ) {
    return this.eventsService.updateRegistrationDetails(id, regId, dto);
  }

  @Delete(':id/registrations/:regId')
  @RequirePermission(EventsPermission.UPDATE_REGISTRATION)
  async deleteRegistration(
    @Param('id') id: string,
    @Param('regId') regId: string,
  ) {
    return this.eventsService.deleteRegistration(id, regId);
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

  // ========== PARTNER MANAGEMENT ENDPOINTS ==========

  @Get(':id/partners')
  @RequirePermission(EventsPermission.VIEW_EVENTS)
  async getPartners(
    @Param('id') id: string,
    @Query() query: QueryPartnersDto,
  ) {
    return this.eventsService.getPartners(id, query);
  }

  @Patch(':id/partners/:partnerId/status')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async updatePartnerStatus(
    @Param('id') id: string,
    @Param('partnerId') partnerId: string,
    @Body() updateDto: UpdatePartnerStatusDto,
  ) {
    return this.eventsService.updatePartnerStatus(id, partnerId, updateDto);
  }

  @Post(':id/partners/:partnerId/contact')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async contactPartner(
    @Param('id') id: string,
    @Param('partnerId') partnerId: string,
    @Body() contactDto: ContactPartnerDto,
  ) {
    return this.eventsService.contactPartner(id, partnerId, contactDto);
  }

  @Patch(':id/partners/:partnerId/details')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async updatePartnerDetails(
    @Param('id') id: string,
    @Param('partnerId') partnerId: string,
    @Body() dto: UpdatePartnerDetailsDto,
  ) {
    return this.eventsService.updatePartnerDetails(id, partnerId, dto);
  }

  @Delete(':id/partners/:partnerId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async deletePartner(
    @Param('id') id: string,
    @Param('partnerId') partnerId: string,
  ) {
    return this.eventsService.deletePartner(id, partnerId);
  }

  // ========== TESTIMONY ENDPOINTS ==========

  @Get('public/:slug/testimony-form')
  @Public()
  async getTestimonyFormInfo(@Param('slug') slug: string) {
    return this.eventsService.getTestimonyFormInfo(slug);
  }

  @Post('public/:slug/testimonies')
  @Public()
  async submitTestimony(
    @Param('slug') slug: string,
    @Body()
    body: {
      fullName: string;
      email?: string;
      phone?: string;
      testimony: string;
      title?: string;
      isAnonymous?: boolean;
    },
  ) {
    return this.eventsService.submitTestimony(slug, body);
  }

  @Post(':id/testimony-form/enable')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async enableTestimonyForm(@Param('id') id: string) {
    return this.eventsService.enableTestimonyForm(id);
  }

  @Post(':id/testimony-form/disable')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async disableTestimonyForm(@Param('id') id: string) {
    return this.eventsService.disableTestimonyForm(id);
  }

  @Get(':id/testimonies')
  @RequirePermission(EventsPermission.VIEW_EVENTS)
  async getTestimonies(
    @Param('id') id: string,
    @Query() query: { page?: number; limit?: number; search?: string },
  ) {
    return this.eventsService.getTestimonies(id, query);
  }

  @Patch('testimonies/:testimonyId/toggle-featured')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async toggleTestimonyFeatured(@Param('testimonyId') testimonyId: string) {
    return this.eventsService.toggleTestimonyFeatured(testimonyId);
  }

  @Delete('testimonies/:testimonyId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async deleteTestimony(@Param('testimonyId') testimonyId: string) {
    await this.eventsService.deleteTestimony(testimonyId);
    return { message: 'Testimony deleted successfully' };
  }

  @Post(':id/testimony-form/link')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async linkTestimonyForm(
    @Param('id') id: string,
    @Body('formId') formId: string,
  ) {
    return this.eventsService.linkTestimonyForm(id, formId);
  }

  @Post(':id/testimony-form/unlink')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async unlinkTestimonyForm(@Param('id') id: string) {
    return this.eventsService.unlinkTestimonyForm(id);
  }

  // ==================== Feedback Endpoints ====================

  @Get('public/:slug/feedback-form')
  @Public()
  async getFeedbackFormInfo(@Param('slug') slug: string) {
    return this.eventsService.getFeedbackFormInfo(slug);
  }

  @Post('public/:slug/feedbacks')
  @Public()
  async submitFeedback(
    @Param('slug') slug: string,
    @Body()
    body: {
      fullName: string;
      email?: string;
      rating?: number;
      message: string;
      isAnonymous?: boolean;
    },
  ) {
    return this.eventsService.submitFeedback(slug, body);
  }

  @Post(':id/feedback-form/enable')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async enableFeedbackForm(@Param('id') id: string) {
    return this.eventsService.enableFeedbackForm(id);
  }

  @Post(':id/feedback-form/disable')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async disableFeedbackForm(@Param('id') id: string) {
    return this.eventsService.disableFeedbackForm(id);
  }

  @Get(':id/feedbacks')
  @RequirePermission(EventsPermission.VIEW_EVENTS)
  async getFeedbacks(
    @Param('id') id: string,
    @Query() query: { page?: number; limit?: number; search?: string },
  ) {
    return this.eventsService.getFeedbacks(id, query);
  }

  @Delete('feedbacks/:feedbackId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async deleteFeedback(@Param('feedbackId') feedbackId: string) {
    await this.eventsService.deleteFeedback(feedbackId);
    return { message: 'Feedback deleted successfully' };
  }

  @Post(':id/feedback-form/link')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async linkFeedbackForm(
    @Param('id') id: string,
    @Body('formId') formId: string,
  ) {
    return this.eventsService.linkFeedbackForm(id, formId);
  }

  @Post(':id/feedback-form/unlink')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  async unlinkFeedbackForm(@Param('id') id: string) {
    return this.eventsService.unlinkFeedbackForm(id);
  }
}
