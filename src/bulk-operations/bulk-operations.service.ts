import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import {
  FirstTimer,
  FirstTimerDocument,
} from '../first-timers/schemas/first-timer.schema';
import {
  BulkOperationHistory,
  BulkOperationHistoryDocument,
} from './schemas/bulk-operation-history.schema';
import {
  BulkOperationType,
  BulkOperationResult,
  BulkOperationOptions,
} from '../common/interfaces/bulk-operation.interface';
import { MembersService } from '../members/members.service';
import { GroupsService } from '../groups/groups.service';
import { FirstTimersService } from '../first-timers/first-timers.service';
import { QueueService } from '../queue/queue.service';

interface BulkOperationStats {
  _id: string;
  entityType: string;
  operation: BulkOperationType;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  status: 'completed' | 'failed' | 'pending';
  createdBy: string;
  createdAt: Date;
  errors?: string[];
}

@Injectable()
export class BulkOperationsService {
  private templates = {
    members: {
      headers: [
        'firstName',
        'lastName',
        'email',
        'phone',
        'password',
        'dateOfBirth',
        'gender',
        'maritalStatus',
        'membershipStatus',
        'occupation',
        'street',
        'city',
        'state',
        'zipCode',
        'country',
        'district',
        'unit',
        'ministries',
        'skills',
        'dateJoined',
        'emergencyContactName',
        'emergencyContactPhone',
        'emergencyContactRelationship',
      ],
      required: [
        'firstName',
        'lastName',
        'email',
        'phone',
        // 'password',
        'dateOfBirth',
        'gender',
      ],
      example: [
        'John',
        'Doe',
        'john.doe@example.com',
        '+1234567890',
        'defaultPassword123',
        '1990-01-01',
        'male',
        'single',
        'new_convert',
        'Engineer',
        '123 Main St',
        'Lagos',
        'Lagos',
        '100001',
        'Nigeria',
        'District Name',
        'Unit Name',
        'ushering,prayer',
        'leadership,music',
        '2024-01-01',
        'Jane Doe',
        '+1234567891',
        'spouse',
      ],
    },
    groups: {
      headers: [
        'name',
        'type',
        'description',
        'maxCapacity',
        'contactPhone',
        'contactEmail',
        'meetingDay',
        'meetingTime',
        'meetingLocation',
        'isVirtual',
        'virtualLink',
        'vision',
        'mission',
        'goals',
      ],
      required: ['name', 'type'],
      example: [
        'Bible Study Group',
        'district',
        'Weekly Bible study and fellowship',
        '20',
        '+1234567890',
        'group@church.com',
        'wednesday',
        '19:00',
        'Church Hall A',
        'false',
        '',
        'Growing together in faith',
        'Study the word together',
        'increase biblical knowledge,fellowship',
      ],
    },
    'first-timers': {
      headers: [
        'firstName',
        'lastName',
        'phone',
        'email',
        'dateOfVisit',
        'dateOfBirth',
        'occupation',
        'street',
        'city',
        'state',
        'country',
        'maritalStatus',
        'numberOfChildren',
        'howDidYouHear',
        'visitorType',
        'previousChurch',
        'invitedBy',
        'interests',
        'prayerRequests',
        'servingInterests',
        'notes',
      ],
      required: ['firstName', 'lastName', 'phone', 'dateOfVisit'],
      example: [
        'Jane',
        'Smith',
        '+1234567890',
        'jane.smith@example.com',
        '2024-01-15',
        '1985-05-20',
        'Teacher',
        '456 Oak St',
        'Lagos',
        'Lagos',
        'Nigeria',
        'married',
        '2',
        'friend',
        'first_time',
        'Previous Church Name',
        'John Doe',
        'bible study,youth ministry',
        'healing for family',
        'children ministry',
        'Very interested in joining',
      ],
    },
  };

  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(FirstTimer.name)
    private firstTimerModel: Model<FirstTimerDocument>,
    @InjectModel(BulkOperationHistory.name)
    private bulkOperationHistoryModel: Model<BulkOperationHistoryDocument>,
    private membersService: MembersService,
    private groupsService: GroupsService,
    private firstTimersService: FirstTimersService,
    private queueService: QueueService,
  ) {}

  async generateTemplate(entityType: string): Promise<string> {
    const template = this.templates[entityType];
    if (!template) {
      throw new BadRequestException(
        `Template not found for entity type: ${entityType}`,
      );
    }

    // Generate CSV manually without external dependencies
    const headers = template.headers.join(',');
    const example = template.example
      .map((value) =>
        typeof value === 'string' && value.includes(',') ? `"${value}"` : value,
      )
      .join(',');

    return `${headers}\n${example}`;
  }

  async processBulkOperation(
    entityType: string,
    file: any,
    operation: BulkOperationType,
    options: BulkOperationOptions,
    userId: string,
  ): Promise<BulkOperationResult> {
    const csvData = await this.parseCsvFile(file);
    const template = this.templates[entityType];

    if (!template) {
      throw new BadRequestException(`Entity type not supported: ${entityType}`);
    }

    const validationErrors = this.validateCsvData(csvData, template);
    if (validationErrors.length > 0 && !options.skipErrors) {
      throw new BadRequestException(
        `Validation errors: ${validationErrors.join(', ')}`,
      );
    }

    // If dry run, return preview without executing
    if (options.dryRun) {
      return this.generatePreview(csvData, entityType, operation, template);
    }

    // Process the operation
    return await this.executeOperation(
      csvData,
      entityType,
      operation,
      options,
      userId,
    );
  }

  private async parseCsvFile(file: any): Promise<any[]> {
    const csvContent = file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter((line) => line.trim() !== '');

    if (lines.length < 2) {
      throw new BadRequestException(
        'CSV file must contain at least headers and one data row',
      );
    }

    const headers = this.parseCsvLine(lines[0]);
    const records: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      if (values.length > 0) {
        const record: any = {};
        headers.forEach((header, index) => {
          record[header.trim()] = values[index]?.trim() || '';
        });
        records.push(record);
      }
    }

    return records;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  private validateCsvData(data: any[], template: any): string[] {
    const errors: string[] = [];

    data.forEach((row, index) => {
      template.required.forEach((field: string) => {
        if (!row[field] || row[field].trim() === '') {
          errors.push(`Row ${index + 2}: ${field} is required`);
        }
      });
    });

    return errors;
  }

  private generatePreview(
    data: any[],
    entityType: string,
    operation: BulkOperationType,
    template: any,
  ): BulkOperationResult {
    const validRows = data.filter((row) => {
      return template.required.every(
        (field: string) => row[field] && row[field].trim() !== '',
      );
    });

    const invalidRows = data.filter((row) => {
      return !template.required.every(
        (field: string) => row[field] && row[field].trim() !== '',
      );
    });

    return {
      successCount: validRows.length,
      errorCount: invalidRows.length,
      totalCount: data.length,
      successfulRecords: validRows.slice(0, 10), // Preview first 10
      failedRecords: invalidRows.map((row, index) => ({
        row: index + 2,
        data: row,
        errors: template.required
          .filter((field: string) => !row[field] || row[field].trim() === '')
          .map((field: string) => `${field} is required`),
        operation,
      })),
      message: `Preview: ${validRows.length} valid records, ${invalidRows.length} invalid records`,
      operationType: operation,
    };
  }

  private async executeOperation(
    data: any[],
    entityType: string,
    operation: BulkOperationType,
    options: BulkOperationOptions,
    userId: string,
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successCount: 0,
      errorCount: 0,
      totalCount: data.length,
      successfulRecords: [],
      failedRecords: [],
      message: '',
      operationType: operation,
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        let record;

        switch (entityType) {
          case 'members':
            record = await this.processMemberRow(row, operation, options);
            break;
          case 'groups':
            record = await this.processGroupRow(row, operation, options);
            break;
          case 'first-timers':
            record = await this.processFirstTimerRow(row, operation, options);
            break;
          default:
            throw new Error(`Unsupported entity type: ${entityType}`);
        }

        result.successfulRecords.push(record);
        result.successCount++;
      } catch (error) {
        result.failedRecords.push({
          row: i + 2,
          data: row,
          errors: [error.message],
          operation,
        });
        result.errorCount++;

        if (!options.skipErrors) {
          break;
        }
      }
    }

    result.message = `Operation completed: ${result.successCount} successful, ${result.errorCount} failed`;

    // Record operation in history
    await this.recordOperationHistory(entityType, operation, result, userId);

    return result;
  }

  private async processMemberRow(
    row: any,
    operation: BulkOperationType,
    options: BulkOperationOptions,
  ) {
    const memberData = {
      firstName: row.firstName?.trim(),
      lastName: row.lastName?.trim(),
      email: row.email?.trim().toLowerCase(),
      phone: row.phone?.trim(),
      gender: row.gender?.trim().toLowerCase(),
      dateOfBirth: row.dateOfBirth?.trim(),
      maritalStatus: row.maritalStatus?.trim().toLowerCase(),
      password: row.password || 'TempPassword123!',
      membershipStatus: row.membershipStatus || 'NEW',
      district: row.district?.trim(),
      unit: row.unit?.trim(),
      address: {
        street: row.street?.trim() || '',
        city: row.city?.trim() || '',
        state: row.state?.trim() || 'Lagos',
        zipCode: row.zipCode?.trim() || '',
        country: row.country?.trim() || 'Nigeria',
      },
    };

    switch (operation) {
      case BulkOperationType.CREATE:
        return await this.membersService.create(memberData);
      case BulkOperationType.UPDATE:
        const identifier = options.identifierField || 'email';
        const existingMember = await this.memberModel.findOne({
          [identifier]: memberData[identifier],
        });
        if (!existingMember) {
          throw new Error(
            `Member not found with ${identifier}: ${memberData[identifier]}`,
          );
        }
        const updateData = { ...memberData };
        delete updateData.password; // Don't update password in bulk operations
        return await this.membersService.update(
          existingMember._id.toString(),
          updateData,
        );
      default:
        throw new Error(`Operation ${operation} not supported for members`);
    }
  }

  private async processGroupRow(
    row: any,
    operation: BulkOperationType,
    options: BulkOperationOptions,
  ) {
    const groupData = {
      name: row.name?.trim(),
      description: row.description?.trim(),
      type: row.type?.trim(),
      capacity: row.capacity ? parseInt(row.capacity) : undefined,
      meetingDay: row.meetingDay?.trim(),
      meetingTime: row.meetingTime?.trim(),
      // Add more field mappings as needed
    };

    switch (operation) {
      case BulkOperationType.CREATE:
        return await this.groupsService.create(groupData);
      case BulkOperationType.UPDATE:
        const identifier = options.identifierField || 'name';
        const existingGroup = await this.groupModel.findOne({
          [identifier]: groupData[identifier],
        });
        if (!existingGroup) {
          throw new Error(
            `Group not found with ${identifier}: ${groupData[identifier]}`,
          );
        }
        return await this.groupsService.update(
          existingGroup._id as string,
          groupData,
        );
      default:
        throw new Error(`Operation ${operation} not supported for groups`);
    }
  }

  private async processFirstTimerRow(
    row: any,
    operation: BulkOperationType,
    options: BulkOperationOptions,
  ) {
    const firstTimerData = {
      firstName: row.firstName?.trim(),
      lastName: row.lastName?.trim(),
      email: row.email?.trim().toLowerCase(),
      phone: row.phone?.trim(),
      dateOfVisit: row.serviceDate?.trim() || row.dateOfVisit?.trim(),
      invitedBy: row.invitedBy?.trim(),
      maritalStatus: row.maritalStatus?.trim().toLowerCase(),
      dateOfBirth: row.dateOfBirth?.trim(),
    };

    switch (operation) {
      case BulkOperationType.CREATE:
        return await this.firstTimersService.create(firstTimerData);
      case BulkOperationType.UPDATE:
        const identifier = options.identifierField || 'email';
        const existingFirstTimer = await this.firstTimerModel.findOne({
          [identifier]: firstTimerData[identifier],
        });
        if (!existingFirstTimer) {
          throw new Error(
            `First timer not found with ${identifier}: ${firstTimerData[identifier]}`,
          );
        }
        return await this.firstTimersService.update(
          existingFirstTimer._id as string,
          firstTimerData,
        );
      default:
        throw new Error(
          `Operation ${operation} not supported for first-timers`,
        );
    }
  }

  async exportEntities(
    entityType: string,
    filters: any,
    userId: string,
  ): Promise<string> {
    let data: any[] = [];

    // Build the final query with user access control and filters
    const finalFilters = await this.buildFilterQuery(
      filters,
      entityType,
      userId,
    );

    switch (entityType) {
      case 'members':
        const members = await this.memberModel
          .find(finalFilters)
          .populate('district', 'name')
          .populate('unit', 'name')
          .lean();
        data = members.map((member) => ({
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          phone: member.phone,
          gender: member.gender,
          dateOfBirth: member.dateOfBirth?.toISOString().split('T')[0],
          maritalStatus: member.maritalStatus,
          membershipStatus: member.membershipStatus,
          district: (member.district as any)?.name || '',
          unit: (member.unit as any)?.name || '',
          dateJoined: member.dateJoined?.toISOString().split('T')[0],
          isActive: member.isActive,
          createdAt: member.createdAt?.toISOString().split('T')[0],
        }));
        break;
      case 'groups':
        const groups = await this.groupModel
          .find(finalFilters)
          .populate('districtPastor', 'firstName lastName')
          .populate('unitHead', 'firstName lastName')
          .lean();
        data = groups.map((group) => ({
          name: group.name,
          description: group.description,
          type: group.type,
          maxCapacity: group.maxCapacity,
          currentMemberCount: group.currentMemberCount,
          isActive: group.isActive,
          districtPastor: group.districtPastor
            ? `${(group.districtPastor as any).firstName} ${(group.districtPastor as any).lastName}`
            : '',
          unitHead: group.unitHead
            ? `${(group.unitHead as any).firstName} ${(group.unitHead as any).lastName}`
            : '',
          contactPhone: group.contactPhone || '',
          contactEmail: group.contactEmail || '',
          createdAt: group.createdAt?.toISOString().split('T')[0],
        }));
        break;
      case 'first-timers':
        const firstTimers = await this.firstTimerModel
          .find(finalFilters)
          .populate('assignedTo', 'firstName lastName')
          .populate('invitedByMember', 'firstName lastName')
          .lean();
        data = firstTimers.map((ft) => ({
          firstName: ft.firstName,
          lastName: ft.lastName,
          email: ft.email || '',
          phone: ft.phone,
          maritalStatus: ft.maritalStatus || '',
          dateOfVisit: ft.dateOfVisit?.toISOString().split('T')[0],
          dateOfBirth: ft.dateOfBirth || '',
          invitedBy: ft.invitedBy || '',
          invitedByMember: ft.invitedByMember
            ? `${(ft.invitedByMember as any).firstName} ${(ft.invitedByMember as any).lastName}`
            : '',
          status: ft.status,
          interestedInJoining: ft.interestedInJoining,
          converted: ft.converted,
          howDidYouHear: ft.howDidYouHear || '',
          visitorType: ft.visitorType || '',
          assignedTo: ft.assignedTo
            ? `${(ft.assignedTo as any).firstName} ${(ft.assignedTo as any).lastName}`
            : '',
          followUpCount: ft.followUpCount,
          nextFollowUpDate:
            ft.nextFollowUpDate?.toISOString().split('T')[0] || '',
          createdAt: ft.createdAt?.toISOString().split('T')[0],
        }));
        break;
      default:
        throw new BadRequestException(
          `Export not supported for entity type: ${entityType}`,
        );
    }

    if (data.length === 0) {
      return '';
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    const csvLines = [headers.join(',')];

    // Add data rows
    data.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header] || '';
        // Escape values that contain commas or quotes
        if (
          typeof value === 'string' &&
          (value.includes(',') || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvLines.push(values.join(','));
    });

    const csvContent = csvLines.join('\n');

    // Record export operation in history
    await this.recordOperationHistory(
      entityType,
      BulkOperationType.EXPORT,
      {
        totalCount: data.length,
        successCount: data.length,
        errorCount: 0,
        successfulRecords: data,
        failedRecords: [],
        message: `Successfully exported ${data.length} ${entityType} records`,
        operationType: BulkOperationType.EXPORT,
      },
      userId,
    );

    return csvContent;
  }

  async getOperationsHistory(params: {
    page: number;
    limit: number;
    entityType?: string;
    operation?: BulkOperationType;
    userId: string;
  }): Promise<any> {
    const query: any = {};

    // Build query based on user access (for now, show all operations for the user)
    // In a real implementation, you might filter by user access rights

    if (params.entityType) {
      query.entityType = params.entityType;
    }

    if (params.operation) {
      query.operation = params.operation;
    }

    const skip = (params.page - 1) * params.limit;

    const [items, total] = await Promise.all([
      this.bulkOperationHistoryModel
        .find(query)
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(params.limit)
        .lean(),
      this.bulkOperationHistoryModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / params.limit);

    return {
      items: items.map((item) => ({
        id: item._id,
        type: item.operation,
        entityType: item.entityType,
        recordsProcessed: item.totalRecords,
        successCount: item.successCount,
        errorCount: item.errorCount,
        status: item.status,
        timestamp: item.createdAt.toISOString(),
        user: item.createdBy
          ? `${(item.createdBy as any).firstName} ${(item.createdBy as any).lastName}`
          : 'Unknown',
        message: item.message,
        fileName: item.fileName,
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrev: params.page > 1,
      },
    };
  }

  async getOperationsStats(userId: string): Promise<any> {
    // Get real statistics from the database
    const [
      totalOperations,
      successfulOperations,
      failedOperations,
      pendingOperations,
      recentActivity,
    ] = await Promise.all([
      this.bulkOperationHistoryModel.countDocuments({}),
      this.bulkOperationHistoryModel.countDocuments({ status: 'completed' }),
      this.bulkOperationHistoryModel.countDocuments({ status: 'failed' }),
      this.bulkOperationHistoryModel.countDocuments({ status: 'pending' }),
      this.bulkOperationHistoryModel
        .find({})
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      pendingOperations,
      recentActivity: recentActivity.map((activity) => ({
        id: activity._id,
        type: activity.operation,
        entityType: activity.entityType,
        recordsProcessed: activity.totalRecords,
        status: activity.status,
        timestamp: activity.createdAt.toISOString(),
        user: activity.createdBy
          ? `${(activity.createdBy as any).firstName} ${(activity.createdBy as any).lastName}`
          : 'Unknown',
      })),
    };
  }

  async updateTemplate(
    entityType: string,
    templateConfig: any,
    userId: string,
  ): Promise<any> {
    // Update template configuration
    if (this.templates[entityType]) {
      this.templates[entityType] = {
        ...this.templates[entityType],
        ...templateConfig,
      };
      return { message: 'Template updated successfully' };
    }
    throw new NotFoundException(
      `Template not found for entity type: ${entityType}`,
    );
  }

  async getAvailableTemplates(): Promise<any> {
    return Object.keys(this.templates).map((entityType) => ({
      entityType,
      name: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Template`,
      headers: this.templates[entityType].headers,
      required: this.templates[entityType].required,
    }));
  }

  private async buildFilterQuery(
    filters: any,
    entityType: string,
    userId: string,
  ): Promise<any> {
    // Start with the provided filters
    const query = { ...filters };

    // Add user access control filtering here if needed
    // For now, we'll just return the filters as-is
    // In a real implementation, you would check user permissions
    // and filter based on district/unit access rights

    console.log('Built filter query for export:', {
      entityType,
      filters,
      query,
    });

    return query;
  }

  private async recordOperationHistory(
    entityType: string,
    operation: BulkOperationType,
    result: BulkOperationResult,
    userId: string,
    fileName?: string,
  ): Promise<void> {
    try {
      // Save the operation to the history collection
      const historyEntry = new this.bulkOperationHistoryModel({
        entityType,
        operation,
        totalRecords: result.totalCount,
        successCount: result.successCount,
        errorCount: result.errorCount,
        status: result.errorCount > 0 ? 'failed' : 'completed',
        createdBy: userId,
        message: result.message,
        errors: result.failedRecords.map((fr) => fr.errors.join(', ')),
        fileName,
      });

      await historyEntry.save();

      console.log('Operation history recorded successfully:', {
        entityType,
        operation,
        total: result.totalCount,
        success: result.successCount,
        errors: result.errorCount,
        userId,
      });
    } catch (error) {
      console.error('Failed to record operation history:', error);
      // Don't throw error as this shouldn't fail the main operation
    }
  }
}
