import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { FirstTimer, FirstTimerDocument } from '../first-timers/schemas/first-timer.schema';
import { BulkOperationType, BulkOperationResult, BulkOperationOptions } from '../common/interfaces/bulk-operation.interface';
import { MembersService } from '../members/members.service';
import { GroupsService } from '../groups/groups.service';
import { FirstTimersService } from '../first-timers/first-timers.service';
import { QueueService } from '../queue/queue.service';

interface BulkOperationHistory {
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
      headers: ['firstName', 'lastName', 'email', 'phone', 'gender', 'dateOfBirth', 'maritalStatus', 'district', 'unit'],
      required: ['firstName', 'lastName', 'email'],
      example: ['John', 'Doe', 'john.doe@example.com', '+1234567890', 'male', '1990-01-01', 'single', 'District 1', 'Unit A']
    },
    groups: {
      headers: ['name', 'description', 'type', 'district', 'unit', 'capacity', 'meetingDay', 'meetingTime'],
      required: ['name', 'type'],
      example: ['Bible Study Group', 'Weekly Bible study and fellowship', 'bible_study', 'District 1', 'Unit A', '20', 'Wednesday', '19:00']
    },
    'first-timers': {
      headers: ['firstName', 'lastName', 'email', 'phone', 'gender', 'ageGroup', 'maritalStatus', 'serviceDate', 'invitedBy'],
      required: ['firstName', 'lastName', 'serviceDate'],
      example: ['Jane', 'Smith', 'jane.smith@example.com', '+1234567890', 'female', 'adult', 'single', '2024-01-15', 'John Doe']
    }
  };

  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(FirstTimer.name) private firstTimerModel: Model<FirstTimerDocument>,
    private membersService: MembersService,
    private groupsService: GroupsService,
    private firstTimersService: FirstTimersService,
    private queueService: QueueService,
  ) {}

  async generateTemplate(entityType: string): Promise<string> {
    const template = this.templates[entityType];
    if (!template) {
      throw new BadRequestException(`Template not found for entity type: ${entityType}`);
    }

    // Generate CSV manually without external dependencies
    const headers = template.headers.join(',');
    const example = template.example.map(value =>
      typeof value === 'string' && value.includes(',') ? `"${value}"` : value
    ).join(',');

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
      throw new BadRequestException(`Validation errors: ${validationErrors.join(', ')}`);
    }

    // If dry run, return preview without executing
    if (options.dryRun) {
      return this.generatePreview(csvData, entityType, operation, template);
    }

    // Process the operation
    return await this.executeOperation(csvData, entityType, operation, options, userId);
  }

  private async parseCsvFile(file: any): Promise<any[]> {
    const csvContent = file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');

    if (lines.length < 2) {
      throw new BadRequestException('CSV file must contain at least headers and one data row');
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
    const validRows = data.filter(row => {
      return template.required.every((field: string) => row[field] && row[field].trim() !== '');
    });

    const invalidRows = data.filter(row => {
      return !template.required.every((field: string) => row[field] && row[field].trim() !== '');
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

  private async processMemberRow(row: any, operation: BulkOperationType, options: BulkOperationOptions) {
    const memberData = {
      firstName: row.firstName?.trim(),
      lastName: row.lastName?.trim(),
      email: row.email?.trim().toLowerCase(),
      phone: row.phone?.trim(),
      gender: row.gender?.trim().toLowerCase(),
      dateOfBirth: row.dateOfBirth?.trim(),
      maritalStatus: row.maritalStatus?.trim().toLowerCase(),
      password: row.password || 'TempPassword123!',
      membershipStatus: row.membershipStatus || 'active',
      district: row.district?.trim(),
      unit: row.unit?.trim(),
    };

    switch (operation) {
      case BulkOperationType.CREATE:
        return await this.membersService.create(memberData);
      case BulkOperationType.UPDATE:
        const identifier = options.identifierField || 'email';
        const existingMember = await this.memberModel.findOne({ [identifier]: memberData[identifier] });
        if (!existingMember) {
          throw new Error(`Member not found with ${identifier}: ${memberData[identifier]}`);
        }
        const updateData = { ...memberData };
        delete updateData.password; // Don't update password in bulk operations
        return await this.membersService.update(existingMember._id.toString(), updateData);
      default:
        throw new Error(`Operation ${operation} not supported for members`);
    }
  }

  private async processGroupRow(row: any, operation: BulkOperationType, options: BulkOperationOptions) {
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
        const existingGroup = await this.groupModel.findOne({ [identifier]: groupData[identifier] });
        if (!existingGroup) {
          throw new Error(`Group not found with ${identifier}: ${groupData[identifier]}`);
        }
        return await this.groupsService.update(existingGroup._id as string, groupData);
      default:
        throw new Error(`Operation ${operation} not supported for groups`);
    }
  }

  private async processFirstTimerRow(row: any, operation: BulkOperationType, options: BulkOperationOptions) {
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
        const existingFirstTimer = await this.firstTimerModel.findOne({ [identifier]: firstTimerData[identifier] });
        if (!existingFirstTimer) {
          throw new Error(`First timer not found with ${identifier}: ${firstTimerData[identifier]}`);
        }
        return await this.firstTimersService.update(existingFirstTimer._id as string, firstTimerData);
      default:
        throw new Error(`Operation ${operation} not supported for first-timers`);
    }
  }

  async exportEntities(entityType: string, filters: any, userId: string): Promise<string> {
    let data: any[] = [];

    switch (entityType) {
      case 'members':
        const members = await this.memberModel.find(filters).lean();
        data = members.map(member => ({
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          phone: member.phone,
          gender: member.gender,
          dateOfBirth: member.dateOfBirth?.toISOString().split('T')[0],
          maritalStatus: member.maritalStatus,
          createdAt: member.createdAt?.toISOString().split('T')[0],
        }));
        break;
      case 'groups':
        const groups = await this.groupModel.find(filters).lean();
        data = groups.map(group => ({
          name: group.name,
          description: group.description,
          type: group.type,
          maxCapacity: group.maxCapacity,
          memberCount: group.members?.length || 0,
          isActive: group.isActive,
          createdAt: group.createdAt?.toISOString().split('T')[0],
        }));
        break;
      case 'first-timers':
        const firstTimers = await this.firstTimerModel.find(filters).lean();
        data = firstTimers.map(ft => ({
          firstName: ft.firstName,
          lastName: ft.lastName,
          email: ft.email,
          phone: ft.phone,
          maritalStatus: ft.maritalStatus,
          dateOfVisit: ft.dateOfVisit?.toISOString().split('T')[0],
          dateOfBirth: ft.dateOfBirth?.toISOString().split('T')[0],
          invitedBy: ft.invitedBy,
          status: ft.status,
          interestedInJoining: ft.interestedInJoining,
          createdAt: ft.createdAt?.toISOString().split('T')[0],
        }));
        break;
      default:
        throw new BadRequestException(`Export not supported for entity type: ${entityType}`);
    }

    if (data.length === 0) {
      return '';
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    const csvLines = [headers.join(',')];

    // Add data rows
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header] || '';
        // Escape values that contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvLines.push(values.join(','));
    });

    return csvLines.join('\n');
  }

  async getOperationsHistory(params: {
    page: number;
    limit: number;
    entityType?: string;
    operation?: BulkOperationType;
    userId: string;
  }): Promise<any> {
    // This would typically use a dedicated operations history collection
    // For now, return mock data
    return {
      items: [],
      pagination: {
        page: params.page,
        limit: params.limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  async getOperationsStats(userId: string): Promise<any> {
    // Mock stats for now
    return {
      totalOperations: 156,
      successfulOperations: 142,
      failedOperations: 8,
      pendingOperations: 6,
      recentActivity: [],
    };
  }

  async updateTemplate(entityType: string, templateConfig: any, userId: string): Promise<any> {
    // Update template configuration
    if (this.templates[entityType]) {
      this.templates[entityType] = { ...this.templates[entityType], ...templateConfig };
      return { message: 'Template updated successfully' };
    }
    throw new NotFoundException(`Template not found for entity type: ${entityType}`);
  }

  async getAvailableTemplates(): Promise<any> {
    return Object.keys(this.templates).map(entityType => ({
      entityType,
      name: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Template`,
      headers: this.templates[entityType].headers,
      required: this.templates[entityType].required,
    }));
  }

  private async recordOperationHistory(
    entityType: string,
    operation: BulkOperationType,
    result: BulkOperationResult,
    userId: string,
  ): Promise<void> {
    // Record the operation in a history collection
    // This would typically save to a BulkOperationHistory collection
    console.log('Recording operation history:', {
      entityType,
      operation,
      result: {
        total: result.totalCount,
        success: result.successCount,
        errors: result.errorCount,
      },
      userId,
    });
  }
}