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
} from './dto/daily-message.dto';
import { UpdateIntegrationStageDto } from './dto/update-integration-stage.dto';
import { CSVParserUtil } from '../common/utils/csv-parser.util';
import { QueueService } from '../queue/queue.service';
import { JobType } from '../common/interfaces/queue-job.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-roles.enums';
import { EngagementStatus } from '../common/enums/engagement-status.enum';
import { FirstTimer } from './schemas/first-timer.schema';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ResponseUtil } from '../common/utils/response.util';

@ApiTags('First Timers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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

      const internalDto: CreateFirstTimerDto = {
        ...relevantData,
        dateOfVisit: new Date().toISOString().split('T')[0], // Set to today
        notes: createFirstTimerDto.notes
          ? `[PUBLIC DOMAIN] ${createFirstTimerDto.notes}`
          : '[PUBLIC DOMAIN] Registration from website/public form',
        howDidYouHear: createFirstTimerDto.howDidYouHear || 'website',
        visitorType: createFirstTimerDto.visitorType || 'first_time',
      };

      const firstTimer = await this.firstTimersService.create(internalDto);

      // Auto-create daily message entry for the visit date
      try {
        const visitDate = new Date(internalDto.dateOfVisit);
        await this.firstTimerMessagingService.ensureDailyMessageEntry(
          visitDate,
          [(firstTimer._id as any).toString()]
        );
      } catch (error) {
        // Log error but don't fail the creation
        console.error('Failed to auto-create daily message entry:', error);
      }

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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL, UserRole.LXL) // PERMISSIONS DISABLED
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

    // Auto-create daily message entry for the visit date
    try {
      const visitDate = new Date(createFirstTimerDto.dateOfVisit);
      await this.firstTimerMessagingService.ensureDailyMessageEntry(
        visitDate,
        [(firstTimer._id as any).toString()]
      );
    } catch (error) {
      // Log error but don't fail the creation
      console.error('Failed to auto-create daily message entry:', error);
    }

    return ResponseUtil.success(
      firstTimer,
      'First-timer registered successfully',
    );
  }

  @Get()
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
      limit: limitNum
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
      hasPrev: assignments.hasPrev
    });

    return ResponseUtil.success(
      assignments,
      'Your assignments retrieved successfully',
    );
  }

  // Daily Messaging Endpoints (must be before :id route)
  @Get('daily-messages')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
    return ResponseUtil.success(result, 'Daily messages retrieved successfully');
  }

  @Post('daily-message')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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

    const dailyMessage = await this.firstTimerMessagingService.createDailyMessage(
      date,
      createDailyMessageDto.message,
      createDailyMessageDto.firstTimerIds,
      user?.id,
      scheduledTime,
      createDailyMessageDto.autoSend,
    );

    // If auto-send is enabled, send immediately
    if (createDailyMessageDto.autoSend) {
      await this.firstTimerMessagingService.sendDailyMessageNow(
        (dailyMessage._id as any).toString(),
        user?.id,
      );
    }

    return ResponseUtil.success(dailyMessage, 'Daily message created successfully');
  }

  @Get('daily-message/:date')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
  @ApiOperation({ summary: 'Get or create daily message for a specific date' })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiResponse({
    status: 200,
    description: 'Daily message retrieved or created successfully',
  })
  async getDailyMessage(@Param('date') dateString: string) {
    // Try to get existing message or create one if there are first timers for this date
    const dailyMessage = await this.firstTimerMessagingService.getOrCreateDailyMessageEntry(dateString);

    if (!dailyMessage) {
      return ResponseUtil.success(null, 'No first timers found for this date');
    }

    return ResponseUtil.success(dailyMessage, 'Daily message retrieved successfully');
  }

  @Patch('daily-message/:id')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
  @ApiOperation({ summary: 'Update a daily message' })
  @ApiParam({ name: 'id', description: 'Daily message ID' })
  @ApiResponse({
    status: 200,
    description: 'Daily message updated successfully',
  })
  async updateDailyMessage(
    @Param('id') dailyMessageId: string,
    @Body() updateData: { message: string; scheduledTime?: string; autoSend: boolean },
    @CurrentUser() user: any,
  ) {
    const scheduledTime = updateData.scheduledTime
      ? new Date(updateData.scheduledTime)
      : undefined;

    const updatedMessage = await this.firstTimerMessagingService.updateDailyMessage(
      dailyMessageId,
      updateData.message,
      scheduledTime,
      updateData.autoSend,
      user?.id,
    );

    return ResponseUtil.success(updatedMessage, 'Daily message updated successfully');
  }

  @Delete('daily-message/:id')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
    await this.firstTimerMessagingService.deleteDailyMessage(dailyMessageId, user?.id);
    return ResponseUtil.success(null, 'Daily message deleted successfully');
  }

  @Post('daily-message/:id/send-now')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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

  // Call Reports Analytics Endpoints - MUST BE BEFORE :id route
  @Get('call-reports/analytics/global')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR) // PERMISSIONS DISABLED
  @ApiOperation({ summary: 'Get global call reports analytics' })
  @ApiResponse({
    status: 200,
    description: 'Global analytics retrieved successfully',
  })
  async getGlobalCallReportsAnalytics() {
    const analytics = await this.callReportsService.getGlobalCallReportsAnalytics();
    return ResponseUtil.success(analytics, 'Global analytics retrieved successfully');
  }

  @Get('call-reports/analytics/team-performance')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR) // PERMISSIONS DISABLED
  @ApiOperation({ summary: 'Get team performance analytics for call reports' })
  @ApiResponse({
    status: 200,
    description: 'Team performance analytics retrieved successfully',
  })
  async getTeamPerformanceAnalytics() {
    const analytics = await this.callReportsService.getTeamPerformanceAnalytics();
    return ResponseUtil.success(analytics, 'Team performance analytics retrieved successfully');
  }

  @Get('call-reports/overdue')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
        (report) => report.assignedTo?._id === user._id
      );
    }

    return ResponseUtil.success(filteredReports, 'Overdue reports retrieved successfully');
  }

  @Get('call-reports/search')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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

    const results = await this.callReportsService.searchCallReports(searchParams);
    return ResponseUtil.success(results, 'Search results retrieved successfully');
  }

  @Get(':id')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
  @ApiOperation({ summary: 'Bulk assign first-timers to users' })
  @ApiResponse({
    status: 200,
    description: 'Bulk assignment completed successfully',
  })
  async bulkAssign(
    @Body()
    body: {
      assignments: Array<{ firstTimerId: string; memberId: string }>;
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

    for (const assignment of body.assignments) {
      try {
        const firstTimer = await this.firstTimersService.assignToMember(
          assignment.firstTimerId,
          assignment.memberId,
          assignedBy,
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL, UserRole.MEMBER) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL, UserRole.MEMBER) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL, UserRole.MEMBER) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL, UserRole.MEMBER) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
  @ApiOperation({ summary: 'Set pre-filled message for multiple first timers' })
  @ApiResponse({
    status: 200,
    description: 'Bulk pre-filled message set successfully',
  })
  async setBulkPreFilledMessage(@Body() bulkSetMessageDto: BulkSetMessageDto, @CurrentUser() user: any) {
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
  @ApiOperation({ summary: 'Get message history for a first timer' })
  @ApiParam({ name: 'id', description: 'First timer ID' })
  @ApiResponse({
    status: 200,
    description: 'Message history retrieved successfully',
  })
  async getMessageHistory(@Param('id') firstTimerId: string) {
    const history = await this.firstTimerMessagingService.getMessageHistory(firstTimerId);
    return ResponseUtil.success(history, 'Message history retrieved successfully');
  }

  @Get(':id/scheduled-message')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
  @ApiOperation({ summary: 'Get current scheduled message for a first timer' })
  @ApiParam({ name: 'id', description: 'First timer ID' })
  @ApiResponse({
    status: 200,
    description: 'Scheduled message retrieved successfully',
  })
  async getScheduledMessage(@Param('id') firstTimerId: string) {
    const scheduledMessage = await this.firstTimerMessagingService.getScheduledMessage(firstTimerId);
    return ResponseUtil.success(scheduledMessage, 'Scheduled message retrieved successfully');
  }

  @Patch(':id/edit-message')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
    await this.firstTimerMessagingService.cancelScheduledMessage(firstTimerId, user?.id);
    return ResponseUtil.success(null, 'Scheduled message cancelled successfully');
  }

  @Get('messages/history')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
    return ResponseUtil.success(result, 'Message history retrieved successfully');
  }


  // Integration Stage Endpoints
  @Patch(':id/integration-stage')
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
  // @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL) // PERMISSIONS DISABLED
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
