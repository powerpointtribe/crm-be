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
import { CallReportsService } from './call-reports.service';
import { CreateFirstTimerDto } from './dto/create-first-timer.dto';
import { PublicCreateFirstTimerDto } from './dto/public-first-timer.dto';
import { AddFollowUpDto } from './dto/add-follow-up.dto';
import { AssignFollowUpDto } from './dto/assign-follow-up.dto';
import { FirstTimerSearchDto } from './dto/first-timer-search.dto';
import { BulkUploadResultDto } from './dto/bulk-upload-first-timer.dto';
import { CreateCallReportDto } from './dto/create-call-report.dto';
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
    private readonly callReportsService: CallReportsService,
    private readonly queueService: QueueService,
  ) {}

  @Get('public/form-config')
  @Public()
  @ApiTags('Public API')
  @ApiOperation({
    summary: 'Get public registration form configuration (generic)',
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

  @Get('public/branches/:slug/form-config')
  @Public()
  @ApiTags('Public API')
  @ApiOperation({
    summary: 'Get branch-specific public registration form configuration',
  })
  @ApiParam({ name: 'slug', description: 'Branch slug (e.g., lagos-mainland)' })
  @ApiResponse({
    status: 200,
    description: 'Branch-specific form configuration retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Branch not found',
  })
  async getBranchFormConfig(@Param('slug') slug: string) {
    const branchConfig =
      await this.firstTimersService.getBranchFormConfig(slug);

    if (!branchConfig) {
      return ResponseUtil.error('Branch not found');
    }

    return ResponseUtil.success(
      branchConfig,
      'Branch form configuration retrieved successfully',
    );
  }

  @Post('public/branches/:slug')
  @Public()
  @ApiTags('Public API')
  @ApiOperation({
    summary:
      'Register a new first-time visitor via branch-specific form (Public endpoint)',
  })
  @ApiParam({ name: 'slug', description: 'Branch slug (e.g., lagos-mainland)' })
  @ApiResponse({
    status: 201,
    description: 'First-timer registered successfully with branch assignment',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 404,
    description: 'Branch not found',
  })
  async createPublicWithBranch(
    @Param('slug') slug: string,
    @Body() createFirstTimerDto: PublicCreateFirstTimerDto,
  ) {
    try {
      // Verify branch exists and get branch ID
      const branch = await this.firstTimersService.getBranchBySlug(slug);
      if (!branch) {
        throw new BadRequestException(`Branch with slug '${slug}' not found`);
      }

      const existingByPhoneAndEmail =
        await this.firstTimersService.findByPhoneAndEmail(
          createFirstTimerDto.phone,
          createFirstTimerDto.email,
        );
      if (existingByPhoneAndEmail) {
        throw new ConflictException(
          `Duplicate phone and email detected: ${createFirstTimerDto.phone} and ${createFirstTimerDto.email}`,
        );
      }

      // Create first timer with branch assignment
      const firstTimer = await this.firstTimersService.createWithBranch(
        createFirstTimerDto,
        branch._id as string,
      );

      return ResponseUtil.success(
        {
          id: firstTimer._id as any,
          firstName: firstTimer.firstName,
          lastName: firstTimer.lastName,
          status: firstTimer.status,
          branch: branch.name,
          message:
            'Thank you for your interest! Our team will contact you soon.',
        },
        'First-timer registration completed successfully',
      );
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Error in createPublicWithBranch:', error);
      throw new BadRequestException(
        'We encountered an issue while processing your registration. Please try again.',
      );
    }
  }

  @Post('public')
  @Public()
  @ApiTags('Public API')
  @ApiOperation({
    summary: 'Register a new first-time visitor (Public endpoint - generic)',
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

    const assignments = await this.firstTimersService.getByAssignedMember(
      user._id.toString(),
      pageNum,
      limitNum,
    );

    return ResponseUtil.success(
      assignments,
      'Your assignments retrieved successfully',
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

    return ResponseUtil.success(
      overdueReports,
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


}
