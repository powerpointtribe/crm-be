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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-roles.enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';

@ApiTags('Service Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('service-reports')
export class ServiceReportsController {
  constructor(private readonly serviceReportsService: ServiceReportsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Get all service reports with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Service reports retrieved successfully',
  })
  async findAll(@Query() searchDto: ServiceReportSearchDto) {
    const reports = await this.serviceReportsService.findAll(searchDto);
    return ResponseUtil.success(reports, 'Service reports retrieved successfully');
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.PASTOR)
  @ApiOperation({ summary: 'Get service report statistics' })
  @ApiResponse({
    status: 200,
    description: 'Service report statistics retrieved successfully',
  })
  async getServiceReportStats() {
    const stats = await this.serviceReportsService.getServiceReportStats();
    return ResponseUtil.success(
      stats,
      'Service report statistics retrieved successfully',
    );
  }

  @Get('my-reports')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
    return ResponseUtil.success(report, 'Service report retrieved successfully');
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete service report' })
  @ApiParam({ name: 'id', description: 'Service report ID' })
  @ApiResponse({
    status: 204,
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
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
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