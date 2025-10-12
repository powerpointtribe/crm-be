import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GrowthMetricsDto {
  @ApiProperty({ description: 'Current period count' })
  current: number;

  @ApiProperty({ description: 'Previous period count' })
  previous: number;

  @ApiProperty({ description: 'Percentage change from previous period' })
  percentageChange: number;

  @ApiProperty({ description: 'Growth trend', enum: ['up', 'down', 'stable'] })
  trend: 'up' | 'down' | 'stable';

  @ApiProperty({ description: 'Net change (current - previous)' })
  netChange: number;
}

export class MonthlyGrowthDto {
  @ApiProperty({ description: 'Month name' })
  month: string;

  @ApiProperty({ description: 'Year' })
  year: number;

  @ApiProperty({ description: 'Number of new members' })
  members: number;

  @ApiProperty({ description: 'Number of new first-timers' })
  firstTimers: number;

  @ApiProperty({ description: 'Number of new groups' })
  groups: number;

  @ApiProperty({ description: 'Total growth for the month' })
  totalGrowth: number;
}

export class GrowthAnalyticsDto {
  @ApiProperty({ description: 'Member growth metrics' })
  memberGrowth: GrowthMetricsDto;

  @ApiProperty({ description: 'First-timer growth metrics' })
  firstTimerGrowth: GrowthMetricsDto;

  @ApiProperty({ description: 'Group growth metrics' })
  groupGrowth: GrowthMetricsDto;

  @ApiProperty({ description: 'User growth metrics' })
  userGrowth: GrowthMetricsDto;

  @ApiProperty({
    description: 'Monthly growth data for charts',
    type: [MonthlyGrowthDto],
  })
  monthlyData: MonthlyGrowthDto[];

  @ApiProperty({ description: 'Period analyzed' })
  period: string;

  @ApiProperty({ description: 'Analysis date range' })
  dateRange: {
    start: Date;
    end: Date;
  };
}

export class ActivityItemDto {
  @ApiProperty({ description: 'Activity ID' })
  id: string;

  @ApiProperty({ description: 'Activity type' })
  type:
    | 'member_joined'
    | 'first_timer_visit'
    | 'group_created'
    | 'user_registered'
    | 'bulk_operation';

  @ApiProperty({ description: 'Activity description' })
  description: string;

  @ApiProperty({ description: 'User who performed the action' })
  performer?: {
    id: string;
    name: string;
    role: string;
  };

  @ApiProperty({ description: 'Activity timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'Related entity data' })
  entityData?: {
    id: string;
    name: string;
    type: string;
  };

  @ApiProperty({ description: 'Activity metadata' })
  metadata?: Record<string, any>;
}

export class RecentActivityAnalyticsDto {
  @ApiProperty({
    description: 'Recent activity items',
    type: [ActivityItemDto],
  })
  activities: ActivityItemDto[];

  @ApiProperty({ description: 'Activity summary by type' })
  summary: {
    totalActivities: number;
    memberActivities: number;
    firstTimerActivities: number;
    groupActivities: number;
    userActivities: number;
    bulkOperations: number;
  };

  @ApiProperty({ description: 'Activity trends' })
  trends: {
    todayCount: number;
    yesterdayCount: number;
    weekCount: number;
    monthCount: number;
  };

  @ApiProperty({ description: 'Most active users' })
  mostActiveUsers: Array<{
    userId: string;
    userName: string;
    activityCount: number;
    lastActivity: Date;
  }>;

  @ApiProperty({ description: 'Analysis period' })
  period: string;

  @ApiProperty({ description: 'Last updated timestamp' })
  lastUpdated: Date;
}

export class DemographicsDto {
  @ApiProperty({ description: 'Age group distribution' })
  ageDistribution: Array<{
    ageGroup: string;
    count: number;
    percentage: number;
    growth?: number;
  }>;

  @ApiProperty({ description: 'Gender distribution' })
  genderDistribution: Array<{
    gender: string;
    count: number;
    percentage: number;
    growth?: number;
  }>;

  @ApiProperty({ description: 'Marital status distribution' })
  maritalStatusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;

  @ApiProperty({ description: 'Geographic distribution by state/city' })
  geographicDistribution: Array<{
    location: string;
    count: number;
    percentage: number;
    type: 'state' | 'city';
  }>;

  @ApiProperty({ description: 'Total analyzed members' })
  totalMembers: number;

  @ApiProperty({ description: 'Analysis date' })
  analysisDate: Date;
}
