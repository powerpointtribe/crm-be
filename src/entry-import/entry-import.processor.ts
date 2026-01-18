import { Process, Processor, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  QueueName,
  JobType,
  EntryImportJobData,
  EntryImportItemJobData,
} from '../common/interfaces/queue-job.interface';
import { EntryImportService } from './entry-import.service';

@Processor(QueueName.ENTRY_IMPORT)
export class EntryImportProcessor {
  private readonly logger = new Logger(EntryImportProcessor.name);

  constructor(private readonly entryImportService: EntryImportService) {}

  @Process(JobType.ENTRY_IMPORT_PROCESS)
  async handleEntryImportProcess(job: Job<EntryImportJobData>): Promise<void> {
    const { entryImportId, branchId } = job.data;
    this.logger.log(`Processing entry import: ${entryImportId}`);

    try {
      // Mark import as processing
      await this.entryImportService.startProcessing(entryImportId);

      // Queue all pending items for processing
      const queuedCount = await this.entryImportService.queueItemsForProcessing(
        entryImportId,
        branchId,
      );

      this.logger.log(`Queued ${queuedCount} items for processing in import ${entryImportId}`);

      // Update job progress
      await job.progress(10);
    } catch (error) {
      this.logger.error(
        `Failed to process entry import ${entryImportId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  @Process(JobType.ENTRY_IMPORT_ITEM_PROCESS)
  async handleEntryImportItemProcess(job: Job<EntryImportItemJobData>): Promise<void> {
    const { entryImportId, entryImportItemId, branchId } = job.data;
    this.logger.debug(`Processing entry import item: ${entryImportItemId}`);

    try {
      const result = await this.entryImportService.processItem(
        entryImportId,
        entryImportItemId,
        branchId,
      );

      if (!result.success) {
        this.logger.warn(
          `Entry import item ${entryImportItemId} failed: ${result.errors?.join(', ')}`,
        );
      }

      // Check if import is complete after processing this item
      const isComplete = await this.entryImportService.isImportComplete(entryImportId);
      if (isComplete) {
        await this.entryImportService.completeImport(entryImportId);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process entry import item ${entryImportItemId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any): void {
    this.logger.debug(`Job ${job.id} completed with result: ${JSON.stringify(result)}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`);
  }
}
