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
import { Member, MemberDocument } from '../../members/schemas/member.schema';
import { CSVParserUtil } from '../../common/utils/csv-parser.util';
import { EngagementStatus } from '../../common/enums/engagement-status.enum';

@Injectable()
export class FirstTimerHandler implements EntityHandler {
  private readonly logger = new Logger(FirstTimerHandler.name);

  entityType = EntryImportEntityType.FIRST_TIMER;

  constructor(
    @InjectModel(FirstTimer.name)
    private firstTimerModel: Model<FirstTimerDocument>,
    @InjectModel(Member.name)
    private memberModel: Model<MemberDocument>,
  ) {}

  getDisplayName(): string {
    return 'First Timers';
  }

  getDescription(): string {
    return 'Import first timer/visitor records from CSV files (e.g., Google Forms exports, Excel)';
  }

  mapCsvRow(rawData: Record<string, any>): MappedEntityData {
    const mappedData = CSVParserUtil.mapCSVToFirstTimer(rawData);

    // Apply default phone if missing
    if (!mappedData.phone || mappedData.phone.trim() === '') {
      mappedData.phone = '080000000000';
    }

    // Extract unique key for duplicate checking
    const uniqueKey = mappedData.phone || mappedData.email;

    // Validate CRITICAL required fields
    const errors: string[] = [];

    // SKIP if both first name and last name are missing
    if ((!mappedData.firstName || mappedData.firstName.trim() === '') &&
        (!mappedData.lastName || mappedData.lastName.trim() === '')) {
      errors.push('Both first name and last name are missing - skipping entry');
    }

    // SKIP if entry date is missing
    if (!mappedData.dateOfVisit || mappedData.dateOfVisit.trim() === '') {
      errors.push('Entry date is missing - skipping entry');
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
      // Set defaults for missing name fields (at least one must exist - validation done in mapCsvRow)
      if (!mappedData.firstName || mappedData.firstName.trim() === '') {
        mappedData.firstName = 'Unknown';
      }
      if (!mappedData.lastName || mappedData.lastName.trim() === '') {
        mappedData.lastName = 'Unknown';
      }

      // Entry date is required - validation done in mapCsvRow
      if (!mappedData.dateOfVisit) {
        return {
          success: false,
          errors: ['Entry date is required - skipping entry'],
        };
      }

      // Apply branch if provided
      if (options?.branchId) {
        mappedData.branch = new Types.ObjectId(options.branchId);
      }

      // Determine status based on membership information
      // Check if they became a member (CLOSED_MEMBER) or just historical record (CLOSED_MANUAL)
      const isMember = this.checkIfMember(mappedData);
      mappedData.status = isMember
        ? EngagementStatus.CLOSED_MEMBER
        : EngagementStatus.CLOSED_MANUAL;

      // Parse ageRange and calculate birth year
      if (mappedData.ageRange) {
        const birthYear = this.inferBirthYearFromAgeRange(mappedData.ageRange);
        if (birthYear) {
          mappedData.dateOfBirth = `${birthYear}-01-01`; // Use January 1st as approximate
          this.logger.debug(`Inferred birth year ${birthYear} from age range: ${mappedData.ageRange}`);
        }
      }

      // Parse and assign followUpAllocation person
      let followUpPersonId: Types.ObjectId | null = null;
      if (mappedData.followUpAllocation) {
        followUpPersonId = await this.findFollowUpPerson(mappedData.followUpAllocation);
        if (followUpPersonId) {
          mappedData.followUpPerson = followUpPersonId;
          this.logger.debug(`Assigned follow-up person: ${followUpPersonId}`);
        }
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

      // Build follow-up records from call reports and service attendance
      const followUpRecords = await this.buildFollowUpRecords(
        mappedData,
        dateOfVisit,
        followUpPersonId,
      );

      // Create the first timer
      const firstTimer = new this.firstTimerModel({
        ...mappedData,
        dateOfVisit,
        email: mappedData.email?.toLowerCase(),
        followUps: followUpRecords,
        familyMembers: [],
        interests: mappedData.interests || [],
        prayerRequests: mappedData.prayerRequests || [],
        servingInterests: mappedData.servingInterests || [],
        followUpCount: followUpRecords.length,
        callReportsCount: Math.min(followUpRecords.length, 4),
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

  /**
   * Check if the first timer became a member based on CSV data
   * Does NOT create a member record - just determines the status
   */
  private checkIfMember(mappedData: Record<string, any>): boolean {
    // Check "Membership Database" column (Yes/No)
    if (mappedData.membershipDatabase) {
      const membershipDb = mappedData.membershipDatabase.toLowerCase().trim();
      if (membershipDb === 'yes' || membershipDb === 'y' || membershipDb === 'true') {
        this.logger.debug('Detected member status from Membership Database: Yes');
        return true;
      }
    }

    // Check "Member Status" or "Membership Status" column
    if (mappedData.memberStatus) {
      const status = mappedData.memberStatus.toLowerCase().trim();
      if (
        status === 'member' ||
        status === 'active member' ||
        status === 'pastor' ||
        status === 'leader' ||
        status === 'minister' ||
        status === 'director'
      ) {
        this.logger.debug(`Detected member status from Member Status: ${status}`);
        return true;
      }
    }

    // Check "Integration Stage" column (e.g., "Closed - Joined PCU")
    if (mappedData.integrationStage) {
      const stage = mappedData.integrationStage.toLowerCase().trim();
      if (
        stage.includes('joined') ||
        stage.includes('member') ||
        stage.includes('closed - joined')
      ) {
        this.logger.debug(`Detected member status from Integration Stage: ${stage}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Infer birth year from age range strings like "25-30 years" or "31-34 years"
   */
  private inferBirthYearFromAgeRange(ageRange: string): number | null {
    if (!ageRange) return null;

    // Match patterns like "25-30 years", "31-34", etc.
    const match = ageRange.match(/(\d+)\s*-\s*(\d+)/);
    if (!match) return null;

    const lowerAge = parseInt(match[1], 10);
    if (isNaN(lowerAge)) return null;

    // Current year is 2026
    const currentYear = 2026;
    const birthYear = currentYear - lowerAge;

    return birthYear;
  }

  /**
   * Find follow-up person by parsing the followUpAllocation field
   * Format can be: "Name", "email@example.com", or "{name=Name, email=email@example.com}"
   */
  private async findFollowUpPerson(
    followUpAllocation: string,
  ): Promise<Types.ObjectId | null> {
    if (!followUpAllocation || followUpAllocation.trim() === '') return null;

    try {
      let email: string | null = null;
      let name: string | null = null;

      // Try to parse as JSON-like object format from Airtable
      // Example: {email=user@example.com, name=John Doe, id=usrXXX}
      const emailMatch = followUpAllocation.match(/email=([^,}\s]+)/);
      const nameMatch = followUpAllocation.match(/name=([^,}]+?)(?:,|\}|$)/);

      if (emailMatch) {
        email = emailMatch[1].trim();
      }
      if (nameMatch) {
        name = nameMatch[1].trim();
      }

      // If no structured data found, check if it's just an email or name
      if (!email && !name) {
        if (followUpAllocation.includes('@')) {
          email = followUpAllocation.trim();
        } else {
          name = followUpAllocation.trim();
        }
      }

      // Search for member by email (preferred) or name
      if (email) {
        const member = await this.memberModel.findOne({
          email: email.toLowerCase(),
          isActive: true,
        });
        if (member) {
          return member._id as Types.ObjectId;
        }
      }

      if (name) {
        // Try to split name into first and last
        const nameParts = name.split(/\s+/);
        if (nameParts.length >= 2) {
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ');

          const member = await this.memberModel.findOne({
            firstName: new RegExp(`^${firstName}$`, 'i'),
            lastName: new RegExp(`^${lastName}$`, 'i'),
            isActive: true,
          });
          if (member) {
            return member._id as Types.ObjectId;
          }
        }
      }

      this.logger.warn(
        `Could not find follow-up person for: ${followUpAllocation}`,
      );
      return null;
    } catch (error) {
      this.logger.error(
        `Error finding follow-up person: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Build follow-up records from call reports and service attendance
   */
  private async buildFollowUpRecords(
    mappedData: Record<string, any>,
    dateOfVisit: Date,
    followUpPersonId: Types.ObjectId | null,
  ): Promise<any[]> {
    const followUpRecords: any[] = [];

    // Add service attendance as follow-up records
    // 2nd Service
    if (
      mappedData.attended2ndService &&
      (mappedData.attended2ndService.toLowerCase() === 'yes' ||
        mappedData.attended2ndService.toLowerCase() === 'true')
    ) {
      const record: any = {
        date: new Date(dateOfVisit.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week after first visit
        method: 'in_visit',
        visitNumber: 2,
        notes: 'Attended 2nd service (imported from CSV)',
        outcome: 'successful',
      };
      if (followUpPersonId) {
        record.contactedBy = followUpPersonId;
      }
      followUpRecords.push(record);
    }

    // 3rd Service
    if (
      mappedData.attended3rdService &&
      (mappedData.attended3rdService.toLowerCase() === 'yes' ||
        mappedData.attended3rdService.toLowerCase() === 'true')
    ) {
      const record: any = {
        date: new Date(dateOfVisit.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks after first visit
        method: 'in_visit',
        visitNumber: 3,
        notes: 'Attended 3rd service (imported from CSV)',
        outcome: 'successful',
      };
      if (followUpPersonId) {
        record.contactedBy = followUpPersonId;
      }
      followUpRecords.push(record);
    }

    // Add call reports as follow-up records
    if (mappedData.callReports && Array.isArray(mappedData.callReports)) {
      for (const report of mappedData.callReports) {
        if (!report.content || report.content.trim() === '') continue;

        // Determine the date based on report type
        let reportDate = dateOfVisit;
        const dayOffset = this.getCallReportDayOffset(report.type);
        if (dayOffset > 0) {
          reportDate = new Date(
            dateOfVisit.getTime() + dayOffset * 24 * 60 * 60 * 1000,
          );
        }

        // Map call report content to outcome
        const outcome = this.mapCallReportToOutcome(report.content);

        // Build notes
        let notes = `${report.type} Call: ${report.content}`;
        if (report.notes) {
          notes += `\n${report.notes}`;
        }

        const record: any = {
          date: reportDate,
          method: 'phone',
          notes: notes,
          outcome: outcome,
        };
        if (followUpPersonId) {
          record.contactedBy = followUpPersonId;
        }
        followUpRecords.push(record);
      }
    }

    // Sort by date
    followUpRecords.sort((a, b) => a.date.getTime() - b.date.getTime());

    return followUpRecords;
  }

  /**
   * Get day offset from first visit for different call report types
   */
  private getCallReportDayOffset(reportType: string): number {
    switch (reportType) {
      case '1st':
        return 3; // 3 days after first visit
      case '2nd':
        return 10; // 10 days after
      case '3rd':
        return 17; // ~2.5 weeks after
      case '4th':
        return 24; // ~3.5 weeks after
      case 'PCU':
        return 30; // ~1 month after
      default:
        return 7; // Default to 1 week
    }
  }

  /**
   * Map call report content to follow-up outcome
   */
  private mapCallReportToOutcome(content: string): string {
    if (!content) return 'no_answer';

    const lowerContent = content.toLowerCase().trim();

    // Successful outcomes
    if (
      lowerContent.includes('willing') ||
      lowerContent.includes('interested') ||
      lowerContent.includes('joined') ||
      lowerContent.includes('yes')
    ) {
      return 'interested';
    }

    // Not interested
    if (
      lowerContent.includes('not interested') ||
      lowerContent.includes('declined') ||
      lowerContent.includes('no')
    ) {
      return 'not_interested';
    }

    // No answer / not reachable
    if (
      lowerContent.includes('not reachable') ||
      lowerContent.includes('nr') ||
      lowerContent.includes('no answer') ||
      lowerContent.includes('incomplete')
    ) {
      return 'no_answer';
    }

    // Busy
    if (lowerContent.includes('busy') || lowerContent.includes('call back')) {
      return 'busy';
    }

    // Follow-up needed
    if (
      lowerContent.includes('undecided') ||
      lowerContent.includes('maybe') ||
      lowerContent.includes('follow up')
    ) {
      return 'follow_up_needed';
    }

    // Default to successful if there's actual content
    return 'successful';
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
