import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EntityHandler,
  MappedEntityData,
  EntityCreationResult,
} from './entity-handler.interface';
import { EntryImportEntityType } from '../schemas/entry-import.schema';
import { Group, GroupDocument } from '../../groups/schemas/group.schema';
import { GroupType } from '../../common/enums/group-types.enum';

@Injectable()
export class GroupHandler implements EntityHandler {
  private readonly logger = new Logger(GroupHandler.name);

  entityType = EntryImportEntityType.GROUP;

  constructor(
    @InjectModel(Group.name)
    private groupModel: Model<GroupDocument>,
  ) {}

  getDisplayName(): string {
    return 'Groups';
  }

  getDescription(): string {
    return 'Import groups (districts, units, ministries, fellowships) from CSV files';
  }

  mapCsvRow(rawData: Record<string, any>): MappedEntityData {
    const mappedData: Record<string, any> = {};

    // Name (required)
    if (rawData['Name'] || rawData['name'] || rawData['Group Name']) {
      mappedData.name = rawData['Name'] || rawData['name'] || rawData['Group Name'];
    }

    // Type (required)
    if (rawData['Type'] || rawData['type'] || rawData['Group Type']) {
      const typeValue = (rawData['Type'] || rawData['type'] || rawData['Group Type'] || '').toLowerCase().trim();
      mappedData.type = this.mapGroupType(typeValue);
    }

    // Description
    if (rawData['Description'] || rawData['description']) {
      mappedData.description = rawData['Description'] || rawData['description'];
    }

    // Contact Info
    if (rawData['Contact Phone'] || rawData['contactPhone'] || rawData['Phone']) {
      mappedData.contactPhone = rawData['Contact Phone'] || rawData['contactPhone'] || rawData['Phone'];
    }
    if (rawData['Contact Email'] || rawData['contactEmail'] || rawData['Email']) {
      mappedData.contactEmail = rawData['Contact Email'] || rawData['contactEmail'] || rawData['Email'];
    }

    // Meeting Schedule
    if (rawData['Meeting Day'] || rawData['meetingDay']) {
      const day = (rawData['Meeting Day'] || rawData['meetingDay'] || '').toLowerCase().trim();
      if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(day)) {
        mappedData.meetingSchedule = mappedData.meetingSchedule || {};
        mappedData.meetingSchedule.day = day;
      }
    }
    if (rawData['Meeting Time'] || rawData['meetingTime']) {
      mappedData.meetingSchedule = mappedData.meetingSchedule || {};
      mappedData.meetingSchedule.time = rawData['Meeting Time'] || rawData['meetingTime'];
    }
    if (rawData['Meeting Location'] || rawData['meetingLocation'] || rawData['Location']) {
      mappedData.meetingSchedule = mappedData.meetingSchedule || {};
      mappedData.meetingSchedule.location = rawData['Meeting Location'] || rawData['meetingLocation'] || rawData['Location'];
    }
    if (rawData['Meeting Frequency'] || rawData['meetingFrequency'] || rawData['Frequency']) {
      const freq = (rawData['Meeting Frequency'] || rawData['meetingFrequency'] || rawData['Frequency'] || '').toLowerCase().trim();
      if (['weekly', 'biweekly', 'monthly'].includes(freq)) {
        mappedData.meetingSchedule = mappedData.meetingSchedule || {};
        mappedData.meetingSchedule.frequency = freq;
      }
    }

    // Vision and Mission
    if (rawData['Vision'] || rawData['vision']) {
      mappedData.vision = rawData['Vision'] || rawData['vision'];
    }
    if (rawData['Mission'] || rawData['mission']) {
      mappedData.mission = rawData['Mission'] || rawData['mission'];
    }

    // Max Capacity
    if (rawData['Max Capacity'] || rawData['maxCapacity'] || rawData['Capacity']) {
      const capacity = parseInt(rawData['Max Capacity'] || rawData['maxCapacity'] || rawData['Capacity'], 10);
      if (!isNaN(capacity)) {
        mappedData.maxCapacity = capacity;
      }
    }

    // Unique key for duplicate checking
    const uniqueKey = mappedData.name;

    // Validate required fields
    const errors: string[] = [];
    if (!mappedData.name) {
      errors.push('Group name is required');
    }
    if (!mappedData.type) {
      errors.push('Group type is required');
    }

    return {
      mappedData,
      uniqueKey,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private mapGroupType(value: string): GroupType | undefined {
    const mapping: Record<string, GroupType> = {
      'district': GroupType.DISTRICT,
      'home cell': GroupType.DISTRICT,
      'homecell': GroupType.DISTRICT,
      'cell': GroupType.DISTRICT,
      'unit': GroupType.UNIT,
      'department': GroupType.UNIT,
      'ministry': GroupType.MINISTRY,
      'fellowship': GroupType.FELLOWSHIP,
      'committee': GroupType.COMMITTEE,
    };
    return mapping[value] || undefined;
  }

  async createEntity(
    mappedData: Record<string, any>,
    options?: Record<string, any>,
  ): Promise<EntityCreationResult> {
    try {
      // Apply branch if provided
      if (options?.branchId) {
        mappedData.branch = new Types.ObjectId(options.branchId);
      }

      if (!mappedData.branch) {
        return {
          success: false,
          errors: ['Branch is required for group creation'],
        };
      }

      // Check for duplicate by name and branch (case-insensitive)
      const existing = await this.groupModel.findOne({
        name: { $regex: new RegExp(`^${mappedData.name}$`, 'i') },
        branch: mappedData.branch,
        isActive: true,
      });

      if (existing) {
        return {
          success: false,
          errors: [`Group with name "${mappedData.name}" already exists in this branch`],
        };
      }

      // Create the group
      const group = new this.groupModel({
        ...mappedData,
        members: [],
        linkedUnits: [],
        goals: [],
        currentMemberCount: 0,
        isActive: true,
      });

      await group.save();

      this.logger.debug(`Created group ${group._id}: ${group.name}`);

      return {
        success: true,
        entityId: (group._id as Types.ObjectId).toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to create group: ${error.message}`);
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  getSampleCsvHeaders(): string[] {
    return [
      'Name',
      'Type',
      'Description',
      'Contact Phone',
      'Contact Email',
      'Meeting Day',
      'Meeting Time',
      'Meeting Location',
      'Meeting Frequency',
      'Vision',
      'Mission',
      'Max Capacity',
    ];
  }

  getSampleCsvRow(): string[] {
    return [
      'Victory District',
      'district',
      'A vibrant home cell group',
      '+2348012345678',
      'victory@church.com',
      'Wednesday',
      '6:00 PM',
      '123 Main Street, Lagos',
      'weekly',
      'To win souls for Christ',
      'Building a community of believers',
      '50',
    ];
  }
}
