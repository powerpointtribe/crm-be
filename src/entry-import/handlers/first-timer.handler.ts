import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';
import {
  EntityHandler,
  MappedEntityData,
  EntityCreationResult,
} from './entity-handler.interface';
import { EntryImportEntityType } from '../schemas/entry-import.schema';
import { FirstTimer, FirstTimerDocument } from '../../first-timers/schemas/first-timer.schema';
import { CSVParserUtil } from '../../common/utils/csv-parser.util';

@Injectable()
export class FirstTimerHandler implements EntityHandler {
  private readonly logger = new Logger(FirstTimerHandler.name);

  entityType = EntryImportEntityType.FIRST_TIMER;

  constructor(
    @InjectModel(FirstTimer.name)
    private firstTimerModel: Model<FirstTimerDocument>,
  ) {}

  getDisplayName(): string {
    return 'First Timers';
  }

  getDescription(): string {
    return 'Import first timer/visitor records from CSV files (e.g., Google Forms exports, Excel)';
  }

  mapCsvRow(rawData: Record<string, any>): MappedEntityData {
    const mappedData = CSVParserUtil.mapCSVToFirstTimer(rawData);

    // Extract unique key for duplicate checking
    const uniqueKey = mappedData.phone || mappedData.email;

    // Validate required fields
    const errors: string[] = [];
    if (!mappedData.phone) {
      errors.push('Phone number is required');
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
      // Set defaults for missing required fields
      if (!mappedData.firstName) mappedData.firstName = 'Unknown';
      if (!mappedData.lastName) mappedData.lastName = 'Unknown';
      if (!mappedData.dateOfVisit) {
        mappedData.dateOfVisit = new Date().toISOString().split('T')[0];
      }

      // Apply branch if provided
      if (options?.branchId) {
        mappedData.branch = new Types.ObjectId(options.branchId);
      }

      // Check for duplicates
      const duplicateTracking = {
        hasDuplicatePhone: false,
        hasDuplicateEmail: false,
        duplicatePhoneNotes: [] as string[],
        duplicateEmailNotes: [] as string[],
      };

      const existingByPhone = await this.firstTimerModel.findOne({
        phone: mappedData.phone,
        isActive: true,
      });

      if (existingByPhone) {
        duplicateTracking.hasDuplicatePhone = true;
        duplicateTracking.duplicatePhoneNotes.push(
          `Duplicate phone detected during entry import - matches first-timer: ${existingByPhone.firstName} ${existingByPhone.lastName} (ID: ${existingByPhone._id})`,
        );
      }

      if (mappedData.email) {
        const existingByEmail = await this.firstTimerModel.findOne({
          email: mappedData.email.toLowerCase(),
          isActive: true,
        });
        if (existingByEmail) {
          duplicateTracking.hasDuplicateEmail = true;
          duplicateTracking.duplicateEmailNotes.push(
            `Duplicate email detected during entry import - matches first-timer: ${existingByEmail.firstName} ${existingByEmail.lastName} (ID: ${existingByEmail._id})`,
          );
        }
      }

      // Parse date
      const dateOfVisit = new Date(mappedData.dateOfVisit);
      if (isNaN(dateOfVisit.getTime())) {
        return {
          success: false,
          errors: ['Invalid date format for dateOfVisit'],
        };
      }

      // Create the first timer
      const firstTimer = new this.firstTimerModel({
        ...mappedData,
        dateOfVisit,
        email: mappedData.email?.toLowerCase(),
        followUps: [],
        familyMembers: [],
        interests: [],
        prayerRequests: [],
        servingInterests: [],
        followUpCount: 0,
        hasDuplicatePhone: duplicateTracking.hasDuplicatePhone,
        hasDuplicateEmail: duplicateTracking.hasDuplicateEmail,
        duplicatePhoneNotes: duplicateTracking.duplicatePhoneNotes,
        duplicateEmailNotes: duplicateTracking.duplicateEmailNotes,
      });

      await firstTimer.save();

      this.logger.debug(`Created first timer ${firstTimer._id}`);

      return {
        success: true,
        entityId: (firstTimer._id as Types.ObjectId).toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to create first timer: ${error.message}`);
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  getSampleCsvHeaders(): string[] {
    return [
      'First Name',
      'Last Name',
      'Phone Number',
      'Email Address',
      'Entry Date',
      'Gender',
      'Birthday',
      'Occupation',
      'Home Address',
      'Can you remember who invited you?',
      'How did you hear about Us?',
      "What did you enjoy about today's service?",
      'Would you like to join The PowerPoint Tribe?',
      'Social Media handle',
      'Phone Number (2)',
      'Attended 2nd Service?',
      'Attended 3rd Service?',
      'Follow Up Allocation',
      '1st Call Report',
      'Call Report - Notes',
      '2nd Call Report',
      '3rd Call Report',
      '4th Call Report',
    ];
  }

  getSampleCsvRow(): string[] {
    return [
      'John',
      'Doe',
      '+2348012345678',
      'john.doe@email.com',
      '2024-01-15',
      'Male',
      '1990-05-20',
      'Software Developer',
      '123 Main Street, Lagos',
      'Jane Smith',
      'Friend',
      'The worship was amazing',
      'Yes',
      '@johndoe',
      '+2348098765432',
      'Yes',
      'No',
      'Mary Johnson',
      'Called, interested in joining',
      'Follow up next week',
      'Second call made',
      '',
      '',
    ];
  }
}
