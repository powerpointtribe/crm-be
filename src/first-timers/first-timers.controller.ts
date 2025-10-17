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
import { CreateFirstTimerDto } from './dto/create-first-timer.dto';
import { PublicCreateFirstTimerDto } from './dto/public-first-timer.dto';
import { AddFollowUpDto } from './dto/add-follow-up.dto';
import { AssignFollowUpDto } from './dto/assign-follow-up.dto';
import { FirstTimerSearchDto } from './dto/first-timer-search.dto';
import { BulkUploadResultDto } from './dto/bulk-upload-first-timer.dto';
import { CSVParserUtil } from '../common/utils/csv-parser.util';
import { QueueService } from '../queue/queue.service';
import { JobType } from '../common/interfaces/queue-job.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-roles.enums';
import { EngagementStatus } from '../common/enums/engagement-status.enum';
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
    private readonly queueService: QueueService,
  ) {}

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

      return ResponseUtil.success(
        {
          id: firstTimer._id,
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR)
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
  @Roles(UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Get first-timers needing follow-up' })
  @ApiResponse({
    status: 200,
    description: 'First-timers needing follow-up retrieved successfully',
  })
  async getNeedingFollowUp(@CurrentUser() user: any) {
    let firstTimers = await this.firstTimersService.getNeedingFollowUp();

    // Filter by assigned user for follow-up team
    if (user.roles === UserRole.LXL) {
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.LXL)
  @ApiOperation({ summary: 'Get first-timers assigned to current user' })
  @ApiResponse({
    status: 200,
    description: 'Assigned first-timers retrieved successfully',
  })
  async getMyAssignments(@CurrentUser() user: any) {
    const assignments = await this.firstTimersService.getByAssignedMember(
      user._id,
    );
    return ResponseUtil.success(
      assignments,
      'Your assignments retrieved successfully',
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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

  @Patch(':id/follow-up')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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

  @Patch(':id/assign/:memberId')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  ) {
    const firstTimer = await this.firstTimersService.assignToMember(
      id,
      memberId,
    );
    return ResponseUtil.success(
      firstTimer,
      'First-timer assigned successfully',
    );
  }

  @Patch(':id/convert')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Assign follow-up person to first-timer' })
  @ApiParam({ name: 'id', description: 'First-timer ID' })
  @ApiResponse({
    status: 200,
    description: 'Follow-up person assigned successfully',
  })
  async assignFollowUp(
    @Param('id') id: string,
    @Body() assignDto: AssignFollowUpDto,
  ) {
    const firstTimer = await this.firstTimersService.assignFollowUp(
      id,
      assignDto.followUpPersonId,
    );
    return ResponseUtil.success(
      firstTimer,
      'Follow-up person assigned successfully',
    );
  }

  @Get('pending-district')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Get first-timers pending district assignment' })
  @ApiResponse({
    status: 200,
    description: 'Pending district assignments retrieved successfully',
  })
  async getPendingDistrictAssignments() {
    const pendingMembers =
      await this.firstTimersService.getPendingDistrictAssignments();
    return ResponseUtil.success(
      pendingMembers,
      'Pending district assignments retrieved successfully',
    );
  }

  @Patch(':id/notes')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  ) {
    const results: Array<{
      success: boolean;
      firstTimer?: any;
      error?: string;
      firstTimerId?: string;
    }> = [];

    for (const assignment of body.assignments) {
      try {
        const firstTimer = await this.firstTimersService.assignToMember(
          assignment.firstTimerId,
          assignment.memberId,
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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

  @Post('bulk-upload')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
}
