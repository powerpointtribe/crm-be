import { Controller, Get, UseGuards, Query, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewDto } from './dto/dashboard-overview.dto';
import {
  GrowthAnalyticsDto,
  RecentActivityAnalyticsDto,
  DemographicsDto,
} from './dto/analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  Roles,
  DashboardAccess,
  FirstTimersAccess,
  MembersAccess,
  SystemSettingsAccess,
  FinancesAccess,
  ReportsAccess,
  UserManagementAccess,
} from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-roles.enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';
import { RoleUtils } from '../common/utils/role.utils';
import { RequestWithUserUnit } from '../common/middleware/user-unit.middleware';
// import { DashboardDocs } from '../../docs/api/dashboard.docs';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@DashboardAccess() // Only LXL members and above can access dashboard
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('modules')
  @ApiOperation({ summary: 'Get accessible modules for current user' })
  getAccessibleModules(
    @CurrentUser() user: any,
    @Req() req: RequestWithUserUnit,
  ) {
    const accessibleModules = RoleUtils.getAccessibleModules(
      user,
      req.userUnit,
    );
    return ResponseUtil.success(
      {
        modules: accessibleModules,
        userRole: RoleUtils.getHighestRole(user),
        isUnitLeader: !!user.leaderOfUnit,
        unitType: req.userUnit?.unitType || null,
      },
      'Accessible modules retrieved successfully',
    );
  }

  @Get('overview')
  @ReportsAccess() // Reports module access required for overview
  @ApiOperation({ summary: 'Get dashboard overview with metrics and analytics' })
  async getDashboardOverview(@CurrentUser() user: any) {
    const overview = await this.dashboardService.getDashboardOverview(
      user.sub,
      user.roles,
    );

    return ResponseUtil.success(
      overview,
      'Dashboard overview retrieved successfully',
    );
  }

  @Get('first-timers')
  @FirstTimersAccess() // Only GIA unit heads and above can access
  @ApiOperation({ summary: 'Get first timers data and analytics' })
  async getFirstTimers(@CurrentUser() user: any) {
    return ResponseUtil.success(
      {
        message:
          'First timers data - accessible to GIA unit heads, pastors, and admin',
      },
      'First timers data retrieved successfully',
    );
  }

  @Get('members')
  @MembersAccess() // All unit heads, directors, pastors can access
  @ApiOperation({ summary: 'Get members data' })
  async getMembers(@CurrentUser() user: any) {
    return ResponseUtil.success(
      {
        message:
          'Members data - accessible to all unit heads, directors, pastors',
      },
      'Members data retrieved successfully',
    );
  }

  @Get('finances')
  @FinancesAccess() // Pastors and admin only
  @ApiOperation({ summary: 'Get financial data' })
  async getFinances(@CurrentUser() user: any) {
    return ResponseUtil.success(
      { message: 'Financial data - accessible to pastors and admin only' },
      'Financial data retrieved successfully',
    );
  }

  @Get('settings')
  @SystemSettingsAccess() // Admin only
  @ApiOperation({ summary: 'Get system settings' })
  async getSystemSettings(@CurrentUser() user: any) {
    return ResponseUtil.success(
      { message: 'System settings - admin only' },
      'System settings retrieved successfully',
    );
  }

  @Get('stats')
  @ReportsAccess() // Reports module access
  @ApiOperation({ summary: 'Get detailed statistics (admin only)' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['week', 'month', 'quarter', 'year'],
    description: 'Time period for statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getDetailedStats(
    @CurrentUser() user: any,
    @Query('period') period: 'week' | 'month' | 'quarter' | 'year' = 'month',
  ) {
    // This endpoint can be extended for more detailed statistics
    const overview = await this.dashboardService.getDashboardOverview(
      user.sub,
      user.roles,
    );

    return ResponseUtil.success(
      {
        period,
        stats: overview.stats,
        trends: overview.membershipTrends,
        activity: overview.recentActivity,
      },
      `${period} statistics retrieved successfully`,
    );
  }

  @Get('activity')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Get recent activity feed' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of activities to retrieve (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Activity feed retrieved successfully',
  })
  async getActivityFeed(
    @CurrentUser() user: any,
    @Query('limit') limit: number = 20,
  ) {
    const overview = await this.dashboardService.getDashboardOverview(
      user.sub,
      user.roles,
    );

    return ResponseUtil.success(
      {
        activities: overview.upcomingTasks,
        recentActivity: overview.recentActivity,
        limit,
      },
      'Activity feed retrieved successfully',
    );
  }

  @Get('tasks')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Get pending tasks and notifications' })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully',
  })
  async getPendingTasks(@CurrentUser() user: any) {
    const overview = await this.dashboardService.getDashboardOverview(
      user.sub,
      user.roles,
    );

    return ResponseUtil.success(
      overview.upcomingTasks,
      'Pending tasks retrieved successfully',
    );
  }

  @Get('quick-stats')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL, UserRole.MEMBER)
  @ApiOperation({ summary: 'Get quick stats for header/sidebar display' })
  @ApiResponse({
    status: 200,
    description: 'Quick stats retrieved successfully',
  })
  async getQuickStats(@CurrentUser() user: any) {
    const overview = await this.dashboardService.getDashboardOverview(
      user.sub,
      user.roles,
    );

    return ResponseUtil.success(
      {
        totalMembers: overview.stats.totalMembers,
        totalFirstTimers: overview.stats.totalFirstTimers,
        pendingFollowUps: overview.upcomingTasks.pendingFollowUps.length,
        userRole: user.role,
      },
      'Quick stats retrieved successfully',
    );
  }

  @Get('growth-analytics')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({
    summary: 'Get growth analytics and trends data',
    description:
      'Returns comprehensive growth analytics including member, first-timer, and group growth metrics with historical data',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['week', 'month', 'quarter', 'year'],
    description: 'Time period for analytics analysis',
  })
  @ApiResponse({
    status: 200,
    description: 'Growth analytics retrieved successfully',
    type: GrowthAnalyticsDto,
  })
  async getGrowthAnalytics(
    @CurrentUser() user: any,
    @Query('period') period: 'week' | 'month' | 'quarter' | 'year' = 'month',
  ) {
    const analytics = await this.dashboardService.getGrowthAnalytics(period);

    return ResponseUtil.success(
      analytics,
      `Growth analytics for ${period} retrieved successfully`,
    );
  }

  @Get('recent-activity')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({
    summary: 'Get recent activity analytics',
    description:
      'Returns detailed recent activity analytics including activity trends, most active users, and activity summaries',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of activities to retrieve (default: 50)',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to analyze (default: 7)',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent activity analytics retrieved successfully',
    type: RecentActivityAnalyticsDto,
  })
  async getRecentActivity(
    @CurrentUser() user: any,
    @Query('limit') limit: number = 50,
    @Query('days') days: number = 7,
  ) {
    const analytics = await this.dashboardService.getRecentActivityAnalytics(
      limit,
      days,
    );

    return ResponseUtil.success(
      analytics,
      'Recent activity analytics retrieved successfully',
    );
  }

  @Get('demographics')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({
    summary: 'Get member demographics analytics',
    description:
      'Returns comprehensive demographic analysis including age, gender, marital status, and geographic distributions',
  })
  @ApiResponse({
    status: 200,
    description: 'Demographics analytics retrieved successfully',
    type: DemographicsDto,
  })
  async getDemographics(@CurrentUser() user: any) {
    const demographics = await this.dashboardService.getDemographicsAnalytics();

    return ResponseUtil.success(
      demographics,
      'Demographics analytics retrieved successfully',
    );
  }
}
