import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EntityHandler,
  MappedEntityData,
  EntityCreationResult,
} from './entity-handler.interface';
import { EntryImportEntityType } from '../schemas/entry-import.schema';
import {
  ServiceReport,
  ServiceReportDocument,
  ServiceTag,
} from '../../service-reports/schemas/service-report.schema';
import { Branch, BranchDocument } from '../../branches/schemas/branch.schema';

@Injectable()
export class ServiceReportHandler implements EntityHandler {
  private readonly logger = new Logger(ServiceReportHandler.name);

  entityType = EntryImportEntityType.SERVICE_REPORT;

  constructor(
    @InjectModel(ServiceReport.name)
    private serviceReportModel: Model<ServiceReportDocument>,
    @InjectModel(Branch.name)
    private branchModel: Model<BranchDocument>,
  ) {}

  getDisplayName(): string {
    return 'Service Reports';
  }

  getDescription(): string {
    return 'Import service attendance reports from CSV files';
  }

  mapCsvRow(rawData: Record<string, any>): MappedEntityData {
    const mappedData: Record<string, any> = {};

    // Campus/Branch Name (required)
    if (rawData['Campus'] || rawData['campus'] || rawData['Branch'] || rawData['branch'] || rawData['Campus Name'] || rawData['Branch Name']) {
      mappedData.campusName = (rawData['Campus'] || rawData['campus'] || rawData['Branch'] || rawData['branch'] || rawData['Campus Name'] || rawData['Branch Name']).trim();
    }

    // Date (required)
    if (rawData['Date'] || rawData['date'] || rawData['Service Date']) {
      mappedData.date = rawData['Date'] || rawData['date'] || rawData['Service Date'];
    }

    // Service Name (required)
    if (rawData['Service Name'] || rawData['serviceName'] || rawData['Name']) {
      mappedData.serviceName = rawData['Service Name'] || rawData['serviceName'] || rawData['Name'];
    }

    // Service Tags (optional)
    if (rawData['Service Tags'] || rawData['serviceTags'] || rawData['Tags']) {
      const tagsRaw = rawData['Service Tags'] || rawData['serviceTags'] || rawData['Tags'];
      if (tagsRaw) {
        const tags = tagsRaw
          .split(',')
          .map((t: string) => t.trim().toLowerCase().replace(/\s+/g, '_'))
          .filter((t: string) => t.length > 0);

        const validTags = tags.filter((tag: string) =>
          Object.values(ServiceTag).includes(tag as ServiceTag)
        );

        if (validTags.length > 0) {
          mappedData.serviceTags = validTags;
        }
      }
    }

    // Total Attendance (required)
    if (rawData['Total Attendance'] || rawData['totalAttendance'] || rawData['Attendance']) {
      const total = parseInt(rawData['Total Attendance'] || rawData['totalAttendance'] || rawData['Attendance'], 10);
      if (!isNaN(total)) {
        mappedData.totalAttendance = total;
      }
    }

    // Number of Males (required)
    if (rawData['Males'] || rawData['numberOfMales'] || rawData['Number of Males'] || rawData['Male']) {
      const males = parseInt(rawData['Males'] || rawData['numberOfMales'] || rawData['Number of Males'] || rawData['Male'], 10);
      if (!isNaN(males)) {
        mappedData.numberOfMales = males;
      }
    }

    // Number of Females (required)
    if (rawData['Females'] || rawData['numberOfFemales'] || rawData['Number of Females'] || rawData['Female']) {
      const females = parseInt(rawData['Females'] || rawData['numberOfFemales'] || rawData['Number of Females'] || rawData['Female'], 10);
      if (!isNaN(females)) {
        mappedData.numberOfFemales = females;
      }
    }

    // Number of Children (required)
    if (rawData['Children'] || rawData['numberOfChildren'] || rawData['Number of Children'] || rawData['Kids']) {
      const children = parseInt(rawData['Children'] || rawData['numberOfChildren'] || rawData['Number of Children'] || rawData['Kids'], 10);
      if (!isNaN(children)) {
        mappedData.numberOfChildren = children;
      }
    }

    // Number of First Timers (required)
    if (rawData['First Timers'] || rawData['numberOfFirstTimers'] || rawData['Number of First Timers'] || rawData['First-Timers']) {
      const firstTimers = parseInt(rawData['First Timers'] || rawData['numberOfFirstTimers'] || rawData['Number of First Timers'] || rawData['First-Timers'], 10);
      if (!isNaN(firstTimers)) {
        mappedData.numberOfFirstTimers = firstTimers;
      }
    }

    // Notes (optional)
    if (rawData['Notes'] || rawData['notes'] || rawData['Comments'] || rawData['Remarks']) {
      mappedData.notes = rawData['Notes'] || rawData['notes'] || rawData['Comments'] || rawData['Remarks'];
    }

    // Unique key for duplicate checking (date + service name + campus)
    const uniqueKey = `${mappedData.campusName}_${mappedData.date}_${mappedData.serviceName}`;

    // Validate required fields
    const errors: string[] = [];
    if (!mappedData.campusName) {
      errors.push('Campus/Branch name is required');
    }
    if (!mappedData.date) {
      errors.push('Date is required');
    }
    if (!mappedData.serviceName) {
      errors.push('Service name is required');
    }
    if (mappedData.totalAttendance === undefined) {
      errors.push('Total attendance is required');
    }
    if (mappedData.numberOfMales === undefined) {
      errors.push('Number of males is required');
    }
    if (mappedData.numberOfFemales === undefined) {
      errors.push('Number of females is required');
    }
    if (mappedData.numberOfChildren === undefined) {
      errors.push('Number of children is required');
    }
    if (mappedData.numberOfFirstTimers === undefined) {
      errors.push('Number of first timers is required');
    }

    // Validate attendance calculation
    if (
      mappedData.totalAttendance !== undefined &&
      mappedData.numberOfMales !== undefined &&
      mappedData.numberOfFemales !== undefined &&
      mappedData.numberOfChildren !== undefined
    ) {
      const calculatedTotal = mappedData.numberOfMales + mappedData.numberOfFemales + mappedData.numberOfChildren;
      if (calculatedTotal !== mappedData.totalAttendance) {
        errors.push(
          `Total attendance (${mappedData.totalAttendance}) must equal Males (${mappedData.numberOfMales}) + Females (${mappedData.numberOfFemales}) + Children (${mappedData.numberOfChildren}) = ${calculatedTotal}`
        );
      }
    }

    // Validate first timers count
    if (
      mappedData.numberOfFirstTimers !== undefined &&
      mappedData.totalAttendance !== undefined &&
      mappedData.numberOfFirstTimers > mappedData.totalAttendance
    ) {
      errors.push(
        `Number of first timers (${mappedData.numberOfFirstTimers}) cannot exceed total attendance (${mappedData.totalAttendance})`
      );
    }

    return {
      mappedData,
      uniqueKey,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async createEntity(
    mappedData: Record<string, any>,
    options?: Record<string, any>,
  ): Promise<EntityCreationResult> {
    try {
      // Validate campus name exists in the system and get the branch
      if (mappedData.campusName) {
        const branch = await this.branchModel.findOne({
          name: { $regex: new RegExp(`^${mappedData.campusName}$`, 'i') },
          isActive: true,
        });

        if (!branch) {
          return {
            success: false,
            errors: [`Campus/Branch "${mappedData.campusName}" not found in the system. Please ensure the campus name matches exactly.`],
          };
        }

        mappedData.branch = branch._id;
        // Remove campusName from mappedData as we now have the branch reference
        delete mappedData.campusName;
      } else if (options?.branchId) {
        // Fall back to branchId from options if no campusName provided
        mappedData.branch = new Types.ObjectId(options.branchId);
      }

      if (!mappedData.branch) {
        return {
          success: false,
          errors: ['Campus/Branch is required for service report creation'],
        };
      }

      // Apply reportedBy if provided (the user doing the import)
      if (options?.reportedBy) {
        mappedData.reportedBy = new Types.ObjectId(options.reportedBy);
      }

      if (!mappedData.reportedBy) {
        return {
          success: false,
          errors: ['Reporter is required for service report creation'],
        };
      }

      // Parse date
      if (mappedData.date) {
        const date = new Date(mappedData.date);
        if (isNaN(date.getTime())) {
          return {
            success: false,
            errors: ['Invalid date format. Use YYYY-MM-DD format.'],
          };
        }
        mappedData.date = date;
      }

      // Check for duplicate by date, service name, and branch
      const existing = await this.serviceReportModel.findOne({
        date: mappedData.date,
        serviceName: mappedData.serviceName,
        branch: mappedData.branch,
        isActive: true,
      });

      if (existing) {
        return {
          success: false,
          errors: [
            `Service report for "${mappedData.serviceName}" on ${mappedData.date.toISOString().split('T')[0]} already exists for this branch`,
          ],
        };
      }

      // Create the service report
      const serviceReport = new this.serviceReportModel({
        ...mappedData,
        isActive: true,
      });

      await serviceReport.save();

      this.logger.debug(
        `Created service report ${serviceReport._id}: ${serviceReport.serviceName} on ${serviceReport.date}`,
      );

      return {
        success: true,
        entityId: (serviceReport._id as Types.ObjectId).toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to create service report: ${error.message}`);
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  getSampleCsvHeaders(): string[] {
    return [
      'Campus',
      'Date',
      'Service Name',
      'Service Tags',
      'Total Attendance',
      'Males',
      'Females',
      'Children',
      'First Timers',
      'Notes',
    ];
  }

  getSampleCsvRow(): string[] {
    return [
      'Main Campus',
      '2024-01-07',
      'Sunday Service',
      'invited_guest_minister',
      '150',
      '60',
      '55',
      '35',
      '12',
      'Great turnout for the new year',
    ];
  }
}
