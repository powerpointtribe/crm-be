import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Model, Types } from 'mongoose';
import { Queue } from 'bull';
import {
  EntryImport,
  EntryImportDocument,
  EntryImportItem,
  EntryImportItemDocument,
  EntryImportStatus,
  EntryImportItemStatus,
  EntryImportEntityType,
} from './schemas/entry-import.schema';
import { QueueName, JobType } from '../common/interfaces/queue-job.interface';
import { EntityHandler } from './handlers/entity-handler.interface';
import { CSVParserUtil } from '../common/utils/csv-parser.util';

@Injectable()
export class EntryImportService {
  private readonly logger = new Logger(EntryImportService.name);
  private handlers: Map<EntryImportEntityType, EntityHandler> = new Map();

  constructor(
    @InjectModel(EntryImport.name)
    private entryImportModel: Model<EntryImportDocument>,
    @InjectModel(EntryImportItem.name)
    private entryImportItemModel: Model<EntryImportItemDocument>,
    @InjectQueue(QueueName.ENTRY_IMPORT)
    private entryImportQueue: Queue,
  ) {}

  /**
   * Register an entity handler
   */
  registerHandler(handler: EntityHandler): void {
    this.handlers.set(handler.entityType, handler);
    this.logger.log(`Registered handler for entity type: ${handler.entityType}`);
  }

  /**
   * Get handler for entity type
   */
  getHandler(entityType: EntryImportEntityType): EntityHandler | undefined {
    return this.handlers.get(entityType);
  }

  /**
   * Get all registered handlers info
   */
  getAvailableEntityTypes(): Array<{
    entityType: EntryImportEntityType;
    displayName: string;
    description: string;
    sampleHeaders: string[];
    sampleRow: string[];
  }> {
    const result: Array<{
      entityType: EntryImportEntityType;
      displayName: string;
      description: string;
      sampleHeaders: string[];
      sampleRow: string[];
    }> = [];

    this.handlers.forEach((handler, entityType) => {
      result.push({
        entityType,
        displayName: handler.getDisplayName(),
        description: handler.getDescription(),
        sampleHeaders: handler.getSampleCsvHeaders(),
        sampleRow: handler.getSampleCsvRow(),
      });
    });

    return result;
  }

  /**
   * Create a new import from CSV content
   */
  async createImport(
    entityType: EntryImportEntityType,
    csvContent: string,
    fileName: string,
    createdBy: string,
    branchId?: string,
    options?: Record<string, any>,
  ): Promise<EntryImportDocument> {
    const handler = this.handlers.get(entityType);
    if (!handler) {
      throw new BadRequestException(`No handler registered for entity type: ${entityType}`);
    }

    // Parse CSV to get rows
    let rows: Record<string, any>[];
    try {
      rows = CSVParserUtil.parseCSV(csvContent, {
        headerRow: true,
        skipEmptyLines: true,
      });
    } catch (error) {
      throw new BadRequestException(
        `CSV parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
    if (rows.length === 0) {
      throw new BadRequestException('CSV file contains no data rows');
    }

    // Create the entry import record
    const entryImport = new this.entryImportModel({
      entityType,
      fileName,
      totalRecords: rows.length,
      status: EntryImportStatus.PENDING,
      createdBy: new Types.ObjectId(createdBy),
      branch: branchId ? new Types.ObjectId(branchId) : undefined,
      options,
    });

    await entryImport.save();
    this.logger.log(`Created entry import ${entryImport._id} for ${rows.length} ${entityType} records`);

    // Create entry import items for each row
    const items = rows.map((rawData, index) => {
      const mappedResult = handler.mapCsvRow(rawData);
      return {
        entryImport: entryImport._id,
        rowNumber: index + 1,
        rawData,
        mappedData: mappedResult.mappedData,
        uniqueKey: mappedResult.uniqueKey,
        status: mappedResult.errors?.length
          ? EntryImportItemStatus.FAILED
          : EntryImportItemStatus.PENDING,
        errors: mappedResult.errors || [],
      };
    });

    await this.entryImportItemModel.insertMany(items);
    this.logger.log(`Created ${items.length} entry import items for import ${entryImport._id}`);

    // Queue the import for processing
    await this.entryImportQueue.add(
      JobType.ENTRY_IMPORT_PROCESS,
      {
        entryImportId: (entryImport._id as Types.ObjectId).toString(),
        branchId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    return entryImport;
  }

  /**
   * Get import by ID
   */
  async getImportById(importId: string): Promise<EntryImportDocument> {
    const entryImport = await this.entryImportModel.findById(importId);
    if (!entryImport) {
      throw new NotFoundException(`Entry import ${importId} not found`);
    }
    return entryImport;
  }

  /**
   * Get imports with pagination
   */
  async getImports(
    page: number = 1,
    limit: number = 20,
    filters?: {
      entityType?: EntryImportEntityType;
      status?: EntryImportStatus;
      branchId?: string;
      createdBy?: string;
    },
  ): Promise<{
    imports: EntryImportDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: any = {};

    if (filters?.entityType) {
      query.entityType = filters.entityType;
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.branchId) {
      query.branch = new Types.ObjectId(filters.branchId);
    }
    if (filters?.createdBy) {
      query.createdBy = new Types.ObjectId(filters.createdBy);
    }

    const skip = (page - 1) * limit;

    const [imports, total] = await Promise.all([
      this.entryImportModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName email')
        .populate('branch', 'name'),
      this.entryImportModel.countDocuments(query),
    ]);

    return {
      imports,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get import items for an import
   */
  async getImportItems(
    importId: string,
    page: number = 1,
    limit: number = 50,
    status?: EntryImportItemStatus,
  ): Promise<{
    items: EntryImportItemDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: any = { entryImport: new Types.ObjectId(importId) };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.entryImportItemModel.find(query).sort({ rowNumber: 1 }).skip(skip).limit(limit),
      this.entryImportItemModel.countDocuments(query),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Start processing an import (called by processor)
   */
  async startProcessing(importId: string): Promise<void> {
    await this.entryImportModel.findByIdAndUpdate(importId, {
      status: EntryImportStatus.PROCESSING,
      startedAt: new Date(),
    });
  }

  /**
   * Queue individual items for processing
   */
  async queueItemsForProcessing(importId: string, branchId?: string): Promise<number> {
    const items = await this.entryImportItemModel.find({
      entryImport: new Types.ObjectId(importId),
      status: EntryImportItemStatus.PENDING,
    });

    for (const item of items) {
      await this.entryImportQueue.add(
        JobType.ENTRY_IMPORT_ITEM_PROCESS,
        {
          entryImportId: importId,
          entryImportItemId: (item._id as Types.ObjectId).toString(),
          branchId,
        },
        {
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 1000,
          },
        },
      );
    }

    return items.length;
  }

  /**
   * Process a single import item (called by processor)
   */
  async processItem(
    importId: string,
    itemId: string,
    branchId?: string,
  ): Promise<{ success: boolean; errors?: string[] }> {
    const entryImport = await this.entryImportModel.findById(importId);
    if (!entryImport) {
      return { success: false, errors: ['Entry import not found'] };
    }

    const item = await this.entryImportItemModel.findById(itemId);
    if (!item) {
      return { success: false, errors: ['Entry import item not found'] };
    }

    // Skip if already processed
    if (
      item.status === EntryImportItemStatus.COMPLETED ||
      item.status === EntryImportItemStatus.SKIPPED
    ) {
      return { success: true };
    }

    // Mark as processing
    await this.entryImportItemModel.findByIdAndUpdate(itemId, {
      status: EntryImportItemStatus.PROCESSING,
    });

    const handler = this.handlers.get(entryImport.entityType);
    if (!handler) {
      await this.markItemFailed(itemId, ['No handler registered for entity type']);
      return { success: false, errors: ['No handler registered'] };
    }

    try {
      const result = await handler.createEntity(item.mappedData || {}, {
        branchId,
        reportedBy: entryImport.createdBy?.toString(),
        ...entryImport.options,
      });

      if (result.success) {
        await this.entryImportItemModel.findByIdAndUpdate(itemId, {
          status: EntryImportItemStatus.COMPLETED,
          createdEntityId: result.entityId ? new Types.ObjectId(result.entityId) : undefined,
          processedAt: new Date(),
        });

        // Update import progress
        await this.entryImportModel.findByIdAndUpdate(importId, {
          $inc: { processedRecords: 1, successCount: 1 },
        });

        return { success: true };
      } else {
        await this.markItemFailed(itemId, result.errors || ['Unknown error']);
        await this.entryImportModel.findByIdAndUpdate(importId, {
          $inc: { processedRecords: 1, errorCount: 1 },
        });
        return { success: false, errors: result.errors };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.markItemFailed(itemId, [errorMessage]);
      await this.entryImportModel.findByIdAndUpdate(importId, {
        $inc: { processedRecords: 1, errorCount: 1 },
      });
      return { success: false, errors: [errorMessage] };
    }
  }

  /**
   * Mark an item as failed
   */
  private async markItemFailed(itemId: string, errors: string[]): Promise<void> {
    await this.entryImportItemModel.findByIdAndUpdate(itemId, {
      status: EntryImportItemStatus.FAILED,
      $push: { errors: { $each: errors } },
      processedAt: new Date(),
    });
  }

  /**
   * Complete import processing
   */
  async completeImport(importId: string): Promise<void> {
    const entryImport = await this.entryImportModel.findById(importId);
    if (!entryImport) return;

    let finalStatus: EntryImportStatus;
    let message: string;

    if (entryImport.errorCount === 0) {
      finalStatus = EntryImportStatus.COMPLETED;
      message = `Successfully imported ${entryImport.successCount} records`;
    } else if (entryImport.successCount === 0) {
      finalStatus = EntryImportStatus.FAILED;
      message = `Import failed. All ${entryImport.errorCount} records had errors`;
    } else {
      finalStatus = EntryImportStatus.PARTIALLY_COMPLETED;
      message = `Import partially completed. ${entryImport.successCount} succeeded, ${entryImport.errorCount} failed`;
    }

    await this.entryImportModel.findByIdAndUpdate(importId, {
      status: finalStatus,
      message,
      completedAt: new Date(),
    });

    this.logger.log(`Import ${importId} completed with status: ${finalStatus}`);
  }

  /**
   * Check if all items for an import have been processed
   */
  async isImportComplete(importId: string): Promise<boolean> {
    const pendingCount = await this.entryImportItemModel.countDocuments({
      entryImport: new Types.ObjectId(importId),
      status: { $in: [EntryImportItemStatus.PENDING, EntryImportItemStatus.PROCESSING] },
    });
    return pendingCount === 0;
  }

  /**
   * Retry failed items for an import
   */
  async retryFailedItems(importId: string): Promise<number> {
    const entryImport = await this.entryImportModel.findById(importId);
    if (!entryImport) {
      throw new NotFoundException(`Entry import ${importId} not found`);
    }

    // Reset failed items to pending
    const updateResult = await this.entryImportItemModel.updateMany(
      {
        entryImport: new Types.ObjectId(importId),
        status: EntryImportItemStatus.FAILED,
      },
      {
        status: EntryImportItemStatus.PENDING,
        errors: [],
        processedAt: null,
      },
    );

    if (updateResult.modifiedCount > 0) {
      // Reset import counters
      await this.entryImportModel.findByIdAndUpdate(importId, {
        status: EntryImportStatus.PROCESSING,
        $inc: {
          processedRecords: -updateResult.modifiedCount,
          errorCount: -updateResult.modifiedCount,
        },
        completedAt: null,
      });

      // Queue items for processing
      await this.queueItemsForProcessing(
        importId,
        entryImport.branch?.toString(),
      );
    }

    return updateResult.modifiedCount;
  }

  /**
   * Delete an import and its items
   */
  async deleteImport(importId: string): Promise<void> {
    const entryImport = await this.entryImportModel.findById(importId);
    if (!entryImport) {
      throw new NotFoundException(`Entry import ${importId} not found`);
    }

    // Delete all items
    await this.entryImportItemModel.deleteMany({
      entryImport: new Types.ObjectId(importId),
    });

    // Delete the import
    await this.entryImportModel.findByIdAndDelete(importId);

    this.logger.log(`Deleted import ${importId} and its items`);
  }

  /**
   * Get import statistics
   */
  async getImportStats(importId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    skipped: number;
  }> {
    const stats = await this.entryImportItemModel.aggregate([
      { $match: { entryImport: new Types.ObjectId(importId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    };

    stats.forEach((stat) => {
      result[stat._id as keyof typeof result] = stat.count;
      result.total += stat.count;
    });

    return result;
  }
}
