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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FirstTimersService } from './first-timers.service';
import { FirstTimerMessagingService } from './first-timer-messaging.service';
import { CallReportsService } from './call-reports.service';
import { CreateFirstTimerDto } from './dto/create-first-timer.dto';
import { PublicCreateFirstTimerDto } from './dto/public-first-timer.dto';
import { AddFollowUpDto } from './dto/add-follow-up.dto';
import { AssignFollowUpDto } from './dto/assign-follow-up.dto';
import { FirstTimerSearchDto } from './dto/first-timer-search.dto';
import { BulkUploadResultDto } from './dto/bulk-upload-first-timer.dto';
import { CreateCallReportDto } from './dto/create-call-report.dto';
import {
  SetPreFilledMessageDto,
  BulkSetMessageDto,
} from './dto/set-message.dto';
import {
  EditScheduledMessageDto,
  MessageHistoryQueryDto,
} from './dto/edit-message.dto';
import {
  CreateDailyMessageDto,
  DailyMessageQueryDto,
  ApproveDailyMessageDto,
  RejectDailyMessageDto,
} from './dto/daily-message.dto';
import { UpdateIntegrationStageDto } from './dto/update-integration-stage.dto';
import { CSVParserUtil } from '../common/utils/csv-parser.util';
import { QueueService } from '../queue/queue.service';
import { JobType } from '../common/interfaces/queue-job.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { FirstTimersPermission } from './permissions';
import { EngagementStatus } from '../common/enums/engagement-status.enum';
import { FirstTimer } from './schemas/first-timer.schema';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-roles.enums';
import { Public } from '../common/decorators/public.decorator';
import { ResponseUtil } from '../common/utils/response.util';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';

@ApiTags('First Timers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('first-timers')
export class FirstTimersController {
  constructor(
    private readonly firstTimersService: FirstTimersService,
    private readonly firstTimerMessagingService: FirstTimerMessagingService,
    private readonly callReportsService: CallReportsService,
    private readonly queueService: QueueService,
  ) {}

  @Get('public/form-config')
  @Public()
  @ApiTags('Public API')
  @ApiOperation({
    summary: 'Get public registration form configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Public form configuration retrieved successfully',
  })
  async getPublicFormConfig() {
    return ResponseUtil.success(
      {
        title: 'Welcome to Our Church!',
        subtitle: "We're excited to connect with you",
        successMessage:
          'Thank you for your interest! Our team will contact you soon.',
        fields: {
          firstName: { required: true, label: 'First Name' },
          lastName: { required: true, label: 'Last Name' },
          phone: { required: true, label: 'Phone Number' },
          email: { required: true, label: 'Email Address' },
          address: { required: false, label: 'Address' },
          dateOfBirth: { required: false, label: 'Date of Birth' },
          occupation: { required: false, label: 'Occupation' },
          howDidYouHear: {
            required: false,
            label: 'How did you hear about us?',
            options: [
              'friend',
              'family',
              'advertisement',
              'online',
              'event',
              'walkby',
              'website',
              'social_media',
              'other',
            ],
          },
          interestedInJoining: {
            required: false,
            label: 'Interested in joining our church?',
          },
          prayerRequests: { required: false, label: 'Prayer Requests' },
          servingInterests: {
            required: false,
            label: 'Areas of Interest for Serving',
          },
          notes: { required: false, label: 'Additional Comments' },
        },
      },
      'Public form configuration retrieved successfully',
    );
  }

  @Post('public')
  @Public()
  @ApiTags('Public API')
  @ApiOperation({
    summary: 'Register a new first-time visitor (Public endpoint)',
  })
  @ApiResponse({
    status: 201,
    description: 'First-timer registered successfully from public domain',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async createPublic(@Body() createFirstTimerDto: PublicCreateFirstTimerDto) {
    try {
      const existingByPhoneAndEmail =
        await this.firstTimersService.findByPhoneAndEmail(
          createFirstTimerDto.phone,
          createFirstTimerDto.email,
        );
      if (existingByPhoneAndEmail) {
        throw new ConflictException(
          `Duplicate phone and email detected: ${createFirstTimerDto.phone} and ${createFirstTimerDto.email} - already exists for ${existingByPhoneAndEmail.firstName} ${existingByPhoneAndEmail.lastName} (${existingByPhoneAndEmail._id})`,
        );
      }

      // Convert public DTO to internal DTO and add metadata
      // Extract only the relevant properties and ignore the ones that should be handled internally
      const {
        dateOfBirth,
        occupation,
        serviceType,
        status,
        converted,
        followUps,
        tags,
        dateOfVisit: ignoredDateOfVisit,
        ...relevantData
      } = createFirstTimerDto;

      // Handle interestedInJoining field properly
      const interestedInJoining = createFirstTimerDto.interestedInJoining;
      let validInterestedInJoining: string | undefined = undefined;

      if (
        interestedInJoining &&
        ['yes', 'no', 'maybe'].includes(interestedInJoining)
      ) {
        validInterestedInJoining = interestedInJoining;
      }

      const internalDto: CreateFirstTimerDto = {
        ...relevantData,
        dateOfVisit: new Date().toISOString().split('T')[0], // Set to today
        interestedInJoining: validInterestedInJoining,
        notes: createFirstTimerDto.notes
          ? `[PUBLIC DOMAIN] ${createFirstTimerDto.notes}`
          : '[PUBLIC DOMAIN] Registration from website/public form',
        howDidYouHear: createFirstTimerDto.howDidYouHear || 'website',
        visitorType: createFirstTimerDto.visitorType || 'first_time',
      };

      const firstTimer = await this.firstTimersService.create(internalDto);

      // Skip auto-creation of daily message entry - messages will be created manually

      // Automatically set up message scheduling for public registrations
      const defaultMessage = `Hello ${firstTimer.firstName},\n\nThank you so much for visiting our church! We're thrilled that you chose to worship with us.\n\nOur follow-up team will be reaching out to you soon to help you get better connected with our church family. In the meantime, we hope you'll consider joining us again for our next service.\n\nIf you have any questions or need anything at all, please don't hesitate to reach out.\n\nBlessings,\nThe Church Team`;

      try {
        await this.firstTimerMessagingService.setPreFilledMessage(
          (firstTimer._id as any).toString(),
          defaultMessage,
        );
      } catch (error) {
        // Log error but don't fail the registration
        console.error(
          'Failed to set pre-filled message for public registration:',
          error,
        );
      }

      return ResponseUtil.success(
        {
          id: firstTimer._id as any,
          firstName: firstTimer.firstName,
          lastName: firstTimer.lastName,
          status: firstTimer.status,
          message:
            'Thank you for your interest! Our team will contact you soon.',
        },
        'First-timer registration completed successfully',
      );
    } catch (error) {
      // Re-throw ConflictException as-is
      if (error instanceof ConflictException) {
        throw error;
      }

      // Log the error for debugging
      console.error('Error in createPublic:', error);

      // For other errors, return a user-friendly error response
      throw new BadRequestException(
        'We encountered an issue while processing your registration. Please try again or contact support if the problem persists.',
      );
    }
  }

  @Post()
  @RequirePermission(FirstTimersPermission.CREATE_FIRST_TIMER)
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.FIRST_TIMER,
    description: 'Registered a new first-time visitor',
    getEntityId: (result) => result.data._id.toString(),
  })
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

    // Skip auto-creation of daily message entry - messages will be created manually

    return ResponseUtil.success(
      firstTimer,
      'First-timer registered successfully',
    );
  }

  @Get()
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMERS)
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
    if (user.roles === UserRole.LXL) {
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
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMER_STATS)
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
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMERS)
  @ApiOperation({ summary: 'Get first-timers needing follow-up' })
  @ApiResponse({
    status: 200,
    description: 'First-timers needing follow-up retrieved successfully',
  })
  async getNeedingFollowUp(
    @CurrentUser() user: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;

    const firstTimers = await this.firstTimersService.getNeedingFollowUp(
      pageNum,
      limitNum,
    );

    // Filter by assigned user for follow-up team
    if (user.roles === UserRole.LXL) {
      firstTimers.data = firstTimers.data.filter(
        (ft) => !ft.assignedTo || ft.assignedTo.toString() === user._id,
      );
    }

    return ResponseUtil.success(
      firstTimers,
      'First-timers needing follow-up retrieved successfully',
    );
  }

  @Get('recent')
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMERS)
  @ApiOperation({ summary: 'Get recent visitors' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days to look back (default: 7)',
  })
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
    description: 'Recent visitors retrieved successfully',
  })
  async getRecentVisitors(
    @Query('days') days?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const daysBack = days ? parseInt(days) : 7;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;

    const visitors = await this.firstTimersService.getRecentVisitors(
      daysBack,
      pageNum,
      limitNum,
    );
    return ResponseUtil.success(
      visitors,
      'Recent visitors retrieved successfully',
    );
  }

  @Get('my-assignments')
  @RequirePermission(FirstTimersPermission.VIEW_ASSIGNED_FIRST_TIMERS)
  @ApiOperation({ summary: 'Get first-timers assigned to current user' })
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
    description: 'Assigned first-timers retrieved successfully',
  })
  async getMyAssignments(
    @CurrentUser() user: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;

    console.log('DEBUG: getMyAssignments called for user:', {
      userId: user._id,
      userEmail: user.email,
      userRoles: user.roles,
      page: pageNum,
      limit: limitNum,
    });

    const assignments = await this.firstTimersService.getByAssignedMember(
      user._id.toString(),
      pageNum,
      limitNum,
    );

    console.log('DEBUG: Found assignments:', {
      total: assignments.total,
      dataCount: assignments.data?.length || 0,
      page: assignments.page,
      totalPages: assignments.totalPages,
      hasNext: assignments.hasNext,
      hasPrev: assignments.hasPrev,
    });

    return ResponseUtil.success(
      assignments,
      'Your assignments retrieved successfully',
    );
  }

  // Daily Messaging Endpoints (must be before :id route)
  @Get('daily-messages')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Get all daily messages with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Daily messages retrieved successfully',
  })
  async getDailyMessages(@Query() query: DailyMessageQueryDto) {
    const result = await this.firstTimerMessagingService.getDailyMessages(
      query.page,
      query.limit,
      query.status,
    );
    return ResponseUtil.success(
      result,
      'Daily messages retrieved successfully',
    );
  }

  @Post('daily-message')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Create a daily message for first timers' })
  @ApiResponse({
    status: 201,
    description: 'Daily message created successfully',
  })
  async createDailyMessage(
    @Body() createDailyMessageDto: CreateDailyMessageDto,
    @CurrentUser() user: any,
  ) {
    const date = new Date(createDailyMessageDto.date);
    const scheduledTime = createDailyMessageDto.scheduledTime
      ? new Date(createDailyMessageDto.scheduledTime)
      : undefined;

    const dailyMessage =
      await this.firstTimerMessagingService.createDailyMessage(
        date,
        createDailyMessageDto.message,
        createDailyMessageDto.firstTimerIds,
        user?.id,
        scheduledTime,
        createDailyMessageDto.autoSend || false,
        createDailyMessageDto.requiresApproval !== undefined
          ? createDailyMessageDto.requiresApproval
          : true,
        createDailyMessageDto.approverId,
      );

    // If auto-send is enabled and doesn't require approval, send immediately
    if (createDailyMessageDto.autoSend && !createDailyMessageDto.requiresApproval) {
      await this.firstTimerMessagingService.sendDailyMessageNow(
        (dailyMessage._id as any).toString(),
        user?.id,
      );
    }

    return ResponseUtil.success(
      dailyMessage,
      'Daily message created successfully',
    );
  }

  @Get('daily-message/:date')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Get or create daily message for a specific date' })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiResponse({
    status: 200,
    description: 'Daily message retrieved or created successfully',
  })
  async getDailyMessage(@Param('date') dateString: string) {
    // Try to get existing message or create one if there are first timers for this date
    const dailyMessage =
      await this.firstTimerMessagingService.getOrCreateDailyMessageEntry(
        dateString,
      );

    if (!dailyMessage) {
      return ResponseUtil.success(null, 'No first timers found for this date');
    }

    return ResponseUtil.success(
      dailyMessage,
      'Daily message retrieved successfully',
    );
  }

  @Patch('daily-message/:id')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Update a daily message' })
  @ApiParam({ name: 'id', description: 'Daily message ID' })
  @ApiResponse({
    status: 200,
    description: 'Daily message updated successfully',
  })
  async updateDailyMessage(
    @Param('id') dailyMessageId: string,
    @Body()
    updateData: { message: string; scheduledTime?: string; autoSend: boolean },
    @CurrentUser() user: any,
  ) {
    const scheduledTime = updateData.scheduledTime
      ? new Date(updateData.scheduledTime)
      : undefined;

    const updatedMessage =
      await this.firstTimerMessagingService.updateDailyMessage(
        dailyMessageId,
        updateData.message,
        scheduledTime,
        updateData.autoSend,
        user?.id,
      );

    return ResponseUtil.success(
      updatedMessage,
      'Daily message updated successfully',
    );
  }

  @Delete('daily-message/:id')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Delete a daily message' })
  @ApiParam({ name: 'id', description: 'Daily message ID' })
  @ApiResponse({
    status: 200,
    description: 'Daily message deleted successfully',
  })
  async deleteDailyMessage(
    @Param('id') dailyMessageId: string,
    @CurrentUser() user: any,
  ) {
    await this.firstTimerMessagingService.deleteDailyMessage(
      dailyMessageId,
      user?.id,
    );
    return ResponseUtil.success(null, 'Daily message deleted successfully');
  }

  @Post('daily-message/:id/send-now')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Send a scheduled daily message immediately' })
  @ApiParam({ name: 'id', description: 'Daily message ID' })
  @ApiResponse({
    status: 200,
    description: 'Daily message sent successfully',
  })
  async sendDailyMessageNow(
    @Param('id') dailyMessageId: string,
    @CurrentUser() user: any,
  ) {
    await this.firstTimerMessagingService.sendDailyMessageNow(
      dailyMessageId,
      user?.id,
    );
    return ResponseUtil.success(null, 'Daily message sent successfully');
  }

  @Post('daily-message/:id/submit-for-approval')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Submit a draft message for approval' })
  @ApiParam({ name: 'id', description: 'Daily message ID' })
  @ApiResponse({
    status: 200,
    description: 'Message submitted for approval successfully',
  })
  async submitDraftForApproval(
    @Param('id') dailyMessageId: string,
    @Body() body: { approverId: string },
    @CurrentUser() user: any,
  ) {
    const updatedMessage =
      await this.firstTimerMessagingService.submitForApproval(
        dailyMessageId,
        body.approverId,
      );
    return ResponseUtil.success(
      updatedMessage,
      'Message submitted for approval successfully',
    );
  }

  @Post('daily-message/:id/approve')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Approve a pending daily message' })
  @ApiParam({ name: 'id', description: 'Daily message ID' })
  @ApiResponse({
    status: 200,
    description: 'Message approved successfully',
  })
  async approveDailyMessage(
    @Param('id') dailyMessageId: string,
    @Body() approveDto: ApproveDailyMessageDto,
    @CurrentUser() user: any,
  ) {
    const scheduledTime = approveDto.scheduledTime
      ? new Date(approveDto.scheduledTime)
      : undefined;

    const updatedMessage =
      await this.firstTimerMessagingService.approveDailyMessage(
        dailyMessageId,
        user?.id,
        {
          message: approveDto.message,
          scheduledTime,
          sendImmediately: approveDto.sendImmediately,
        },
      );

    return ResponseUtil.success(
      updatedMessage,
      'Message approved successfully',
    );
  }

  @Post('daily-message/:id/reject')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Reject a pending daily message' })
  @ApiParam({ name: 'id', description: 'Daily message ID' })
  @ApiResponse({
    status: 200,
    description: 'Message rejected successfully',
  })
  async rejectDailyMessage(
    @Param('id') dailyMessageId: string,
    @Body() rejectDto: RejectDailyMessageDto,
    @CurrentUser() user: any,
  ) {
    const updatedMessage =
      await this.firstTimerMessagingService.rejectDailyMessage(
        dailyMessageId,
        user?.id,
        rejectDto.rejectionReason,
      );

    return ResponseUtil.success(
      updatedMessage,
      'Message rejected successfully',
    );
  }

  @Get('daily-message/pending-approvals/my-approvals')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Get messages pending approval for current user' })
  @ApiResponse({
    status: 200,
    description: 'Pending approvals retrieved successfully',
  })
  async getMyPendingApprovals(@CurrentUser() user: any) {
    const pendingApprovals =
      await this.firstTimerMessagingService.getPendingApprovals(user?.id);

    return ResponseUtil.success(
      pendingApprovals,
      'Pending approvals retrieved successfully',
    );
  }

  // Call Reports Analytics Endpoints - MUST BE BEFORE :id route
  @Get('call-reports/analytics/global')
  @RequirePermission(FirstTimersPermission.VIEW_CALL_REPORTS)
  @ApiOperation({ summary: 'Get global call reports analytics' })
  @ApiResponse({
    status: 200,
    description: 'Global analytics retrieved successfully',
  })
  async getGlobalCallReportsAnalytics() {
    const analytics =
      await this.callReportsService.getGlobalCallReportsAnalytics();
    return ResponseUtil.success(
      analytics,
      'Global analytics retrieved successfully',
    );
  }

  @Get('call-reports/analytics/team-performance')
  @RequirePermission(FirstTimersPermission.VIEW_CALL_REPORTS)
  @ApiOperation({ summary: 'Get team performance analytics for call reports' })
  @ApiResponse({
    status: 200,
    description: 'Team performance analytics retrieved successfully',
  })
  async getTeamPerformanceAnalytics() {
    const analytics =
      await this.callReportsService.getTeamPerformanceAnalytics();
    return ResponseUtil.success(
      analytics,
      'Team performance analytics retrieved successfully',
    );
  }

  @Get('call-reports/overdue')
  @RequirePermission(FirstTimersPermission.VIEW_CALL_REPORTS)
  @ApiOperation({ summary: 'Get overdue call reports and first timers' })
  @ApiResponse({
    status: 200,
    description: 'Overdue reports retrieved successfully',
  })
  async getOverdueReports(@CurrentUser() user: any) {
    const overdueReports = await this.callReportsService.getOverdueReports();

    // Filter by assigned user for follow-up team
    let filteredReports = overdueReports;
    if (user.roles === UserRole.LXL) {
      filteredReports = overdueReports.filter(
        (report) => report.assignedTo?._id === user._id,
      );
    }

    return ResponseUtil.success(
      filteredReports,
      'Overdue reports retrieved successfully',
    );
  }

  @Get('call-reports/search')
  @RequirePermission(FirstTimersPermission.VIEW_CALL_REPORTS)
  @ApiOperation({ summary: 'Search and filter call reports' })
  @ApiResponse({
    status: 200,
    description: 'Call reports search results retrieved successfully',
  })
  async searchCallReports(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('contactMethod') contactMethod?: string,
    @Query('callMadeBy') callMadeBy?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('firstTimerName') firstTimerName?: string,
  ) {
    const searchParams = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      status,
      contactMethod,
      callMadeBy,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      firstTimerName,
    };

    const results =
      await this.callReportsService.searchCallReports(searchParams);
    return ResponseUtil.success(
      results,
      'Search results retrieved successfully',
    );
  }

  @Get(':id')
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMER_DETAILS)
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
    if (user.roles === UserRole.LXL) {
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

  @Patch(':id')
  @RequirePermission(FirstTimersPermission.UPDATE_FIRST_TIMER)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.FIRST_TIMER,
    description: 'Updated first-timer information',
    getEntityId: (result, request) => request.params.id,
  })
  @ApiOperation({ summary: 'Update first-timer details' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({
    status: 200,
    description: 'First-timer updated successfully',
  })
  async update(
    @Param('id') id: string,
    @Body() updateFirstTimerDto: Partial<FirstTimer>,
    @CurrentUser() user: any,
  ) {
    // Check access for follow-up team - they can only update their assignments
    if (user.systemRoles.includes(UserRole.MEMBER)) {
      const firstTimer = await this.firstTimersService.findById(id);
      if (
        firstTimer?.assignedTo &&
        firstTimer.assignedTo.toString() !== user._id
      ) {
        return ResponseUtil.error('Access denied - not your assignment');
      }
    }
    const firstTimer = await this.firstTimersService.update(
      id,
      updateFirstTimerDto,
    );
    return ResponseUtil.success(firstTimer, 'First-timer updated successfully');
  }

  @Patch(':id/follow-up')
  @RequirePermission(FirstTimersPermission.UPDATE_FOLLOW_UP_STATUS)
  @ApiOperation({ summary: 'Add follow-up record to first-timer' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({ status: 200, description: 'Follow-up added successfully' })
  async addFollowUp(
    @Param('id') id: string,
    @Body() followUpDto: AddFollowUpDto,
    @CurrentUser() user: any,
  ) {
    // Auto-set the contactedBy field to current user if not provided
    if (!followUpDto.contactedBy) {
      followUpDto.contactedBy = user._id;
    }

    const firstTimer = await this.firstTimersService.addFollowUp(
      id,
      followUpDto,
    );
    return ResponseUtil.success(firstTimer, 'Follow-up added successfully');
  }

  @Patch(':id/status')
  @RequirePermission(FirstTimersPermission.UPDATE_FIRST_TIMER)
  @ApiOperation({ summary: 'Update first-timer engagement status' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: EngagementStatus },
  ) {
    const firstTimer = await this.firstTimersService.update(id, {
      status: body.status,
    });
    return ResponseUtil.success(firstTimer, 'Status updated successfully');
  }

  @Patch(':id/assign/:memberId')
  @RequirePermission(FirstTimersPermission.ASSIGN_FIRST_TIMER)
  @ApiOperation({ summary: 'Assign first-timer to a follow-up team member' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID to assign to' })
  @ApiResponse({
    status: 200,
    description: 'First-timer assigned successfully',
  })
  async assignToMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
  ) {
    const assignedBy = `${user.firstName} ${user.lastName}`;
    const firstTimer = await this.firstTimersService.assignToMember(
      id,
      memberId,
      assignedBy,
    );
    return ResponseUtil.success(
      firstTimer,
      'First-timer assigned successfully',
    );
  }

  @Patch(':id/convert')
  @RequirePermission(FirstTimersPermission.CONVERT_TO_MEMBER)
  @ApiOperation({ summary: 'Convert first-timer to member' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({
    status: 200,
    description: 'First-timer converted to member successfully',
  })
  async convertToMember(
    @Param('id') id: string,
    @Body() body: { memberRecordId?: string } = {},
  ) {
    const firstTimer = await this.firstTimersService.convertToMember(
      id,
      body?.memberRecordId,
    );
    return ResponseUtil.success(
      firstTimer,
      'First-timer converted to member successfully',
    );
  }

  @Patch(':id/assign')
  @RequirePermission(FirstTimersPermission.ASSIGN_FIRST_TIMER)
  @ApiOperation({ summary: 'Assign follow-up person to first-timer' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({
    status: 200,
    description: 'Follow-up person assigned successfully',
  })
  async assignFollowUp(
    @Param('id') id: string,
    @Body() assignDto: AssignFollowUpDto,
    @CurrentUser() user: any,
  ) {
    const assignedBy = `${user.firstName} ${user.lastName}`;
    const firstTimer = await this.firstTimersService.assignFollowUp(
      id,
      assignDto.followUpPersonId,
      assignedBy,
    );
    return ResponseUtil.success(
      firstTimer,
      'Follow-up person assigned successfully',
    );
  }

  @Get('pending-district')
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMERS)
  @ApiOperation({ summary: 'Get first-timers pending district assignment' })
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
    description: 'Pending district assignments retrieved successfully',
  })
  async getPendingDistrictAssignments(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;

    const pendingMembers =
      await this.firstTimersService.getPendingDistrictAssignments(
        pageNum,
        limitNum,
      );
    return ResponseUtil.success(
      pendingMembers,
      'Pending district assignments retrieved successfully',
    );
  }

  @Patch(':id/notes')
  @RequirePermission(FirstTimersPermission.UPDATE_FIRST_TIMER)
  @ApiOperation({ summary: 'Update first-timer notes' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({ status: 200, description: 'Notes updated successfully' })
  async updateNotes(
    @Param('id') id: string,
    @Body() body: { notes: string },
    @CurrentUser() user: any,
  ) {
    // Check access for follow-up team
    if (user.roles === UserRole.LXL) {
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
  @RequirePermission(FirstTimersPermission.ARCHIVE_FIRST_TIMER)
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

  @Delete('bulk')
  @RequirePermission(FirstTimersPermission.DELETE_FIRST_TIMER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk delete first-timers (super admin only)' })
  @ApiBody({
    description: 'Array of first-timer IDs to delete',
    schema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          example: ['6123456789abcdef01234567', '7123456789abcdef01234567'],
        },
      },
      required: ['ids'],
    },
  })
  @ApiResponse({
    status: 204,
    description: 'First-timers deleted successfully',
  })
  async bulkRemove(@Body() body: { ids: string[] }) {
    const deletedCount = await this.firstTimersService.bulkRemove(body.ids);
    return ResponseUtil.success(
      { deletedCount },
      'First-timers deleted successfully',
    );
  }

  @Delete(':id')
  @RequirePermission(FirstTimersPermission.DELETE_FIRST_TIMER)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.FIRST_TIMER,
    description: 'Deleted a first-timer record',
    severity: 'high',
    getEntityId: (result, request) => request.params.id,
  })
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
  @RequirePermission(FirstTimersPermission.ASSIGN_FIRST_TIMER)
  @ApiOperation({ summary: 'Bulk assign first-timers to users' })
  @ApiResponse({
    status: 200,
    description: 'Bulk assignment completed successfully',
  })
  async bulkAssign(
    @Body()
    body: {
      assignments: Array<{
        firstTimerId: string;
        memberId?: string;
        followUpPersonId?: string;
        assigneeId?: string;
      }>;
      assignmentType?: 'assignment' | 'followup';
    },
    @CurrentUser() user: any,
  ) {
    const results: Array<{
      success: boolean;
      firstTimer?: any;
      error?: string;
      firstTimerId?: string;
    }> = [];

    const assignedBy = `${user.firstName} ${user.lastName}`;

    // Group assignments by member to send consolidated notifications
    const memberAssignments = new Map<string, Array<any>>();

    // Determine assignment type and target member field
    const isFollowUpAssignment =
      body.assignmentType === 'followup' ||
      body.assignments.some((a) => a.followUpPersonId || a.assigneeId);

    // Process assignments without triggering individual notifications
    for (const assignment of body.assignments) {
      try {
        let firstTimer: any;
        const targetMemberId =
          assignment.memberId ||
          assignment.followUpPersonId ||
          assignment.assigneeId;

        if (!targetMemberId) {
          throw new Error(
            'Either memberId, followUpPersonId, or assigneeId must be provided',
          );
        }

        firstTimer =
          await this.firstTimersService.assignToMemberWithoutNotification(
            assignment.firstTimerId,
            targetMemberId,
          );

        results.push({ success: true, firstTimer });

        // Group successful assignments by member
        if (!memberAssignments.has(targetMemberId)) {
          memberAssignments.set(targetMemberId, []);
        }
        memberAssignments.get(targetMemberId)!.push(firstTimer);
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message,
          firstTimerId: assignment.firstTimerId,
        });
      }
    }

    // Send consolidated notifications for each member
    for (const [memberId, firstTimers] of memberAssignments) {
      try {
        if (firstTimers.length > 0) {
          await this.firstTimersService.sendBulkAssignmentNotification(
            firstTimers,
            assignedBy,
          );
        }
      } catch (error: any) {
        // Log error but don't fail the assignment
        console.error(
          `Failed to send notification to member ${memberId}:`,
          error.message,
        );
      }
    }

    return ResponseUtil.success(results, 'Bulk assignment completed');
  }

  @Patch('bulk-status')
  @RequirePermission(FirstTimersPermission.UPDATE_FIRST_TIMER)
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
        const firstTimer = await this.firstTimersService.update(id, {
          status: body.status,
        });
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

  @Post('bulk-upload')
  @RequirePermission(FirstTimersPermission.CREATE_FIRST_TIMER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Queue bulk upload first-timers from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'CSV file with first-timer data',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        skipErrors: {
          type: 'boolean',
          description:
            'Whether to skip validation errors and continue with valid records',
          default: false,
        },
        defaultAssignedTo: {
          type: 'string',
          description: 'Default assignee for all first-timers in the upload',
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Bulk upload job queued successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            status: { type: 'string' },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file format or content',
  })
  async bulkUpload(
    @UploadedFile() file: any,
    @Body('skipErrors') skipErrors: string = 'false',
    @Body('defaultAssignedTo') defaultAssignedTo: string = '',
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
    if (!CSVParserUtil.validateFileType(file.originalname)) {
      throw new BadRequestException(
        'Invalid file type. Only CSV files are allowed',
      );
    }

    // Validate file size (limit to 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        'File size too large. Maximum allowed size is 5MB',
      );
    }

    const csvContent = file.buffer.toString('utf-8');

    // Parse CSV to get row count for metadata
    let totalRows = 0;
    try {
      const csvData = CSVParserUtil.parseCSV(csvContent, {
        headerRow: true,
        skipEmptyLines: true,
      });
      totalRows = csvData.length;
    } catch (error) {
      throw new BadRequestException(`CSV parsing failed: ${error.message}`);
    }

    const options = {
      skipErrors: skipErrors === 'true',
      defaultAssignedTo,
    };

    // Queue the job
    const job = await this.queueService.addBulkOperationJob(
      JobType.BULK_FIRST_TIMER_CREATE,
      csvContent,
      options,
      user.sub,
      {
        filename: file.originalname,
        totalRows,
      },
    );

    return ResponseUtil.success(
      {
        jobId: job.id,
        status: 'queued',
        estimatedRows: totalRows,
      },
      'Bulk upload job queued successfully. Use the job ID to check progress.',
    );
  }

  @Get('sample-csv')
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMERS)
  @ApiOperation({ summary: 'Download sample CSV template for bulk upload' })
  @ApiResponse({
    status: 200,
    description: 'Sample CSV template downloaded successfully',
  })
  getSampleCSV() {
    const csvContent = this.firstTimersService.generateSampleCSV();

    return {
      success: true,
      data: {
        content: csvContent,
        filename: 'first-timers-template.csv',
        contentType: 'text/csv',
      },
      message: 'Sample CSV template generated successfully',
    };
  }

  // Call Reports Endpoints
  @Post(':id/call-reports')
  @RequirePermission(FirstTimersPermission.ADD_CALL_REPORT)
  @ApiOperation({ summary: 'Create a call report for a first timer' })
  @ApiParam({ name: 'id', description: 'First timer ID' })
  @ApiResponse({
    status: 201,
    description: 'Call report created successfully',
  })
  async createCallReport(
    @Param('id') firstTimerId: string,
    @Body() createCallReportDto: CreateCallReportDto,
    @CurrentUser() user: any,
  ) {
    createCallReportDto.firstTimerId = firstTimerId;
    const callReport = await this.callReportsService.create(
      createCallReportDto,
      user.id,
    );
    return ResponseUtil.success(callReport, 'Call report created successfully');
  }

  @Get(':id/call-reports')
  @RequirePermission(FirstTimersPermission.VIEW_CALL_REPORTS)
  @ApiOperation({ summary: 'Get all call reports for a first timer' })
  @ApiParam({ name: 'id', description: 'First timer ID' })
  @ApiResponse({
    status: 200,
    description: 'Call reports retrieved successfully',
  })
  async getCallReports(@Param('id') firstTimerId: string) {
    const callReports =
      await this.callReportsService.findByFirstTimer(firstTimerId);
    return ResponseUtil.success(
      callReports,
      'Call reports retrieved successfully',
    );
  }

  @Get(':id/call-reports/summary')
  @RequirePermission(FirstTimersPermission.VIEW_CALL_REPORTS)
  @ApiOperation({ summary: 'Get call reports summary for a first timer' })
  @ApiParam({ name: 'id', description: 'First timer ID' })
  @ApiResponse({
    status: 200,
    description: 'Call reports summary retrieved successfully',
  })
  async getCallReportsSummary(@Param('id') firstTimerId: string) {
    const summary =
      await this.callReportsService.getCallReportsSummary(firstTimerId);
    return ResponseUtil.success(
      summary,
      'Call reports summary retrieved successfully',
    );
  }

  @Patch('call-reports/:reportId')
  @RequirePermission(FirstTimersPermission.ADD_CALL_REPORT)
  @ApiOperation({ summary: 'Update a call report' })
  @ApiParam({ name: 'reportId', description: 'Call report ID' })
  @ApiResponse({
    status: 200,
    description: 'Call report updated successfully',
  })
  async updateCallReport(
    @Param('reportId') reportId: string,
    @Body() updateData: Partial<CreateCallReportDto>,
  ) {
    const callReport = await this.callReportsService.update(
      reportId,
      updateData,
    );
    return ResponseUtil.success(callReport, 'Call report updated successfully');
  }

  @Delete('call-reports/:reportId')
  @RequirePermission(FirstTimersPermission.ADD_CALL_REPORT)
  @ApiOperation({ summary: 'Delete a call report' })
  @ApiParam({ name: 'reportId', description: 'Call report ID' })
  @ApiResponse({
    status: 200,
    description: 'Call report deleted successfully',
  })
  async deleteCallReport(@Param('reportId') reportId: string) {
    await this.callReportsService.delete(reportId);
    return ResponseUtil.success(null, 'Call report deleted successfully');
  }

  // Pre-filled Message Endpoints
  @Post(':id/set-message')
  @RequirePermission(FirstTimersPermission.SEND_WELCOME_MESSAGE)
  @ApiOperation({ summary: 'Set pre-filled message for a first timer' })
  @ApiParam({ name: 'id', description: 'First timer ID' })
  @ApiResponse({
    status: 200,
    description: 'Pre-filled message set successfully',
  })
  async setPreFilledMessage(
    @Param('id') firstTimerId: string,
    @Body() setMessageDto: SetPreFilledMessageDto,
    @CurrentUser() user: any,
  ) {
    const scheduledTime = setMessageDto.scheduledTime
      ? new Date(setMessageDto.scheduledTime)
      : undefined;

    await this.firstTimerMessagingService.setPreFilledMessage(
      firstTimerId,
      setMessageDto.message,
      scheduledTime,
      user?.id,
    );

    return ResponseUtil.success(null, 'Pre-filled message set successfully');
  }

  @Post('bulk-set-message')
  @RequirePermission(FirstTimersPermission.SEND_WELCOME_MESSAGE)
  @ApiOperation({ summary: 'Set pre-filled message for multiple first timers' })
  @ApiResponse({
    status: 200,
    description: 'Bulk pre-filled message set successfully',
  })
  async setBulkPreFilledMessage(
    @Body() bulkSetMessageDto: BulkSetMessageDto,
    @CurrentUser() user: any,
  ) {
    const scheduledTime = bulkSetMessageDto.scheduledTime
      ? new Date(bulkSetMessageDto.scheduledTime)
      : undefined;

    await this.firstTimerMessagingService.setBulkPreFilledMessage(
      bulkSetMessageDto.firstTimerIds,
      bulkSetMessageDto.message,
      scheduledTime,
      user?.id,
    );

    return ResponseUtil.success(
      null,
      'Bulk pre-filled message set successfully',
    );
  }

  @Get(':id/message-history')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Get message history for a first timer' })
  @ApiParam({ name: 'id', description: 'First timer ID' })
  @ApiResponse({
    status: 200,
    description: 'Message history retrieved successfully',
  })
  async getMessageHistory(@Param('id') firstTimerId: string) {
    const history =
      await this.firstTimerMessagingService.getMessageHistory(firstTimerId);
    return ResponseUtil.success(
      history,
      'Message history retrieved successfully',
    );
  }

  @Get(':id/scheduled-message')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Get current scheduled message for a first timer' })
  @ApiParam({ name: 'id', description: 'First timer ID' })
  @ApiResponse({
    status: 200,
    description: 'Scheduled message retrieved successfully',
  })
  async getScheduledMessage(@Param('id') firstTimerId: string) {
    const scheduledMessage =
      await this.firstTimerMessagingService.getScheduledMessage(firstTimerId);
    return ResponseUtil.success(
      scheduledMessage,
      'Scheduled message retrieved successfully',
    );
  }

  @Patch(':id/edit-message')
  @RequirePermission(FirstTimersPermission.SEND_WELCOME_MESSAGE)
  @ApiOperation({ summary: 'Edit scheduled message for a first timer' })
  @ApiParam({ name: 'id', description: 'First timer ID' })
  @ApiResponse({
    status: 200,
    description: 'Scheduled message updated successfully',
  })
  async editScheduledMessage(
    @Param('id') firstTimerId: string,
    @Body() editMessageDto: EditScheduledMessageDto,
    @CurrentUser() user: any,
  ) {
    const scheduledTime = editMessageDto.scheduledTime
      ? new Date(editMessageDto.scheduledTime)
      : undefined;

    await this.firstTimerMessagingService.editScheduledMessage(
      firstTimerId,
      editMessageDto.message,
      scheduledTime,
      user?.id,
    );

    return ResponseUtil.success(null, 'Scheduled message updated successfully');
  }

  @Delete(':id/cancel-message')
  @RequirePermission(FirstTimersPermission.SEND_WELCOME_MESSAGE)
  @ApiOperation({ summary: 'Cancel scheduled message for a first timer' })
  @ApiParam({ name: 'id', description: 'First timer ID' })
  @ApiResponse({
    status: 200,
    description: 'Scheduled message cancelled successfully',
  })
  async cancelScheduledMessage(
    @Param('id') firstTimerId: string,
    @CurrentUser() user: any,
  ) {
    await this.firstTimerMessagingService.cancelScheduledMessage(
      firstTimerId,
      user?.id,
    );
    return ResponseUtil.success(
      null,
      'Scheduled message cancelled successfully',
    );
  }

  @Get('messages/history')
  @RequirePermission(FirstTimersPermission.MANAGE_DAILY_MESSAGES)
  @ApiOperation({ summary: 'Get all message history with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Message history retrieved successfully',
  })
  async getAllMessageHistory(@Query() query: MessageHistoryQueryDto) {
    const result = await this.firstTimerMessagingService.getAllMessageHistory(
      query.page,
      query.limit,
      query.status,
    );
    return ResponseUtil.success(
      result,
      'Message history retrieved successfully',
    );
  }

  // Integration Stage Endpoints
  @Patch(':id/integration-stage')
  @RequirePermission(FirstTimersPermission.UPDATE_INTEGRATION_STAGE)
  @ApiOperation({ summary: 'Update integration stage for a first timer' })
  @ApiParam({ name: 'id', description: 'First timer ID' })
  @ApiResponse({
    status: 200,
    description: 'Integration stage updated successfully',
  })
  async updateIntegrationStage(
    @Param('id') firstTimerId: string,
    @Body() updateIntegrationStageDto: UpdateIntegrationStageDto,
  ) {
    await this.firstTimerMessagingService.updateIntegrationStage(
      firstTimerId,
      updateIntegrationStageDto.integrationStage,
      updateIntegrationStageDto.assignedDistrict,
    );

    return ResponseUtil.success(null, 'Integration stage updated successfully');
  }

  // Assignment Endpoints
  // Legacy bulk-assign-followup endpoint removed - use POST /bulk-assign instead

  @Post(':id/close')
  @RequirePermission(FirstTimersPermission.UPDATE_FIRST_TIMER)
  @ApiOperation({ summary: 'Close a first timer (unwilling or became member)' })
  @ApiParam({ name: 'id', description: 'First timer ID' })
  @ApiResponse({
    status: 200,
    description: 'First timer closed successfully',
  })
  async closeFirstTimer(
    @Param('id') firstTimerId: string,
    @Body()
    body: {
      reason: 'unwilling' | 'became_member';
      memberRecordId?: string;
    },
  ) {
    await this.firstTimerMessagingService.closeFirstTimer(
      firstTimerId,
      body.reason,
      body.memberRecordId,
    );

    return ResponseUtil.success(null, 'First timer closed successfully');
  }
}
