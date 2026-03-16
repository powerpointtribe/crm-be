import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Event, EventDocument, EventStatus, EventType } from './schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationDocument,
  RegistrationStatus,
  AttendeeType,
} from './schemas/event-registration.schema';
import {
  EventSession,
  EventSessionDocument,
  SessionStatus,
} from './schemas/event-session.schema';
import {
  SessionAttendance,
  SessionAttendanceDocument,
  SessionAttendanceStatus,
} from './schemas/session-attendance.schema';
import {
  EventPartner,
  EventPartnerDocument,
  PartnerStatus,
} from './schemas/event-partner.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventSearchDto } from './dto/event-search.dto';
import {
  AddCommitteeMemberDto,
  UpdateCommitteeMemberDto,
} from './dto/add-committee-member.dto';
import {
  CreateRegistrationDto,
  UpdateRegistrationStatusDto,
  RegistrationSearchDto,
} from './dto/create-registration.dto';
import { PublicRegistrationDto } from './dto/public-registration.dto';
import {
  SubmitPartnerDto,
  UpdatePartnerStatusDto,
  QueryPartnersDto,
  ContactPartnerDto,
  BulkPartnerEmailDto,
} from './dto/partner.dto';
import {
  CreateSessionDto,
  UpdateSessionDto,
  RecordSessionAttendanceDto,
  BulkRecordAttendanceDto,
  RecordAssessmentResultDto,
  SessionSearchDto,
} from './dto/session.dto';
import {
  EventAnalyticsQueryDto,
  EventOverviewStatsDto,
  RegistrationAnalyticsDto,
  SessionAnalyticsDto,
  AttendeeProgressDto,
  TrainingCompletionSummaryDto,
  FullEventAnalyticsDto,
  ParticipantAccountabilityDto,
  EventParticipantAccountabilitySummaryDto,
  TrainingAccountabilityReportDto,
  ParticipantAccountabilityQueryDto,
  AttendanceTrendDto,
  TrendAnalyticsQueryDto,
  RegistrationFunnelDto,
  CheckInAnalyticsDto,
  EventCommitteeAnalyticsDto,
  CommitteeMemberPerformanceDto,
  EventsDashboardAnalyticsDto,
  MemberEngagementAnalyticsDto,
} from './dto/event-analytics.dto';
import {
  PaginatedResult,
  createPaginatedResult,
} from '../common/utils/pagination.util';
import {
  BranchAccessService,
  BranchFilterContext,
} from '../common/services/branch-access.service';
import { EmailProvider } from '../notifications/providers/email.provider';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName, JobType } from '../common/interfaces/queue-job.interface';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(EventRegistration.name)
    private registrationModel: Model<EventRegistrationDocument>,
    @InjectModel(EventSession.name)
    private sessionModel: Model<EventSessionDocument>,
    @InjectModel(SessionAttendance.name)
    private sessionAttendanceModel: Model<SessionAttendanceDocument>,
    @InjectModel(EventPartner.name)
    private partnerModel: Model<EventPartnerDocument>,
    private branchAccessService: BranchAccessService,
    private emailProvider: EmailProvider,
    @InjectQueue(QueueName.EMAIL_NOTIFICATIONS)
    private emailQueue: Queue,
  ) {}

  // ========== EVENT CRUD OPERATIONS ==========

  async create(createEventDto: CreateEventDto): Promise<EventDocument> {
    // Validate dates
    const startDate = new Date(createEventDto.startDate);
    const endDate = new Date(createEventDto.endDate);

    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Generate registration slug if not provided
    let registrationSlug = createEventDto.registrationSlug;
    if (!registrationSlug && createEventDto.title) {
      registrationSlug = this.generateSlug(createEventDto.title);
    }

    // Check if slug is unique
    if (registrationSlug) {
      const existingSlug = await this.eventModel.findOne({ registrationSlug });
      if (existingSlug) {
        // Append random string to make unique
        registrationSlug = `${registrationSlug}-${Date.now().toString(36)}`;
      }
    }

    // Generate API key if integration mode is 'api'
    if (createEventDto.registrationSettings?.integrationMode === 'api') {
      createEventDto.registrationSettings.apiKey = `evt_${randomBytes(24).toString('hex')}`;
    }
    // Always strip client-provided apiKey when not in api mode
    if (
      createEventDto.registrationSettings?.apiKey &&
      createEventDto.registrationSettings?.integrationMode !== 'api'
    ) {
      delete createEventDto.registrationSettings.apiKey;
    }

    // Transform committee members
    const committee = createEventDto.committee?.map((c) => ({
      member: new Types.ObjectId(c.member),
      role: c.role,
      assignedAt: new Date(),
    }));

    const event = new this.eventModel({
      ...createEventDto,
      registrationSlug,
      committee,
      organizer: createEventDto.organizer
        ? new Types.ObjectId(createEventDto.organizer)
        : undefined,
      branch: new Types.ObjectId(createEventDto.branch),
    });

    return event.save();
  }

  async findAll(
    searchDto: EventSearchDto,
    branchFilterContext?: BranchFilterContext,
  ): Promise<PaginatedResult<EventDocument>> {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      status,
      branchId,
      organizerId,
      startDateFrom,
      startDateTo,
      tag,
      sortBy = 'startDate',
      sortOrder = 'asc',
    } = searchDto;

    const filter: FilterQuery<EventDocument> = {};

    // Text search
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Type filter
    if (type) {
      filter.type = type;
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Branch filter - apply branch access control
    if (branchFilterContext) {
      const updatedFilter = this.branchAccessService.applyBranchFilter(
        filter,
        branchFilterContext,
        'branch',
      );
      Object.assign(filter, updatedFilter);
    } else if (branchId) {
      filter.branch = new Types.ObjectId(branchId);
    }

    // Organizer filter
    if (organizerId) {
      filter.organizer = new Types.ObjectId(organizerId);
    }

    // Date range filters
    if (startDateFrom || startDateTo) {
      filter.startDate = {};
      if (startDateFrom) {
        filter.startDate.$gte = new Date(startDateFrom);
      }
      if (startDateTo) {
        filter.startDate.$lte = new Date(startDateTo);
      }
    }

    // Tag filter
    if (tag) {
      filter.tags = tag;
    }

    const skip = (page - 1) * limit;
    const sortOptions: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [data, total] = await Promise.all([
      this.eventModel
        .find(filter)
        .populate('branch', 'name')
        .populate('organizer', 'firstName lastName email')
        .populate('committee.member', 'firstName lastName email')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.eventModel.countDocuments(filter),
    ]);

    return createPaginatedResult(data, total, page, limit);
  }

  async findById(id: string): Promise<EventDocument> {
    const event = await this.eventModel
      .findById(id)
      .populate('branch', 'name')
      .populate('organizer', 'firstName lastName email phone')
      .populate('committee.member', 'firstName lastName email phone')
      .exec();

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  async findBySlug(slug: string): Promise<EventDocument> {
    const event = await this.eventModel
      .findOne({ registrationSlug: slug })
      .populate('branch', 'name')
      .populate('organizer', 'firstName lastName email')
      .exec();

    if (!event) {
      throw new NotFoundException(`Event with slug "${slug}" not found`);
    }

    return event;
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
  ): Promise<EventDocument> {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Validate dates if provided
    const startDate = updateEventDto.startDate
      ? new Date(updateEventDto.startDate)
      : event.startDate;
    const endDate = updateEventDto.endDate
      ? new Date(updateEventDto.endDate)
      : event.endDate;

    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Check slug uniqueness if changing
    if (
      updateEventDto.registrationSlug &&
      updateEventDto.registrationSlug !== event.registrationSlug
    ) {
      const existingSlug = await this.eventModel.findOne({
        registrationSlug: updateEventDto.registrationSlug,
        _id: { $ne: id },
      });
      if (existingSlug) {
        throw new ConflictException('Registration slug already in use');
      }
    }

    // Transform committee members if provided
    if (updateEventDto.committee) {
      (updateEventDto as any).committee = updateEventDto.committee.map((c) => ({
        member: new Types.ObjectId(c.member),
        role: c.role,
        assignedAt: new Date(),
      }));
    }

    // Generate API key if switching to 'api' integration mode
    if (updateEventDto.registrationSettings?.integrationMode === 'api') {
      if (!event.registrationSettings?.apiKey) {
        const regSettings = updateEventDto.registrationSettings || ({} as any);
        regSettings.apiKey = `evt_${randomBytes(24).toString('hex')}`;
        updateEventDto.registrationSettings = regSettings;
      }
    }
    // Strip client-provided apiKey when not in api mode
    if (
      updateEventDto.registrationSettings?.apiKey &&
      updateEventDto.registrationSettings?.integrationMode !== 'api'
    ) {
      delete updateEventDto.registrationSettings.apiKey;
    }

    // Transform ObjectId fields
    if (updateEventDto.organizer) {
      (updateEventDto as any).organizer = new Types.ObjectId(
        updateEventDto.organizer,
      );
    }
    if (updateEventDto.branch) {
      (updateEventDto as any).branch = new Types.ObjectId(updateEventDto.branch);
    }

    Object.assign(event, updateEventDto);
    return event.save();
  }

  async regenerateApiKey(eventId: string): Promise<{ apiKey: string }> {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }
    if (event.registrationSettings?.integrationMode !== 'api') {
      throw new BadRequestException('Event is not in API integration mode');
    }
    const apiKey = `evt_${randomBytes(24).toString('hex')}`;
    event.registrationSettings.apiKey = apiKey;
    await event.save();
    return { apiKey };
  }

  async remove(id: string): Promise<void> {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Delete all registrations for this event
    await this.registrationModel.deleteMany({ event: event._id });

    await this.eventModel.findByIdAndDelete(id);
  }

  // ========== COMMITTEE MANAGEMENT ==========

  async addCommitteeMember(
    eventId: string,
    dto: AddCommitteeMemberDto,
  ): Promise<EventDocument> {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Check if member is already in committee
    const existingMember = event.committee.find(
      (c) => c.member.toString() === dto.memberId,
    );
    if (existingMember) {
      throw new ConflictException('Member is already in the committee');
    }

    event.committee.push({
      member: new Types.ObjectId(dto.memberId),
      role: dto.role,
      assignedAt: new Date(),
    });

    return event.save();
  }

  async updateCommitteeMember(
    eventId: string,
    memberId: string,
    dto: UpdateCommitteeMemberDto,
  ): Promise<EventDocument> {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const memberIndex = event.committee.findIndex(
      (c) => c.member.toString() === memberId,
    );
    if (memberIndex === -1) {
      throw new NotFoundException('Member not found in committee');
    }

    event.committee[memberIndex].role = dto.role;
    return event.save();
  }

  async removeCommitteeMember(
    eventId: string,
    memberId: string,
  ): Promise<EventDocument> {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const memberIndex = event.committee.findIndex(
      (c) => c.member.toString() === memberId,
    );
    if (memberIndex === -1) {
      throw new NotFoundException('Member not found in committee');
    }

    event.committee.splice(memberIndex, 1);
    return event.save();
  }

  // ========== REGISTRATION MANAGEMENT ==========

  async getRegistrations(
    eventId: string,
    searchDto: RegistrationSearchDto,
  ): Promise<PaginatedResult<EventRegistrationDocument>> {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const { page = 1, limit = 10, search, status, attendeeType } = searchDto;

    const filter: FilterQuery<EventRegistrationDocument> = {
      event: event._id,
    };

    // Search by name or email
    if (search) {
      filter.$or = [
        { 'attendeeInfo.firstName': { $regex: search, $options: 'i' } },
        { 'attendeeInfo.lastName': { $regex: search, $options: 'i' } },
        { 'attendeeInfo.email': { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (attendeeType) {
      filter.attendeeType = attendeeType;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.registrationModel
        .find(filter)
        .populate('member', 'firstName lastName email phone')
        .sort({ registeredAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.registrationModel.countDocuments(filter),
    ]);

    return createPaginatedResult(data, total, page, limit);
  }

  async createRegistration(
    eventId: string,
    dto: CreateRegistrationDto,
  ): Promise<EventRegistrationDocument> {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Check if registration is open
    if (!event.registrationSettings?.isOpen) {
      throw new BadRequestException('Registration is closed for this event');
    }

    // Check registration deadline
    if (
      event.registrationSettings?.deadline &&
      new Date() > new Date(event.registrationSettings.deadline)
    ) {
      throw new BadRequestException('Registration deadline has passed');
    }

    // Check max attendees
    if (event.registrationSettings?.maxAttendees) {
      const currentCount = await this.registrationModel.countDocuments({
        event: event._id,
        status: { $in: [RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED] },
      });

      if (currentCount >= event.registrationSettings.maxAttendees) {
        if (event.registrationSettings.allowWaitlist) {
          dto.status = RegistrationStatus.WAITLISTED;
        } else {
          throw new BadRequestException('Event is at full capacity');
        }
      }
    }

    // Check for duplicate registration by member
    if (dto.memberId) {
      const existingReg = await this.registrationModel.findOne({
        event: event._id,
        member: new Types.ObjectId(dto.memberId),
      });
      if (existingReg) {
        throw new ConflictException('Member is already registered for this event');
      }
    }

    // Determine initial status
    let initialStatus = dto.status || RegistrationStatus.PENDING;
    if (
      event.registrationSettings?.requireApproval &&
      initialStatus === RegistrationStatus.PENDING
    ) {
      initialStatus = RegistrationStatus.PENDING;
    } else if (!event.registrationSettings?.requireApproval) {
      initialStatus = RegistrationStatus.CONFIRMED;
    }

    const registration = new this.registrationModel({
      event: event._id,
      branch: event.branch,
      member: dto.memberId ? new Types.ObjectId(dto.memberId) : undefined,
      attendeeType: dto.attendeeType,
      attendeeInfo: dto.attendeeInfo,
      status: initialStatus,
      customFieldResponses: dto.customFieldResponses
        ? new Map(Object.entries(dto.customFieldResponses))
        : new Map(),
      notes: dto.notes,
      registeredAt: new Date(),
      confirmedAt: initialStatus === RegistrationStatus.CONFIRMED ? new Date() : undefined,
    });

    const savedReg = await registration.save();

    // Update event counts
    await this.updateEventCounts(eventId);

    return savedReg;
  }

  async updateRegistrationStatus(
    eventId: string,
    registrationId: string,
    dto: UpdateRegistrationStatusDto,
  ): Promise<EventRegistrationDocument> {
    const registration = await this.registrationModel.findOne({
      _id: registrationId,
      event: new Types.ObjectId(eventId),
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    registration.status = dto.status;
    if (dto.notes) {
      registration.notes = dto.notes;
    }

    // Set appropriate timestamps
    if (dto.status === RegistrationStatus.CONFIRMED) {
      registration.confirmedAt = new Date();
    } else if (dto.status === RegistrationStatus.CANCELLED) {
      registration.cancelledAt = new Date();
    }

    const savedReg = await registration.save();

    // Update event counts
    await this.updateEventCounts(eventId);

    return savedReg;
  }

  async checkInAttendee(
    eventId: string,
    registrationId: string,
  ): Promise<EventRegistrationDocument> {
    const registration = await this.registrationModel.findOne({
      _id: registrationId,
      event: new Types.ObjectId(eventId),
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    if (registration.status === RegistrationStatus.CANCELLED) {
      throw new BadRequestException('Cannot check in a cancelled registration');
    }

    registration.status = RegistrationStatus.ATTENDED;
    registration.checkedInAt = new Date();

    const savedReg = await registration.save();

    // Update event counts
    await this.updateEventCounts(eventId);

    return savedReg;
  }

  async checkInByCode(
    eventId: string,
    checkInCode: string,
  ): Promise<EventRegistrationDocument> {
    const registration = await this.registrationModel.findOne({
      event: new Types.ObjectId(eventId),
      checkInCode,
    });

    if (!registration) {
      throw new NotFoundException('Registration not found with this check-in code');
    }

    return this.checkInAttendee(eventId, registration._id.toString());
  }

  // ========== PUBLIC REGISTRATION ==========

  async publicRegister(
    slug: string,
    dto: PublicRegistrationDto,
  ): Promise<EventRegistrationDocument> {
    const event = await this.findBySlug(slug);

    // Check if event is published
    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException('Event is not open for registration');
    }

    // Check if registration is open
    if (!event.registrationSettings?.isOpen) {
      throw new BadRequestException('Registration is closed for this event');
    }

    // Check registration deadline
    if (
      event.registrationSettings?.deadline &&
      new Date() > new Date(event.registrationSettings.deadline)
    ) {
      throw new BadRequestException('Registration deadline has passed');
    }

    // Check for duplicate by email or phone
    if (dto.email || dto.phone) {
      const duplicateFilter: any = {
        event: event._id,
        $or: [],
      };
      if (dto.email) {
        duplicateFilter.$or.push({
          'attendeeInfo.email': dto.email.toLowerCase(),
        });
      }
      if (dto.phone) {
        duplicateFilter.$or.push({ 'attendeeInfo.phone': dto.phone });
      }

      if (duplicateFilter.$or.length > 0) {
        const existing = await this.registrationModel.findOne(duplicateFilter);
        if (existing) {
          throw new ConflictException(
            'You are already registered for this event',
          );
        }
      }
    }

    // Check max attendees
    let initialStatus = RegistrationStatus.PENDING;
    if (event.registrationSettings?.maxAttendees) {
      const currentCount = await this.registrationModel.countDocuments({
        event: event._id,
        status: { $in: [RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED] },
      });

      if (currentCount >= event.registrationSettings.maxAttendees) {
        if (event.registrationSettings.allowWaitlist) {
          initialStatus = RegistrationStatus.WAITLISTED;
        } else {
          throw new BadRequestException('Event is at full capacity');
        }
      }
    }

    // Determine status based on approval requirement
    if (!event.registrationSettings?.requireApproval && initialStatus !== RegistrationStatus.WAITLISTED) {
      initialStatus = RegistrationStatus.CONFIRMED;
    }

    const registration = new this.registrationModel({
      event: event._id,
      branch: event.branch,
      attendeeType: AttendeeType.VISITOR,
      attendeeInfo: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        gender: dto.gender,
      },
      status: initialStatus,
      customFieldResponses: dto.customFieldResponses
        ? new Map(Object.entries(dto.customFieldResponses))
        : new Map(),
      registeredAt: new Date(),
      confirmedAt: initialStatus === RegistrationStatus.CONFIRMED ? new Date() : undefined,
    });

    const savedReg = await registration.save();

    // Update event counts
    await this.updateEventCounts(event._id.toString());

    // Queue confirmation email (fire-and-forget)
    if (dto.email) {
      this.emailQueue.add(JobType.EVENT_REGISTRATION_CONFIRMATION, {
        registrationId: savedReg._id.toString(),
        email: dto.email.toLowerCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        eventTitle: event.title,
        eventDate: event.startDate,
        eventLocation: event.location,
        checkInCode: savedReg.checkInCode,
        customFieldResponses: savedReg.customFieldResponses,
      }).catch((err) => {
        this.logger.error(`Failed to queue registration email for ${dto.email}: ${err.message}`);
      });
    }

    return savedReg;
  }

  // ========== HELPER METHODS ==========

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private async updateEventCounts(eventId: string): Promise<void> {
    const [registrationCount, confirmedCount, attendedCount] = await Promise.all([
      this.registrationModel.countDocuments({
        event: new Types.ObjectId(eventId),
        status: { $nin: [RegistrationStatus.CANCELLED] },
      }),
      this.registrationModel.countDocuments({
        event: new Types.ObjectId(eventId),
        status: RegistrationStatus.CONFIRMED,
      }),
      this.registrationModel.countDocuments({
        event: new Types.ObjectId(eventId),
        status: RegistrationStatus.ATTENDED,
      }),
    ]);

    await this.eventModel.findByIdAndUpdate(eventId, {
      registrationCount,
      confirmedCount,
      attendedCount,
    });
  }

  // Get event statistics
  async getEventStats(eventId: string): Promise<any> {
    const event = await this.findById(eventId);

    const [
      totalRegistrations,
      pendingCount,
      confirmedCount,
      waitlistedCount,
      attendedCount,
      cancelledCount,
      noShowCount,
      memberCount,
      visitorCount,
    ] = await Promise.all([
      this.registrationModel.countDocuments({ event: event._id }),
      this.registrationModel.countDocuments({
        event: event._id,
        status: RegistrationStatus.PENDING,
      }),
      this.registrationModel.countDocuments({
        event: event._id,
        status: RegistrationStatus.CONFIRMED,
      }),
      this.registrationModel.countDocuments({
        event: event._id,
        status: RegistrationStatus.WAITLISTED,
      }),
      this.registrationModel.countDocuments({
        event: event._id,
        status: RegistrationStatus.ATTENDED,
      }),
      this.registrationModel.countDocuments({
        event: event._id,
        status: RegistrationStatus.CANCELLED,
      }),
      this.registrationModel.countDocuments({
        event: event._id,
        status: RegistrationStatus.NO_SHOW,
      }),
      this.registrationModel.countDocuments({
        event: event._id,
        attendeeType: AttendeeType.MEMBER,
      }),
      this.registrationModel.countDocuments({
        event: event._id,
        attendeeType: AttendeeType.VISITOR,
      }),
    ]);

    return {
      totalRegistrations,
      byStatus: {
        pending: pendingCount,
        confirmed: confirmedCount,
        waitlisted: waitlistedCount,
        attended: attendedCount,
        cancelled: cancelledCount,
        noShow: noShowCount,
      },
      byType: {
        members: memberCount,
        visitors: visitorCount,
      },
      capacity: {
        max: event.registrationSettings?.maxAttendees || null,
        current: confirmedCount + pendingCount,
        available: event.registrationSettings?.maxAttendees
          ? event.registrationSettings.maxAttendees - (confirmedCount + pendingCount)
          : null,
      },
    };
  }

  // ========== SESSION MANAGEMENT ==========

  async createSession(dto: CreateSessionDto): Promise<EventSessionDocument> {
    const event = await this.eventModel.findById(dto.event);
    if (!event) {
      throw new NotFoundException(`Event with ID ${dto.event} not found`);
    }

    // Generate IDs for learning objectives and resources
    const learningObjectives = dto.learningObjectives?.map((obj, index) => ({
      ...obj,
      id: obj.id || `obj-${Date.now()}-${index}`,
    }));

    const resources = dto.resources?.map((res, index) => ({
      ...res,
      id: res.id || `res-${Date.now()}-${index}`,
    }));

    // Calculate duration if not provided
    let durationMinutes = dto.durationMinutes;
    if (!durationMinutes && dto.startTime && dto.endTime) {
      const [startH, startM] = dto.startTime.split(':').map(Number);
      const [endH, endM] = dto.endTime.split(':').map(Number);
      durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    }

    const session = new this.sessionModel({
      ...dto,
      event: event._id,
      branch: event.branch,
      learningObjectives,
      resources,
      durationMinutes,
      facilitators: dto.facilitators?.map(f => ({
        member: new Types.ObjectId(f.member),
        role: f.role,
      })),
    });

    const savedSession = await session.save();

    // Update event session count
    await this.updateEventSessionCount(event._id.toString());

    return savedSession;
  }

  async getSessions(
    eventId: string,
    searchDto: SessionSearchDto,
  ): Promise<PaginatedResult<EventSessionDocument>> {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const { page = 1, limit = 20, sessionType, status, dateFrom, dateTo, facilitator } = searchDto;

    const filter: FilterQuery<EventSessionDocument> = { event: event._id };

    if (sessionType) {
      filter.sessionType = sessionType;
    }

    if (status) {
      filter.status = status;
    }

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }

    if (facilitator) {
      filter['facilitators.member'] = new Types.ObjectId(facilitator);
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.sessionModel
        .find(filter)
        .populate('facilitators.member', 'firstName lastName email')
        .sort({ order: 1, date: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.sessionModel.countDocuments(filter),
    ]);

    return createPaginatedResult(data, total, page, limit);
  }

  async getSessionById(sessionId: string): Promise<EventSessionDocument> {
    const session = await this.sessionModel
      .findById(sessionId)
      .populate('event', 'title type status')
      .populate('facilitators.member', 'firstName lastName email phone')
      .exec();

    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    return session;
  }

  async updateSession(
    sessionId: string,
    dto: UpdateSessionDto,
  ): Promise<EventSessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    // Transform facilitators if provided
    if (dto.facilitators) {
      (dto as any).facilitators = dto.facilitators.map(f => ({
        member: new Types.ObjectId(f.member),
        role: f.role,
      }));
    }

    Object.assign(session, dto);
    const savedSession = await session.save();

    // Update counts if status changed to completed
    if (dto.status === SessionStatus.COMPLETED) {
      await this.updateEventSessionCount(session.event.toString());
    }

    return savedSession;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    // Delete all session attendance records
    await this.sessionAttendanceModel.deleteMany({ session: session._id });

    const eventId = session.event.toString();
    await this.sessionModel.findByIdAndDelete(sessionId);

    // Update event session count
    await this.updateEventSessionCount(eventId);
  }

  // ========== SESSION ATTENDANCE ==========

  async recordSessionAttendance(
    sessionId: string,
    dto: RecordSessionAttendanceDto,
  ): Promise<SessionAttendanceDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    const registration = await this.registrationModel.findById(dto.registrationId);
    if (!registration) {
      throw new NotFoundException(`Registration with ID ${dto.registrationId} not found`);
    }

    // Calculate late minutes if checking in
    let lateByMinutes = dto.lateByMinutes || 0;
    if (dto.checkInTime && session.startTime) {
      const checkIn = new Date(dto.checkInTime);
      const sessionDate = new Date(session.date);
      const [startH, startM] = session.startTime.split(':').map(Number);
      sessionDate.setHours(startH, startM, 0, 0);

      const diffMs = checkIn.getTime() - sessionDate.getTime();
      lateByMinutes = Math.max(0, Math.floor(diffMs / 60000));
    }

    // Determine status based on late arrival threshold
    let status = dto.status;
    if (
      status === SessionAttendanceStatus.PRESENT &&
      lateByMinutes > (session.attendanceConfig?.lateArrivalThresholdMinutes || 15)
    ) {
      status = SessionAttendanceStatus.LATE;
    }

    // Check if attendance record already exists
    let attendance = await this.sessionAttendanceModel.findOne({
      session: session._id,
      registration: registration._id,
    });

    if (attendance) {
      // Update existing record
      attendance.status = status;
      attendance.checkInTime = dto.checkInTime ? new Date(dto.checkInTime) : attendance.checkInTime;
      attendance.checkOutTime = dto.checkOutTime ? new Date(dto.checkOutTime) : attendance.checkOutTime;
      attendance.lateByMinutes = lateByMinutes;
      if (dto.facilitatorNotes) attendance.facilitatorNotes = dto.facilitatorNotes;
    } else {
      // Create new record
      attendance = new this.sessionAttendanceModel({
        event: session.event,
        session: session._id,
        registration: registration._id,
        branch: session.branch,
        member: registration.member,
        status,
        checkInTime: dto.checkInTime ? new Date(dto.checkInTime) : new Date(),
        checkOutTime: dto.checkOutTime ? new Date(dto.checkOutTime) : undefined,
        lateByMinutes,
        facilitatorNotes: dto.facilitatorNotes,
        recordedAt: new Date(),
      });
    }

    const savedAttendance = await attendance.save();

    // Update session attendance counts
    await this.updateSessionAttendanceCounts(sessionId);

    return savedAttendance;
  }

  async bulkRecordAttendance(
    sessionId: string,
    dto: BulkRecordAttendanceDto,
  ): Promise<SessionAttendanceDocument[]> {
    const results: SessionAttendanceDocument[] = [];

    for (const attendance of dto.attendances) {
      const result = await this.recordSessionAttendance(sessionId, attendance);
      results.push(result);
    }

    return results;
  }

  async recordAssessmentResult(
    sessionId: string,
    dto: RecordAssessmentResultDto,
  ): Promise<SessionAttendanceDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    if (!session.assessment?.hasAssessment) {
      throw new BadRequestException('This session does not have an assessment');
    }

    const attendance = await this.sessionAttendanceModel.findOne({
      session: session._id,
      registration: new Types.ObjectId(dto.registrationId),
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record not found for this registration');
    }

    const percentage = (dto.score / dto.maxScore) * 100;
    const passed = session.assessment.passingScore
      ? percentage >= session.assessment.passingScore
      : true;

    attendance.assessmentResult = {
      score: dto.score,
      maxScore: dto.maxScore,
      percentage,
      passed,
      attemptNumber: dto.attemptNumber || 1,
      submittedAt: new Date(),
      feedback: dto.feedback,
    };

    return attendance.save();
  }

  async getSessionAttendance(
    sessionId: string,
  ): Promise<SessionAttendanceDocument[]> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    return this.sessionAttendanceModel
      .find({ session: session._id })
      .populate('registration', 'attendeeInfo attendeeType checkInCode')
      .populate('member', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .exec();
  }

  // ========== ANALYTICS METHODS ==========

  async getOverviewStats(
    branchId: string,
    queryDto: EventAnalyticsQueryDto,
  ): Promise<EventOverviewStatsDto> {
    const filter: FilterQuery<EventDocument> = {
      branch: new Types.ObjectId(branchId),
    };

    if (queryDto.startDate || queryDto.endDate) {
      filter.startDate = {};
      if (queryDto.startDate) filter.startDate.$gte = new Date(queryDto.startDate);
      if (queryDto.endDate) filter.startDate.$lte = new Date(queryDto.endDate);
    }

    if (queryDto.eventType) {
      filter.type = queryDto.eventType;
    }

    const now = new Date();

    const [
      totalEvents,
      publishedEvents,
      completedEvents,
      upcomingEvents,
      totalTrainingEvents,
      totalCertificationsIssued,
    ] = await Promise.all([
      this.eventModel.countDocuments(filter),
      this.eventModel.countDocuments({ ...filter, status: EventStatus.PUBLISHED }),
      this.eventModel.countDocuments({ ...filter, status: EventStatus.COMPLETED }),
      this.eventModel.countDocuments({ ...filter, startDate: { $gt: now } }),
      this.eventModel.countDocuments({ ...filter, type: EventType.TRAINING }),
      this.eventModel.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$certifiedCount' } } },
      ]).then(r => r[0]?.total || 0),
    ]);

    // Get registration and attendance totals
    const eventIds = await this.eventModel.find(filter).distinct('_id');

    const [totalRegistrations, totalAttendees] = await Promise.all([
      this.registrationModel.countDocuments({
        event: { $in: eventIds },
        status: { $nin: [RegistrationStatus.CANCELLED] },
      }),
      this.registrationModel.countDocuments({
        event: { $in: eventIds },
        status: RegistrationStatus.ATTENDED,
      }),
    ]);

    const averageAttendanceRate = totalRegistrations > 0
      ? Math.round((totalAttendees / totalRegistrations) * 100)
      : 0;

    return {
      totalEvents,
      publishedEvents,
      completedEvents,
      upcomingEvents,
      totalRegistrations,
      totalAttendees,
      averageAttendanceRate,
      totalTrainingEvents,
      totalCertificationsIssued,
    };
  }

  async getEventAnalytics(eventId: string): Promise<FullEventAnalyticsDto> {
    const event = await this.findById(eventId);

    const registrations = await this.getRegistrationAnalytics(eventId);

    let sessions: SessionAnalyticsDto | undefined;
    let completion: TrainingCompletionSummaryDto | undefined;
    let attendeeProgress: AttendeeProgressDto[] | undefined;

    // Only get session/training analytics for training events
    if (event.type === EventType.TRAINING && event.trainingConfig?.hasMultipleSessions) {
      sessions = await this.getSessionAnalytics(eventId);
      completion = await this.getTrainingCompletionSummary(eventId);
      attendeeProgress = await this.getAttendeeProgress(eventId);
    }

    return {
      eventId: event._id.toString(),
      eventTitle: event.title,
      eventType: event.type,
      status: event.status,
      registrations,
      sessions,
      completion,
      attendeeProgress,
    };
  }

  async getRegistrationAnalytics(eventId: string): Promise<RegistrationAnalyticsDto> {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const [
      totalRegistrations,
      confirmedRegistrations,
      pendingRegistrations,
      cancelledRegistrations,
      waitlistedRegistrations,
      attendedRegistrations,
      noShowRegistrations,
      memberRegistrations,
      visitorRegistrations,
    ] = await Promise.all([
      this.registrationModel.countDocuments({ event: event._id }),
      this.registrationModel.countDocuments({ event: event._id, status: RegistrationStatus.CONFIRMED }),
      this.registrationModel.countDocuments({ event: event._id, status: RegistrationStatus.PENDING }),
      this.registrationModel.countDocuments({ event: event._id, status: RegistrationStatus.CANCELLED }),
      this.registrationModel.countDocuments({ event: event._id, status: RegistrationStatus.WAITLISTED }),
      this.registrationModel.countDocuments({ event: event._id, status: RegistrationStatus.ATTENDED }),
      this.registrationModel.countDocuments({ event: event._id, status: RegistrationStatus.NO_SHOW }),
      this.registrationModel.countDocuments({ event: event._id, attendeeType: AttendeeType.MEMBER }),
      this.registrationModel.countDocuments({ event: event._id, attendeeType: AttendeeType.VISITOR }),
    ]);

    // Get registrations by day
    const registrationsByDay = await this.registrationModel.aggregate([
      { $match: { event: event._id } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } },
    ]);

    const activeRegistrations = confirmedRegistrations + pendingRegistrations;
    const conversionRate = activeRegistrations > 0
      ? Math.round((attendedRegistrations / activeRegistrations) * 100)
      : 0;

    return {
      totalRegistrations,
      confirmedRegistrations,
      pendingRegistrations,
      cancelledRegistrations,
      waitlistedRegistrations,
      attendedRegistrations,
      noShowRegistrations,
      memberRegistrations,
      visitorRegistrations,
      conversionRate,
      registrationsByDay,
      registrationsBySource: [], // Can be enhanced with source tracking
    };
  }

  async getSessionAnalytics(eventId: string): Promise<SessionAnalyticsDto> {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const sessions = await this.sessionModel.find({ event: event._id });
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === SessionStatus.COMPLETED).length;
    const upcomingSessions = sessions.filter(s => s.status === SessionStatus.SCHEDULED).length;

    // Get attendance data per session
    const attendanceBySession = await Promise.all(
      sessions.map(async (session) => {
        const [present, late, absent, excused] = await Promise.all([
          this.sessionAttendanceModel.countDocuments({
            session: session._id,
            status: SessionAttendanceStatus.PRESENT,
          }),
          this.sessionAttendanceModel.countDocuments({
            session: session._id,
            status: SessionAttendanceStatus.LATE,
          }),
          this.sessionAttendanceModel.countDocuments({
            session: session._id,
            status: SessionAttendanceStatus.ABSENT,
          }),
          this.sessionAttendanceModel.countDocuments({
            session: session._id,
            status: SessionAttendanceStatus.EXCUSED,
          }),
        ]);

        const total = present + late + absent + excused;
        const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

        return {
          sessionId: session._id.toString(),
          sessionTitle: session.title,
          date: session.date.toISOString(),
          present,
          late,
          absent,
          excused,
          attendanceRate,
        };
      }),
    );

    // Calculate averages
    const totalAttendanceRates = attendanceBySession.reduce((sum, s) => sum + s.attendanceRate, 0);
    const averageAttendancePerSession = totalSessions > 0
      ? Math.round(totalAttendanceRates / totalSessions)
      : 0;

    const totalLateCount = attendanceBySession.reduce((sum, s) => sum + s.late, 0);
    const totalAttendeeCount = attendanceBySession.reduce(
      (sum, s) => sum + s.present + s.late + s.absent + s.excused,
      0,
    );
    const averageLateArrivalPercentage = totalAttendeeCount > 0
      ? Math.round((totalLateCount / totalAttendeeCount) * 100)
      : 0;

    // Get assessment results for sessions with assessments
    const sessionsWithAssessment = sessions.filter(s => s.assessment?.hasAssessment);
    const assessmentResults = await Promise.all(
      sessionsWithAssessment.map(async (session) => {
        const results = await this.sessionAttendanceModel.find({
          session: session._id,
          'assessmentResult.score': { $exists: true },
        });

        const totalAttempts = results.length;
        const passed = results.filter(r => r.assessmentResult?.passed).length;
        const avgScore = totalAttempts > 0
          ? results.reduce((sum, r) => sum + (r.assessmentResult?.percentage || 0), 0) / totalAttempts
          : 0;

        return {
          sessionId: session._id.toString(),
          sessionTitle: session.title,
          averageScore: Math.round(avgScore),
          passRate: totalAttempts > 0 ? Math.round((passed / totalAttempts) * 100) : 0,
          totalAttempts,
        };
      }),
    );

    return {
      totalSessions,
      completedSessions,
      upcomingSessions,
      averageAttendancePerSession,
      averageLateArrivalPercentage,
      attendanceBySession,
      assessmentResults,
    };
  }

  async getTrainingCompletionSummary(eventId: string): Promise<TrainingCompletionSummaryDto> {
    const event = await this.findById(eventId);

    const registrations = await this.registrationModel.find({
      event: event._id,
      status: { $nin: [RegistrationStatus.CANCELLED] },
    });

    const totalEnrolled = registrations.length;
    const sessions = await this.sessionModel.find({ event: event._id });
    const totalRequiredSessions = event.trainingConfig?.requireAllSessions
      ? sessions.length
      : Math.ceil(sessions.length * (event.trainingConfig?.minimumAttendancePercentage || 80) / 100);

    let totalCompleted = 0;
    let totalCertified = 0;
    let totalInProgress = 0;
    let totalDropped = 0;

    for (const registration of registrations) {
      const attendanceRecords = await this.sessionAttendanceModel.find({
        registration: registration._id,
        status: { $in: [SessionAttendanceStatus.PRESENT, SessionAttendanceStatus.LATE] },
      });

      const sessionsAttended = attendanceRecords.length;
      const attendancePercentage = sessions.length > 0
        ? (sessionsAttended / sessions.length) * 100
        : 0;

      if (attendancePercentage >= (event.trainingConfig?.minimumAttendancePercentage || 80)) {
        totalCompleted++;
        // Check certification (simplified - can be enhanced)
        if (event.trainingConfig?.hasCertification) {
          totalCertified++;
        }
      } else if (registration.status === RegistrationStatus.NO_SHOW) {
        totalDropped++;
      } else {
        totalInProgress++;
      }
    }

    const completionRate = totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0;
    const certificationRate = totalEnrolled > 0 ? Math.round((totalCertified / totalEnrolled) * 100) : 0;

    return {
      totalEnrolled,
      totalCompleted,
      totalCertified,
      totalInProgress,
      totalDropped,
      completionRate,
      certificationRate,
      averageCompletionTime: 0, // Would need tracking of completion dates
      completionByRequirement: [], // Can be enhanced with requirement tracking
    };
  }

  async getAttendeeProgress(eventId: string): Promise<AttendeeProgressDto[]> {
    const event = await this.findById(eventId);

    const registrations = await this.registrationModel.find({
      event: event._id,
      status: { $nin: [RegistrationStatus.CANCELLED] },
    }).populate('member', 'firstName lastName email');

    const sessions = await this.sessionModel.find({ event: event._id });
    const totalSessionsRequired = sessions.length;

    // Count total learning objectives across all sessions
    const totalObjectives = sessions.reduce(
      (sum, s) => sum + (s.learningObjectives?.length || 0),
      0,
    );

    const progressList: AttendeeProgressDto[] = [];

    for (const registration of registrations) {
      const attendanceRecords = await this.sessionAttendanceModel
        .find({ registration: registration._id })
        .populate('session', 'title date');

      const sessionsAttended = attendanceRecords.filter(
        a => a.status === SessionAttendanceStatus.PRESENT || a.status === SessionAttendanceStatus.LATE,
      ).length;

      const assessmentScores = attendanceRecords
        .filter(a => a.assessmentResult?.score !== undefined)
        .map(a => a.assessmentResult!);

      const avgScore = assessmentScores.length > 0
        ? assessmentScores.reduce((sum, a) => sum + a.percentage, 0) / assessmentScores.length
        : 0;

      const assessmentsPassed = assessmentScores.filter(a => a.passed).length;
      const assessmentsFailed = assessmentScores.filter(a => !a.passed).length;

      const objectivesCompleted = attendanceRecords.reduce(
        (sum, a) => sum + (a.objectivesCompletion?.filter(o => o.completed).length || 0),
        0,
      );

      const attendancePercentage = totalSessionsRequired > 0
        ? Math.round((sessionsAttended / totalSessionsRequired) * 100)
        : 0;

      const overallProgress = Math.round(
        (attendancePercentage * 0.6) + // 60% weight for attendance
        (avgScore * 0.4), // 40% weight for assessments
      );

      const isCompleted = attendancePercentage >= (event.trainingConfig?.minimumAttendancePercentage || 80);
      const isCertified = isCompleted && event.trainingConfig?.hasCertification;

      const attendeeName = registration.member
        ? `${(registration.member as any).firstName} ${(registration.member as any).lastName}`
        : `${registration.attendeeInfo.firstName} ${registration.attendeeInfo.lastName}`;

      const attendeeEmail = registration.member
        ? (registration.member as any).email
        : registration.attendeeInfo.email;

      progressList.push({
        registrationId: registration._id.toString(),
        attendeeName,
        attendeeEmail: attendeeEmail || '',
        attendeeType: registration.attendeeType,
        memberId: registration.member?.toString(),
        totalSessionsAttended: sessionsAttended,
        totalSessionsRequired,
        attendancePercentage,
        averageAssessmentScore: Math.round(avgScore),
        assessmentsPassed,
        assessmentsFailed,
        objectivesCompleted,
        totalObjectives,
        overallProgress,
        isCompleted,
        isCertified: isCertified || false,
        sessionDetails: attendanceRecords.map(a => ({
          sessionId: a.session.toString(),
          sessionTitle: (a.session as any)?.title || '',
          date: a.checkInTime?.toISOString() || '',
          status: a.status,
          assessmentScore: a.assessmentResult?.score,
          assessmentPassed: a.assessmentResult?.passed,
        })),
      });
    }

    return progressList;
  }

  // ========== PRIVATE HELPER METHODS ==========

  private async updateEventSessionCount(eventId: string): Promise<void> {
    const [sessionCount, completedSessionCount] = await Promise.all([
      this.sessionModel.countDocuments({ event: new Types.ObjectId(eventId) }),
      this.sessionModel.countDocuments({
        event: new Types.ObjectId(eventId),
        status: SessionStatus.COMPLETED,
      }),
    ]);

    await this.eventModel.findByIdAndUpdate(eventId, {
      sessionCount,
      completedSessionCount,
    });
  }

  private async updateSessionAttendanceCounts(sessionId: string): Promise<void> {
    const [attendanceCount, lateCount, absentCount] = await Promise.all([
      this.sessionAttendanceModel.countDocuments({
        session: new Types.ObjectId(sessionId),
        status: SessionAttendanceStatus.PRESENT,
      }),
      this.sessionAttendanceModel.countDocuments({
        session: new Types.ObjectId(sessionId),
        status: SessionAttendanceStatus.LATE,
      }),
      this.sessionAttendanceModel.countDocuments({
        session: new Types.ObjectId(sessionId),
        status: SessionAttendanceStatus.ABSENT,
      }),
    ]);

    await this.sessionModel.findByIdAndUpdate(sessionId, {
      attendanceCount,
      lateCount,
      absentCount,
    });
  }

  // ========== ENHANCED ANALYTICS METHODS ==========

  async getAttendanceTrends(
    branchId: string,
    queryDto: TrendAnalyticsQueryDto,
  ): Promise<AttendanceTrendDto> {
    const { startDate, endDate, period = 'weekly', eventType } = queryDto;

    const filter: FilterQuery<EventDocument> = {
      branch: new Types.ObjectId(branchId),
    };

    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    if (eventType) {
      filter.type = eventType;
    }

    // Get events in range
    const events = await this.eventModel.find(filter).sort({ startDate: 1 });
    const eventIds = events.map(e => e._id);

    // Get all registrations for these events
    const registrations = await this.registrationModel.find({
      event: { $in: eventIds },
    });

    // Group by period
    const groupedTrends: Map<string, { registrations: number; attendees: number; noShows: number }> = new Map();

    for (const event of events) {
      let periodKey: string;
      const eventDate = new Date(event.startDate);

      if (period === 'daily') {
        periodKey = eventDate.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const weekStart = new Date(eventDate);
        weekStart.setDate(eventDate.getDate() - eventDate.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
      } else {
        periodKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!groupedTrends.has(periodKey)) {
        groupedTrends.set(periodKey, { registrations: 0, attendees: 0, noShows: 0 });
      }

      const eventRegs = registrations.filter(r => r.event.toString() === event._id.toString());
      const current = groupedTrends.get(periodKey)!;

      current.registrations += eventRegs.filter(r => r.status !== RegistrationStatus.CANCELLED).length;
      current.attendees += eventRegs.filter(r => r.status === RegistrationStatus.ATTENDED).length;
      current.noShows += eventRegs.filter(r => r.status === RegistrationStatus.NO_SHOW).length;
    }

    const trends = Array.from(groupedTrends.entries()).map(([date, data]) => ({
      date,
      registrations: data.registrations,
      attendees: data.attendees,
      noShows: data.noShows,
      attendanceRate: data.registrations > 0
        ? Math.round((data.attendees / data.registrations) * 100)
        : 0,
    }));

    // Calculate summary stats
    const totalAttendees = trends.reduce((sum, t) => sum + t.attendees, 0);
    const totalRegistrations = trends.reduce((sum, t) => sum + t.registrations, 0);
    const averageAttendanceRate = totalRegistrations > 0
      ? Math.round((totalAttendees / totalRegistrations) * 100)
      : 0;

    const peakTrend = trends.reduce((max, t) => t.attendees > max.attendees ? t : max, trends[0] || { date: '', attendees: 0 });
    const lowestTrend = trends.reduce((min, t) => t.attendees < min.attendees ? t : min, trends[0] || { date: '', attendees: 0 });

    // Calculate growth rate (first vs last period)
    let growthRate = 0;
    if (trends.length >= 2) {
      const first = trends[0].attendees;
      const last = trends[trends.length - 1].attendees;
      growthRate = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
    }

    return {
      period,
      trends,
      averageAttendanceRate,
      peakAttendanceDate: peakTrend?.date || '',
      peakAttendanceCount: peakTrend?.attendees || 0,
      lowestAttendanceDate: lowestTrend?.date || '',
      lowestAttendanceCount: lowestTrend?.attendees || 0,
      growthRate,
    };
  }

  async getRegistrationFunnel(eventId: string): Promise<RegistrationFunnelDto> {
    const event = await this.findById(eventId);

    const registrations = await this.registrationModel.find({ event: event._id });

    // Calculate funnel stages
    const total = registrations.length;
    const confirmed = registrations.filter(r =>
      [RegistrationStatus.CONFIRMED, RegistrationStatus.ATTENDED].includes(r.status)
    ).length;
    const attended = registrations.filter(r => r.status === RegistrationStatus.ATTENDED).length;
    const cancelled = registrations.filter(r => r.status === RegistrationStatus.CANCELLED).length;
    const waitlisted = registrations.filter(r => r.status === RegistrationStatus.WAITLISTED).length;
    const noShow = registrations.filter(r => r.status === RegistrationStatus.NO_SHOW).length;

    const stages = [
      {
        stage: 'Registered',
        count: total,
        percentage: 100,
        dropOffRate: 0,
      },
      {
        stage: 'Confirmed',
        count: confirmed,
        percentage: total > 0 ? Math.round((confirmed / total) * 100) : 0,
        dropOffRate: total > 0 ? Math.round(((total - confirmed - waitlisted) / total) * 100) : 0,
      },
      {
        stage: 'Attended',
        count: attended,
        percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
        dropOffRate: confirmed > 0 ? Math.round(((confirmed - attended) / confirmed) * 100) : 0,
      },
    ];

    // Calculate time metrics
    const confirmedRegs = registrations.filter(r => r.confirmedAt);
    const avgTimeToConfirmation = confirmedRegs.length > 0
      ? confirmedRegs.reduce((sum, r) => {
          const diff = new Date(r.confirmedAt!).getTime() - new Date(r.registeredAt).getTime();
          return sum + diff;
        }, 0) / confirmedRegs.length / (1000 * 60 * 60) // Convert to hours
      : 0;

    const checkedInRegs = registrations.filter(r => r.checkedInAt);
    const avgTimeToCheckIn = checkedInRegs.length > 0
      ? checkedInRegs.reduce((sum, r) => {
          const diff = new Date(r.checkedInAt!).getTime() - new Date(r.registeredAt).getTime();
          return sum + diff;
        }, 0) / checkedInRegs.length / (1000 * 60 * 60) // Convert to hours
      : 0;

    // Find peak registration patterns
    const hourCounts = new Map<number, number>();
    const dayCounts = new Map<string, number>();

    for (const reg of registrations) {
      const date = new Date(reg.registeredAt);
      const hour = date.getHours();
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      dayCounts.set(dayOfWeek, (dayCounts.get(dayOfWeek) || 0) + 1);
    }

    let peakHour = 0;
    let peakHourCount = 0;
    hourCounts.forEach((count, hour) => {
      if (count > peakHourCount) {
        peakHour = hour;
        peakHourCount = count;
      }
    });

    let peakDay = 'Monday';
    let peakDayCount = 0;
    dayCounts.forEach((count, day) => {
      if (count > peakDayCount) {
        peakDay = day;
        peakDayCount = count;
      }
    });

    return {
      eventId: event._id.toString(),
      stages,
      overallConversionRate: total > 0 ? Math.round((attended / total) * 100) : 0,
      averageTimeToConfirmation: Math.round(avgTimeToConfirmation * 10) / 10,
      averageTimeToCheckIn: Math.round(avgTimeToCheckIn * 10) / 10,
      peakRegistrationHour: peakHour,
      peakRegistrationDay: peakDay,
    };
  }

  async getCheckInAnalytics(eventId: string): Promise<CheckInAnalyticsDto> {
    const event = await this.findById(eventId);

    const registrations = await this.registrationModel.find({
      event: event._id,
      checkedInAt: { $exists: true },
    });

    const totalCheckIns = registrations.length;

    // Group check-ins by time
    const timelineCounts = new Map<string, number>();
    const hourCounts = new Map<number, number>();

    for (const reg of registrations) {
      if (reg.checkedInAt) {
        const date = new Date(reg.checkedInAt);
        const timeKey = `${String(date.getHours()).padStart(2, '0')}:${String(Math.floor(date.getMinutes() / 15) * 15).padStart(2, '0')}`;
        timelineCounts.set(timeKey, (timelineCounts.get(timeKey) || 0) + 1);
        hourCounts.set(date.getHours(), (hourCounts.get(date.getHours()) || 0) + 1);
      }
    }

    // Calculate peak hour
    let peakHour = 0;
    let peakCount = 0;
    hourCounts.forEach((count, hour) => {
      if (count > peakCount) {
        peakHour = hour;
        peakCount = count;
      }
    });

    // Calculate average check-in time
    const totalMinutes = registrations.reduce((sum, r) => {
      if (r.checkedInAt) {
        const date = new Date(r.checkedInAt);
        return sum + date.getHours() * 60 + date.getMinutes();
      }
      return sum;
    }, 0);
    const avgMinutes = totalCheckIns > 0 ? Math.round(totalMinutes / totalCheckIns) : 0;
    const avgHours = Math.floor(avgMinutes / 60);
    const avgMins = avgMinutes % 60;
    const averageCheckInTime = `${String(avgHours).padStart(2, '0')}:${String(avgMins).padStart(2, '0')}`;

    // Calculate early/on-time/late (relative to event start)
    const eventStart = new Date(event.startDate);
    if (event.startTime) {
      const [h, m] = event.startTime.split(':').map(Number);
      eventStart.setHours(h, m, 0, 0);
    }

    let earlyCheckIns = 0;
    let onTimeCheckIns = 0;
    let lateCheckIns = 0;

    for (const reg of registrations) {
      if (reg.checkedInAt) {
        const checkInTime = new Date(reg.checkedInAt);
        const diffMinutes = (checkInTime.getTime() - eventStart.getTime()) / (1000 * 60);

        if (diffMinutes < -30) {
          earlyCheckIns++;
        } else if (diffMinutes <= 15) {
          onTimeCheckIns++;
        } else {
          lateCheckIns++;
        }
      }
    }

    // Build timeline
    const checkInTimeline = Array.from(timelineCounts.entries())
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => a.time.localeCompare(b.time));

    return {
      totalCheckIns,
      checkInsByMethod: [
        { method: 'manual', count: totalCheckIns }, // Default - enhance with actual tracking
        { method: 'qr_code', count: 0 },
      ],
      averageCheckInTime,
      peakCheckInHour: peakHour,
      checkInTimeline,
      earlyCheckIns,
      onTimeCheckIns,
      lateCheckIns,
      checkedInByCommittee: [], // Can be enhanced with committee tracking
    };
  }

  async getCommitteeAnalytics(eventId: string): Promise<EventCommitteeAnalyticsDto> {
    const event = await this.findById(eventId);

    const committeeMembers = event.committee || [];
    const totalCommitteeMembers = committeeMembers.length;

    // Count roles distribution
    const rolesCount = new Map<string, number>();
    for (const member of committeeMembers) {
      rolesCount.set(member.role, (rolesCount.get(member.role) || 0) + 1);
    }

    const rolesDistribution = Array.from(rolesCount.entries()).map(([role, count]) => ({
      role,
      count,
    }));

    // Build member performance data
    const memberPerformance: CommitteeMemberPerformanceDto[] = committeeMembers.map(cm => {
      const member = cm.member as any;
      return {
        memberId: cm.member.toString(),
        memberName: member?.firstName && member?.lastName
          ? `${member.firstName} ${member.lastName}`
          : 'Unknown',
        role: cm.role,
        assignedAt: cm.assignedAt,
        eventsAssigned: 1, // Current event
        tasksCompleted: 0, // Can be enhanced with task tracking
        tasksTotal: 0,
        checkInsPerformed: 0, // Can be enhanced with audit log analysis
        registrationsProcessed: 0,
        lastActivityDate: cm.assignedAt,
        performanceScore: 85, // Default score - can be calculated
      };
    });

    return {
      totalCommitteeMembers,
      rolesDistribution,
      totalCheckInsPerformed: 0, // Can be enhanced
      totalRegistrationsProcessed: 0, // Can be enhanced
      memberPerformance,
    };
  }

  async getMemberEngagementAnalytics(
    branchId: string,
    queryDto: EventAnalyticsQueryDto,
  ): Promise<MemberEngagementAnalyticsDto> {
    const filter: FilterQuery<EventDocument> = {
      branch: new Types.ObjectId(branchId),
    };

    if (queryDto.startDate || queryDto.endDate) {
      filter.startDate = {};
      if (queryDto.startDate) filter.startDate.$gte = new Date(queryDto.startDate);
      if (queryDto.endDate) filter.startDate.$lte = new Date(queryDto.endDate);
    }

    const events = await this.eventModel.find(filter);
    const eventIds = events.map(e => e._id);

    // Get all attended registrations
    const attendedRegs = await this.registrationModel.find({
      event: { $in: eventIds },
      status: RegistrationStatus.ATTENDED,
      member: { $exists: true },
    }).populate('member', 'firstName lastName email');

    // Calculate unique and repeat attendees
    const memberAttendance = new Map<string, { name: string; count: number; sessions: number }>();

    for (const reg of attendedRegs) {
      if (reg.member) {
        const memberId = reg.member.toString();
        const member = reg.member as any;
        const name = member?.firstName && member?.lastName
          ? `${member.firstName} ${member.lastName}`
          : 'Unknown';

        if (!memberAttendance.has(memberId)) {
          memberAttendance.set(memberId, { name, count: 0, sessions: 0 });
        }
        const current = memberAttendance.get(memberId)!;
        current.count++;
      }
    }

    const totalUniqueAttendees = memberAttendance.size;
    const repeatAttendees = Array.from(memberAttendance.values()).filter(m => m.count > 1).length;
    const firstTimeAttendees = totalUniqueAttendees - repeatAttendees;

    // Top attendees
    const topAttendees = Array.from(memberAttendance.entries())
      .map(([memberId, data]) => ({
        memberId,
        memberName: data.name,
        eventsAttended: data.count,
        totalSessions: 0,
        averageAttendanceRate: 100,
      }))
      .sort((a, b) => b.eventsAttended - a.eventsAttended)
      .slice(0, 10);

    // Attendees by event type
    const typeAttendance = new Map<string, { unique: Set<string>; total: number }>();
    for (const event of events) {
      const eventRegs = attendedRegs.filter(r => r.event.toString() === event._id.toString());

      if (!typeAttendance.has(event.type)) {
        typeAttendance.set(event.type, { unique: new Set(), total: 0 });
      }

      const current = typeAttendance.get(event.type)!;
      for (const reg of eventRegs) {
        if (reg.member) {
          current.unique.add(reg.member.toString());
          current.total++;
        }
      }
    }

    const attendeesByEventType = Array.from(typeAttendance.entries()).map(([type, data]) => ({
      eventType: type,
      uniqueAttendees: data.unique.size,
      totalAttendances: data.total,
    }));

    // Monthly engagement trend
    const monthlyTrend = new Map<string, { unique: Set<string>; total: number; new: Set<string> }>();
    const allTimeMembers = new Set<string>();

    for (const reg of attendedRegs.sort((a, b) =>
      new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime()
    )) {
      if (reg.member) {
        const date = new Date(reg.registeredAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const memberId = reg.member.toString();

        if (!monthlyTrend.has(monthKey)) {
          monthlyTrend.set(monthKey, { unique: new Set(), total: 0, new: new Set() });
        }

        const current = monthlyTrend.get(monthKey)!;
        current.unique.add(memberId);
        current.total++;

        if (!allTimeMembers.has(memberId)) {
          current.new.add(memberId);
          allTimeMembers.add(memberId);
        }
      }
    }

    const engagementTrend = Array.from(monthlyTrend.entries())
      .map(([month, data]) => ({
        month,
        uniqueAttendees: data.unique.size,
        totalAttendances: data.total,
        newAttendees: data.new.size,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalUniqueAttendees,
      repeatAttendees,
      firstTimeAttendees,
      repeatAttendeeRate: totalUniqueAttendees > 0
        ? Math.round((repeatAttendees / totalUniqueAttendees) * 100)
        : 0,
      topAttendees,
      attendeesByEventType,
      engagementTrend,
    };
  }

  async getDashboardAnalytics(
    branchId: string,
    queryDto: EventAnalyticsQueryDto,
  ): Promise<EventsDashboardAnalyticsDto> {
    // Get overview stats
    const overview = await this.getOverviewStats(branchId, queryDto);

    // Get attendance trends
    const attendanceTrends = await this.getAttendanceTrends(branchId, {
      ...queryDto,
      period: 'weekly',
    });

    // Get member engagement
    const memberEngagement = await this.getMemberEngagementAnalytics(branchId, queryDto);

    // Get upcoming events
    const now = new Date();
    const upcomingEventsRaw = await this.eventModel.find({
      branch: new Types.ObjectId(branchId),
      startDate: { $gte: now },
      status: EventStatus.PUBLISHED,
    })
      .sort({ startDate: 1 })
      .limit(5);

    const upcomingEvents = upcomingEventsRaw.map(e => ({
      eventId: e._id.toString(),
      title: e.title,
      startDate: e.startDate,
      registrationCount: e.registrationCount || 0,
      capacity: e.registrationSettings?.maxAttendees,
      capacityPercentage: e.registrationSettings?.maxAttendees
        ? Math.round(((e.registrationCount || 0) / e.registrationSettings.maxAttendees) * 100)
        : undefined,
    }));

    // Get events by month
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const eventsForMonths = await this.eventModel.find({
      branch: new Types.ObjectId(branchId),
      startDate: { $gte: sixMonthsAgo },
    });

    const monthlyEvents = new Map<string, { total: number; completed: number; cancelled: number }>();
    for (const event of eventsForMonths) {
      const monthKey = `${event.startDate.getFullYear()}-${String(event.startDate.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyEvents.has(monthKey)) {
        monthlyEvents.set(monthKey, { total: 0, completed: 0, cancelled: 0 });
      }

      const current = monthlyEvents.get(monthKey)!;
      current.total++;
      if (event.status === EventStatus.COMPLETED) current.completed++;
      if (event.status === EventStatus.CANCELLED) current.cancelled++;
    }

    const eventsByMonth = Array.from(monthlyEvents.entries())
      .map(([month, data]) => ({
        month,
        total: data.total,
        completed: data.completed,
        cancelled: data.cancelled,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      overview,
      attendanceTrends,
      memberEngagement,
      upcomingEvents,
      recentActivity: [], // Can be enhanced with audit log integration
      eventsByMonth,
    };
  }

  // ========== PARTICIPANT ACCOUNTABILITY METHODS ==========

  async getParticipantAccountability(
    eventId: string,
    queryDto: ParticipantAccountabilityQueryDto,
  ): Promise<EventParticipantAccountabilitySummaryDto> {
    const event = await this.findById(eventId);

    const registrations = await this.registrationModel.find({
      event: event._id,
      status: { $nin: [RegistrationStatus.CANCELLED] },
    }).populate('member', 'firstName lastName email phone');

    const sessions = await this.sessionModel.find({ event: event._id });
    const totalSessionsRequired = sessions.length;

    const participants: ParticipantAccountabilityDto[] = [];
    let totalAttendanceSum = 0;
    let totalAssessmentSum = 0;
    let assessmentCount = 0;

    // Counters for summary
    let excellentAttendance = 0;
    let goodAttendance = 0;
    let needsImprovement = 0;
    let atRisk = 0;
    let failed = 0;
    let passingParticipants = 0;
    let failingParticipants = 0;
    let incompleteAssessments = 0;
    let eligibleForCertification = 0;
    let certified = 0;
    let activeParticipants = 0;
    let inactiveParticipants = 0;
    let droppedParticipants = 0;

    const alerts: { type: string; severity: string; count: number; participants: { id: string; name: string }[] }[] = [];
    const missedSessionsParticipants: { id: string; name: string }[] = [];
    const failingAssessmentParticipants: { id: string; name: string }[] = [];
    const atRiskParticipants: { id: string; name: string }[] = [];
    const inactiveList: { id: string; name: string }[] = [];

    for (const registration of registrations) {
      const member = registration.member as any;
      const participantName = member?.firstName && member?.lastName
        ? `${member.firstName} ${member.lastName}`
        : `${registration.attendeeInfo.firstName} ${registration.attendeeInfo.lastName}`;
      const participantEmail = member?.email || registration.attendeeInfo.email || '';
      const participantPhone = member?.phone || registration.attendeeInfo.phone;

      // Get attendance records
      const attendanceRecords = await this.sessionAttendanceModel.find({
        registration: registration._id,
      }).populate('session', 'title date');

      const sessionsAttended = attendanceRecords.filter(
        a => a.status === SessionAttendanceStatus.PRESENT || a.status === SessionAttendanceStatus.LATE
      ).length;
      const sessionsAbsent = attendanceRecords.filter(a => a.status === SessionAttendanceStatus.ABSENT).length;
      const sessionsExcused = attendanceRecords.filter(a => a.status === SessionAttendanceStatus.EXCUSED).length;
      const lateArrivals = attendanceRecords.filter(a => a.status === SessionAttendanceStatus.LATE).length;

      const attendancePercentage = totalSessionsRequired > 0
        ? Math.round((sessionsAttended / totalSessionsRequired) * 100)
        : 0;

      // Determine attendance status
      let attendanceStatus: string;
      if (attendancePercentage >= 90) {
        attendanceStatus = 'excellent';
        excellentAttendance++;
      } else if (attendancePercentage >= 75) {
        attendanceStatus = 'good';
        goodAttendance++;
      } else if (attendancePercentage >= 60) {
        attendanceStatus = 'needs_improvement';
        needsImprovement++;
      } else if (attendancePercentage >= 40) {
        attendanceStatus = 'at_risk';
        atRisk++;
        atRiskParticipants.push({ id: registration._id.toString(), name: participantName });
      } else {
        attendanceStatus = 'failed';
        failed++;
      }

      totalAttendanceSum += attendancePercentage;

      // Assessment data
      const assessmentResults = attendanceRecords.filter(a => a.assessmentResult?.score !== undefined);
      const totalAssessments = sessions.filter(s => s.assessment?.hasAssessment).length;
      const assessmentsCompleted = assessmentResults.length;
      const assessmentsPassed = assessmentResults.filter(a => a.assessmentResult?.passed).length;
      const assessmentsFailed = assessmentResults.filter(a => !a.assessmentResult?.passed).length;

      const avgAssessmentScore = assessmentsCompleted > 0
        ? assessmentResults.reduce((sum, a) => sum + (a.assessmentResult?.percentage || 0), 0) / assessmentsCompleted
        : 0;

      if (assessmentsCompleted > 0) {
        totalAssessmentSum += avgAssessmentScore;
        assessmentCount++;
      }

      // Assessment status
      let assessmentStatus: string;
      if (assessmentsCompleted === 0 && totalAssessments > 0) {
        assessmentStatus = 'incomplete';
        incompleteAssessments++;
      } else if (assessmentsFailed > 0) {
        assessmentStatus = 'failing';
        failingParticipants++;
        failingAssessmentParticipants.push({ id: registration._id.toString(), name: participantName });
      } else {
        assessmentStatus = 'passing';
        passingParticipants++;
      }

      // Completion and certification
      const completionPercentage = Math.round(
        (attendancePercentage * 0.6) + (avgAssessmentScore * 0.4)
      );
      const isEligibleForCertification = attendancePercentage >= (event.trainingConfig?.minimumAttendancePercentage || 80)
        && assessmentsFailed === 0;

      let certificationStatus: string;
      if (isEligibleForCertification && event.trainingConfig?.hasCertification) {
        certificationStatus = 'certified';
        certified++;
        eligibleForCertification++;
      } else if (completionPercentage >= 80) {
        certificationStatus = 'completed';
        eligibleForCertification++;
      } else if (sessionsAttended > 0) {
        certificationStatus = 'in_progress';
        activeParticipants++;
      } else {
        certificationStatus = 'not_started';
        if (registration.status === RegistrationStatus.NO_SHOW) {
          droppedParticipants++;
        } else {
          inactiveParticipants++;
          inactiveList.push({ id: registration._id.toString(), name: participantName });
        }
      }

      // Check for missed sessions
      if (sessionsAbsent > 0) {
        missedSessionsParticipants.push({ id: registration._id.toString(), name: participantName });
      }

      // Build session records
      const sessionRecords = attendanceRecords.map(a => ({
        sessionId: a.session.toString(),
        sessionTitle: (a.session as any)?.title || '',
        sessionDate: a.checkInTime || new Date(),
        attendanceStatus: a.status,
        checkInTime: a.checkInTime,
        checkOutTime: a.checkOutTime,
        lateByMinutes: a.lateByMinutes,
        assessmentScore: a.assessmentResult?.score,
        assessmentPassed: a.assessmentResult?.passed,
        facilitatorNotes: a.facilitatorNotes,
      }));

      // Calculate follow-up flags
      const requiresFollowUp = attendanceStatus === 'at_risk' || attendanceStatus === 'failed' || assessmentStatus === 'failing';
      let followUpReason: string | undefined;
      if (requiresFollowUp) {
        const reasons: string[] = [];
        if (attendanceStatus === 'at_risk' || attendanceStatus === 'failed') {
          reasons.push('Low attendance');
        }
        if (assessmentStatus === 'failing') {
          reasons.push('Failed assessments');
        }
        followUpReason = reasons.join(', ');
      }

      // Last activity
      const lastAttendance = attendanceRecords.sort((a, b) =>
        new Date(b.checkInTime || 0).getTime() - new Date(a.checkInTime || 0).getTime()
      )[0];
      const lastActivityDate = lastAttendance?.checkInTime || registration.registeredAt;
      const daysInactive = Math.floor((Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24));

      // Apply query filters
      if (queryDto.attendanceStatus && attendanceStatus !== queryDto.attendanceStatus) continue;
      if (queryDto.certificationStatus && certificationStatus !== queryDto.certificationStatus) continue;
      if (queryDto.requiresFollowUp && !requiresFollowUp) continue;
      if (queryDto.search) {
        const searchLower = queryDto.search.toLowerCase();
        if (!participantName.toLowerCase().includes(searchLower) &&
            !participantEmail.toLowerCase().includes(searchLower)) {
          continue;
        }
      }

      participants.push({
        registrationId: registration._id.toString(),
        participantId: registration.member?.toString(),
        participantName,
        participantEmail,
        participantPhone,
        participantType: registration.attendeeType,
        registrationDate: registration.registeredAt,
        registrationStatus: registration.status,
        totalSessionsRequired,
        sessionsAttended,
        sessionsAbsent,
        sessionsExcused,
        lateArrivals,
        attendancePercentage,
        attendanceStatus,
        totalAssessments,
        assessmentsCompleted,
        assessmentsPassed,
        assessmentsFailed,
        averageAssessmentScore: Math.round(avgAssessmentScore),
        assessmentStatus,
        completionPercentage,
        isEligibleForCertification,
        certificationStatus,
        sessionRecords,
        requiresFollowUp,
        followUpReason,
        lastActivityDate,
        daysInactive,
      });
    }

    // Build alerts
    if (missedSessionsParticipants.length > 0) {
      alerts.push({
        type: 'missed_sessions',
        severity: missedSessionsParticipants.length > 5 ? 'high' : 'medium',
        count: missedSessionsParticipants.length,
        participants: missedSessionsParticipants.slice(0, 5),
      });
    }
    if (failingAssessmentParticipants.length > 0) {
      alerts.push({
        type: 'failing_assessment',
        severity: 'high',
        count: failingAssessmentParticipants.length,
        participants: failingAssessmentParticipants.slice(0, 5),
      });
    }
    if (inactiveList.length > 0) {
      alerts.push({
        type: 'inactive',
        severity: 'medium',
        count: inactiveList.length,
        participants: inactiveList.slice(0, 5),
      });
    }
    if (atRiskParticipants.length > 0) {
      alerts.push({
        type: 'at_risk',
        severity: 'critical',
        count: atRiskParticipants.length,
        participants: atRiskParticipants.slice(0, 5),
      });
    }

    // Sort participants
    if (queryDto.sortBy) {
      const sortOrder = queryDto.sortOrder === 'desc' ? -1 : 1;
      participants.sort((a, b) => {
        switch (queryDto.sortBy) {
          case 'name': return a.participantName.localeCompare(b.participantName) * sortOrder;
          case 'attendance': return (a.attendancePercentage - b.attendancePercentage) * sortOrder;
          case 'progress': return (a.completionPercentage - b.completionPercentage) * sortOrder;
          case 'score': return (a.averageAssessmentScore - b.averageAssessmentScore) * sortOrder;
          case 'lastActivity': return (new Date(a.lastActivityDate || 0).getTime() - new Date(b.lastActivityDate || 0).getTime()) * sortOrder;
          default: return 0;
        }
      });
    }

    // Pagination
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 20;
    const paginatedParticipants = participants.slice((page - 1) * limit, page * limit);

    const totalParticipants = registrations.length;
    const averageAttendanceRate = totalParticipants > 0
      ? Math.round(totalAttendanceSum / totalParticipants)
      : 0;
    const averageAssessmentScore = assessmentCount > 0
      ? Math.round(totalAssessmentSum / assessmentCount)
      : 0;

    return {
      eventId: event._id.toString(),
      eventTitle: event.title,
      totalParticipants,
      activeParticipants,
      inactiveParticipants,
      droppedParticipants,
      averageAttendanceRate,
      excellentAttendance,
      goodAttendance,
      needsImprovement,
      atRisk,
      failed,
      averageAssessmentScore,
      passingParticipants,
      failingParticipants,
      incompleteAssessments,
      eligibleForCertification,
      certified,
      pendingCertification: eligibleForCertification - certified,
      certificationRate: totalParticipants > 0 ? Math.round((certified / totalParticipants) * 100) : 0,
      alerts,
      participants: paginatedParticipants,
    };
  }

  async getTrainingAccountabilityReport(
    eventId: string,
    queryDto: ParticipantAccountabilityQueryDto,
  ): Promise<TrainingAccountabilityReportDto> {
    const event = await this.findById(eventId);
    const accountability = await this.getParticipantAccountability(eventId, queryDto);

    const sessions = await this.sessionModel.find({ event: event._id }).sort({ order: 1 });

    // Build session breakdown
    const sessionBreakdown = await Promise.all(sessions.map(async (session) => {
      const attendances = await this.sessionAttendanceModel.find({ session: session._id });
      const expectedAttendees = accountability.totalParticipants;
      const actualAttendees = attendances.filter(
        a => a.status === SessionAttendanceStatus.PRESENT || a.status === SessionAttendanceStatus.LATE
      ).length;
      const lateArrivals = attendances.filter(a => a.status === SessionAttendanceStatus.LATE).length;
      const absences = attendances.filter(a => a.status === SessionAttendanceStatus.ABSENT).length;
      const excused = attendances.filter(a => a.status === SessionAttendanceStatus.EXCUSED).length;

      // Assessment data
      const assessmentResults = attendances.filter(a => a.assessmentResult?.score !== undefined);
      const assessmentAverage = assessmentResults.length > 0
        ? assessmentResults.reduce((sum, a) => sum + (a.assessmentResult?.percentage || 0), 0) / assessmentResults.length
        : undefined;
      const assessmentPassRate = assessmentResults.length > 0
        ? Math.round((assessmentResults.filter(a => a.assessmentResult?.passed).length / assessmentResults.length) * 100)
        : undefined;

      return {
        sessionId: session._id.toString(),
        sessionTitle: session.title,
        sessionDate: session.date,
        expectedAttendees,
        actualAttendees,
        attendanceRate: expectedAttendees > 0 ? Math.round((actualAttendees / expectedAttendees) * 100) : 0,
        lateArrivals,
        absences,
        excused,
        assessmentAverage: assessmentAverage ? Math.round(assessmentAverage) : undefined,
        assessmentPassRate,
      };
    }));

    // Participant status breakdown
    const statusGroups = {
      'excellent': accountability.participants.filter(p => p.attendanceStatus === 'excellent'),
      'good': accountability.participants.filter(p => p.attendanceStatus === 'good'),
      'needs_improvement': accountability.participants.filter(p => p.attendanceStatus === 'needs_improvement'),
      'at_risk': accountability.participants.filter(p => p.attendanceStatus === 'at_risk'),
      'failed': accountability.participants.filter(p => p.attendanceStatus === 'failed'),
    };

    const participantStatusBreakdown = Object.entries(statusGroups).map(([status, participants]) => ({
      status,
      count: participants.length,
      percentage: accountability.totalParticipants > 0
        ? Math.round((participants.length / accountability.totalParticipants) * 100)
        : 0,
      participants: participants.slice(0, 5).map(p => ({
        id: p.registrationId,
        name: p.participantName,
        email: p.participantEmail,
        progress: p.completionPercentage,
      })),
    }));

    // At-risk participants with detailed info
    const atRiskParticipants = accountability.participants
      .filter(p => p.attendanceStatus === 'at_risk' || p.attendanceStatus === 'failed' || p.assessmentStatus === 'failing')
      .map(p => {
        const riskFactors: string[] = [];
        let riskLevel: 'medium' | 'high' | 'critical' = 'medium';

        if (p.attendancePercentage < 40) {
          riskFactors.push('Very low attendance');
          riskLevel = 'critical';
        } else if (p.attendancePercentage < 60) {
          riskFactors.push('Low attendance');
          riskLevel = 'high';
        }

        if (p.assessmentsFailed > 0) {
          riskFactors.push(`${p.assessmentsFailed} failed assessment(s)`);
          if (riskLevel !== 'critical') riskLevel = 'high';
        }

        if (p.daysInactive && p.daysInactive > 14) {
          riskFactors.push(`Inactive for ${p.daysInactive} days`);
        }

        let recommendedAction = 'Monitor progress';
        if (riskLevel === 'critical') {
          recommendedAction = 'Immediate intervention required';
        } else if (riskLevel === 'high') {
          recommendedAction = 'Schedule one-on-one meeting';
        }

        return {
          registrationId: p.registrationId,
          participantName: p.participantName,
          participantEmail: p.participantEmail,
          riskLevel,
          riskFactors,
          currentProgress: p.completionPercentage,
          missedSessions: p.sessionsAbsent,
          failedAssessments: p.assessmentsFailed,
          recommendedAction,
        };
      })
      .sort((a, b) => {
        const levelOrder = { critical: 0, high: 1, medium: 2 };
        return levelOrder[a.riskLevel] - levelOrder[b.riskLevel];
      });

    // Top performers
    const topPerformers = accountability.participants
      .filter(p => p.attendanceStatus === 'excellent' || p.attendanceStatus === 'good')
      .sort((a, b) => {
        const scoreA = (a.attendancePercentage * 0.5) + (a.averageAssessmentScore * 0.5);
        const scoreB = (b.attendancePercentage * 0.5) + (b.averageAssessmentScore * 0.5);
        return scoreB - scoreA;
      })
      .slice(0, 10)
      .map(p => ({
        registrationId: p.registrationId,
        participantName: p.participantName,
        attendanceRate: p.attendancePercentage,
        assessmentAverage: p.averageAssessmentScore,
        overallScore: Math.round((p.attendancePercentage * 0.5) + (p.averageAssessmentScore * 0.5)),
      }));

    return {
      eventId: event._id.toString(),
      eventTitle: event.title,
      reportGeneratedAt: new Date(),
      totalEnrolled: accountability.totalParticipants,
      totalActive: accountability.activeParticipants,
      totalCompleted: accountability.certified + accountability.excellentAttendance,
      totalDropped: accountability.droppedParticipants,
      completionRate: accountability.certificationRate,
      averageProgress: Math.round(
        accountability.participants.reduce((sum, p) => sum + p.completionPercentage, 0) /
        (accountability.participants.length || 1)
      ),
      sessionBreakdown,
      participantStatusBreakdown,
      atRiskParticipants,
      topPerformers,
    };
  }

  // ========== PARTNERSHIP MANAGEMENT ==========

  /**
   * Submit partnership inquiry from public form
   */
  async submitPartnership(
    eventSlug: string,
    submitPartnerDto: SubmitPartnerDto,
  ): Promise<EventPartnerDocument> {
    // Find event by registrationSlug
    const event = await this.eventModel.findOne({ registrationSlug: eventSlug });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check if event accepts partnerships
    if (event.status === EventStatus.CANCELLED || event.status === EventStatus.COMPLETED) {
      throw new BadRequestException(
        `Event is ${event.status.toLowerCase()}. Partnership inquiries are not accepted.`
      );
    }

    // Check for duplicate email for this event
    const existing = await this.partnerModel.findOne({
      event: event._id,
      email: submitPartnerDto.email.toLowerCase(),
    });

    if (existing) {
      throw new ConflictException(
        'A partnership inquiry with this email already exists for this event'
      );
    }

    // Create partner record
    const partner = new this.partnerModel({
      event: event._id,
      branch: event.branch,
      name: submitPartnerDto.name,
      company: submitPartnerDto.company,
      email: submitPartnerDto.email.toLowerCase(),
      phone: submitPartnerDto.phone,
      interestDetails: submitPartnerDto.interestDetails,
      status: PartnerStatus.PENDING,
    });

    await partner.save();

    // Queue partner emails (fire-and-forget)
    Promise.all([
      this.emailQueue.add('partner-inquiry-confirmation', {
        partnerId: partner._id.toString(),
        partnerEmail: partner.email,
        partnerName: partner.name,
        eventTitle: event.title,
      }),
      this.emailQueue.add('partner-inquiry-notification', {
        partnerId: partner._id.toString(),
        partnerName: partner.name,
        partnerEmail: partner.email,
        partnerCompany: partner.company,
        partnerPhone: partner.phone,
        eventTitle: event.title,
        interestDetails: partner.interestDetails,
        adminEmail: event.contactEmail || 'lbs@powerpointtribe.org',
      }),
    ]).catch((err) => {
      this.logger.error(`Failed to queue partner emails for ${partner.email}: ${err.message}`);
    });

    this.logger.log(
      `Partnership inquiry submitted for event ${event.title} by ${partner.email}`
    );

    return partner;
  }

  /**
   * Get partners with filtering and pagination
   */
  async getPartners(
    eventId: string,
    queryDto: QueryPartnersDto,
  ): Promise<PaginatedResult<EventPartnerDocument>> {
    // Verify event exists and user has access
    const event = await this.findById(eventId);

    // Build filter query
    const filter: FilterQuery<EventPartnerDocument> = {
      event: new Types.ObjectId(eventId),
    };

    // Apply filters
    if (queryDto.status) {
      filter.status = queryDto.status;
    }

    if (queryDto.assignedTo) {
      filter.assignedTo = new Types.ObjectId(queryDto.assignedTo);
    }

    if (queryDto.search) {
      const searchRegex = new RegExp(queryDto.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { company: searchRegex },
      ];
    }

    if (queryDto.startDate || queryDto.endDate) {
      filter.submittedAt = {};
      if (queryDto.startDate) {
        filter.submittedAt.$gte = new Date(queryDto.startDate);
      }
      if (queryDto.endDate) {
        filter.submittedAt.$lte = new Date(queryDto.endDate);
      }
    }

    // Pagination
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 20;
    const skip = (page - 1) * limit;

    // Execute query
    const [partners, total] = await Promise.all([
      this.partnerModel
        .find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('assignedTo', 'firstName lastName email')
        .exec(),
      this.partnerModel.countDocuments(filter),
    ]);

    return createPaginatedResult(partners, total, page, limit);
  }

  /**
   * Update partner status
   */
  async updatePartnerStatus(
    eventId: string,
    partnerId: string,
    updateDto: UpdatePartnerStatusDto,
  ): Promise<EventPartnerDocument> {
    // Verify event exists and user has access
    await this.findById(eventId);

    // Find partner
    const partner = await this.partnerModel.findOne({
      _id: partnerId,
      event: new Types.ObjectId(eventId),
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    // Update status
    partner.status = updateDto.status;

    // Update notes if provided
    if (updateDto.notes !== undefined) {
      partner.notes = updateDto.notes;
    }

    // Update assigned member if provided
    if (updateDto.assignedTo) {
      partner.assignedTo = new Types.ObjectId(updateDto.assignedTo);
    }

    // Update status-specific timestamps
    if (updateDto.status === PartnerStatus.CONTACTED && !partner.contactedAt) {
      partner.contactedAt = new Date();
    } else if (updateDto.status === PartnerStatus.CONFIRMED) {
      partner.confirmedAt = new Date();
    } else if (updateDto.status === PartnerStatus.DECLINED) {
      partner.declinedAt = new Date();
    }

    await partner.save();

    this.logger.log(
      `Partner ${partnerId} status updated to ${updateDto.status} for event ${eventId}`
    );

    return partner;
  }

  /**
   * Contact a partner via email
   */
  async contactPartner(
    eventId: string,
    partnerId: string,
    contactDto: ContactPartnerDto,
  ): Promise<void> {
    // Verify event exists and user has access
    const event = await this.findById(eventId);

    // Find partner
    const partner = await this.partnerModel.findOne({
      _id: partnerId,
      event: new Types.ObjectId(eventId),
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    // Send email via email provider
    await this.emailProvider.sendEmail({
      to: partner.email,
      subject: contactDto.subject,
      html: contactDto.message,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@powerpointtribe.org',
    });

    // Update partner status if requested
    if (contactDto.updateStatus) {
      partner.status = contactDto.updateStatus;
      if (contactDto.updateStatus === PartnerStatus.CONTACTED && !partner.contactedAt) {
        partner.contactedAt = new Date();
      }
      await partner.save();
    } else if (partner.status === PartnerStatus.PENDING) {
      // Auto-update to contacted if still pending
      partner.status = PartnerStatus.CONTACTED;
      partner.contactedAt = new Date();
      await partner.save();
    }

    this.logger.log(
      `Email sent to partner ${partner.email} for event ${event.title}`
    );
  }

  /**
   * Send bulk email to partners
   */
  async sendBulkEmailToPartners(
    eventId: string,
    bulkEmailDto: BulkPartnerEmailDto,
  ): Promise<{ jobId: string; recipientCount: number }> {
    // Verify event exists and user has access
    const event = await this.findById(eventId);

    // Build filter for partners
    const filter: FilterQuery<EventPartnerDocument> = {
      event: new Types.ObjectId(eventId),
    };

    // If specific partner IDs provided, use those
    if (bulkEmailDto.partnerIds && bulkEmailDto.partnerIds.length > 0) {
      filter._id = { $in: bulkEmailDto.partnerIds.map(id => new Types.ObjectId(id)) };
    }
    // Otherwise filter by status
    else if (bulkEmailDto.statuses && bulkEmailDto.statuses.length > 0) {
      filter.status = { $in: bulkEmailDto.statuses };
    }

    // Get all matching partners
    const partners = await this.partnerModel.find(filter).select('_id email name company');

    if (partners.length === 0) {
      throw new BadRequestException('No partners match the specified criteria');
    }

    // Queue bulk email job
    const job = await this.emailQueue.add('bulk-partner-email', {
      eventId: event._id.toString(),
      eventTitle: event.title,
      subject: bulkEmailDto.subject,
      message: bulkEmailDto.message,
      partners: partners.map(p => ({
        id: p._id.toString(),
        email: p.email,
        name: p.name,
        company: p.company,
      })),
      scheduledFor: bulkEmailDto.scheduledFor,
    }, {
      delay: bulkEmailDto.scheduledFor
        ? new Date(bulkEmailDto.scheduledFor).getTime() - Date.now()
        : 0,
    });

    this.logger.log(
      `Bulk email queued for ${partners.length} partners for event ${event.title}`
    );

    return {
      jobId: job.id.toString(),
      recipientCount: partners.length,
    };
  }

  /**
   * Send bulk email to registrants
   */
  async sendBulkEmailToRegistrants(
    eventId: string,
    bulkEmailDto: {
      subject: string;
      message: string;
      statuses?: RegistrationStatus[];
      registrationIds?: string[];
      scheduledFor?: string;
    },
  ): Promise<{ jobId: string; recipientCount: number }> {
    // Verify event exists and user has access
    const event = await this.findById(eventId);

    // Build filter for registrations
    const filter: FilterQuery<EventRegistrationDocument> = {
      event: new Types.ObjectId(eventId),
    };

    // If specific registration IDs provided, use those
    if (bulkEmailDto.registrationIds && bulkEmailDto.registrationIds.length > 0) {
      filter._id = { $in: bulkEmailDto.registrationIds.map(id => new Types.ObjectId(id)) };
    }
    // Otherwise filter by status
    else if (bulkEmailDto.statuses && bulkEmailDto.statuses.length > 0) {
      filter.status = { $in: bulkEmailDto.statuses };
    }

    // Get all matching registrations
    const registrations = await this.registrationModel
      .find(filter)
      .select('_id attendeeInfo customFieldResponses checkInCode');

    if (registrations.length === 0) {
      throw new BadRequestException('No registrations match the specified criteria');
    }

    // Queue bulk email job
    const job = await this.emailQueue.add('bulk-registration-email', {
      eventId: event._id.toString(),
      eventTitle: event.title,
      subject: bulkEmailDto.subject,
      message: bulkEmailDto.message,
      registrations: registrations.map(r => ({
        id: r._id.toString(),
        email: r.attendeeInfo.email,
        firstName: r.attendeeInfo.firstName,
        lastName: r.attendeeInfo.lastName,
        checkInCode: r.checkInCode,
        customFieldResponses: r.customFieldResponses,
      })),
      scheduledFor: bulkEmailDto.scheduledFor,
    }, {
      delay: bulkEmailDto.scheduledFor
        ? new Date(bulkEmailDto.scheduledFor).getTime() - Date.now()
        : 0,
    });

    this.logger.log(
      `Bulk email queued for ${registrations.length} registrations for event ${event.title}`
    );

    return {
      jobId: job.id.toString(),
      recipientCount: registrations.length,
    };
  }

  /**
   * Export registrations in specified format (CSV, Excel, PDF)
   */
  async exportRegistrations(
    eventId: string,
    filters?: any,
    format: 'csv' | 'xlsx' | 'pdf' = 'xlsx',
  ): Promise<any> {
    const { ExportUtil } = await import('./utils/export.util');

    // Verify event exists
    const event = await this.findById(eventId);

    // Build query with filters
    const query: any = { event: new Types.ObjectId(eventId) };

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.search) {
      query.$or = [
        { 'attendeeInfo.firstName': { $regex: filters.search, $options: 'i' } },
        { 'attendeeInfo.lastName': { $regex: filters.search, $options: 'i' } },
        { 'attendeeInfo.email': { $regex: filters.search, $options: 'i' } },
        { 'attendeeInfo.phone': { $regex: filters.search, $options: 'i' } },
      ];
    }

    // Get filtered registrations
    const registrations = await this.registrationModel
      .find(query)
      .populate('member', 'firstName lastName email phone')
      .sort({ registeredAt: -1 })
      .exec();

    // Get custom field definitions from event
    const customFields = event.registrationSettings?.customFields || [];

    // Define columns
    const columns = [
      { header: 'Registration ID', key: 'registrationId', width: 25 },
      { header: 'First Name', key: 'firstName', width: 15 },
      { header: 'Last Name', key: 'lastName', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Attendee Type', key: 'attendeeType', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Check-in Code', key: 'checkInCode', width: 15 },
      { header: 'Registered At', key: 'registeredAt', width: 18 },
      { header: 'Confirmed At', key: 'confirmedAt', width: 18 },
      { header: 'Checked In At', key: 'checkedInAt', width: 18 },
    ];

    // Add custom field columns
    customFields.forEach(field => {
      columns.push({
        header: field.label,
        key: field.id,
        width: 20,
      });
    });

    columns.push({ header: 'Notes', key: 'notes', width: 30 });

    // Transform data
    const data = registrations.map(reg => {
      const baseData: any = {
        registrationId: reg._id.toString(),
        firstName: reg.attendeeInfo.firstName,
        lastName: reg.attendeeInfo.lastName,
        email: reg.attendeeInfo.email || '',
        phone: reg.attendeeInfo.phone || '',
        gender: reg.attendeeInfo.gender || '',
        attendeeType: reg.attendeeType,
        status: reg.status,
        checkInCode: reg.checkInCode || '',
        registeredAt: reg.registeredAt,
        confirmedAt: reg.confirmedAt || '',
        checkedInAt: reg.checkedInAt || '',
        notes: reg.notes || '',
      };

      // Add custom field responses
      if (reg.customFieldResponses) {
        reg.customFieldResponses.forEach((value, key) => {
          baseData[key] = value;
        });
      }

      return baseData;
    });

    // Generate export based on format
    if (format === 'csv') {
      return ExportUtil.generateCSV(data, columns);
    } else if (format === 'xlsx') {
      return ExportUtil.generateExcel(data, columns, `${event.title} - Registrations`);
    } else if (format === 'pdf') {
      return ExportUtil.generatePDF(data, columns, `${event.title} - Registrations`);
    }
  }

  /**
   * Get partner analytics
   */
  async getPartnerAnalytics(
    eventId: string,
  ): Promise<any> {
    // Verify event exists and user has access
    const event = await this.findById(eventId);

    // Get all partners for the event
    const partners = await this.partnerModel.find({
      event: new Types.ObjectId(eventId),
    });

    // Calculate statistics
    const total = partners.length;
    const statusBreakdown = {
      pending: partners.filter(p => p.status === PartnerStatus.PENDING).length,
      contacted: partners.filter(p => p.status === PartnerStatus.CONTACTED).length,
      inDiscussion: partners.filter(p => p.status === PartnerStatus.IN_DISCUSSION).length,
      confirmed: partners.filter(p => p.status === PartnerStatus.CONFIRMED).length,
      declined: partners.filter(p => p.status === PartnerStatus.DECLINED).length,
    };

    const conversionRate = total > 0
      ? Math.round((statusBreakdown.confirmed / total) * 100)
      : 0;

    // Timeline data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInquiries = partners.filter(
      p => p.submittedAt >= thirtyDaysAgo
    );

    return {
      eventId: event._id.toString(),
      eventTitle: event.title,
      totalInquiries: total,
      statusBreakdown,
      conversionRate,
      recentInquiries: recentInquiries.length,
      avgResponseTime: null, // Can be calculated if needed
      topCompanies: this.getTopCompanies(partners),
    };
  }

  /**
   * Helper: Get top companies from partners
   */
  private getTopCompanies(partners: EventPartnerDocument[]): Array<{ company: string; count: number }> {
    const companyMap = new Map<string, number>();

    partners.forEach(p => {
      if (p.company) {
        const count = companyMap.get(p.company) || 0;
        companyMap.set(p.company, count + 1);
      }
    });

    return Array.from(companyMap.entries())
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Export partners in specified format (CSV, Excel, PDF)
   */
  async exportPartners(
    eventId: string,
    filters?: any,
    format: 'csv' | 'xlsx' | 'pdf' = 'xlsx',
  ): Promise<any> {
    const { ExportUtil } = await import('./utils/export.util');

    // Verify event exists
    const event = await this.findById(eventId);

    // Build query with filters
    const query: any = { event: new Types.ObjectId(eventId) };

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { company: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
      ];
    }

    // Get filtered partners
    const partners = await this.partnerModel
      .find(query)
      .populate('assignedTo', 'firstName lastName email')
      .sort({ submittedAt: -1 })
      .exec();

    // Define columns
    const columns = [
      { header: 'Partner ID', key: 'partnerId', width: 25 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Company', key: 'company', width: 25 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Interest Details', key: 'interestDetails', width: 40 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Submitted At', key: 'submittedAt', width: 18 },
      { header: 'Contacted At', key: 'contactedAt', width: 18 },
      { header: 'Confirmed At', key: 'confirmedAt', width: 18 },
      { header: 'Declined At', key: 'declinedAt', width: 18 },
      { header: 'Assigned To', key: 'assignedTo', width: 20 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];

    // Transform data
    const data = partners.map(partner => {
      const assignedMember = partner.assignedTo as any;
      const assignedToName = assignedMember && typeof assignedMember === 'object' && assignedMember.firstName
        ? `${assignedMember.firstName} ${assignedMember.lastName}`
        : '';

      return {
        partnerId: partner._id.toString(),
        name: partner.name,
        company: partner.company || '',
        email: partner.email,
        phone: partner.phone,
        interestDetails: partner.interestDetails,
        status: partner.status,
        submittedAt: partner.submittedAt,
        contactedAt: partner.contactedAt || '',
        confirmedAt: partner.confirmedAt || '',
        declinedAt: partner.declinedAt || '',
        assignedTo: assignedToName,
        notes: partner.notes || '',
      };
    });

    // Generate export based on format
    if (format === 'csv') {
      return ExportUtil.generateCSV(data, columns);
    } else if (format === 'xlsx') {
      return ExportUtil.generateExcel(data, columns, `${event.title} - Partners`);
    } else if (format === 'pdf') {
      return ExportUtil.generatePDF(data, columns, `${event.title} - Partners`);
    }
  }

  /**
   * Find upcoming events for reminders (used by scheduler)
   */
  async findUpcomingEvents(daysArray: number[]): Promise<EventDocument[]> {
    const events: EventDocument[] = [];

    for (const days of daysArray) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      targetDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const upcomingEvents = await this.eventModel.find({
        startDate: {
          $gte: targetDate,
          $lt: nextDay,
        },
        status: EventStatus.PUBLISHED,
      });

      events.push(...upcomingEvents);
    }

    return events;
  }

  /**
   * Get confirmed registrations for event (used by reminder scheduler)
   */
  async getConfirmedRegistrations(eventId: Types.ObjectId): Promise<EventRegistrationDocument[]> {
    return this.registrationModel.find({
      event: eventId,
      status: RegistrationStatus.CONFIRMED,
    });
  }
}
