import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DashboardOverviewDto,
  DashboardStatsDto,
  RecentActivityDto,
  MembershipTrendsDto,
  UpcomingTasksDto
} from './dto/dashboard-overview.dto';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { FirstTimer, FirstTimerDocument } from '../first-timers/schemas/first-timer.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
// import { QueueService } from '../queue/queue.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(FirstTimer.name) private firstTimerModel: Model<FirstTimerDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    // private queueService: QueueService,
  ) {}

  async getDashboardOverview(userId: string, userRole: string): Promise<DashboardOverviewDto> {
    const [stats, recentActivity, membershipTrends, upcomingTasks] = await Promise.all([
      this.getGeneralStats(),
      this.getRecentActivity(),
      this.getMembershipTrends(),
      this.getUpcomingTasks(userId),
    ]);

    return {
      stats,
      recentActivity,
      membershipTrends,
      upcomingTasks,
      userRole,
      lastUpdated: new Date(),
    };
  }

  private async getGeneralStats(): Promise<DashboardStatsDto> {
    const [totalMembers, activeMembers, totalFirstTimers, totalUsers, totalGroups] = await Promise.all([
      this.memberModel.countDocuments(),
      this.memberModel.countDocuments({ isActive: true }),
      this.firstTimerModel.countDocuments(),
      this.userModel.countDocuments(),
      this.groupModel.countDocuments(),
    ]);

    return {
      totalMembers,
      activeMembers,
      totalFirstTimers,
      totalUsers,
      totalGroups,
    };
  }

  private async getRecentActivity(): Promise<RecentActivityDto> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Get current month data
    const [recentMembersCount, recentFirstTimersCount, recentGroupsCount] = await Promise.all([
      this.memberModel.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      this.firstTimerModel.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      this.groupModel.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    // Get previous month data for comparison
    const [prevMembersCount, prevFirstTimersCount, prevGroupsCount] = await Promise.all([
      this.memberModel.countDocuments({
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
      }),
      this.firstTimerModel.countDocuments({
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
      }),
      this.groupModel.countDocuments({
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
      }),
    ]);

    return {
      recentMembers: {
        count: recentMembersCount,
        percentage: this.calculatePercentageChange(recentMembersCount, prevMembersCount),
        trend: this.getTrend(recentMembersCount, prevMembersCount),
      },
      recentFirstTimers: {
        count: recentFirstTimersCount,
        percentage: this.calculatePercentageChange(recentFirstTimersCount, prevFirstTimersCount),
        trend: this.getTrend(recentFirstTimersCount, prevFirstTimersCount),
      },
      recentGroups: {
        count: recentGroupsCount,
        percentage: this.calculatePercentageChange(recentGroupsCount, prevGroupsCount),
        trend: this.getTrend(recentGroupsCount, prevGroupsCount),
      },
    };
  }

  private async getMembershipTrends(): Promise<MembershipTrendsDto> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get monthly growth data
    const monthlyGrowth = await this.getMonthlyGrowthData(sixMonthsAgo);

    // Get age distribution
    const ageDistribution = await this.getAgeDistribution();

    // Get gender distribution
    const genderDistribution = await this.getGenderDistribution();

    return {
      monthlyGrowth,
      ageDistribution,
      genderDistribution,
    };
  }

  private async getMonthlyGrowthData(startDate: Date) {
    const memberGrowth = await this.memberModel.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const firstTimerGrowth = await this.firstTimerModel.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Combine and format the data
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const result = [];
    const memberMap = new Map();
    const firstTimerMap = new Map();

    memberGrowth.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      memberMap.set(key, item.count);
    });

    firstTimerGrowth.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      firstTimerMap.set(key, item.count);
    });

    // Generate last 6 months
    const monthlyData: Array<{
      month: string;
      members: number;
      firstTimers: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const monthName = monthNames[date.getMonth()];

      monthlyData.push({
        month: monthName,
        members: memberMap.get(key) || 0,
        firstTimers: firstTimerMap.get(key) || 0,
      });
    }

    return monthlyData;
  }

  private async getAgeDistribution() {
    const currentYear = new Date().getFullYear();

    const ageGroups = await this.memberModel.aggregate([
      {
        $match: {
          dateOfBirth: { $exists: true, $ne: null }
        }
      },
      {
        $addFields: {
          age: {
            $subtract: [
              currentYear,
              { $year: '$dateOfBirth' }
            ]
          }
        }
      },
      {
        $addFields: {
          ageGroup: {
            $switch: {
              branches: [
                { case: { $lte: ['$age', 17] }, then: 'Children (0-17)' },
                { case: { $lte: ['$age', 25] }, then: 'Youth (18-25)' },
                { case: { $lte: ['$age', 35] }, then: 'Young Adults (26-35)' },
                { case: { $lte: ['$age', 50] }, then: 'Adults (36-50)' },
                { case: { $lte: ['$age', 65] }, then: 'Middle Age (51-65)' },
              ],
              default: 'Seniors (65+)'
            }
          }
        }
      },
      {
        $group: {
          _id: '$ageGroup',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalMembers = await this.memberModel.countDocuments({
      dateOfBirth: { $exists: true, $ne: null }
    });

    return ageGroups.map(group => ({
      ageGroup: group._id,
      count: group.count,
      percentage: totalMembers > 0 ? Math.round((group.count / totalMembers) * 100) : 0,
    }));
  }

  private async getGenderDistribution() {
    const genderStats = await this.memberModel.aggregate([
      {
        $match: {
          gender: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$gender',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalMembers = await this.memberModel.countDocuments({
      gender: { $exists: true, $ne: null }
    });

    return genderStats.map(stat => ({
      gender: stat._id,
      count: stat.count,
      percentage: totalMembers > 0 ? Math.round((stat.count / totalMembers) * 100) : 0,
    }));
  }

  private async getUpcomingTasks(userId: string): Promise<UpcomingTasksDto> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get first-timers needing follow-up
    const pendingFirstTimers = await this.firstTimerModel
      .find({
        status: { $in: ['new', 'contacted'] },
        createdAt: { $lte: sevenDaysAgo },
      })
      .sort({ createdAt: 1 })
      .limit(10)
      .select('firstName lastName status createdAt assignedTo');

    // Get recent bulk operations
    // const recentJobs = await this.queueService.getJobHistory(userId, 5);
    const recentJobs: any[] = []; // Temporary placeholder

    const pendingFollowUps = pendingFirstTimers.map(ft => ({
      id: (ft as any)._id.toString(),
      name: `${ft.firstName} ${ft.lastName}`,
      type: 'first-timer' as const,
      daysOverdue: Math.floor((Date.now() - ft.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      assignedTo: ft.assignedTo?.toString(),
    }));

    const recentBulkOperations = recentJobs.map(job => ({
      id: job.id.toString(),
      type: job.data.jobType,
      status: 'completed', // You might want to get the actual status
      processedCount: 0, // Get from job result
      totalCount: job.data.metadata?.totalRows || 0,
      createdAt: job.data.metadata?.timestamp || new Date(),
    }));

    return {
      pendingFollowUps,
      recentBulkOperations,
    };
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private getTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'stable';
  }
}