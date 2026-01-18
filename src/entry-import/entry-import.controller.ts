import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { EntryImportService } from './entry-import.service';
import {
  EntryImportEntityType,
  EntryImportStatus,
  EntryImportItemStatus,
} from './schemas/entry-import.schema';

@Controller('entry-import')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class EntryImportController {
  constructor(private readonly entryImportService: EntryImportService) {}

  /**
   * Get available entity types for import
   */
  @Get('entity-types')
  getEntityTypes() {
    return {
      success: true,
      data: this.entryImportService.getAvailableEntityTypes(),
    };
  }

  /**
   * Create a new import from uploaded CSV file
   */
  @Post('upload/:entityType')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(csv)$/i)) {
          return callback(new BadRequestException('Only CSV files are allowed'), false);
        }
        callback(null, true);
      },
    }),
  )
  async uploadCsv(
    @Param('entityType') entityType: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('branchId') branchId?: string,
    @Body('options') optionsStr?: string,
    @Req() req?: any,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    // Validate entity type
    if (!Object.values(EntryImportEntityType).includes(entityType as EntryImportEntityType)) {
      throw new BadRequestException(`Invalid entity type: ${entityType}`);
    }

    const csvContent = file.buffer.toString('utf-8');
    const options = optionsStr ? JSON.parse(optionsStr) : undefined;
    const createdBy = req.user._id.toString();

    const entryImport = await this.entryImportService.createImport(
      entityType as EntryImportEntityType,
      csvContent,
      file.originalname,
      createdBy,
      branchId,
      options,
    );

    return {
      success: true,
      message: 'Import created and queued for processing',
      data: {
        importId: entryImport._id,
        fileName: entryImport.fileName,
        entityType: entryImport.entityType,
        totalRecords: entryImport.totalRecords,
        status: entryImport.status,
      },
    };
  }

  /**
   * Get all imports with pagination
   */
  @Get()
  async getImports(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('entityType') entityType?: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
  ) {
    const result = await this.entryImportService.getImports(
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
      {
        entityType: entityType as EntryImportEntityType,
        status: status as EntryImportStatus,
        branchId,
      },
    );

    return {
      success: true,
      data: result.imports,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Get single import by ID
   */
  @Get(':id')
  async getImportById(@Param('id') id: string) {
    const entryImport = await this.entryImportService.getImportById(id);
    const stats = await this.entryImportService.getImportStats(id);

    return {
      success: true,
      data: {
        import: entryImport,
        stats,
      },
    };
  }

  /**
   * Get import items with pagination
   */
  @Get(':id/items')
  async getImportItems(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.entryImportService.getImportItems(
      id,
      parseInt(page || '1', 10),
      parseInt(limit || '50', 10),
      status as EntryImportItemStatus,
    );

    return {
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Retry failed items for an import
   */
  @Post(':id/retry')
  async retryFailedItems(@Param('id') id: string) {
    const retriedCount = await this.entryImportService.retryFailedItems(id);

    return {
      success: true,
      message: `Retrying ${retriedCount} failed items`,
      data: { retriedCount },
    };
  }

  /**
   * Delete an import
   */
  @Delete(':id')
  async deleteImport(@Param('id') id: string) {
    await this.entryImportService.deleteImport(id);

    return {
      success: true,
      message: 'Import deleted successfully',
    };
  }

  /**
   * Get sample CSV template for an entity type
   */
  @Get('template/:entityType')
  async getSampleTemplate(@Param('entityType') entityType: string) {
    // Validate entity type
    if (!Object.values(EntryImportEntityType).includes(entityType as EntryImportEntityType)) {
      throw new BadRequestException(`Invalid entity type: ${entityType}`);
    }

    const handler = this.entryImportService.getHandler(entityType as EntryImportEntityType);
    if (!handler) {
      throw new BadRequestException(`No handler registered for entity type: ${entityType}`);
    }

    const headers = handler.getSampleCsvHeaders();
    const sampleRow = handler.getSampleCsvRow();

    // Generate CSV content
    const csvLines = [headers.join(','), sampleRow.map((val) => `"${val}"`).join(',')];

    return {
      success: true,
      data: {
        entityType,
        displayName: handler.getDisplayName(),
        description: handler.getDescription(),
        headers,
        sampleRow,
        csvContent: csvLines.join('\n'),
      },
    };
  }
}
