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
import { ServiceReportsService } from './service-reports.service';
import { CreateServiceReportDto } from './dto/create-service-report.dto';
import { UpdateServiceReportDto } from './dto/update-service-report.dto';
import { ServiceReportSearchDto } from './dto/service-report-search.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { ServiceReportsPermission } from './permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { BranchFilterContext } from '../common/services/branch-access.service';

@ApiTags('Service Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('service-reports')
export class ServiceReportsController {
  constructor(
    private readonly serviceReportsService: ServiceReportsService,
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  @Post()
  @RequirePermission(ServiceReportsPermission.CREATE_REPORT)
  @ApiOperation({ summary: 'Create a new service report' })
  @ApiResponse({
    status: 201,
    description: 'Service report created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or attendance numbers',
  })
  @ApiResponse({
    status: 409,
    description: 'Service report already exists for this date and service',
  })
  async create(
    @Body() createServiceReportDto: CreateServiceReportDto,
    @CurrentUser() user: any,
  ) {
    const report = await this.serviceReportsService.create(
      createServiceReportDto,
      user._id,
    );
    return ResponseUtil.success(report, 'Service report created successfully');
  }

  @Get()
  @RequirePermission(ServiceReportsPermission.VIEW_REPORTS)
  @ApiOperation({
    summary: 'Get all service reports with filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Service reports retrieved successfully',
  })
  async findAll(
    @Query() searchDto: ServiceReportSearchDto,
    @CurrentUser() user: any,
  ) {
    // Build branch filter context based on user's permissions
    let branchFilterContext: BranchFilterContext | undefined;

    if (user.role) {
      const userPermissions = await this.userPermissionsService.getUserPermissions(
        user.role._id || user.role,
      );
      branchFilterContext = {
        userPermissions: userPermissions.permissions,
        userBranchId: user.branch?._id || user.branch,
        selectedBranchId: searchDto.branchId,
      };
    } else {
      branchFilterContext = {
        userPermissions: [],
        userBranchId: user.branch?._id || user.branch,
      };
    }

    const reports = await this.serviceReportsService.findAll(
      searchDto,
      branchFilterContext,
    );
    return ResponseUtil.success(
      reports,
      'Service reports retrieved successfully',
    );
  }

  @Get('stats')
  @RequirePermission(ServiceReportsPermission.VIEW_REPORT_STATS)
  @ApiOperation({ summary: 'Get service report statistics' })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'Start date for filtering stats (ISO format)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'End date for filtering stats (ISO format)',
  })
  @ApiResponse({
    status: 200,
    description: 'Service report statistics retrieved successfully',
  })
  async getServiceReportStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const stats = await this.serviceReportsService.getServiceReportStats(dateFrom, dateTo);
    return ResponseUtil.success(
      stats,
      'Service report statistics retrieved successfully',
    );
  }

  @Get('chart-data')
  @RequirePermission(ServiceReportsPermission.VIEW_REPORT_TRENDS)
  @ApiOperation({ summary: 'Get attendance chart data' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of records to return (default: 10)',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'Start date for filtering chart data (ISO format)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'End date for filtering chart data (ISO format)',
  })
  @ApiResponse({
    status: 200,
    description: 'Attendance chart data retrieved successfully',
  })
  async getAttendanceChartData(
    @Query('limit') limit?: number,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const chartData = await this.serviceReportsService.getAttendanceChartData(
      limit || 10,
      dateFrom,
      dateTo,
    );
    return ResponseUtil.success(
      chartData,
      'Attendance chart data retrieved successfully',
    );
  }

  @Get('my-reports')
  @RequirePermission(ServiceReportsPermission.VIEW_OWN_REPORTS)
  @ApiOperation({ summary: 'Get service reports created by current user' })
  @ApiResponse({
    status: 200,
    description: 'User service reports retrieved successfully',
  })
  async getMyReports(
    @Query() searchDto: ServiceReportSearchDto,
    @CurrentUser() user: any,
  ) {
    const reports = await this.serviceReportsService.getMyReports(
      user._id,
      searchDto,
    );
    return ResponseUtil.success(
      reports,
      'Your service reports retrieved successfully',
    );
  }

  @Get('recent')
  @RequirePermission(ServiceReportsPermission.VIEW_REPORTS)
  @ApiOperation({ summary: 'Get recent service reports' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days to look back (default: 30)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent service reports retrieved successfully',
  })
  async getRecentReports(
    @Query('days') days?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const daysBack = days ? parseInt(days) : 30;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const reports = await this.serviceReportsService.getRecentReports(
      daysBack,
      pageNum,
      limitNum,
    );
    return ResponseUtil.success(
      reports,
      'Recent service reports retrieved successfully',
    );
  }

  @Get(':id')
  @RequirePermission(ServiceReportsPermission.VIEW_REPORT_DETAILS)
  @ApiOperation({ summary: 'Get service report by ID' })
  @ApiParam({ name: 'id', description: 'Service report ID' })
  @ApiResponse({
    status: 200,
    description: 'Service report retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Service report not found',
  })
  async findOne(@Param('id') id: string) {
    const report = await this.serviceReportsService.findById(id);
    return ResponseUtil.success(
      report,
      'Service report retrieved successfully',
    );
  }

  @Patch(':id')
  @RequirePermission(ServiceReportsPermission.UPDATE_REPORT)
  @ApiOperation({ summary: 'Update service report' })
  @ApiParam({ name: 'id', description: 'Service report ID' })
  @ApiResponse({
    status: 200,
    description: 'Service report updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - can only update own reports',
  })
  @ApiResponse({
    status: 404,
    description: 'Service report not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateServiceReportDto: UpdateServiceReportDto,
    @CurrentUser() user: any,
  ) {
    const report = await this.serviceReportsService.update(
      id,
      updateServiceReportDto,
      user._id,
    );
    return ResponseUtil.success(report, 'Service report updated successfully');
  }

  @Delete(':id')
  @RequirePermission(ServiceReportsPermission.DELETE_REPORT)
  @ApiOperation({ summary: 'Delete service report' })
  @ApiParam({ name: 'id', description: 'Service report ID' })
  @ApiResponse({
    status: 200,
    description: 'Service report deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - can only delete own reports',
  })
  @ApiResponse({
    status: 404,
    description: 'Service report not found',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    await this.serviceReportsService.remove(id, user._id);
    return ResponseUtil.success(null, 'Service report deleted successfully');
  }

  @Get(':id/pdf')
  @RequirePermission(ServiceReportsPermission.VIEW_REPORT_DETAILS)
  @ApiOperation({ summary: 'Generate PDF report for service report' })
  @ApiParam({ name: 'id', description: 'Service report ID' })
  @ApiResponse({
    status: 200,
    description: 'PDF HTML generated successfully',
    headers: {
      'Content-Type': {
        description: 'text/html',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Service report not found',
  })
  async generatePdf(@Param('id') id: string) {
    const htmlContent = await this.serviceReportsService.generatePdfHtml(id);
    return ResponseUtil.success(
      { html: htmlContent },
      'PDF HTML generated successfully',
    );
  }
}
