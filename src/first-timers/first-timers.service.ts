import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { FirstTimer, FirstTimerDocument } from './schemas/first-timer.schema';
import { CreateFirstTimerDto } from './dto/create-first-timer.dto';
import { AddFollowUpDto } from './dto/add-follow-up.dto';
import { FirstTimerSearchDto } from './dto/first-timer-search.dto';
import { BulkUploadResultDto } from './dto/bulk-upload-first-timer.dto';
import {
  PaginatedResult,
  createPaginatedResult,
} from '../common/utils/pagination.util';
import { QueryBuilder } from '../common/utils/query-builder.util';
import { CSVParserUtil } from '../common/utils/csv-parser.util';
import { EngagementStatus } from '../common/enums/engagement-status.enum';
import { MembershipStatus } from '../common/enums/member-status.enum';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { MembersService } from '../members/members.service';
import { QueueService } from '../queue/queue.service';
import { GroupsService } from '../groups/groups.service';
import { CallReportsService } from './call-reports.service';
import { GroupType } from '../common/enums/group-types.enum';
import { JobType } from '../common/interfaces/queue-job.interface';

@Injectable()
export class FirstTimersService {
  private readonly logger = new Logger(FirstTimersService.name);

  constructor(
    @InjectModel(FirstTimer.name)
    private firstTimerModel: Model<FirstTimerDocument>,
    private membersService: MembersService,
    private queueService: QueueService,
    private groupsService: GroupsService,
    private callReportsService: CallReportsService,
  ) {}

  async create(
    createFirstTimerDto: CreateFirstTimerDto,
  ): Promise<FirstTimerDocument> {
    // Check for duplicate phone and email but don't block creation
    const duplicateTracking = {
      hasDuplicatePhone: false,
      hasDuplicateEmail: false,
      duplicatePhoneNotes: [] as string[],
      duplicateEmailNotes: [] as string[],
    };

    // Check if phone already exists
    const existingPhone = await this.firstTimerModel.findOne({
      phone: createFirstTimerDto.phone,
      isActive: true,
    });

    if (existingPhone) {
      duplicateTracking.hasDuplicatePhone = true;
      duplicateTracking.duplicatePhoneNotes.push(
        `Duplicate phone detected - matches first-timer: ${existingPhone.firstName} ${existingPhone.lastName} (ID: ${existingPhone._id}) created on ${existingPhone.createdAt}`,
      );
      this.logger.warn(
        `Duplicate phone number detected: ${createFirstTimerDto.phone} - already exists for ${existingPhone.firstName} ${existingPhone.lastName} (${existingPhone._id})`,
      );
    }

    // Check if email already exists (if provided)
    if (createFirstTimerDto.email) {
      const existingEmail = await this.firstTimerModel.findOne({
        email: createFirstTimerDto.email.toLowerCase(),
        isActive: true,
      });

      if (existingEmail) {
        duplicateTracking.hasDuplicateEmail = true;
        duplicateTracking.duplicateEmailNotes.push(
          `Duplicate email detected - matches first-timer: ${existingEmail.firstName} ${existingEmail.lastName} (ID: ${existingEmail._id}) created on ${existingEmail.createdAt}`,
        );
        this.logger.warn(
          `Duplicate email detected: ${createFirstTimerDto.email} - already exists for ${existingEmail.firstName} ${existingEmail.lastName} (${existingEmail._id})`,
        );
      }
    }

    // Auto-assign GIA leader if not provided
    let giaLeader = createFirstTimerDto.giaLeader;
    if (!giaLeader) {
      try {
        // Find the GIA unit group
        const giaGroup = await this.groupsService.findByNameAndType(
          'Guest Relations and Integrations',
          GroupType.UNIT,
        );

        if (!giaGroup) {
          throw new Error(
            'GIA unit group not found. Please create a GIA unit group in the groups module.',
          );
        }

        if (!giaGroup.unitHead) {
          throw new Error(
            'GIA unit group has no unit head assigned. Please assign a unit head to the GIA group.',
          );
        }

        // The unitHead is populated, so we can access the member's email
        const unitHeadMember = giaGroup.unitHead as any;

        if (!unitHeadMember.email) {
          throw new Error(
            'GIA unit head member has no email address. Please ensure the unit head member has a valid email.',
          );
        }

        // Find the member with the same email as the GIA unit head
        const giaLeaderMember = await this.membersService.findByEmail(
          unitHeadMember.email,
        );

        if (!giaLeaderMember) {
          throw new Error(
            `No active member found with email ${unitHeadMember.email}`,
          );
        }

        giaLeader = giaLeaderMember._id?.toString();
      } catch (error) {
        throw new BadRequestException(
          `Failed to assign GIA leader: ${error.message}`,
        );
      }
    }

    // Validate and convert dateOfVisit
    const dateOfVisit = new Date(createFirstTimerDto.dateOfVisit);
    if (isNaN(dateOfVisit.getTime())) {
      throw new BadRequestException(
        'Invalid date format for dateOfVisit. Use YYYY-MM-DD format.',
      );
    }

    const firstTimer = new this.firstTimerModel({
      ...createFirstTimerDto,
      dateOfVisit,
      email: createFirstTimerDto.email?.toLowerCase(),
      status: EngagementStatus.NEW,
      giaLeader,
      followUps: [],
      familyMembers: createFirstTimerDto.familyMembers || [],
      interests: createFirstTimerDto.interests || [],
      prayerRequests: createFirstTimerDto.prayerRequests || [],
      servingInterests: createFirstTimerDto.servingInterests || [],
      followUpCount: 0,
      lastStatusChange: new Date(),
      interestedInJoining: createFirstTimerDto.interestedInJoining || false,
      // Include duplicate tracking information
      hasDuplicatePhone: duplicateTracking.hasDuplicatePhone,
      hasDuplicateEmail: duplicateTracking.hasDuplicateEmail,
      duplicatePhoneNotes: duplicateTracking.duplicatePhoneNotes,
      duplicateEmailNotes: duplicateTracking.duplicateEmailNotes,
    });

    // Set initial follow-up date (1 day after visit)
    const nextDay = new Date(dateOfVisit);
    nextDay.setDate(nextDay.getDate() + 1);
    firstTimer.nextFollowUpDate = nextDay;

    const savedFirstTimer = await firstTimer.save();

    // Schedule thank you email job (3 hours after registration)
    const thankYouDelay = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
    await this.queueService.addDelayedJob(
      'first-timer-thank-you-email',
      savedFirstTimer._id,
      thankYouDelay,
    );

    return savedFirstTimer;
  }

  async findAll(
    searchDto: FirstTimerSearchDto,
  ): Promise<PaginatedResult<FirstTimerDocument>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      assignedTo,
      visitDateFrom,
      visitDateTo,
      converted,
      needsFollowUp,
      visitorType,
      howDidYouHear,
    } = searchDto;

    const skip = (page - 1) * limit;
    const filterQuery: FilterQuery<FirstTimerDocument> = { isActive: true };

    // Text search
    if (search) {
      const searchQuery = QueryBuilder.buildSearchQuery(search, [
        'firstName',
        'lastName',
        'phone',
        'email',
        'invitedBy',
      ]);
      Object.assign(filterQuery, searchQuery);
    }

    // Status filters
    if (status) filterQuery.status = status;
    if (assignedTo) filterQuery.assignedTo = assignedTo;
    if (converted !== undefined) filterQuery.converted = converted;
    if (visitorType) filterQuery.visitorType = visitorType;
    if (howDidYouHear) filterQuery.howDidYouHear = howDidYouHear;

    // Date range filter
    if (visitDateFrom || visitDateTo) {
      const startDate = visitDateFrom ? new Date(visitDateFrom) : undefined;
      const endDate = visitDateTo
        ? new Date(visitDateTo + 'T23:59:59.999Z')
        : undefined; // End of day

      const dateQuery = QueryBuilder.buildDateRangeQuery(
        startDate,
        endDate,
        'dateOfVisit',
      );
      Object.assign(filterQuery, dateQuery);
    }

    // Special filters
    if (needsFollowUp) {
      filterQuery.$or = [
        { status: EngagementStatus.NEW },
        {
          nextFollowUpDate: { $lte: new Date() },
          status: {
            $nin: [EngagementStatus.CLOSED],
          },
        },
      ];
    }

    // Build sort query
    const sortQuery = QueryBuilder.buildSortQuery(sortBy, sortOrder);

    // Execute queries with proper population
    const [firstTimers, total] = await Promise.all([
      this.firstTimerModel
        .find(filterQuery)
        .populate('assignedTo', 'firstName lastName email')
        .populate('invitedByMember', 'firstName lastName')
        .populate('suggestedDistrict', 'name type')
        .populate('memberRecord', 'firstName lastName membershipStatus')
        .populate('followUps.contactedBy', 'firstName lastName')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.firstTimerModel.countDocuments(filterQuery),
    ]);

    return createPaginatedResult(firstTimers, total, page, limit);
  }

  async findById(id: string): Promise<FirstTimerDocument | null> {
    return this.firstTimerModel
      .findById(id)
      .populate('assignedTo', 'firstName lastName email phone')
      .populate('invitedByMember', 'firstName lastName email phone')
      .populate('suggestedDistrict', 'name type description')
      .populate(
        'memberRecord',
        'firstName lastName email phone membershipStatus',
      )
      .populate('followUps.contactedBy', 'firstName lastName email')
      .exec();
  }

  async findByPhone(phone: string): Promise<FirstTimerDocument | null> {
    return this.firstTimerModel.findOne({ phone, isActive: true }).exec();
  }

  async findByPhoneAndEmail(
    phone: string,
    email: string,
  ): Promise<FirstTimerDocument | null> {
    return this.firstTimerModel
      .findOne({ phone, email, isActive: true })
      .exec();
  }

  async findByEmail(email: string): Promise<FirstTimerDocument | null> {
    return this.firstTimerModel
      .findOne({ email: email.toLowerCase(), isActive: true })
      .exec();
  }

  async addFollowUp(
    id: string,
    followUpDto: AddFollowUpDto,
  ): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findById(id);
    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    // Add the follow-up record
    const followUp = {
      date: new Date(),
      method: followUpDto.method,
      notes: followUpDto.notes,
      outcome: followUpDto.outcome,
      contactedBy: followUpDto.contactedBy,
      nextFollowUpDate: followUpDto?.nextFollowUpDate ? new Date(followUpDto.nextFollowUpDate) : undefined,
    };

    // Update status based on outcome
    let newStatus = firstTimer.status;
    switch (followUpDto.outcome) {
      case 'successful':
        if (firstTimer.status === EngagementStatus.NEW) {
          newStatus = EngagementStatus.ENGAGED;
        }
        break;
      case 'interested':
        newStatus = EngagementStatus.ENGAGED;
        break;
      case 'not_interested':
        newStatus = EngagementStatus.CLOSED;
        break;
    }

    const updatedFirstTimer = await this.firstTimerModel
      .findByIdAndUpdate(
        id,
        {
          $push: { followUps: followUp },
          $inc: { followUpCount: 1 },
          $set: {
            status: newStatus,
            nextFollowUpDate: followUpDto.nextFollowUpDate ? new Date(followUpDto.nextFollowUpDate) : null,
          },
        },
        { new: true },
      )
      .populate('followUps.contactedBy', 'firstName lastName');

    // Create a corresponding call report
    try {
      const callReportData = {
        firstTimerId: id,
        callDate: new Date().toISOString(),
        status: this.mapFollowUpOutcomeToCallReportStatus(followUpDto.outcome),
        notes: followUpDto.notes || '',
        contactMethod: followUpDto.method,
        nextFollowUpDate: followUpDto.nextFollowUpDate,
        reportNumber: updatedFirstTimer!.followUpCount, // Use the updated count
      };

      await this.callReportsService.create(callReportData, followUpDto.contactedBy || '');
      this.logger.log(`Call report created for first-timer ${id} follow-up`);
    } catch (error) {
      this.logger.error(`Failed to create call report for first-timer ${id}:`, error);
      // Don't fail the follow-up if call report creation fails
    }

    return updatedFirstTimer!;
  }

  async update(
    id: string,
    data: Partial<FirstTimer>,
  ): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findByIdAndUpdate(
      id,
      {
        $set: {
          ...data,
          lastStatusChange: new Date(),
        },
      },
      { new: true },
    );

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    return firstTimer;
  }

  async assignFollowUp(
    id: string,
    followUpPersonId: string,
    assignedBy?: string,
  ): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            followUpPerson: followUpPersonId,
            assignedTo: followUpPersonId,
            status: EngagementStatus.NEW,
            lastStatusChange: new Date(),
          },
        },
        { new: true },
      )
      .populate('followUpPerson', 'firstName lastName email');

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    // Trigger email notification job as a side effect
    if (firstTimer.followUpPerson) {
      await this.triggerMemberAssignmentNotification(
        [firstTimer],
        firstTimer.followUpPerson as any,
        'followup',
        assignedBy,
      );
    }

    return firstTimer;
  }

  async getPendingDistrictAssignments(
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResult<FirstTimerDocument>> {
    const skip = (page - 1) * limit;

    const filterQuery = {
      isActive: true,
      status: EngagementStatus.CLOSED,
      pendingDistrictAssignment: true,
    };

    const [firstTimers, total] = await Promise.all([
      this.firstTimerModel
        .find(filterQuery)
        .populate('memberRecord', 'firstName lastName email phone')
        .populate('giaLeader', 'firstName lastName email')
        .sort({ memberCreatedAt: -1 })
        .skip(skip)
        .limit(limit),
      this.firstTimerModel.countDocuments(filterQuery),
    ]);

    return createPaginatedResult(firstTimers, total, page, limit);
  }

  async convertToMember(
    id: string,
    memberRecordId?: string,
  ): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findById(id);
    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    // If no memberRecordId provided, create a new member record
    if (!memberRecordId) {
      const memberData = {
        firstName: firstTimer.firstName,
        lastName: firstTimer.lastName,
        email:
          firstTimer.email ||
          `${firstTimer.firstName.toLowerCase()}.${firstTimer.lastName.toLowerCase()}@church.com`,
        phone: firstTimer.phone,
        address: {
          street: firstTimer.address?.street || 'Unknown',
          city: firstTimer.address?.city || 'Unknown',
          state: firstTimer.address?.state || 'Unknown',
          country: firstTimer.address?.country || 'Nigeria',
        },
        dateOfBirth: '1990-01-01', // Default date, will need to be updated later
        gender: 'male', // Default, will need to be updated
        password: Math.random().toString(36).slice(-8), // Temporary random password
        membershipStatus: MembershipStatus.NEW_CONVERT,
        district:
          firstTimer.suggestedDistrict?.toString() ||
          '507f1f77bcf86cd799439011', // Default district ID
      };

      const newMember = await this.membersService.create(memberData);
      memberRecordId = newMember._id?.toString();
    }

    const updatedFirstTimer = await this.firstTimerModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            converted: true,
            conversionDate: new Date(),
            memberRecord: memberRecordId,
            status: EngagementStatus.CLOSED,
            lastStatusChange: new Date(),
            memberCreatedAt: new Date(),
            pendingDistrictAssignment: true,
          },
        },
        { new: true },
      )
      .populate('memberRecord', 'firstName lastName membershipStatus')
      .populate('giaLeader', 'firstName lastName email');

    if (!updatedFirstTimer) {
      throw new NotFoundException('First-timer not found after update');
    }

    // Notify GIA leader about new member conversion
    if (updatedFirstTimer.giaLeader) {
      await this.queueService.addJob('first-timer-conversion-notification', {
        firstTimerId: updatedFirstTimer._id,
        giaLeaderId: updatedFirstTimer.giaLeader._id,
        memberRecordId,
      });
    }

    return updatedFirstTimer;
  }

  async assignToMember(
    id: string,
    memberId: string,
    assignedBy?: string,
  ): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel
      .findByIdAndUpdate(id, { $set: { assignedTo: memberId } }, { new: true })
      .populate('assignedTo', 'firstName lastName email');

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    // Trigger email notification job as a side effect
    if (firstTimer.assignedTo) {
      await this.triggerMemberAssignmentNotification(
        [firstTimer],
        firstTimer.assignedTo as any,
        'assignment',
        assignedBy,
      );
    }

    return firstTimer;
  }

  async assignToMemberWithoutNotification(
    id: string,
    memberId: string,
  ): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel
      .findByIdAndUpdate(id, { $set: { assignedTo: memberId } }, { new: true })
      .populate('assignedTo', 'firstName lastName email');

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    return firstTimer;
  }

  async assignFollowUpWithoutNotification(
    id: string,
    followUpPersonId: string,
  ): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            followUpPerson: followUpPersonId,
            assignedTo: followUpPersonId,
            status: EngagementStatus.NEW,
            lastStatusChange: new Date(),
          },
        },
        { new: true },
      )
      .populate('followUpPerson', 'firstName lastName email');

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    return firstTimer;
  }

  async sendBulkAssignmentNotification(
    firstTimers: FirstTimerDocument[],
    assignedBy: string,
  ): Promise<void> {
    if (firstTimers.length === 0) return;

    // Get member details from either assignedTo or followUpPerson field
    const assignedMember = (firstTimers[0].assignedTo || firstTimers[0].followUpPerson) as any;

    if (!assignedMember) {
      this.logger.warn(`No assigned member found for bulk notification`);
      return;
    }

    // Determine assignment type based on which field is populated
    const assignmentType = firstTimers[0].assignedTo ? 'assignment' : 'followup';

    await this.triggerMemberAssignmentNotification(
      firstTimers,
      assignedMember,
      assignmentType,
      assignedBy,
    );
  }

  // Helper method to trigger email notification for member assignments
  private async triggerMemberAssignmentNotification(
    firstTimers: FirstTimerDocument[],
    assignedMember: any,
    assignmentType: 'assignment' | 'followup',
    assignedBy?: string,
  ): Promise<void> {
    try {
      await this.queueService.addJob(JobType.SEND_MEMBER_FOLLOWUP_ASSIGNMENT, {
        firstTimerId: firstTimers[0]?._id?.toString() || 'bulk',
        type: 'member_assignment',
        additionalData: {
          memberEmail: assignedMember.email,
          memberName: `${assignedMember.firstName} ${assignedMember.lastName}`,
          // Also add fields that processors expect
          assigneeEmail: assignedMember.email,
          assigneeName: `${assignedMember.firstName} ${assignedMember.lastName}`,
          firstTimers: firstTimers.map((ft) => ({
            firstName: ft.firstName,
            lastName: ft.lastName,
            phone: ft.phone,
            email: ft.email,
            dateOfVisit: ft.dateOfVisit
              ? ft.dateOfVisit.toISOString()
              : new Date().toISOString(),
          })),
          assignmentType,
          assignedBy: assignedBy || 'Church Leadership',
        },
      });

      this.logger.log(
        `Enqueued ${assignmentType} assignment notification for ${assignedMember.email} with ${firstTimers.length} first-timer(s)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue assignment notification: ${error.message}`,
      );
      // Don't throw here to avoid disrupting the main assignment flow
    }
  }

  // Analytics and Reports
  async getFirstTimerStats(): Promise<any> {
    const [
      statusStats,
      conversionStats,
      sourceStats,
      weeklyStats,
      assignmentStats,
    ] = await Promise.all([
      // Status distribution
      this.firstTimerModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Conversion analytics
      this.firstTimerModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            converted: { $sum: { $cond: ['$converted', 1, 0] } },
            avgFollowUps: { $avg: '$followUpCount' },
          },
        },
      ]),

      // Traffic sources
      this.firstTimerModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$howDidYouHear', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Weekly visitor trends (last 8 weeks)
      this.firstTimerModel.aggregate([
        {
          $match: {
            isActive: true,
            dateOfVisit: {
              $gte: new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$dateOfVisit' },
              week: { $week: '$dateOfVisit' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.week': 1 } },
      ]),

      // Assignment stats
      this.firstTimerModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$assignedTo',
            count: { $sum: 1 },
            converted: { $sum: { $cond: ['$converted', 1, 0] } },
          },
        },
        {
          $lookup: {
            from: 'members',
            localField: '_id',
            foreignField: '_id',
            as: 'assignedMember',
          },
        },
      ]),
    ]);

    const conversionRate = conversionStats[0]
      ? Math.round(
          (conversionStats[0].converted / conversionStats[0].total) * 100,
        )
      : 0;

    return {
      total: conversionStats[0]?.total || 0,
      byStatus: statusStats,
      conversionRate,
      totalConverted: conversionStats[0]?.converted || 0,
      averageFollowUps: Math.round(conversionStats[0]?.avgFollowUps || 0),
      bySources: sourceStats,
      weeklyTrends: weeklyStats,
      byAssignment: assignmentStats,
    };
  }

  async getNeedingFollowUp(
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResult<FirstTimerDocument>> {
    const today = new Date();
    const skip = (page - 1) * limit;

    const filterQuery = {
      isActive: true,
      converted: false,
      status: {
        $nin: [EngagementStatus.CLOSED],
      },
      $or: [
        { status: EngagementStatus.NEW },
        { nextFollowUpDate: { $lte: today } },
      ],
    };

    const [firstTimers, total] = await Promise.all([
      this.firstTimerModel
        .find(filterQuery)
        .populate('assignedTo', 'firstName lastName email')
        .sort({ nextFollowUpDate: 1, dateOfVisit: 1 })
        .skip(skip)
        .limit(limit),
      this.firstTimerModel.countDocuments(filterQuery),
    ]);

    return createPaginatedResult(firstTimers, total, page, limit);
  }

  async getRecentVisitors(
    days: number = 7,
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResult<FirstTimerDocument>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const skip = (page - 1) * limit;

    const filterQuery = {
      isActive: true,
      dateOfVisit: { $gte: startDate },
    };

    const [firstTimers, total] = await Promise.all([
      this.firstTimerModel
        .find(filterQuery)
        .populate('assignedTo', 'firstName lastName')
        .populate('invitedByMember', 'firstName lastName')
        .sort({ dateOfVisit: -1 })
        .skip(skip)
        .limit(limit),
      this.firstTimerModel.countDocuments(filterQuery),
    ]);

    return createPaginatedResult(firstTimers, total, page, limit);
  }

  async getByAssignedMember(
    memberId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResult<FirstTimerDocument>> {
    const skip = (page - 1) * limit;

    // The assignedTo field is stored as a string in the database, not ObjectId
    const filterQuery = {
      $or: [{ assignedTo: memberId }, { followUpPerson: memberId }],
      isActive: true,
      converted: false,
    };

    const [firstTimers, total] = await Promise.all([
      this.firstTimerModel
        .find(filterQuery)
        .populate('assignedTo', 'firstName lastName email')
        .populate('followUpPerson', 'firstName lastName email')
        .sort({ nextFollowUpDate: 1, dateOfVisit: -1 })
        .skip(skip)
        .limit(limit),
      this.firstTimerModel.countDocuments(filterQuery),
    ]);

    return createPaginatedResult(firstTimers, total, page, limit);
  }

  async updateNotes(id: string, notes: string): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findByIdAndUpdate(
      id,
      { $set: { notes } },
      { new: true },
    );

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    return firstTimer;
  }

  async deactivate(id: string): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    );

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    return firstTimer;
  }

  async remove(id: string): Promise<void> {
    const result = await this.firstTimerModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException('First-timer not found');
    }
  }

  async bulkRemove(ids: string[]): Promise<number> {
    const result = await this.firstTimerModel.deleteMany({ _id: { $in: ids } });
    return result.deletedCount || 0;
  }

  async bulkUpload(
    csvContent: string,
    options: {
      skipErrors?: boolean;
      defaultAssignedTo?: string;
    } = {},
  ): Promise<BulkUploadResultDto> {
    const { skipErrors = false, defaultAssignedTo } = options;

    // Parse CSV content
    let csvData: any[];
    try {
      csvData = CSVParserUtil.parseCSV(csvContent, {
        headerRow: true,
        skipEmptyLines: true,
      });
    } catch (error) {
      throw new BadRequestException(`CSV parsing failed: ${error.message}`);
    }

    if (csvData.length === 0) {
      throw new BadRequestException('No valid data found in CSV file');
    }

    const result: BulkUploadResultDto = {
      successCount: 0,
      errorCount: 0,
      totalCount: csvData.length,
      successfulRecords: [],
      failedRecords: [],
      message: '',
    };

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNumber = i + 2; // +2 because array is 0-indexed and first row is header

      try {
        // Map CSV data to CreateFirstTimerDto format
        const mappedData = CSVParserUtil.mapCSVToFirstTimer(row);

        // Apply default assigned user if provided
        if (defaultAssignedTo && !mappedData.assignedTo) {
          mappedData.assignedTo = defaultAssignedTo;
        }

        // Validate the mapped data
        const createDto = plainToClass(CreateFirstTimerDto, mappedData);
        const validationErrors = await validate(createDto);

        if (validationErrors.length > 0) {
          const errorMessages = validationErrors.map((error) =>
            Object.values(error.constraints || {}).join(', '),
          );
          throw new Error(`Validation failed: ${errorMessages.join('; ')}`);
        }

        // Check for required fields
        if (
          !createDto.firstName ||
          !createDto.lastName ||
          !createDto.phone ||
          !createDto.dateOfVisit
        ) {
          throw new Error(
            'Missing required fields: firstName, lastName, phone, or dateOfVisit',
          );
        }

        // Create the first-timer record
        const firstTimer = await this.createSafe(createDto);
        result.successfulRecords.push(firstTimer);
        result.successCount++;
      } catch (error) {
        result.errorCount++;
        result.failedRecords.push({
          row: rowNumber,
          data: row,
          errors: [error.message],
        });

        // If not skipping errors, stop processing
        if (!skipErrors) {
          result.message = `Processing stopped at row ${rowNumber} due to error: ${error.message}`;
          break;
        }
      }
    }

    // Generate summary message
    if (result.errorCount === 0) {
      result.message = `Successfully processed all ${result.successCount} records`;
    } else if (result.successCount === 0) {
      result.message = `Failed to process any records. ${result.errorCount} errors encountered`;
    } else {
      result.message = `Processed ${result.successCount} records successfully, ${result.errorCount} failed`;
    }

    return result;
  }

  private async createSafe(
    createFirstTimerDto: CreateFirstTimerDto,
  ): Promise<FirstTimerDocument> {
    // Check for duplicate phone and email but don't block creation
    const duplicateTracking = {
      hasDuplicatePhone: false,
      hasDuplicateEmail: false,
      duplicatePhoneNotes: [] as string[],
      duplicateEmailNotes: [] as string[],
    };

    // Check if phone already exists
    const existingPhone = await this.firstTimerModel.findOne({
      phone: createFirstTimerDto.phone,
      isActive: true,
    });

    if (existingPhone) {
      duplicateTracking.hasDuplicatePhone = true;
      duplicateTracking.duplicatePhoneNotes.push(
        `Duplicate phone detected during bulk upload - matches first-timer: ${existingPhone.firstName} ${existingPhone.lastName} (ID: ${existingPhone._id}) created on ${existingPhone.createdAt}`,
      );
      this.logger.warn(
        `Bulk upload: Duplicate phone number detected: ${createFirstTimerDto.phone} - already exists for ${existingPhone.firstName} ${existingPhone.lastName} (${existingPhone._id})`,
      );
    }

    // Check if email already exists (if provided)
    if (createFirstTimerDto.email) {
      const existingEmail = await this.firstTimerModel.findOne({
        email: createFirstTimerDto.email.toLowerCase(),
        isActive: true,
      });

      if (existingEmail) {
        duplicateTracking.hasDuplicateEmail = true;
        duplicateTracking.duplicateEmailNotes.push(
          `Duplicate email detected during bulk upload - matches first-timer: ${existingEmail.firstName} ${existingEmail.lastName} (ID: ${existingEmail._id}) created on ${existingEmail.createdAt}`,
        );
        this.logger.warn(
          `Bulk upload: Duplicate email detected: ${createFirstTimerDto.email} - already exists for ${existingEmail.firstName} ${existingEmail.lastName} (${existingEmail._id})`,
        );
      }
    }

    // Validate and convert dateOfVisit
    const dateOfVisit = new Date(createFirstTimerDto.dateOfVisit);
    if (isNaN(dateOfVisit.getTime())) {
      throw new BadRequestException(
        'Invalid date format for dateOfVisit. Use YYYY-MM-DD format.',
      );
    }

    const firstTimer = new this.firstTimerModel({
      ...createFirstTimerDto,
      dateOfVisit,
      email: createFirstTimerDto.email?.toLowerCase(),
      followUps: [],
      familyMembers: createFirstTimerDto.familyMembers || [],
      interests: createFirstTimerDto.interests || [],
      prayerRequests: createFirstTimerDto.prayerRequests || [],
      servingInterests: createFirstTimerDto.servingInterests || [],
      followUpCount: 0,
      // Include duplicate tracking information
      hasDuplicatePhone: duplicateTracking.hasDuplicatePhone,
      hasDuplicateEmail: duplicateTracking.hasDuplicateEmail,
      duplicatePhoneNotes: duplicateTracking.duplicatePhoneNotes,
      duplicateEmailNotes: duplicateTracking.duplicateEmailNotes,
    });

    // Set initial follow-up date (1 day after visit)
    const nextDay = new Date(dateOfVisit);
    nextDay.setDate(nextDay.getDate() + 1);
    firstTimer.nextFollowUpDate = nextDay;

    return firstTimer.save();
  }

  generateSampleCSV(): string {
    return CSVParserUtil.generateSampleCSV();
  }

  // New methods for automation
  async findStaleFirstTimers(cutoffDate: Date): Promise<FirstTimerDocument[]> {
    return this.firstTimerModel.find({
      isActive: true,
      status: { $in: [EngagementStatus.NEW, EngagementStatus.ENGAGED] },
      lastStatusChange: { $lte: cutoffDate },
    });
  }

  async findInterestedFirstTimers(): Promise<FirstTimerDocument[]> {
    return this.firstTimerModel.find({
      isActive: true,
      interestedInJoining: true,
      status: { $nin: [EngagementStatus.CLOSED] },
      remindersSent: { $lt: 3 },
    });
  }

  private mapFollowUpOutcomeToCallReportStatus(outcome: string): string {
    switch (outcome) {
      case 'successful':
      case 'interested':
        return 'willing_to_join';
      case 'not_interested':
        return 'committed_to_another_church';
      case 'no_answer':
      case 'busy':
        return 'unreachable';
      case 'follow_up_needed':
      default:
        return 'others';
    }
  }

  async updateReminderCount(id: string): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findByIdAndUpdate(
      id,
      {
        $inc: { remindersSent: 1 },
        $set: { lastReminderSent: new Date() },
      },
      { new: true },
    );

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    return firstTimer;
  }

  // Update message sent status and tracking
  async updateMessageSent(firstTimerId: string): Promise<FirstTimerDocument> {
    const sentAt = new Date();

    const firstTimer = await this.firstTimerModel.findByIdAndUpdate(
      firstTimerId,
      {
        messageSent: true,
        messageSentAt: sentAt,
      },
      { new: true },
    );

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    // Update message history to mark as sent
    await this.updateMessageHistoryAsSent(firstTimerId, sentAt);

    return firstTimer;
  }

  // Helper method to update message history when message is sent
  private async updateMessageHistoryAsSent(
    firstTimerId: string,
    sentAt: Date,
  ): Promise<void> {
    try {
      // We need to import MessageHistory model here or use a separate service
      // For now, we'll handle this in the messaging service
      this.logger.log(
        `Message sent tracking updated for first-timer ${firstTimerId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update message history for ${firstTimerId}:`,
        error,
      );
    }
  }

  // Helper method to get GIA group information
  async getGiaGroup() {
    return this.groupsService.findByNameAndType('GIA', GroupType.UNIT);
  }
}
