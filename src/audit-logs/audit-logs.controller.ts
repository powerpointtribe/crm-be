import {
  Controller,
  Get,
  Query,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { AuditLogsPermission } from './permissions';
import { UserRole } from '../common/enums/user-roles.enums';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequirePermission(AuditLogsPermission.VIEW_AUDIT_LOGS)
  @ApiOperation({ summary: 'Get all audit logs with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
  })
  async findAll(@Query() queryDto: AuditLogQueryDto, @Req() req: any) {
    try {
      return await this.auditLogsService.findAll(queryDto);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve audit logs',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('statistics')
  @RequirePermission(AuditLogsPermission.VIEW_AUDIT_STATISTICS)
  @ApiOperation({ summary: 'Get audit log statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getStatistics(
    @Query()
    query: { startDate?: string; endDate?: string; entityType?: string },
    @Req() req: any,
  ) {
    try {
      const filters: any = {};

      if (query.startDate) filters.startDate = new Date(query.startDate);
      if (query.endDate) filters.endDate = new Date(query.endDate);
      if (query.entityType) filters.entityType = query.entityType;

      return await this.auditLogsService.getStatistics(filters);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve statistics',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('export')
  @RequirePermission(AuditLogsPermission.EXPORT_AUDIT_LOGS)
  @ApiOperation({ summary: 'Export audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs exported successfully' })
  async exportLogs(
    @Query() queryDto: AuditLogQueryDto,
    @Query('format') format: 'csv' | 'json' = 'json',
    @Res() res: Response,
    @Req() req: any,
  ) {
    try {
      const data = await this.auditLogsService.exportLogs(queryDto, format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename=audit-logs.csv',
        );
        res.send(data);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename=audit-logs.json',
        );
        res.json(data);
      }
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to export audit logs',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @RequirePermission(AuditLogsPermission.VIEW_AUDIT_LOG_DETAILS)
  @ApiOperation({ summary: 'Get audit log by ID' })
  @ApiResponse({ status: 200, description: 'Audit log retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    try {
      const auditLog = await this.auditLogsService.findOne(id);

      if (!auditLog) {
        throw new HttpException('Audit log not found', HttpStatus.NOT_FOUND);
      }

      return auditLog;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve audit log',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('cleanup')
  @RequirePermission(AuditLogsPermission.CLEANUP_OLD_LOGS)
  @ApiOperation({ summary: 'Delete old audit logs (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Old audit logs deleted successfully',
  })
  async deleteOldLogs(@Query('beforeDate') beforeDate: string) {
    try {
      if (!beforeDate) {
        throw new HttpException(
          'beforeDate query parameter is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.auditLogsService.deleteOldLogs(
        new Date(beforeDate),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete old audit logs',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
