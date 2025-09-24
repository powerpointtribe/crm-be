import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { FirstTimer, FirstTimerDocument } from './schemas/first-timer.schema';
import { CreateFirstTimerDto } from './dto/create-first-timer.dto';
import { AddFollowUpDto } from './dto/add-follow-up.dto';
import { FirstTimerSearchDto } from './dto/first-timer-search.dto';
import {
  PaginatedResult,
  createPaginatedResult,
} from '../common/utils/pagination.util';
import { QueryBuilder } from '../common/utils/query-builder.util';
import { EngagementStatus } from '../common/enums/engagement-status.enum';

@Injectable()
export class FirstTimersService {
  constructor(
    @InjectModel(FirstTimer.name)
    private firstTimerModel: Model<FirstTimerDocument>,
  ) {}

  async create(
    createFirstTimerDto: CreateFirstTimerDto,
  ): Promise<FirstTimerDocument> {
    // Check if phone already exists
    const existingPhone = await this.firstTimerModel.findOne({
      phone: createFirstTimerDto.phone,
      isActive: true,
    });

    if (existingPhone) {
      throw new ConflictException(
        'A first-timer with this phone number already exists',
      );
    }

    // Check if email already exists (if provided)
    if (createFirstTimerDto.email) {
      const existingEmail = await this.firstTimerModel.findOne({
        email: createFirstTimerDto.email.toLowerCase(),
        isActive: true,
      });

      if (existingEmail) {
        throw new ConflictException(
          'A first-timer with this email already exists',
        );
      }
    }

    const firstTimer = new this.firstTimerModel({
      ...createFirstTimerDto,
      email: createFirstTimerDto.email?.toLowerCase(),
      followUps: [],
      familyMembers: createFirstTimerDto.familyMembers || [],
      interests: createFirstTimerDto.interests || [],
      prayerRequests: createFirstTimerDto.prayerRequests || [],
      servingInterests: createFirstTimerDto.servingInterests || [],
      followUpCount: 0,
    });

    // Set initial follow-up date (1 day after visit)
    const nextDay = new Date(createFirstTimerDto.dateOfVisit);
    nextDay.setDate(nextDay.getDate() + 1);
    firstTimer.nextFollowUpDate = nextDay;

    return firstTimer.save();
  }

  async findAll(
    searchDto: FirstTimerSearchDto,
  ): Promise<PaginatedResult<FirstTimerDocument>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'dateOfVisit',
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
      const dateQuery = QueryBuilder.buildDateRangeQuery(
        visitDateFrom,
        visitDateTo,
        'dateOfVisit',
      );
      Object.assign(filterQuery, dateQuery);
    }

    // Special filters
    if (needsFollowUp) {
      filterQuery.$or = [
        { status: EngagementStatus.NOT_CONTACTED },
        {
          nextFollowUpDate: { $lte: new Date() },
          status: {
            $nin: [EngagementStatus.CONVERTED, EngagementStatus.LOST_CONTACT],
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
      nextFollowUpDate: followUpDto.nextFollowUpDate,
    };

    // Update status based on outcome
    let newStatus = firstTimer.status;
    switch (followUpDto.outcome) {
      case 'successful':
        if (firstTimer.status === EngagementStatus.NOT_CONTACTED) {
          newStatus = EngagementStatus.CONTACTED;
        }
        break;
      case 'interested':
        newStatus = EngagementStatus.SCHEDULED_VISIT;
        break;
      case 'not_interested':
        newStatus = EngagementStatus.LOST_CONTACT;
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
            nextFollowUpDate: followUpDto.nextFollowUpDate || null,
          },
        },
        { new: true },
      )
      .populate('followUps.contactedBy', 'firstName lastName');

    return updatedFirstTimer!;
  }

  async updateStatus(
    id: string,
    status: EngagementStatus,
  ): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true },
    );

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    return firstTimer;
  }

  async convertToMember(
    id: string,
    memberRecordId: string,
  ): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            converted: true,
            conversionDate: new Date(),
            memberRecord: memberRecordId,
            status: EngagementStatus.CONVERTED,
          },
        },
        { new: true },
      )
      .populate('memberRecord', 'firstName lastName membershipStatus');

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    return firstTimer;
  }

  async assignToUser(id: string, userId: string): Promise<FirstTimerDocument> {
    const firstTimer = await this.firstTimerModel
      .findByIdAndUpdate(id, { $set: { assignedTo: userId } }, { new: true })
      .populate('assignedTo', 'firstName lastName email');

    if (!firstTimer) {
      throw new NotFoundException('First-timer not found');
    }

    return firstTimer;
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
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'assignedUser',
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

  async getNeedingFollowUp(): Promise<FirstTimerDocument[]> {
    const today = new Date();

    return this.firstTimerModel
      .find({
        isActive: true,
        converted: false,
        status: {
          $nin: [EngagementStatus.CONVERTED, EngagementStatus.LOST_CONTACT],
        },
        $or: [
          { status: EngagementStatus.NOT_CONTACTED },
          { nextFollowUpDate: { $lte: today } },
        ],
      })
      .populate('assignedTo', 'firstName lastName email')
      .sort({ nextFollowUpDate: 1, dateOfVisit: 1 })
      .limit(50);
  }

  async getRecentVisitors(days: number = 7): Promise<FirstTimerDocument[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.firstTimerModel
      .find({
        isActive: true,
        dateOfVisit: { $gte: startDate },
      })
      .populate('assignedTo', 'firstName lastName')
      .populate('invitedByMember', 'firstName lastName')
      .sort({ dateOfVisit: -1 });
  }

  async getByAssignedUser(userId: string): Promise<FirstTimerDocument[]> {
    return this.firstTimerModel
      .find({
        assignedTo: userId,
        isActive: true,
        converted: false,
      })
      .sort({ nextFollowUpDate: 1, dateOfVisit: -1 });
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
}
