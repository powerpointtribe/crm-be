import { ApiProperty } from '@nestjs/swagger';

export class DashboardStatsDto {
  @ApiProperty({ description: 'Total number of members' })
  totalMembers: number;

  @ApiProperty({ description: 'Total number of active members' })
  activeMembers: number;

  @ApiProperty({ description: 'Total number of first-timers' })
  totalFirstTimers: number;

  @ApiProperty({ description: 'Total number of users in the system' })
  totalUsers: number;

  @ApiProperty({ description: 'Total number of groups/units' })
  totalGroups: number;
}

export class RecentActivityDto {
  @ApiProperty({ description: 'Recent member registrations' })
  recentMembers: {
    count: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  };

  @ApiProperty({ description: 'Recent first-timer visits' })
  recentFirstTimers: {
    count: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  };

  @ApiProperty({ description: 'Recent group formations' })
  recentGroups: {
    count: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export class MembershipTrendsDto {
  @ApiProperty({ description: 'Monthly membership growth data' })
  monthlyGrowth: Array<{
    month: string;
    members: number;
    firstTimers: number;
  }>;

  @ApiProperty({ description: 'Age group distribution' })
  ageDistribution: Array<{
    ageGroup: string;
    count: number;
    percentage: number;
  }>;

  @ApiProperty({ description: 'Gender distribution' })
  genderDistribution: Array<{
    gender: string;
    count: number;
    percentage: number;
  }>;
}

export class UpcomingTasksDto {
  @ApiProperty({ description: 'Members requiring follow-up' })
  pendingFollowUps: Array<{
    id: string;
    name: string;
    type: 'member' | 'first-timer';
    daysOverdue: number;
    assignedTo?: string;
  }>;

  @ApiProperty({ description: 'Recent bulk operations' })
  recentBulkOperations: Array<{
    id: string;
    type: string;
    status: string;
    processedCount: number;
    totalCount: number;
    createdAt: Date;
  }>;
}

export class DashboardOverviewDto {
  @ApiProperty({ description: 'General statistics' })
  stats: DashboardStatsDto;

  @ApiProperty({ description: 'Recent activity metrics' })
  recentActivity: RecentActivityDto;

  @ApiProperty({ description: 'Membership trends and analytics' })
  membershipTrends: MembershipTrendsDto;

  @ApiProperty({ description: 'Upcoming tasks and notifications' })
  upcomingTasks: UpcomingTasksDto;

  @ApiProperty({ description: 'Current user role for conditional rendering' })
  userRole: string;

  @ApiProperty({ description: 'Last updated timestamp' })
  lastUpdated: Date;
}
