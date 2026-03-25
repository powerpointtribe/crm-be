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
import { PublicCreateFirstTimerDto } from './dto/public-first-timer.dto';
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
import { BranchesService } from '../branches/branches.service';
import { RolesService } from '../roles/services/roles.service';
import { GroupType } from '../common/enums/group-types.enum';
import { JobType } from '../common/interfaces/queue-job.interface';
import { BranchDocument } from '../branches/schemas/branch.schema';
import {
  BranchAccessService,
  BranchFilterContext,
} from '../common/services/branch-access.service';
import { MemberLifecycleService } from '../activity-tracker/member-lifecycle.service';

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
    private branchesService: BranchesService,
    private branchAccessService: BranchAccessService,
    private rolesService: RolesService,
    private memberLifecycleService: MemberLifecycleService,
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

    // GIA leader is optional and can be assigned later
    const giaLeader = createFirstTimerDto.giaLeader;

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

    return firstTimer.save();
  }

  async findAll(
    searchDto: FirstTimerSearchDto,
    branchFilterContext?: BranchFilterContext,
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
      branchId,
      excludeReadyForIntegration,
      dateRange,
    } = searchDto;

    const skip = (page - 1) * limit;
    let filterQuery: FilterQuery<FirstTimerDocument> = {
      isActive: true,
    };

    // Show all records including archived in the general listing
    // Status filtering will handle showing specific statuses

    // Exclude ready for integration if requested
    if (excludeReadyForIntegration) {
      filterQuery.readyForIntegration = { $ne: true };
    }

    // Apply date range filter based on dateOfVisit
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let fromDate: Date;

      switch (dateRange) {
        case '7days':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3months':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(0); // All time
      }

      filterQuery.dateOfVisit = { $gte: fromDate };
    }

    // Apply branch filtering based on user permissions
    if (branchFilterContext) {
      const effectiveContext: BranchFilterContext = {
        ...branchFilterContext,
        selectedBranchId: branchId || branchFilterContext.selectedBranchId,
      };
      filterQuery = this.branchAccessService.applyBranchFilter(
        filterQuery,
        effectiveContext,
        'branch',
      );
    }

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
        .populate('branch', 'name slug')
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
      .populate('branch', 'name slug')
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

  /**
   * Find duplicate first timer by phone, email, and firstName (case-insensitive)
   */
  async findDuplicate(
    phone: string,
    email: string,
    firstName: string,
  ): Promise<FirstTimerDocument | null> {
    return this.firstTimerModel
      .findOne({
        phone,
        email: email?.toLowerCase(),
        firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
        isActive: true,
      })
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
    const followUp: any = {
      date: followUpDto.date ? new Date(followUpDto.date) : new Date(),
      dateEntered: followUpDto.dateEntered ? new Date(followUpDto.dateEntered) : new Date(),
      method: followUpDto.method,
      notes: followUpDto.notes || 'N/A',
      outcome: followUpDto.outcome,
      contactedBy: followUpDto.contactedBy,
      nextFollowUpDate: followUpDto?.nextFollowUpDate
        ? new Date(followUpDto.nextFollowUpDate)
        : undefined,
    };

    // Add visitNumber if method is in_visit
    if (followUpDto.method === 'in_visit' && followUpDto.visitNumber) {
      followUp.visitNumber = followUpDto.visitNumber;
    }

    // Update status to ENGAGED when any follow-up is added
    // unless already at a terminal status (CLOSED, READY_FOR_INTEGRATION)
    let newStatus = firstTimer.status;
    const terminalStatuses = [
      EngagementStatus.CLOSED,
      EngagementStatus.READY_FOR_INTEGRATION,
    ];

    if (!terminalStatuses.includes(firstTimer.status as EngagementStatus)) {
      // Default to ENGAGED when any follow-up is added
      newStatus = EngagementStatus.ENGAGED;
    }

    // Override to CLOSED if outcome is not_interested
    if (followUpDto.outcome === 'not_interested') {
      newStatus = EngagementStatus.CLOSED;
    }

    // Build the update object
    const updateObj: any = {
      $push: { followUps: followUp },
      $inc: { followUpCount: 1 },
      $set: {
        status: newStatus,
        nextFollowUpDate: followUpDto.nextFollowUpDate
          ? new Date(followUpDto.nextFollowUpDate)
          : null,
      },
    };

    // If method is in_visit, also update totalVisits
    if (followUpDto.method === 'in_visit' && followUpDto.visitNumber) {
      // Set totalVisits to the visit number (e.g., 2nd visit = 2 total visits)
      updateObj.$set.totalVisits = followUpDto.visitNumber;
    }

    const updatedFirstTimer = await this.firstTimerModel
      .findByIdAndUpdate(id, updateObj, { new: true })
      .populate('followUps.contactedBy', 'firstName lastName');

    // Schedule follow-up reminder if nextFollowUpDate is provided
    if (followUpDto.nextFollowUpDate) {
      try {
        const scheduledDate = new Date(followUpDto.nextFollowUpDate);
        this.logger.log(
          `Scheduling follow-up reminder for first-timer ${id} at ${scheduledDate}`,
        );

        // Get the person assigned to this first-timer to send them the reminder
        const assignedToId = firstTimer.assignedTo?.toString();
        if (assignedToId) {
          const assignedPerson =
            await this.membersService.findById(assignedToId);
          if (assignedPerson && assignedPerson.email) {
            const job = await this.queueService.scheduleFollowUpReminder(
              {
                firstTimerId: id,
                assignedPersonEmail: assignedPerson.email,
                assignedPersonName: `${assignedPerson.firstName} ${assignedPerson.lastName}`,
                firstTimerName: `${firstTimer.firstName} ${firstTimer.lastName}`,
                firstTimerPhone: firstTimer.phone,
                firstTimerEmail: firstTimer.email,
                followUpNotes: followUpDto.notes,
              },
              scheduledDate,
            );
            this.logger.log(
              `✅ Scheduled follow-up reminder - Job ID: ${job.id}, for ${assignedPerson.email} at ${scheduledDate}`,
            );
          } else {
            this.logger.warn(
              `Cannot schedule reminder: Assigned person ${assignedToId} not found or has no email`,
            );
          }
        } else {
          this.logger.warn(
            `Cannot schedule reminder: First-timer ${id} has no assigned person`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to schedule follow-up reminder for first-timer ${id}:`,
          error.message,
        );
        // Don't fail the follow-up if scheduling fails
      }
    }

    // Create a corresponding call report (optional, don't block on failure)
    try {
      // Get the actual count of existing call reports for this first-timer
      const existingReports =
        await this.callReportsService.findByFirstTimer(id);
      const nextReportNumber = existingReports.length + 1;

      this.logger.log(
        `Creating call report for first-timer ${id}: found ${existingReports.length} existing reports, next report number: ${nextReportNumber}`,
      );

      const callReportData: any = {
        firstTimerId: id,
        callDate: new Date().toISOString(),
        status: this.mapFollowUpOutcomeToCallReportStatus(followUpDto.outcome),
        notes: followUpDto.notes || '',
        contactMethod: followUpDto.method,
        nextFollowUpDate: followUpDto.nextFollowUpDate,
        reportNumber: nextReportNumber,
      };

      // If method is in_visit, add visitNumber and set attended service flags
      if (followUpDto.method === 'in_visit' && followUpDto.visitNumber) {
        callReportData.visitNumber = followUpDto.visitNumber;
        if (followUpDto.visitNumber === 2) {
          callReportData.attended2ndService = true;
        } else if (followUpDto.visitNumber === 3) {
          callReportData.attended3rdService = true;
        } else if (followUpDto.visitNumber === 4) {
          callReportData.attended4thService = true;
        }
      }

      await this.callReportsService.create(
        callReportData,
        followUpDto.contactedBy || '',
      );
      this.logger.log(`Call report created for first-timer ${id} follow-up`);
    } catch (error) {
      this.logger.error(
        `Failed to create call report for first-timer ${id}:`,
        error.message || error,
      );
      // Don't fail the follow-up if call report creation fails
    }

    return updatedFirstTimer!;
  }

  async update(
    id: string,
    data: Record<string, any>,
  ): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findByIdAndUpdate(
      id,
      {
        $set: {
          ...data,
          lastStatusChange: new Date(),
        },
      },
      { new: true, runValidators: true },
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
    limit: number = 10,
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
      // Convert MM-DD format to full date with 1990 as default year
      let dateOfBirth = '1990-01-01'; // Default date
      if (firstTimer.dateOfBirth) {
        // dateOfBirth is in MM-DD format, prepend 1990
        dateOfBirth = `1990-${firstTimer.dateOfBirth}`;
      }

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
        dateOfBirth,
        gender: firstTimer.gender || 'male', // Use first-timer's gender if available
        password: Math.random().toString(36).slice(-8), // Temporary random password
        membershipStatus: MembershipStatus.MEMBER,
        branch: firstTimer.branch!.toString(), // Required - first-timer always has branch from form
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
    const assignedMember = (firstTimers[0].assignedTo ||
      firstTimers[0].followUpPerson) as any;

    if (!assignedMember) {
      this.logger.warn(`No assigned member found for bulk notification`);
      return;
    }

    // Determine assignment type based on which field is populated
    const assignmentType = firstTimers[0].assignedTo
      ? 'assignment'
      : 'followup';

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
      totalAllStats,
      sourceStats,
      weeklyStats,
      assignmentStats,
      readyForIntegrationCount,
      totalClosedCount,
    ] = await Promise.all([
      // Status distribution (exclude archived)
      this.firstTimerModel.aggregate([
        { $match: { isActive: true, isArchived: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Conversion analytics (exclude archived) - for active count
      this.firstTimerModel.aggregate([
        { $match: { isActive: true, isArchived: { $ne: true } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            converted: { $sum: { $cond: ['$converted', 1, 0] } },
            avgFollowUps: { $avg: '$followUpCount' },
          },
        },
      ]),

      // Total count including archived (for "Total Visitors" display)
      this.firstTimerModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalAll: { $sum: 1 },
            totalArchived: { $sum: { $cond: [{ $eq: ['$isArchived', true] }, 1, 0] } },
          },
        },
      ]),

      // Traffic sources (exclude archived)
      this.firstTimerModel.aggregate([
        { $match: { isActive: true, isArchived: { $ne: true } } },
        { $group: { _id: '$howDidYouHear', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Weekly visitor trends (last 8 weeks) (exclude archived)
      this.firstTimerModel.aggregate([
        {
          $match: {
            isActive: true,
            isArchived: { $ne: true },
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

      // Assignment stats (exclude archived)
      this.firstTimerModel.aggregate([
        { $match: { isActive: true, isArchived: { $ne: true } } },
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

      // Ready for integration count
      this.firstTimerModel.countDocuments({
        isActive: true,
        isArchived: { $ne: true },
        readyForIntegration: true,
      }),

      // Closed count (converted to member or marked inactive)
      this.firstTimerModel.countDocuments({
        isActive: true,
        status: EngagementStatus.CLOSED,
      }),
    ]);

    const conversionRate = conversionStats[0]
      ? Math.round(
          (conversionStats[0].converted / conversionStats[0].total) * 100,
        )
      : 0;

    // All visitors including archived (for "All Visitors" tab)
    const totalAll = totalAllStats[0]?.totalAll || 0;
    const totalArchived = totalAllStats[0]?.totalArchived || 0;

    return {
      total: totalAll, // All first timers including archived (for "All Visitors" tab)
      totalArchived: totalArchived, // Archived count (for "Archived" tab)
      totalClosed: totalClosedCount, // Closed count (for "Closed" tab)
      readyForIntegration: readyForIntegrationCount, // Ready for integration count
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
    limit: number = 10,
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
    limit: number = 10,
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
    limit: number = 10,
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

  /**
   * Entry Import - Import first timers from external CSV format (e.g., Google Forms, Excel)
   * Supports flexible column mapping for various CSV formats
   */
  async entryImport(
    csvContent: string,
    options: {
      skipErrors?: boolean;
      branchId?: string;
    } = {},
  ): Promise<BulkUploadResultDto> {
    const { skipErrors = true, branchId } = options;

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
        // Map CSV data to CreateFirstTimerDto format using flexible mapper
        const mappedData = CSVParserUtil.mapCSVToFirstTimer(row);

        // Apply branch if provided
        if (branchId) {
          mappedData.branch = branchId;
        }

        // Skip rows without essential data
        if (!mappedData.firstName && !mappedData.lastName && !mappedData.phone) {
          this.logger.debug(`Skipping row ${rowNumber}: No essential data found`);
          continue;
        }

        // Handle missing required fields with defaults
        if (!mappedData.firstName) {
          mappedData.firstName = 'Unknown';
        }
        if (!mappedData.lastName) {
          mappedData.lastName = 'Unknown';
        }
        if (!mappedData.phone) {
          // Skip rows without phone number
          throw new Error('Phone number is required');
        }
        if (!mappedData.dateOfVisit) {
          // Default to today if no entry date
          mappedData.dateOfVisit = new Date().toISOString().split('T')[0];
        }

        // Create the first-timer record
        const firstTimer = await this.createSafe(
          plainToClass(CreateFirstTimerDto, mappedData),
        );
        result.successfulRecords.push({
          row: rowNumber,
          firstName: firstTimer.firstName,
          lastName: firstTimer.lastName,
          phone: firstTimer.phone,
        });
        result.successCount++;
      } catch (error) {
        result.errorCount++;
        result.failedRecords.push({
          row: rowNumber,
          data: {
            firstName: row['First Name'] || row['firstName'],
            lastName: row['Last Name'] || row['lastName'],
            phone: row['Phone Number'] || row['Phone'] || row['phone'],
          },
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
      result.message = `Successfully imported all ${result.successCount} first timer entries`;
    } else if (result.successCount === 0) {
      result.message = `Failed to import any entries. ${result.errorCount} errors encountered`;
    } else {
      result.message = `Imported ${result.successCount} entries successfully, ${result.errorCount} failed`;
    }

    this.logger.log(
      `Entry Import completed: ${result.successCount} success, ${result.errorCount} failed out of ${result.totalCount} total`,
    );

    return result;
  }

  /**
   * Generate sample CSV for Entry Import with all supported column headers
   */
  generateEntryImportSampleCSV(): string {
    const headers = [
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
      'What did you enjoy about today\'s service?',
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

    const sampleRow = [
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

    return headers.join(',') + '\n' + sampleRow.map(val => `"${val}"`).join(',');
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
    // The follow-up outcomes match the call report status values
    const validStatuses = [
      'successful',
      'no_answer',
      'busy',
      'not_interested',
      'interested',
      'follow_up_needed',
      'completed',
    ];

    if (validStatuses.includes(outcome)) {
      return outcome;
    }

    // Default to 'follow_up_needed' if outcome doesn't match
    return 'follow_up_needed';
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


  // Helper method to get GIA group information
  async getGiaGroup() {
    return this.groupsService.findByNameAndType('GIA', GroupType.UNIT);
  }

  // Branch-specific methods for public registration forms
  async getBranchFormConfig(slug: string): Promise<any | null> {
    return this.branchesService.getBranchFormConfig(slug);
  }

  async getBranchBySlug(slug: string): Promise<BranchDocument | null> {
    return this.branchesService.findBySlug(slug);
  }

  async createWithBranch(
    createFirstTimerDto: PublicCreateFirstTimerDto,
    branchId: Types.ObjectId | string,
  ): Promise<FirstTimerDocument> {
    // Convert branchId to ObjectId if it's a string
    const branchObjectId = typeof branchId === 'string'
      ? new Types.ObjectId(branchId)
      : branchId;

    // Set dateOfVisit to today if not provided
    const dateOfVisit = createFirstTimerDto.dateOfVisit
      ? new Date(createFirstTimerDto.dateOfVisit)
      : new Date();

    if (isNaN(dateOfVisit.getTime())) {
      throw new BadRequestException(
        'Invalid date format for dateOfVisit. Use YYYY-MM-DD format.',
      );
    }

    // Handle interestedInJoining field properly
    const interestedInJoining = createFirstTimerDto.interestedInJoining;
    let validInterestedInJoining: string | undefined = undefined;

    if (
      interestedInJoining &&
      ['yes', 'no', 'maybe'].includes(interestedInJoining)
    ) {
      validInterestedInJoining = interestedInJoining;
    }

    const firstTimer = new this.firstTimerModel({
      firstName: createFirstTimerDto.firstName,
      lastName: createFirstTimerDto.lastName,
      phone: createFirstTimerDto.phone,
      email: createFirstTimerDto.email?.toLowerCase(),
      address: createFirstTimerDto.address,
      dateOfBirth: createFirstTimerDto.dateOfBirth,
      gender: createFirstTimerDto.gender,
      occupation: createFirstTimerDto.occupation,
      alternateContactMethod: createFirstTimerDto.alternateContactMethod,
      socialMediaHandles: createFirstTimerDto.socialMediaHandles,
      serviceExperience: createFirstTimerDto.serviceExperience,
      profilePhotoUrl: createFirstTimerDto.profilePhotoUrl,
      invitedBy: createFirstTimerDto.invitedBy,
      previousChurch: createFirstTimerDto.previousChurch,
      visitorType: createFirstTimerDto.visitorType || 'first_time',
      maritalStatus: createFirstTimerDto.maritalStatus,
      numberOfChildren: createFirstTimerDto.numberOfChildren,
      familyMembers: createFirstTimerDto.familyMembers || [],
      interests: createFirstTimerDto.interests || [],
      servingInterests: createFirstTimerDto.servingInterests || [],
      dateOfVisit,
      status: EngagementStatus.NEW,
      branch: branchObjectId, // Assign the branch based on the URL slug
      followUps: [],
      prayerRequests: [],
      followUpCount: 0,
      lastStatusChange: new Date(),
      interestedInJoining: validInterestedInJoining,
      notes: createFirstTimerDto.notes
        ? `[BRANCH FORM] ${createFirstTimerDto.notes}`
        : '[BRANCH FORM] Registration from branch-specific public form',
      howDidYouHear: createFirstTimerDto.howDidYouHear || 'website',
    });

    // Set initial follow-up date (1 day after visit)
    const nextDay = new Date(dateOfVisit);
    nextDay.setDate(nextDay.getDate() + 1);
    firstTimer.nextFollowUpDate = nextDay;

    return firstTimer.save();
  }

  // ==================== ARCHIVE METHODS ====================

  /**
   * Archive a first timer manually
   */
  async archive(id: string, reason?: string): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findByIdAndUpdate(
      id,
      {
        $set: {
          isArchived: true,
          archivedAt: new Date(),
          archiveReason: reason || 'Manually archived',
          status: EngagementStatus.ARCHIVED,
          lastStatusChange: new Date(),
        },
      },
      { new: true },
    );

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    this.logger.log(`First-timer ${id} archived. Reason: ${reason || 'Manually archived'}`);
    return firstTimer;
  }

  /**
   * Unarchive/restore an archived first timer
   */
  async unarchive(id: string): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findByIdAndUpdate(
      id,
      {
        $set: {
          isArchived: false,
          status: EngagementStatus.ENGAGED,
          lastStatusChange: new Date(),
        },
        $unset: {
          archivedAt: 1,
          archiveReason: 1,
        },
      },
      { new: true },
    );

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    this.logger.log(`First-timer ${id} unarchived`);
    return firstTimer;
  }

  /**
   * Set or unset the exemptFromAutoArchive flag
   */
  async setExemptFromAutoArchive(id: string, exempt: boolean): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findByIdAndUpdate(
      id,
      { $set: { exemptFromAutoArchive: exempt } },
      { new: true },
    );

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    this.logger.log(`First-timer ${id} exemptFromAutoArchive set to ${exempt}`);
    return firstTimer;
  }

  /**
   * Find all archived first timers with pagination
   */
  async findArchived(
    searchDto: FirstTimerSearchDto,
    branchFilterContext?: BranchFilterContext,
  ): Promise<PaginatedResult<FirstTimerDocument>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'archivedAt',
      sortOrder = 'desc',
      branchId,
      dateRange,
    } = searchDto;

    const skip = (page - 1) * limit;
    let filterQuery: FilterQuery<FirstTimerDocument> = {
      isActive: true,
      isArchived: true,
    };

    // Apply date range filter based on dateOfVisit
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let fromDate: Date;

      switch (dateRange) {
        case '7days':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3months':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(0);
      }

      filterQuery.dateOfVisit = { $gte: fromDate };
    }

    // Apply branch filtering based on user permissions
    if (branchFilterContext) {
      const effectiveContext: BranchFilterContext = {
        ...branchFilterContext,
        selectedBranchId: branchId || branchFilterContext.selectedBranchId,
      };
      filterQuery = this.branchAccessService.applyBranchFilter(
        filterQuery,
        effectiveContext,
        'branch',
      );
    }

    // Text search
    if (search) {
      const searchQuery = QueryBuilder.buildSearchQuery(search, [
        'firstName',
        'lastName',
        'phone',
        'email',
      ]);
      Object.assign(filterQuery, searchQuery);
    }

    // Build sort query
    const sortQuery = QueryBuilder.buildSortQuery(sortBy, sortOrder);

    const [firstTimers, total] = await Promise.all([
      this.firstTimerModel
        .find(filterQuery)
        .populate('assignedTo', 'firstName lastName email')
        .populate('branch', 'name slug')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.firstTimerModel.countDocuments(filterQuery),
    ]);

    return createPaginatedResult(firstTimers, total, page, limit);
  }

  /**
   * Find first timers eligible for auto-archiving
   * Criteria:
   * - More than 3 follow-up engagements (followUpCount > 3)
   * - 6 months have passed since dateOfVisit
   * - Not already archived
   * - Not exempt from auto-archive
   */
  async findAutoArchiveEligible(): Promise<FirstTimerDocument[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return this.firstTimerModel.find({
      isActive: true,
      isArchived: { $ne: true },
      exemptFromAutoArchive: { $ne: true },
      followUpCount: { $gt: 3 },
      dateOfVisit: { $lte: sixMonthsAgo },
    });
  }

  /**
   * Run the auto-archive process
   * Archives first timers that meet the criteria
   */
  async runAutoArchive(): Promise<{ archivedCount: number; archivedIds: string[] }> {
    const eligibleFirstTimers = await this.findAutoArchiveEligible();
    const archivedIds: string[] = [];

    for (const firstTimer of eligibleFirstTimers) {
      try {
        const firstTimerId = (firstTimer._id as any).toString();
        await this.firstTimerModel.findByIdAndUpdate(firstTimer._id, {
          $set: {
            isArchived: true,
            archivedAt: new Date(),
            archiveReason: 'Auto-archived: More than 3 follow-ups and 6 months since first visit',
          },
        });
        archivedIds.push(firstTimerId);
      } catch (error) {
        this.logger.error(`Failed to auto-archive first-timer ${(firstTimer._id as any).toString()}: ${error.message}`);
      }
    }

    this.logger.log(`Auto-archive completed: ${archivedIds.length} first-timers archived`);
    return { archivedCount: archivedIds.length, archivedIds };
  }

  /**
   * Get archive statistics
   */
  async getArchiveStats(): Promise<{
    totalArchived: number;
    archivedThisMonth: number;
    exemptCount: number;
    eligibleForArchive: number;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalArchived, archivedThisMonth, exemptCount, eligibleForArchive] = await Promise.all([
      this.firstTimerModel.countDocuments({ isArchived: true, isActive: true }),
      this.firstTimerModel.countDocuments({
        isArchived: true,
        isActive: true,
        archivedAt: { $gte: startOfMonth },
      }),
      this.firstTimerModel.countDocuments({ exemptFromAutoArchive: true, isActive: true }),
      this.findAutoArchiveEligible().then((docs) => docs.length),
    ]);

    return { totalArchived, archivedThisMonth, exemptCount, eligibleForArchive };
  }

  // ==================== READY FOR INTEGRATION METHODS ====================

  /**
   * Mark a first timer as ready for integration
   * This does NOT create a member record - it just flags the first timer
   */
  async markReadyForIntegration(
    id: string,
    markedByUserId: string,
  ): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findById(id);
    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    if (!firstTimer.assignedTo) {
      throw new BadRequestException(
        'First-timer must be assigned to someone before marking as ready for integration',
      );
    }

    if (!firstTimer.followUps || firstTimer.followUps.length === 0) {
      throw new BadRequestException(
        'At least one follow-up record is required before marking as ready for integration',
      );
    }

    if (firstTimer.readyForIntegration) {
      throw new BadRequestException('First-timer is already marked as ready for integration');
    }

    const updatedFirstTimer = await this.firstTimerModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            readyForIntegration: true,
            readyForIntegrationDate: new Date(),
            markedReadyBy: markedByUserId,
            lastStatusChange: new Date(),
            status: EngagementStatus.READY_FOR_INTEGRATION,
          },
        },
        { new: true },
      )
      .populate('assignedTo', 'firstName lastName email phone')
      .populate('branch', 'name slug')
      .populate('markedReadyBy', 'firstName lastName');

    if (!updatedFirstTimer) {
      throw new NotFoundException('First-timer not found after update');
    }

    this.logger.log(`First-timer ${id} marked as ready for integration by user ${markedByUserId}`);

    return updatedFirstTimer;
  }

  /**
   * Unmark a first timer from ready for integration
   */
  async unmarkReadyForIntegration(id: string): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findByIdAndUpdate(
      id,
      {
        $set: {
          readyForIntegration: false,
          status: EngagementStatus.ENGAGED,
          lastStatusChange: new Date(),
        },
        $unset: {
          readyForIntegrationDate: 1,
          markedReadyBy: 1,
        },
      },
      { new: true },
    );

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    this.logger.log(`First-timer ${id} unmarked from ready for integration`);
    return firstTimer;
  }

  /**
   * Close a first timer as inactive (not converted to member)
   * Requires at least one follow-up record
   */
  async closeFirstTimer(
    id: string,
    reason?: string,
  ): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findById(id);
    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    if (firstTimer.status === EngagementStatus.CLOSED) {
      throw new BadRequestException('First-timer is already closed');
    }

    if (!firstTimer.assignedTo) {
      throw new BadRequestException(
        'First-timer must be assigned to someone before closing',
      );
    }

    if (!firstTimer.followUps || firstTimer.followUps.length === 0) {
      throw new BadRequestException(
        'At least one follow-up record is required before closing',
      );
    }

    const updatedFirstTimer = await this.firstTimerModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: EngagementStatus.CLOSED,
          lastStatusChange: new Date(),
          closedAt: new Date(),
          closureReason: reason || 'Marked as inactive',
          readyForIntegration: false,
          isArchived: false,
        },
        $unset: {
          readyForIntegrationDate: 1,
          markedReadyBy: 1,
          archivedAt: 1,
          archiveReason: 1,
        },
      },
      { new: true },
    );

    if (!updatedFirstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    this.logger.log(`First-timer ${id} closed as inactive. Reason: ${reason || 'No reason provided'}`);
    return updatedFirstTimer;
  }

  /**
   * Find all first timers marked as ready for integration with pagination
   */
  async findReadyForIntegration(
    searchDto: FirstTimerSearchDto,
    branchFilterContext?: BranchFilterContext,
  ): Promise<PaginatedResult<FirstTimerDocument>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'readyForIntegrationDate',
      sortOrder = 'desc',
      branchId,
      dateRange,
    } = searchDto;

    const skip = (page - 1) * limit;
    let filterQuery: FilterQuery<FirstTimerDocument> = {
      isActive: true,
      isArchived: { $ne: true },
      readyForIntegration: true,
    };

    // Apply date range filter based on dateOfVisit
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let fromDate: Date;

      switch (dateRange) {
        case '7days':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3months':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(0);
      }

      filterQuery.dateOfVisit = { $gte: fromDate };
    }

    // Apply branch filtering based on user permissions
    if (branchFilterContext) {
      const effectiveContext: BranchFilterContext = {
        ...branchFilterContext,
        selectedBranchId: branchId || branchFilterContext.selectedBranchId,
      };
      filterQuery = this.branchAccessService.applyBranchFilter(
        filterQuery,
        effectiveContext,
        'branch',
      );
    }

    // Text search
    if (search) {
      const searchQuery = QueryBuilder.buildSearchQuery(search, [
        'firstName',
        'lastName',
        'phone',
        'email',
      ]);
      Object.assign(filterQuery, searchQuery);
    }

    // Build sort query
    const sortQuery = QueryBuilder.buildSortQuery(sortBy, sortOrder);

    const [firstTimers, total] = await Promise.all([
      this.firstTimerModel
        .find(filterQuery)
        .populate('assignedTo', 'firstName lastName email')
        .populate('branch', 'name slug')
        .populate('markedReadyBy', 'firstName lastName')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.firstTimerModel.countDocuments(filterQuery),
    ]);

    return createPaginatedResult(firstTimers, total, page, limit);
  }

  /**
   * Get count of first timers ready for integration
   */
  async getReadyForIntegrationCount(): Promise<number> {
    return this.firstTimerModel.countDocuments({
      isActive: true,
      isArchived: { $ne: true },
      readyForIntegration: true,
    });
  }

  /**
   * Integrate a first timer into membership
   * Creates a member record and assigns to district/unit
   */
  async integrateFirstTimer(
    id: string,
    districtId: string,
    unitId?: string,
    initiatedByUserId?: string,
  ): Promise<{ firstTimer: FirstTimerDocument; memberId: string }> {
    const firstTimer = await this.firstTimerModel.findById(id);
    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    if (!firstTimer.readyForIntegration) {
      throw new BadRequestException(
        'First-timer must be marked as ready for integration before integrating',
      );
    }

    if (!firstTimer.assignedTo) {
      throw new BadRequestException(
        'First-timer must be assigned to someone before integrating',
      );
    }

    if (!firstTimer.followUps || firstTimer.followUps.length === 0) {
      throw new BadRequestException(
        'At least one follow-up record is required before integrating',
      );
    }

    if (firstTimer.status === EngagementStatus.CLOSED) {
      throw new BadRequestException('First-timer has already been integrated');
    }

    // Verify district exists
    const district = await this.groupsService.findById(districtId);
    if (!district || district.type !== 'district') {
      throw new BadRequestException('Invalid district ID');
    }

    // Determine branch - use first timer's branch or fall back to district's branch
    const branchId = firstTimer.branch?.toString() || district.branch?.toString();
    if (!branchId) {
      throw new BadRequestException(
        'Unable to determine branch for integration. Please assign a branch to the first-timer or district.',
      );
    }

    // Verify unit exists if provided
    if (unitId) {
      const unit = await this.groupsService.findById(unitId);
      if (!unit || unit.type !== 'unit') {
        throw new BadRequestException('Invalid unit ID');
      }
    }

    // Convert date of birth format
    let dateOfBirth = '1990-01-01';
    if (firstTimer.dateOfBirth) {
      // dateOfBirth might be in MM-DD format, prepend 1990
      if (firstTimer.dateOfBirth.length === 5) {
        dateOfBirth = `1990-${firstTimer.dateOfBirth}`;
      } else {
        dateOfBirth = firstTimer.dateOfBirth;
      }
    }

    // Get default "Member" role
    let memberRoleId: string | undefined;
    try {
      const memberRole = await this.rolesService.findByName('Member') as any;
      memberRoleId = memberRole?._id?.toString();
    } catch (error) {
      this.logger.warn('Default "Member" role not found, member will be created without a role');
    }

    // Create member record
    const memberData = {
      firstName: firstTimer.firstName,
      lastName: firstTimer.lastName,
      email:
        firstTimer.email ||
        `${firstTimer.firstName.toLowerCase()}.${firstTimer.lastName.toLowerCase()}@church.local`,
      phone: firstTimer.phone,
      address: {
        street: firstTimer.address?.street || '',
        city: firstTimer.address?.city || '',
        state: firstTimer.address?.state || '',
        country: firstTimer.address?.country || 'Nigeria',
      },
      dateOfBirth,
      gender: firstTimer.gender || 'male',
      password: Math.random().toString(36).slice(-8),
      membershipStatus: MembershipStatus.MEMBER,
      branch: branchId,
      district: districtId,
      profilePhotoUrl: firstTimer.profilePhotoUrl,
      occupation: firstTimer.occupation,
      maritalStatus: firstTimer.maritalStatus,
      role: memberRoleId,
    };

    // Create the member - pass the user who initiated the conversion
    const newMember = await this.membersService.create(memberData, initiatedByUserId);
    const memberId = newMember._id?.toString();

    // Log first-timer conversion event with the first visit date
    try {
      const effectiveInitiator = initiatedByUserId || memberId;
      await this.memberLifecycleService.logFirstTimerConversion(
        memberId,
        id, // first timer ID
        effectiveInitiator,
        firstTimer.dateOfVisit,
      );
      this.logger.log(`Activity logged: First-timer conversion for ${memberId}, first visit: ${firstTimer.dateOfVisit}`);
    } catch (error) {
      this.logger.warn(`Failed to log first-timer conversion event: ${error.message}`);
    }

    // Add member to district
    await this.groupsService.addMember(districtId, memberId);

    // Add member to unit if specified
    if (unitId) {
      await this.groupsService.addMember(unitId, memberId);
    }

    // Update first timer status
    const updatedFirstTimer = await this.firstTimerModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            converted: true,
            conversionDate: new Date(),
            memberRecord: memberId,
            status: EngagementStatus.CLOSED,
            readyForIntegration: false,
            lastStatusChange: new Date(),
            memberCreatedAt: new Date(),
            assignedDistrict: districtId,
            districtAssignmentDate: new Date(),
            integrationStage: 'assigned_to_district',
            integrationStageDate: new Date(),
          },
        },
        { new: true },
      )
      .populate('memberRecord', 'firstName lastName membershipStatus')
      .populate('assignedDistrict', 'name');

    if (!updatedFirstTimer) {
      throw new NotFoundException('First-timer not found after update');
    }

    this.logger.log(
      `First-timer ${firstTimer.firstName} ${firstTimer.lastName} integrated as member ${memberId}`,
    );

    return { firstTimer: updatedFirstTimer, memberId };
  }

  // ==================== FOLLOW-UP REMINDER METHODS ====================

  /**
   * Find all first timers with follow-up reminders due today
   * Returns first timers with their follow-ups that have nextFollowUpDate matching today
   */
  async findFollowUpsDueToday(): Promise<
    Array<{
      firstTimer: FirstTimerDocument;
      dueFollowUps: Array<{
        date: Date;
        method: string;
        notes?: string;
        outcome: string;
        contactedBy: Types.ObjectId;
        nextFollowUpDate?: Date;
      }>;
    }>
  > {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find first timers with follow-ups that have nextFollowUpDate due today
    const firstTimers = await this.firstTimerModel
      .find({
        isActive: true,
        isArchived: { $ne: true },
        'followUps.nextFollowUpDate': {
          $gte: today,
          $lt: tomorrow,
        },
      })
      .populate('assignedTo', 'firstName lastName email')
      .populate('followUps.contactedBy', 'firstName lastName email')
      .exec();

    // Extract the specific follow-ups that are due today
    return firstTimers.map((firstTimer) => ({
      firstTimer,
      dueFollowUps: firstTimer.followUps.filter((followUp) => {
        if (!followUp.nextFollowUpDate) return false;
        const followUpDate = new Date(followUp.nextFollowUpDate);
        followUpDate.setHours(0, 0, 0, 0);
        return followUpDate.getTime() === today.getTime();
      }),
    }));
  }

  /**
   * Get summary of follow-up reminders due today
   */
  async getFollowUpRemindersSummary(): Promise<{
    totalDue: number;
    firstTimersDue: number;
    reminders: Array<{
      firstTimerId: string;
      firstTimerName: string;
      firstTimerPhone: string;
      assignedToEmail: string | null;
      assignedToName: string | null;
      followUpCount: number;
    }>;
  }> {
    const dueFollowUps = await this.findFollowUpsDueToday();

    const reminders = dueFollowUps.map(({ firstTimer, dueFollowUps }) => ({
      firstTimerId: (firstTimer._id as any).toString(),
      firstTimerName: `${firstTimer.firstName} ${firstTimer.lastName}`,
      firstTimerPhone: firstTimer.phone,
      assignedToEmail: firstTimer.assignedTo
        ? (firstTimer.assignedTo as any).email
        : null,
      assignedToName: firstTimer.assignedTo
        ? `${(firstTimer.assignedTo as any).firstName} ${(firstTimer.assignedTo as any).lastName}`
        : null,
      followUpCount: dueFollowUps.length,
    }));

    return {
      totalDue: reminders.reduce((sum, r) => sum + r.followUpCount, 0),
      firstTimersDue: reminders.length,
      reminders,
    };
  }

  // ==================== REPORT STATISTICS ====================

  /**
   * Get comprehensive report statistics for first timers
   * Includes traffic sources, join us choices, and 2nd/3rd timer retention rates
   */
  async getReportStatistics(startDate: string, endDate: string): Promise<any> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const dateFilter = {
      isActive: true,
      dateOfVisit: { $gte: start, $lte: end },
    };

    // Get all first timers in the date range
    const firstTimers = await this.firstTimerModel.find(dateFilter).exec();
    const totalFirstTimers = firstTimers.length;

    // Traffic Source by Service (grouped by date of visit)
    const trafficSourceByService = await this.firstTimerModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%b %d, %Y', date: '$dateOfVisit' } },
            source: '$howDidYouHear',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // Transform traffic source by service for stacked bar chart
    const serviceMap = new Map<string, any>();
    trafficSourceByService.forEach((item) => {
      const service = item._id.date;
      const source = this.mapHowDidYouHear(item._id.source);
      if (!serviceMap.has(service)) {
        serviceMap.set(service, {
          service,
          'Friend/Colleague': 0,
          'Others': 0,
          'Outreach': 0,
          'Social Media': 0,
          'Special Programs': 0,
          'Family': 0,
        });
      }
      const entry = serviceMap.get(service);
      entry[source] = (entry[source] || 0) + item.count;
    });

    // Traffic Source Summary (donut chart)
    const trafficSourceSummary = await this.firstTimerModel.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$howDidYouHear', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const trafficSummary = trafficSourceSummary.map((item) => ({
      name: this.mapHowDidYouHear(item._id),
      value: item.count,
      percentage: totalFirstTimers > 0 ? (item.count / totalFirstTimers) * 100 : 0,
    }));

    // Join Us Choices by Service
    const joinUsChoicesByService = await this.firstTimerModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%b %d, %Y', date: '$dateOfVisit' } },
            joinUs: '$interestedInJoining',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // Transform join us choices for stacked bar chart
    const joinUsMap = new Map<string, any>();
    joinUsChoicesByService.forEach((item) => {
      const service = item._id.date;
      // Map string values to display labels
      const joinUsValue = item._id.joinUs;
      const choice = joinUsValue === 'yes' ? 'Yes' : joinUsValue === 'no' ? 'No' : 'Maybe';
      if (!joinUsMap.has(service)) {
        joinUsMap.set(service, { service, Yes: 0, Maybe: 0, No: 0 });
      }
      const entry = joinUsMap.get(service);
      entry[choice] = (entry[choice] || 0) + item.count;
    });

    // Join Us Choices Summary
    const yesCount = firstTimers.filter((ft) => ft.interestedInJoining === 'yes').length;
    const noCount = firstTimers.filter((ft) => ft.interestedInJoining === 'no').length;
    const maybeCount = firstTimers.filter((ft) => ft.interestedInJoining === 'maybe' || !ft.interestedInJoining).length;

    const joinUsSummary = [
      { name: 'Yes', value: yesCount, percentage: totalFirstTimers > 0 ? (yesCount / totalFirstTimers) * 100 : 0 },
      { name: 'Maybe', value: maybeCount, percentage: totalFirstTimers > 0 ? (maybeCount / totalFirstTimers) * 100 : 0 },
      { name: 'No', value: noCount, percentage: totalFirstTimers > 0 ? (noCount / totalFirstTimers) * 100 : 0 },
    ];

    // 2nd Timer Retention (based on follow-ups with visitNumber = 2)
    const secondTimerData = await this.calculateRetentionByVisitNumber(firstTimers, 2);

    // 3rd Timer Retention (based on follow-ups with visitNumber = 3)
    const thirdTimerData = await this.calculateRetentionByVisitNumber(firstTimers, 3);

    return {
      totalFirstTimers,
      trafficSourceByService: Array.from(serviceMap.values()),
      trafficSourceSummary: trafficSummary,
      joinUsChoicesByService: Array.from(joinUsMap.values()),
      joinUsChoicesSummary: joinUsSummary,
      secondTimerRetention: secondTimerData,
      thirdTimerRetention: thirdTimerData,
    };
  }

  /**
   * Map howDidYouHear values to friendly labels
   */
  private mapHowDidYouHear(source: string): string {
    const mapping: Record<string, string> = {
      friend: 'Friend/Colleague',
      family: 'Family',
      advertisement: 'Others',
      online: 'Social Media',
      event: 'Special Programs',
      walkby: 'Others',
      website: 'Social Media',
      social_media: 'Social Media',
      other: 'Others',
      outreach: 'Outreach',
    };
    return mapping[source] || 'Others';
  }

  /**
   * Calculate retention data for a specific visit number
   */
  private async calculateRetentionByVisitNumber(
    firstTimers: FirstTimerDocument[],
    visitNumber: number,
  ): Promise<{
    byService: Array<{ service: string; Yes: number; null: number }>;
    expectedCount: number;
    actualCount: number;
    retentionRate: number;
  }> {
    // Group by date of visit
    const serviceMap = new Map<string, { Yes: number; null: number }>();

    // Expected count = those who said "Yes" to joining
    const expectedCount = firstTimers.filter((ft) => ft.interestedInJoining === 'yes').length;

    let actualCount = 0;

    firstTimers.forEach((ft) => {
      const service = new Date(ft.dateOfVisit).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      if (!serviceMap.has(service)) {
        serviceMap.set(service, { Yes: 0, null: 0 });
      }

      const entry = serviceMap.get(service)!;

      // Check if there's a follow-up with the specified visitNumber
      const hasVisit = ft.followUps?.some(
        (followUp: any) => followUp.visitNumber === visitNumber
      );

      if (hasVisit) {
        entry.Yes++;
        actualCount++;
      } else {
        entry.null++;
      }
    });

    const retentionRate = expectedCount > 0 ? (actualCount / expectedCount) * 100 : 0;

    return {
      byService: Array.from(serviceMap.entries()).map(([service, data]) => ({
        service,
        Yes: data.Yes,
        null: data.null,
      })),
      expectedCount,
      actualCount,
      retentionRate: Math.round(retentionRate * 100) / 100,
    };
  }
}
