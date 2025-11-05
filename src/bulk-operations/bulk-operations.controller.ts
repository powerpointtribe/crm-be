import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { BulkOperationsService } from './bulk-operations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-roles.enums';
import { ResponseUtil } from '../common/utils/response.util';
import { BulkOperationType } from '../common/interfaces/bulk-operation.interface';

@ApiTags('Bulk Operations')
@Controller('bulk-operations')
export class BulkOperationsController {
  constructor(private readonly bulkOperationsService: BulkOperationsService) {}

  @Get('templates/:entityType')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Download CSV template for bulk operations' })
  @ApiResponse({
    status: 200,
    description: 'CSV template downloaded successfully',
  })
  async downloadTemplate(
    @Param('entityType') entityType: string,
    @Res() res: Response,
  ) {
    const csvContent = await this.bulkOperationsService.generateTemplate(entityType);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${entityType}-template.csv"`);
    res.send(csvContent);
  }

  @Post('upload/:entityType')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload CSV file for bulk operations' })
  @ApiResponse({
    status: 200,
    description: 'Bulk operation completed successfully',
  })
  async bulkUpload(
    @Param('entityType') entityType: string,
    @UploadedFile() file: any,
    @Body('operation') operation: BulkOperationType,
    @Body('options') options: string = '{}',
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const parsedOptions = options ? JSON.parse(options) : {};

    const result = await this.bulkOperationsService.processBulkOperation(
      entityType,
      file,
      operation,
      parsedOptions,
      user._id,
    );

    return ResponseUtil.success(result, 'Bulk operation completed successfully');
  }

  @Get('operations')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Get bulk operations history' })
  async getOperationsHistory(
    @CurrentUser() user: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('entityType') entityType?: string,
    @Query('operation') operation?: BulkOperationType,
  ) {
    const history = await this.bulkOperationsService.getOperationsHistory({
      page,
      limit,
      entityType,
      operation,
      userId: user._id,
    });

    return ResponseUtil.success(history, 'Operations history retrieved successfully');
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Get bulk operations statistics' })
  async getOperationsStats(@CurrentUser() user: any) {
    const stats = await this.bulkOperationsService.getOperationsStats(user._id);
    return ResponseUtil.success(stats, 'Operations statistics retrieved successfully');
  }

  @Post('preview/:entityType')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Preview bulk operation without executing' })
  async previewBulkOperation(
    @Param('entityType') entityType: string,
    @UploadedFile() file: any,
    @Body('operation') operation: BulkOperationType,
    @Body('options') options: string = '{}',
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const parsedOptions = options ? JSON.parse(options) : { dryRun: true };

    const preview = await this.bulkOperationsService.processBulkOperation(
      entityType,
      file,
      operation,
      { ...parsedOptions, dryRun: true },
      user._id,
    );

    return ResponseUtil.success(preview, 'Bulk operation preview generated successfully');
  }

  @Get('export/:entityType')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Export entities as CSV' })
  async exportEntities(
    @Param('entityType') entityType: string,
    @Query('filters') filters: string = '{}',
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    const parsedFilters = filters ? JSON.parse(filters) : {};

    const csvContent = await this.bulkOperationsService.exportEntities(
      entityType,
      parsedFilters,
      user._id,
    );

    const timestamp = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${entityType}-export-${timestamp}.csv"`);
    res.send(csvContent);
  }

  @Patch('templates/:entityType')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update CSV template for entity type' })
  async updateTemplate(
    @Param('entityType') entityType: string,
    @Body() templateConfig: any,
    @CurrentUser() user: any,
  ) {
    const result = await this.bulkOperationsService.updateTemplate(
      entityType,
      templateConfig,
      user._id,
    );

    return ResponseUtil.success(result, 'Template updated successfully');
  }

  @Get('templates')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Get available templates' })
  async getAvailableTemplates() {
    const templates = await this.bulkOperationsService.getAvailableTemplates();
    return ResponseUtil.success(templates, 'Templates retrieved successfully');
  }
}