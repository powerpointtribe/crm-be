import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import {
  DashboardOverviewDto,
  DashboardStatsDto,
  RecentActivityDto,
  MembershipTrendsDto,
  UpcomingTasksDto,
  DashboardScopeDto,
} from './dto/dashboard-overview.dto';
import { MODULE_DASHBOARD_STATS, ModuleIdentifier } from '../roles/constants/modules.constant';
import {
  GrowthAnalyticsDto,
  GrowthMetricsDto,
  MonthlyGrowthDto,
  RecentActivityAnalyticsDto,
  ActivityItemDto,
  DemographicsDto,
} from './dto/analytics.dto';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import {
  FirstTimer,
  FirstTimerDocument,
} from '../first-timers/schemas/first-timer.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Event, EventDocument } from '../events/schemas/event.schema';
// import { QueueService } from '../queue/queue.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(FirstTimer.name)
    private firstTimerModel: Model<FirstTimerDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    // private queueService: QueueService,
  ) {}

  /**
   * Build a branch filter for MongoDB queries.
   * Returns empty object if no branchId (user can view all).
   */
  private branchFilter(branchId?: string): Record<string, any> {
    if (!branchId) return {};
    return { branch: new Types.ObjectId(branchId) };
  }

  async getDashboardOverview(
    userId: string,
    userRole: string,
    startDateParam?: string,
    endDateParam?: string,
    branchId?: string,
  ): Promise<DashboardOverviewDto> {
    // Default to the present year (Jan 1 → now) if no date range provided
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(endDate.getFullYear(), 0, 1); // Jan 1 of the current year

    const [stats, recentActivity, membershipTrends, upcomingTasks] =
      await Promise.all([
        this.getGeneralStats(branchId),
        this.getRecentActivityWithDateRange(startDate, endDate, branchId),
        this.getMembershipTrends(branchId),
        this.getUpcomingTasks(userId),
      ]);

    return {
      stats,
      recentActivity,
      membershipTrends,
      upcomingTasks,
      userRole,
      lastUpdated: new Date(),
      dateRange: {
        startDate,
        endDate,
      },
    };
  }

  /**
   * Get scoped dashboard overview based on user's accessible modules
   * Filters stats to only include data from modules the user has access to
   */
  async getScopedDashboardOverview(
    userId: string,
    userRole: string,
    accessibleModules: string[],
    isAdmin: boolean,
    startDateParam?: string,
    endDateParam?: string,
    branchId?: string,
  ): Promise<DashboardOverviewDto> {
    // Default to the present year (Jan 1 → now) if no date range provided
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(endDate.getFullYear(), 0, 1); // Jan 1 of the current year

    // Build scope information
    const scope: DashboardScopeDto = {
      type: isAdmin ? 'full' : 'module-limited',
      accessibleModules,
      isAdmin,
      userRole,
    };

    // Get all data
    const [stats, recentActivity, membershipTrends, upcomingTasks] =
      await Promise.all([
        this.getScopedStats(accessibleModules, isAdmin, branchId),
        this.getScopedRecentActivity(accessibleModules, isAdmin, startDate, endDate, branchId),
        this.getScopedMembershipTrends(accessibleModules, isAdmin, branchId),
        this.getUpcomingTasks(userId),
      ]);

    return {
      stats,
      recentActivity,
      membershipTrends,
      upcomingTasks,
      userRole,
      lastUpdated: new Date(),
      dateRange: {
        startDate,
        endDate,
      },
      scope,
      accessibleModules,
    };
  }

  /**
   * Get stats filtered by accessible modules
   */
  private async getScopedStats(
    accessibleModules: string[],
    isAdmin: boolean,
    branchId?: string,
  ): Promise<DashboardStatsDto> {
    // Admin gets all stats (still branch-scoped if applicable)
    if (isAdmin) {
      return this.getGeneralStats(branchId);
    }

    const bf = this.branchFilter(branchId);
    // Filter stats based on accessible modules
    const hasMembers = accessibleModules.includes(ModuleIdentifier.MEMBERS);
    const hasFirstTimers = accessibleModules.includes(ModuleIdentifier.FIRST_TIMERS);
    const hasGroups = accessibleModules.includes(ModuleIdentifier.GROUPS);
    const hasEvents = accessibleModules.includes(ModuleIdentifier.EVENTS);

    const [
      totalMembers,
      activeMembers,
      totalFirstTimers,
      totalGroups,
      totalEvents,
    ] = await Promise.all([
      hasMembers ? this.memberModel.countDocuments({ ...bf }) : Promise.resolve(0),
      hasMembers ? this.memberModel.countDocuments({ isActive: true, ...bf }) : Promise.resolve(0),
      hasFirstTimers ? this.firstTimerModel.countDocuments({ ...bf }) : Promise.resolve(0),
      hasGroups ? this.groupModel.countDocuments({ ...bf }) : Promise.resolve(0),
      hasEvents ? this.eventModel.countDocuments({ ...bf }) : Promise.resolve(0),
    ]);

    return {
      totalMembers,
      activeMembers,
      totalFirstTimers,
      totalUsers: totalMembers,
      totalGroups,
      totalEvents,
    };
  }

  /**
   * Get recent activity filtered by accessible modules
   */
  private async getScopedRecentActivity(
    accessibleModules: string[],
    isAdmin: boolean,
    startDate: Date,
    endDate: Date,
    branchId?: string,
  ): Promise<RecentActivityDto> {
    if (isAdmin) {
      return this.getRecentActivityWithDateRange(startDate, endDate, branchId);
    }

    const bf = this.branchFilter(branchId);
    const hasMembers = accessibleModules.includes(ModuleIdentifier.MEMBERS);
    const hasFirstTimers = accessibleModules.includes(ModuleIdentifier.FIRST_TIMERS);
    const hasGroups = accessibleModules.includes(ModuleIdentifier.GROUPS);
    const hasEvents = accessibleModules.includes(ModuleIdentifier.EVENTS);

    const periodDuration = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime());
    const prevStartDate = new Date(startDate.getTime() - periodDuration);

    // Get current period data (only for accessible modules)
    const [recentMembersCount, recentFirstTimersCount, recentGroupsCount, recentEventsCount] =
      await Promise.all([
        hasMembers
          ? this.memberModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate }, ...bf })
          : Promise.resolve(0),
        hasFirstTimers
          ? this.firstTimerModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate }, ...bf })
          : Promise.resolve(0),
        hasGroups
          ? this.groupModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate }, ...bf })
          : Promise.resolve(0),
        hasEvents
          ? this.eventModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate }, ...bf })
          : Promise.resolve(0),
      ]);

    // Get previous period data for comparison
    const [prevMembersCount, prevFirstTimersCount, prevGroupsCount, prevEventsCount] =
      await Promise.all([
        hasMembers
          ? this.memberModel.countDocuments({ createdAt: { $gte: prevStartDate, $lt: prevEndDate }, ...bf })
          : Promise.resolve(0),
        hasFirstTimers
          ? this.firstTimerModel.countDocuments({ createdAt: { $gte: prevStartDate, $lt: prevEndDate }, ...bf })
          : Promise.resolve(0),
        hasGroups
          ? this.groupModel.countDocuments({ createdAt: { $gte: prevStartDate, $lt: prevEndDate }, ...bf })
          : Promise.resolve(0),
        hasEvents
          ? this.eventModel.countDocuments({ createdAt: { $gte: prevStartDate, $lt: prevEndDate }, ...bf })
          : Promise.resolve(0),
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
      recentEvents: {
        count: recentEventsCount,
        percentage: this.calculatePercentageChange(recentEventsCount, prevEventsCount),
        trend: this.getTrend(recentEventsCount, prevEventsCount),
      },
    };
  }

  /**
   * Get membership trends filtered by accessible modules
   */
  private async getScopedMembershipTrends(
    accessibleModules: string[],
    isAdmin: boolean,
    branchId?: string,
  ): Promise<MembershipTrendsDto> {
    if (isAdmin) {
      return this.getMembershipTrends(branchId);
    }

    const hasMembers = accessibleModules.includes(ModuleIdentifier.MEMBERS);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyGrowth = hasMembers
      ? await this.getMonthlyGrowthData(sixMonthsAgo, branchId)
      : [];
    const ageDistribution = hasMembers ? await this.getAgeDistribution(branchId) : [];
    const genderDistribution = hasMembers ? await this.getGenderDistribution(branchId) : [];

    return {
      monthlyGrowth,
      ageDistribution,
      genderDistribution,
    };
  }

  private async getGeneralStats(branchId?: string): Promise<DashboardStatsDto> {
    const bf = this.branchFilter(branchId);
    const [
      totalMembers,
      activeMembers,
      totalFirstTimers,
      totalUsers,
      totalGroups,
      totalEvents,
    ] = await Promise.all([
      this.memberModel.countDocuments({ ...bf }),
      this.memberModel.countDocuments({ isActive: true, ...bf }),
      this.firstTimerModel.countDocuments({ ...bf }),
      this.memberModel.countDocuments({ ...bf }),
      this.groupModel.countDocuments({ ...bf }),
      this.eventModel.countDocuments({ ...bf }),
    ]);

    return {
      totalMembers,
      activeMembers,
      totalFirstTimers,
      totalUsers,
      totalGroups,
      totalEvents,
    };
  }

  private async getRecentActivity(): Promise<RecentActivityDto> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Get current month data
    const [recentMembersCount, recentFirstTimersCount, recentGroupsCount, recentEventsCount] =
      await Promise.all([
        this.memberModel.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        this.firstTimerModel.countDocuments({
          createdAt: { $gte: thirtyDaysAgo },
        }),
        this.groupModel.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        this.eventModel.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      ]);

    // Get previous month data for comparison
    const [prevMembersCount, prevFirstTimersCount, prevGroupsCount, prevEventsCount] =
      await Promise.all([
        this.memberModel.countDocuments({
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
        this.firstTimerModel.countDocuments({
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
        this.groupModel.countDocuments({
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
        this.eventModel.countDocuments({
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
      ]);

    return {
      recentMembers: {
        count: recentMembersCount,
        percentage: this.calculatePercentageChange(
          recentMembersCount,
          prevMembersCount,
        ),
        trend: this.getTrend(recentMembersCount, prevMembersCount),
      },
      recentFirstTimers: {
        count: recentFirstTimersCount,
        percentage: this.calculatePercentageChange(
          recentFirstTimersCount,
          prevFirstTimersCount,
        ),
        trend: this.getTrend(recentFirstTimersCount, prevFirstTimersCount),
      },
      recentGroups: {
        count: recentGroupsCount,
        percentage: this.calculatePercentageChange(
          recentGroupsCount,
          prevGroupsCount,
        ),
        trend: this.getTrend(recentGroupsCount, prevGroupsCount),
      },
      recentEvents: {
        count: recentEventsCount,
        percentage: this.calculatePercentageChange(
          recentEventsCount,
          prevEventsCount,
        ),
        trend: this.getTrend(recentEventsCount, prevEventsCount),
      },
    };
  }

  private async getRecentActivityWithDateRange(
    startDate: Date,
    endDate: Date,
    branchId?: string,
  ): Promise<RecentActivityDto> {
    const bf = this.branchFilter(branchId);
    // Calculate the duration of the current period
    const periodDuration = endDate.getTime() - startDate.getTime();

    // Calculate the previous period with the same duration
    const prevEndDate = new Date(startDate.getTime());
    const prevStartDate = new Date(startDate.getTime() - periodDuration);

    // Get current period data
    const [recentMembersCount, recentFirstTimersCount, recentGroupsCount, recentEventsCount] =
      await Promise.all([
        this.memberModel.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }, ...bf,
        }),
        this.firstTimerModel.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }, ...bf,
        }),
        this.groupModel.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }, ...bf,
        }),
        this.eventModel.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }, ...bf,
        }),
      ]);

    // Get previous period data for comparison (same duration, previous cycle)
    const [prevMembersCount, prevFirstTimersCount, prevGroupsCount, prevEventsCount] =
      await Promise.all([
        this.memberModel.countDocuments({
          createdAt: { $gte: prevStartDate, $lt: prevEndDate }, ...bf,
        }),
        this.firstTimerModel.countDocuments({
          createdAt: { $gte: prevStartDate, $lt: prevEndDate }, ...bf,
        }),
        this.groupModel.countDocuments({
          createdAt: { $gte: prevStartDate, $lt: prevEndDate }, ...bf,
        }),
        this.eventModel.countDocuments({
          createdAt: { $gte: prevStartDate, $lt: prevEndDate }, ...bf,
        }),
      ]);

    return {
      recentMembers: {
        count: recentMembersCount,
        percentage: this.calculatePercentageChange(
          recentMembersCount,
          prevMembersCount,
        ),
        trend: this.getTrend(recentMembersCount, prevMembersCount),
      },
      recentFirstTimers: {
        count: recentFirstTimersCount,
        percentage: this.calculatePercentageChange(
          recentFirstTimersCount,
          prevFirstTimersCount,
        ),
        trend: this.getTrend(recentFirstTimersCount, prevFirstTimersCount),
      },
      recentGroups: {
        count: recentGroupsCount,
        percentage: this.calculatePercentageChange(
          recentGroupsCount,
          prevGroupsCount,
        ),
        trend: this.getTrend(recentGroupsCount, prevGroupsCount),
      },
      recentEvents: {
        count: recentEventsCount,
        percentage: this.calculatePercentageChange(
          recentEventsCount,
          prevEventsCount,
        ),
        trend: this.getTrend(recentEventsCount, prevEventsCount),
      },
    };
  }

  private async getMembershipTrends(branchId?: string): Promise<MembershipTrendsDto> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get monthly growth data
    const monthlyGrowth = await this.getMonthlyGrowthData(sixMonthsAgo, branchId);

    // Get age distribution
    const ageDistribution = await this.getAgeDistribution(branchId);

    // Get gender distribution
    const genderDistribution = await this.getGenderDistribution(branchId);

    return {
      monthlyGrowth,
      ageDistribution,
      genderDistribution,
    };
  }

  private async getMonthlyGrowthData(startDate: Date, branchId?: string) {
    const bf = this.branchFilter(branchId);
    const memberGrowth = await this.memberModel.aggregate([
      { $match: { createdAt: { $gte: startDate }, ...bf } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1 as const, '_id.month': 1 as const } },
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
      { $sort: { '_id.year': 1 as const, '_id.month': 1 as const } },
    ]);

    // Combine and format the data
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const result = [];
    const memberMap = new Map();
    const firstTimerMap = new Map();

    memberGrowth.forEach((item) => {
      const key = `${item._id.year}-${item._id.month}`;
      memberMap.set(key, item.count);
    });

    firstTimerGrowth.forEach((item) => {
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

  private async getAgeDistribution(branchId?: string) {
    const currentYear = new Date().getFullYear();
    const bf = this.branchFilter(branchId);

    const ageGroups = await this.memberModel.aggregate([
      {
        $match: {
          dateOfBirth: { $exists: true, $ne: null },
          ...bf,
        },
      },
      {
        $addFields: {
          age: {
            $subtract: [currentYear, { $year: '$dateOfBirth' }],
          },
        },
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
              default: 'Seniors (65+)',
            },
          },
        },
      },
      {
        $group: {
          _id: '$ageGroup',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const totalMembers = await this.memberModel.countDocuments({
      dateOfBirth: { $exists: true, $ne: null },
    });

    return ageGroups.map((group) => ({
      ageGroup: group._id,
      count: group.count,
      percentage:
        totalMembers > 0 ? Math.round((group.count / totalMembers) * 100) : 0,
    }));
  }

  private async getGenderDistribution(branchId?: string) {
    const bf = this.branchFilter(branchId);
    const genderStats = await this.memberModel.aggregate([
      {
        $match: {
          gender: { $exists: true, $ne: null },
          ...bf,
        },
      },
      {
        $group: {
          _id: '$gender',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const totalMembers = await this.memberModel.countDocuments({
      gender: { $exists: true, $ne: null },
    });

    return genderStats.map((stat) => ({
      gender: stat._id,
      count: stat.count,
      percentage:
        totalMembers > 0 ? Math.round((stat.count / totalMembers) * 100) : 0,
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

    const pendingFollowUps = pendingFirstTimers.map((ft) => ({
      id: (ft as any)._id.toString(),
      name: `${ft.firstName} ${ft.lastName}`,
      type: 'first-timer' as const,
      daysOverdue: Math.floor(
        (Date.now() - ft.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      ),
      assignedTo: ft.assignedTo?.toString(),
    }));

    const recentBulkOperations = recentJobs.map((job) => ({
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

  private getTrend(
    current: number,
    previous: number,
  ): 'up' | 'down' | 'stable' {
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'stable';
  }

  // Growth Analytics Methods
  async getGrowthAnalytics(
    period: 'week' | 'month' | 'quarter' | 'year' = 'month',
    branchId?: string,
  ): Promise<GrowthAnalyticsDto> {
    const { startDate, endDate, previousStartDate } =
      this.getDateRanges(period);

    const [currentPeriodData, previousPeriodData, monthlyData] =
      await Promise.all([
        this.getPeriodCounts(startDate, endDate, branchId),
        this.getPeriodCounts(previousStartDate, startDate, branchId),
        this.getDetailedMonthlyGrowth(period, branchId),
      ]);

    return {
      memberGrowth: this.createGrowthMetrics(
        currentPeriodData.members,
        previousPeriodData.members,
      ),
      firstTimerGrowth: this.createGrowthMetrics(
        currentPeriodData.firstTimers,
        previousPeriodData.firstTimers,
      ),
      groupGrowth: this.createGrowthMetrics(
        currentPeriodData.groups,
        previousPeriodData.groups,
      ),
      userGrowth: this.createGrowthMetrics(
        currentPeriodData.users,
        previousPeriodData.users,
      ),
      monthlyData,
      period,
      dateRange: { start: startDate, end: endDate },
    };
  }

  async getRecentActivityAnalytics(
    limit: number = 50,
    days: number = 7,
    branchId?: string,
  ): Promise<RecentActivityAnalyticsDto> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await this.buildRecentActivities(startDate, limit, branchId);
    const summary = this.calculateActivitySummary(activities);
    const trends = await this.calculateActivityTrends();
    const mostActiveUsers = await this.getMostActiveUsers(startDate, 5);

    return {
      activities,
      summary,
      trends,
      mostActiveUsers,
      period: `Last ${days} days`,
      lastUpdated: new Date(),
    };
  }

  async getDemographicsAnalytics(branchId?: string): Promise<DemographicsDto> {
    const bf = this.branchFilter(branchId);
    const [
      ageDistribution,
      genderDistribution,
      maritalStatus,
      geographic,
      totalMembers,
    ] = await Promise.all([
      this.getAgeDistribution(branchId),
      this.getGenderDistribution(branchId),
      this.getMaritalStatusDistribution(branchId),
      this.getGeographicDistribution(branchId),
      this.memberModel.countDocuments({ ...bf }),
    ]);

    return {
      ageDistribution,
      genderDistribution,
      maritalStatusDistribution: maritalStatus,
      geographicDistribution: geographic,
      totalMembers,
      analysisDate: new Date(),
    };
  }

  private getDateRanges(period: string) {
    const endDate = new Date();
    const startDate = new Date();
    const previousStartDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        previousStartDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        previousStartDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        previousStartDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        previousStartDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    return { startDate, endDate, previousStartDate };
  }

  private async getPeriodCounts(startDate: Date, endDate: Date, branchId?: string) {
    const bf = this.branchFilter(branchId);
    const [members, firstTimers, groups, users] = await Promise.all([
      this.memberModel.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }, ...bf,
      }),
      this.firstTimerModel.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }, ...bf,
      }),
      this.groupModel.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }, ...bf,
      }),
      this.memberModel.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }, ...bf,
      }),
    ]);

    return { members, firstTimers, groups, users };
  }

  private createGrowthMetrics(
    current: number,
    previous: number,
  ): GrowthMetricsDto {
    return {
      current,
      previous,
      percentageChange: this.calculatePercentageChange(current, previous),
      trend: this.getTrend(current, previous),
      netChange: current - previous,
    };
  }

  private async getDetailedMonthlyGrowth(
    period: string,
    branchId?: string,
  ): Promise<MonthlyGrowthDto[]> {
    const months = period === 'year' ? 12 : period === 'quarter' ? 3 : 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const bf = this.branchFilter(branchId);

    const aggregationPipeline = [
      { $match: { createdAt: { $gte: startDate }, ...bf } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1 as const, '_id.month': 1 as const } },
    ];

    const [memberData, firstTimerData, groupData] = await Promise.all([
      this.memberModel.aggregate(aggregationPipeline),
      this.firstTimerModel.aggregate(aggregationPipeline),
      this.groupModel.aggregate(aggregationPipeline),
    ]);

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const result: MonthlyGrowthDto[] = [];

    // Create maps for easy lookup
    const memberMap = new Map(
      memberData.map((item) => [
        `${item._id.year}-${item._id.month}`,
        item.count,
      ]),
    );
    const firstTimerMap = new Map(
      firstTimerData.map((item) => [
        `${item._id.year}-${item._id.month}`,
        item.count,
      ]),
    );
    const groupMap = new Map(
      groupData.map((item) => [
        `${item._id.year}-${item._id.month}`,
        item.count,
      ]),
    );

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;

      const members: number = memberMap.get(key) || 0;
      const firstTimers: number = firstTimerMap.get(key) || 0;
      const groups: number = groupMap.get(key) || 0;

      result.push({
        month: monthNames[date.getMonth()],
        year: date.getFullYear(),
        members,
        firstTimers,
        groups,
        totalGrowth: members + firstTimers + groups,
      });
    }

    return result;
  }

  private async buildRecentActivities(
    startDate: Date,
    limit: number,
    branchId?: string,
  ): Promise<ActivityItemDto[]> {
    const bf = this.branchFilter(branchId);
    const activities: ActivityItemDto[] = [];

    // Get recent members
    const recentMembers = await this.memberModel
      .find({ createdAt: { $gte: startDate }, ...bf })
      .sort({ createdAt: -1 })
      .limit(Math.floor(limit / 4))
      .select('firstName lastName createdAt');

    recentMembers.forEach((member) => {
      activities.push({
        id: `member_${(member as any)._id}`,
        type: 'member_joined',
        description: `${member.firstName} ${member.lastName} joined as a new member`,
        timestamp: member.createdAt,
        entityData: {
          id: (member as any)._id.toString(),
          name: `${member.firstName} ${member.lastName}`,
          type: 'member',
        },
      });
    });

    // Get recent first-timers
    const recentFirstTimers = await this.firstTimerModel
      .find({ createdAt: { $gte: startDate }, ...bf })
      .sort({ createdAt: -1 })
      .limit(Math.floor(limit / 4))
      .select('firstName lastName createdAt');

    recentFirstTimers.forEach((ft) => {
      activities.push({
        id: `ft_${(ft as any)._id}`,
        type: 'first_timer_visit',
        description: `${ft.firstName} ${ft.lastName} visited as a first-timer`,
        timestamp: ft.createdAt,
        entityData: {
          id: (ft as any)._id.toString(),
          name: `${ft.firstName} ${ft.lastName}`,
          type: 'first-timer',
        },
      });
    });

    // Get recent groups
    const recentGroups = await this.groupModel
      .find({ createdAt: { $gte: startDate }, ...bf })
      .sort({ createdAt: -1 })
      .limit(Math.floor(limit / 4))
      .select('name type createdAt');

    recentGroups.forEach((group) => {
      activities.push({
        id: `group_${(group as any)._id}`,
        type: 'group_created',
        description: `New ${group.type} "${group.name}" was created`,
        timestamp: group.createdAt,
        entityData: {
          id: (group as any)._id.toString(),
          name: group.name,
          type: group.type,
        },
      });
    });

    // Get recent users
    const recentUsers = await this.memberModel
      .find({ createdAt: { $gte: startDate }, ...bf })
      .sort({ createdAt: -1 })
      .limit(Math.floor(limit / 4))
      .select('firstName lastName role createdAt');

    recentUsers.forEach((user) => {
      activities.push({
        id: `user_${(user as any)._id}`,
        type: 'user_registered',
        description: `${user.firstName} ${user.lastName} registered as ${JSON.stringify(user.systemRoles)}`,
        timestamp: user.createdAt,
        entityData: {
          id: (user as any)._id.toString(),
          name: `${user.firstName} ${user.lastName}`,
          type: JSON.stringify(user.systemRoles),
        },
      });
    });

    // Sort all activities by timestamp (most recent first)
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private calculateActivitySummary(activities: ActivityItemDto[]) {
    return {
      totalActivities: activities.length,
      memberActivities: activities.filter((a) => a.type === 'member_joined')
        .length,
      firstTimerActivities: activities.filter(
        (a) => a.type === 'first_timer_visit',
      ).length,
      groupActivities: activities.filter((a) => a.type === 'group_created')
        .length,
      userActivities: activities.filter((a) => a.type === 'user_registered')
        .length,
      bulkOperations: activities.filter((a) => a.type === 'bulk_operation')
        .length,
    };
  }

  private async calculateActivityTrends() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const [todayCount, yesterdayCount, weekCount, monthCount] =
      await Promise.all([
        this.getTotalActivityCount(today, new Date()),
        this.getTotalActivityCount(yesterday, today),
        this.getTotalActivityCount(weekAgo, new Date()),
        this.getTotalActivityCount(monthAgo, new Date()),
      ]);

    return {
      todayCount,
      yesterdayCount,
      weekCount,
      monthCount,
    };
  }

  private async getTotalActivityCount(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const [members, firstTimers, groups, users] = await Promise.all([
      this.memberModel.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate },
      }),
      this.firstTimerModel.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate },
      }),
      this.groupModel.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate },
      }),
      this.memberModel.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate },
      }),
    ]);

    return members + firstTimers + groups + users;
  }

  private async getMostActiveUsers(startDate: Date, limit: number) {
    // This is a simplified version - in a real app, you'd track user activities
    const recentUsers = await this.memberModel
      .find({ createdAt: { $gte: startDate } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('firstName lastName createdAt');

    return recentUsers.map((user) => ({
      userId: (user as any)._id.toString(),
      userName: `${user.firstName} ${user.lastName}`,
      activityCount: 1, // Simplified - would be actual activity count
      lastActivity: user.createdAt,
    }));
  }

  private async getMaritalStatusDistribution(branchId?: string) {
    const bf = this.branchFilter(branchId);
    const maritalStats = await this.memberModel.aggregate([
      {
        $match: {
          maritalStatus: { $exists: true, $ne: null },
          ...bf,
        },
      },
      {
        $group: {
          _id: '$maritalStatus',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const totalMembers = await this.memberModel.countDocuments({
      maritalStatus: { $exists: true, $ne: null },
      ...bf,
    });

    return maritalStats.map((stat) => ({
      status: stat._id,
      count: stat.count,
      percentage:
        totalMembers > 0 ? Math.round((stat.count / totalMembers) * 100) : 0,
    }));
  }

  private async getGeographicDistribution(branchId?: string) {
    const bf = this.branchFilter(branchId);
    const stateStats = await this.memberModel.aggregate([
      {
        $match: {
          'address.state': { $exists: true, $ne: null },
          ...bf,
        },
      },
      {
        $group: {
          _id: '$address.state',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const cityStats = await this.memberModel.aggregate([
      {
        $match: {
          'address.city': { $exists: true, $ne: null },
          ...bf,
        },
      },
      {
        $group: {
          _id: '$address.city',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const totalMembers = await this.memberModel.countDocuments({
      $or: [
        { 'address.state': { $exists: true, $ne: null } },
        { 'address.city': { $exists: true, $ne: null } },
      ],
    });

    const result: Array<{
      location: string;
      count: number;
      percentage: number;
      type: 'state' | 'city';
    }> = [];

    stateStats.forEach((stat: any) => {
      result.push({
        location: stat._id as string,
        count: stat.count as number,
        percentage:
          totalMembers > 0 ? Math.round((stat.count / totalMembers) * 100) : 0,
        type: 'state' as const,
      });
    });

    cityStats.forEach((stat: any) => {
      result.push({
        location: stat._id as string,
        count: stat.count as number,
        percentage:
          totalMembers > 0 ? Math.round((stat.count / totalMembers) * 100) : 0,
        type: 'city' as const,
      });
    });

    return result;
  }
}
