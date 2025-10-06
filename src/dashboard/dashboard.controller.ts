import {
  Controller,
  Get,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewDto } from './dto/dashboard-overview.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-roles.enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
  )
  @ApiOperation({ summary: 'Get dashboard overview with key metrics and statistics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview retrieved successfully',
    type: DashboardOverviewDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - User not authenticated',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async getDashboardOverview(@CurrentUser() user: any) {
    const overview = await this.dashboardService.getDashboardOverview(
      user.sub,
      user.role,
    );

    return ResponseUtil.success(overview, 'Dashboard overview retrieved successfully');
  }

  @Get('stats')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
  )
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
      user.role,
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
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
  )
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
      user.role,
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
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
  )
  @ApiOperation({ summary: 'Get pending tasks and notifications' })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully',
  })
  async getPendingTasks(@CurrentUser() user: any) {
    const overview = await this.dashboardService.getDashboardOverview(
      user.sub,
      user.role,
    );

    return ResponseUtil.success(
      overview.upcomingTasks,
      'Pending tasks retrieved successfully',
    );
  }

  @Get('quick-stats')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
    UserRole.MEMBER,
  )
  @ApiOperation({ summary: 'Get quick stats for header/sidebar display' })
  @ApiResponse({
    status: 200,
    description: 'Quick stats retrieved successfully',
  })
  async getQuickStats(@CurrentUser() user: any) {
    const overview = await this.dashboardService.getDashboardOverview(
      user.sub,
      user.role,
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
}