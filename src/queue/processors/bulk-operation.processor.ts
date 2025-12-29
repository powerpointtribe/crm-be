import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  QueueName,
  JobType,
  BulkOperationJobData,
  JobProgress,
  JobResult,
} from '../../common/interfaces/queue-job.interface';
import { BulkOperationUtil } from '../../common/utils/bulk-operation.util';
import { CSVParserUtil } from '../../common/utils/csv-parser.util';
import { BulkOperationType } from '../../common/interfaces/bulk-operation.interface';

// Import services
import { MembersService } from '../../members/members.service';
import { FirstTimersService } from '../../first-timers/first-timers.service';

// Import DTOs
import { CreateMemberDto } from '../../members/dto/create-member.dto';
import { UpdateMemberDto } from '../../members/dto/update-member.dto';
import { CreateFirstTimerDto } from '../../first-timers/dto/create-first-timer.dto';

@Processor(QueueName.BULK_OPERATION)
@Injectable()
export class BulkOperationProcessor {
  private readonly logger = new Logger(BulkOperationProcessor.name);

  constructor(
    private readonly membersService: MembersService,
    private readonly firstTimersService: FirstTimersService,
  ) {}

  @Process(JobType.BULK_MEMBER_CREATE)
  async processBulkMemberCreate(
    job: Job<BulkOperationJobData>,
  ): Promise<JobResult> {
    return this.processBulkMemberOperation(job, BulkOperationType.CREATE);
  }

  @Process(JobType.BULK_MEMBER_UPDATE)
  async processBulkMemberUpdate(
    job: Job<BulkOperationJobData>,
  ): Promise<JobResult> {
    return this.processBulkMemberOperation(job, BulkOperationType.UPDATE);
  }

  @Process(JobType.BULK_USER_CREATE)
  async processBulkUserCreate(
    job: Job<BulkOperationJobData>,
  ): Promise<JobResult> {
    return this.processBulkUserOperation(job, BulkOperationType.CREATE);
  }

  @Process(JobType.BULK_USER_UPDATE)
  async processBulkUserUpdate(
    job: Job<BulkOperationJobData>,
  ): Promise<JobResult> {
    return this.processBulkUserOperation(job, BulkOperationType.UPDATE);
  }

  @Process(JobType.BULK_FIRST_TIMER_CREATE)
  async processBulkFirstTimerCreate(
    job: Job<BulkOperationJobData>,
  ): Promise<JobResult> {
    const { csvContent, options } = job.data;

    try {
      this.updateProgress(job, {
        processedRows: 0,
        totalRows: 0,
        successCount: 0,
        errorCount: 0,
        stage: 'parsing',
        message: 'Parsing CSV content...',
      });

      // Parse CSV content
      const csvData = CSVParserUtil.parseCSV(csvContent, {
        headerRow: true,
        skipEmptyLines: true,
      });

      this.updateProgress(job, {
        processedRows: 0,
        totalRows: csvData.length,
        successCount: 0,
        errorCount: 0,
        stage: 'processing',
        message: 'Processing first-timers...',
      });

      const result = {
        successCount: 0,
        errorCount: 0,
        totalCount: csvData.length,
        successfulRecords: [] as any[],
        failedRecords: [] as Array<{
          row: number;
          data: any;
          errors: string[];
        }>,
      };

      // Process each row
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const rowNumber = i + 2; // +2 because array is 0-indexed and first row is header

        try {
          // Map CSV data to DTO
          const mappedData = CSVParserUtil.mapCSVToFirstTimer(row);

          // Apply default values
          if (options.defaultAssignedTo) {
            mappedData.assignedTo = options.defaultAssignedTo;
          }

          // Create first-timer
          const firstTimer = await this.firstTimersService.create(mappedData);
          result.successfulRecords.push(firstTimer);
          result.successCount++;
        } catch (error) {
          result.errorCount++;
          result.failedRecords.push({
            row: rowNumber,
            data: row,
            errors: [error.message],
          });

          if (!options.skipErrors) {
            break; // Stop processing on first error if not skipping
          }
        }

        // Update progress
        this.updateProgress(job, {
          processedRows: i + 1,
          totalRows: csvData.length,
          successCount: result.successCount,
          errorCount: result.errorCount,
          currentRow: rowNumber,
          stage: 'processing',
          message: `Processing row ${i + 1} of ${csvData.length}`,
        });
      }

      this.updateProgress(job, {
        processedRows: csvData.length,
        totalRows: csvData.length,
        successCount: result.successCount,
        errorCount: result.errorCount,
        stage: 'completed',
        message: 'Processing completed',
      });

      return {
        success: true,
        result,
        processedCount: result.successCount,
        failedCount: result.errorCount,
        totalCount: result.totalCount,
        details: {
          successfulRecords: result.successfulRecords,
          failedRecords: result.failedRecords,
        },
      };
    } catch (error) {
      this.logger.error(`Bulk first-timer create job failed:`, error);

      this.updateProgress(job, {
        processedRows: 0,
        totalRows: 0,
        successCount: 0,
        errorCount: 0,
        stage: 'failed',
        message: error.message,
      });

      return {
        success: false,
        error: error.message,
        processedCount: 0,
        failedCount: 0,
        totalCount: 0,
      };
    }
  }

  private async processBulkMemberOperation(
    job: Job<BulkOperationJobData>,
    operationType: BulkOperationType,
  ): Promise<JobResult> {
    const { csvContent, options } = job.data;

    try {
      this.updateProgress(job, {
        processedRows: 0,
        totalRows: 0,
        successCount: 0,
        errorCount: 0,
        stage: 'parsing',
        message: 'Parsing CSV content...',
      });

      // Create member CSV mapping configuration
      const memberCSVMapping = this.getMemberCSVMapping();

      // Use the bulk operation utility
      const dtoClass =
        operationType === BulkOperationType.CREATE
          ? CreateMemberDto
          : UpdateMemberDto;

      const result = await BulkOperationUtil.processBulkOperation(
        csvContent,
        dtoClass as new () => CreateMemberDto,
        memberCSVMapping,
        // Create function
        async (dto: CreateMemberDto) => {
          return await this.membersService.create(dto);
        },
        // Update function
        async (identifier: any, dto: Partial<UpdateMemberDto>) => {
          const member = await this.membersService.findByEmail(identifier);
          if (!member) {
            throw new Error(`Member with email ${identifier} not found`);
          }
          return await this.membersService.update(
            (member as any)._id.toString(),
            dto,
          );
        },
        // Find function
        async (identifier: any) => {
          return await this.membersService.findByEmail(identifier);
        },
        {
          ...options,
          operationType,
          defaultValues: {
            district: options.defaultDistrict,
            unit: options.defaultUnit,
          },
        },
      );

      return {
        success: true,
        result,
        processedCount: result.successCount,
        failedCount: result.errorCount,
        totalCount: result.totalCount,
        details: {
          successfulRecords: result.successfulRecords,
          failedRecords: result.failedRecords,
        },
      };
    } catch (error) {
      this.logger.error(`Bulk member ${operationType} job failed:`, error);
      return {
        success: false,
        error: error.message,
        processedCount: 0,
        failedCount: 0,
        totalCount: 0,
      };
    }
  }

  private async processBulkUserOperation(
    job: Job<BulkOperationJobData>,
    operationType: BulkOperationType,
  ): Promise<JobResult> {
    const { csvContent, options } = job.data;

    try {
      this.updateProgress(job, {
        processedRows: 0,
        totalRows: 0,
        successCount: 0,
        errorCount: 0,
        stage: 'parsing',
        message: 'Parsing CSV content...',
      });

      // Create user CSV mapping configuration
      const userCSVMapping = this.getUserCSVMapping();

      // Use the bulk operation utility
      const userDtoClass =
        operationType === BulkOperationType.CREATE
          ? CreateMemberDto
          : UpdateMemberDto;

      const result = await BulkOperationUtil.processBulkOperation(
        csvContent,
        userDtoClass as new () => CreateMemberDto,
        userCSVMapping,
        // Create function
        async (dto: CreateMemberDto) => {
          return await this.membersService.create(dto);
        },
        // Update function
        async (identifier: any, dto: Partial<UpdateMemberDto>) => {
          const member = await this.membersService.findByEmail(identifier);
          if (!member) {
            throw new Error(`Member with email ${identifier} not found`);
          }
          return await this.membersService.update(
            (member as any)._id.toString(),
            dto,
          );
        },
        // Find function
        async (identifier: any) => {
          return await this.membersService.findByEmail(identifier);
        },
        {
          ...options,
          operationType,
          defaultValues: {
            password: options.defaultPassword,
            role: options.defaultRole,
          },
        },
      );

      return {
        success: true,
        result,
        processedCount: result.successCount,
        failedCount: result.errorCount,
        totalCount: result.totalCount,
        details: {
          successfulRecords: result.successfulRecords,
          failedRecords: result.failedRecords,
        },
      };
    } catch (error) {
      this.logger.error(`Bulk user ${operationType} job failed:`, error);
      return {
        success: false,
        error: error.message,
        processedCount: 0,
        failedCount: 0,
        totalCount: 0,
      };
    }
  }

  private getMemberCSVMapping() {
    const transforms = BulkOperationUtil.createCommonTransforms();

    return {
      'First Name': { dtoField: 'firstName', required: true },
      'Last Name': { dtoField: 'lastName', required: true },
      Email: {
        dtoField: 'email',
        required: true,
        transform: transforms.normalizeEmail,
      },
      Phone: {
        dtoField: 'phone',
        required: true,
        transform: transforms.normalizePhone,
      },
      'Date of Birth': {
        dtoField: 'dateOfBirth',
        transform: transforms.toDate,
      },
      Gender: { dtoField: 'gender' },
      'Marital Status': { dtoField: 'maritalStatus' },
      Occupation: { dtoField: 'occupation' },
      Street: { dtoField: 'address.street' },
      City: { dtoField: 'address.city' },
      State: { dtoField: 'address.state' },
      Country: { dtoField: 'address.country' },
      'Emergency Contact Name': { dtoField: 'emergencyContact.name' },
      'Emergency Contact Phone': {
        dtoField: 'emergencyContact.phone',
        transform: transforms.normalizePhone,
      },
      'Emergency Contact Relationship': {
        dtoField: 'emergencyContact.relationship',
      },
      'Salvation Date': {
        dtoField: 'salvationDate',
        transform: transforms.toDate,
      },
      'Baptism Date': { dtoField: 'baptismDate', transform: transforms.toDate },
      'Membership Date': {
        dtoField: 'membershipDate',
        transform: transforms.toDate,
      },
      'Join Via': { dtoField: 'joinVia' },
      'Previous Church': { dtoField: 'previousChurch' },
      Skills: {
        dtoField: 'skills',
        transform: (value) => transforms.toArray(value),
      },
      Interests: {
        dtoField: 'interests',
        transform: (value) => transforms.toArray(value),
      },
      'Ministry Preferences': {
        dtoField: 'ministryPreferences',
        transform: (value) => transforms.toArray(value),
      },
    };
  }

  private getUserCSVMapping() {
    const transforms = BulkOperationUtil.createCommonTransforms();

    return {
      'First Name': { dtoField: 'firstName', required: true },
      'Last Name': { dtoField: 'lastName', required: true },
      Email: {
        dtoField: 'email',
        required: true,
        transform: transforms.normalizeEmail,
      },
      Phone: { dtoField: 'phone', transform: transforms.normalizePhone },
      Role: { dtoField: 'role', required: true },
      Password: { dtoField: 'password' },
      Active: { dtoField: 'isActive', transform: transforms.toBoolean },
    };
  }

  private updateProgress(
    job: Job<BulkOperationJobData>,
    progress: JobProgress,
  ): void {
    job.progress(progress);
  }
}
