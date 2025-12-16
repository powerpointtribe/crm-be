import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import {
  MemberActivity,
  MemberActivityDocument,
} from './schemas/member-activity.schema';
import {
  ActivityType,
  ActivityStatus,
  ActivityPriority,
} from '../common/enums/activity-tracker.enum';

export interface ActivityQueryParams {
  page?: number;
  limit?: number;
  memberId?: string;
  activityType?: ActivityType;
  status?: ActivityStatus;
  priority?: ActivityPriority;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class ActivityTrackerService {
  constructor(
    @InjectModel(MemberActivity.name)
    private memberActivityModel: Model<MemberActivityDocument>,
  ) {}

  async findActivities(params: ActivityQueryParams) {
    const {
      page = 1,
      limit = 20,
      memberId,
      activityType,
      status,
      priority,
      startDate,
      endDate,
      search,
      sortBy = 'activityDate',
      sortOrder = 'desc',
    } = params;

    const query: FilterQuery<MemberActivityDocument> = { isVisible: true };

    if (memberId) {
      query.member = memberId;
    }

    if (activityType) {
      query.activityType = activityType;
    }

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    if (startDate || endDate) {
      query.activityDate = {};
      if (startDate) query.activityDate.$gte = startDate;
      if (endDate) query.activityDate.$lte = endDate;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    const sortOptions: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'desc' ? -1 : 1,
    };

    const [activities, total] = await Promise.all([
      this.memberActivityModel
        .find(query)
        .populate('member', 'firstName lastName email')
        .populate('initiatedBy', 'firstName lastName email')
        .populate('approvedBy', 'firstName lastName email')
        .populate('supervisedBy', 'firstName lastName email')
        .populate('fromUnit', 'name type')
        .populate('toUnit', 'name type')
        .populate('fromDistrict', 'name type')
        .populate('toDistrict', 'name type')
        .populate('fromMinistries', 'name type')
        .populate('toMinistries', 'name type')
        .populate('relatedCohort', 'name code type')
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.memberActivityModel.countDocuments(query).exec(),
    ]);

    return {
      activities,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        count: activities.length,
        total,
      },
    };
  }

  async findActivityById(id: string): Promise<MemberActivity | null> {
    return this.memberActivityModel
      .findById(id)
      .populate('member', 'firstName lastName email')
      .populate('initiatedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .populate('supervisedBy', 'firstName lastName email')
      .populate('fromUnit', 'name type')
      .populate('toUnit', 'name type')
      .populate('fromDistrict', 'name type')
      .populate('toDistrict', 'name type')
      .populate('fromMinistries', 'name type')
      .populate('toMinistries', 'name type')
      .populate('relatedCohort', 'name code type')
      .exec();
  }

  async getActivityStatistics(memberId?: string): Promise<{
    totalActivities: number;
    recentActivities: number;
    activityTypeBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
    priorityBreakdown: Record<string, number>;
  }> {
    const matchStage: any = { isVisible: true };
    if (memberId) {
      matchStage.member = memberId;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      total,
      recent,
      typeBreakdown,
      statusBreakdown,
      priorityBreakdown,
    ] = await Promise.all([
      this.memberActivityModel.countDocuments(matchStage),
      this.memberActivityModel.countDocuments({
        ...matchStage,
        activityDate: { $gte: thirtyDaysAgo }
      }),
      this.memberActivityModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$activityType', count: { $sum: 1 } } },
      ]),
      this.memberActivityModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.memberActivityModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      totalActivities: total,
      recentActivities: recent,
      activityTypeBreakdown: typeBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      priorityBreakdown: priorityBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };
  }

  async getUpcomingFollowUps(limit = 50): Promise<MemberActivity[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    return this.memberActivityModel
      .find({
        requiresFollowUp: true,
        nextFollowUpDate: {
          $gte: today,
          $lte: in30Days,
        },
        isVisible: true,
      })
      .populate('member', 'firstName lastName email phone')
      .populate('initiatedBy', 'firstName lastName email')
      .sort({ nextFollowUpDate: 1 })
      .limit(limit)
      .exec();
  }

  async addFollowUpNote(
    activityId: string,
    note: string,
    followUpBy: string,
    nextFollowUpDate?: Date,
  ): Promise<MemberActivity | null> {
    return this.memberActivityModel
      .findByIdAndUpdate(
        activityId,
        {
          $push: {
            followUpNotes: {
              date: new Date(),
              by: followUpBy,
              notes: note,
              nextFollowUp: nextFollowUpDate,
            },
          },
          nextFollowUpDate,
          requiresFollowUp: !!nextFollowUpDate,
        },
        { new: true }
      )
      .exec();
  }

  async markActivityComplete(activityId: string): Promise<MemberActivity | null> {
    return this.memberActivityModel
      .findByIdAndUpdate(
        activityId,
        {
          status: ActivityStatus.COMPLETED,
          requiresFollowUp: false,
          nextFollowUpDate: null,
        },
        { new: true }
      )
      .exec();
  }
}