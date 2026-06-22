import { IsOptional, IsDateString, IsMongoId, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '../schemas/event.schema';

// Query params for analytics endpoints
export class EventAnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Start date for analytics range' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for analytics range' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by event type' })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;
}

// Overview statistics response
export class EventOverviewStatsDto {
  @ApiProperty()
  totalEvents: number;

  @ApiProperty()
  publishedEvents: number;

  @ApiProperty()
  completedEvents: number;

  @ApiProperty()
  upcomingEvents: number;

  @ApiProperty()
  totalRegistrations: number;

  @ApiProperty()
  totalAttendees: number;

  @ApiProperty()
  averageAttendanceRate: number;

  @ApiProperty()
  totalTrainingEvents: number;

  @ApiProperty()
  totalCertificationsIssued: number;
}

// Registration analytics
export class RegistrationAnalyticsDto {
  @ApiProperty()
  totalRegistrations: number;

  @ApiProperty()
  confirmedRegistrations: number;

  @ApiProperty()
  pendingRegistrations: number;

  @ApiProperty()
  cancelledRegistrations: number;

  @ApiProperty()
  waitlistedRegistrations: number;

  @ApiProperty()
  attendedRegistrations: number;

  @ApiProperty()
  noShowRegistrations: number;

  @ApiProperty()
  memberRegistrations: number;

  @ApiProperty()
  visitorRegistrations: number;

  @ApiProperty()
  conversionRate: number; // Registered to attended percentage

  @ApiProperty({ type: [Object] })
  registrationsByDay: { date: string; count: number }[];

  @ApiProperty({ type: [Object] })
  registrationsBySource: { source: string; count: number }[];

  @ApiProperty({
    type: [Object],
    description: 'School / university distribution, ranked by count',
  })
  schoolDistribution: { value: string; count: number }[];

  @ApiProperty({
    type: [Object],
    description: '"How did you hear about us" distribution, ranked by count',
  })
  heardAboutDistribution: { value: string; count: number }[];
}

// Session analytics for training events
export class SessionAnalyticsDto {
  @ApiProperty()
  totalSessions: number;

  @ApiProperty()
  completedSessions: number;

  @ApiProperty()
  upcomingSessions: number;

  @ApiProperty()
  averageAttendancePerSession: number;

  @ApiProperty()
  averageLateArrivalPercentage: number;

  @ApiProperty({ type: [Object] })
  attendanceBySession: {
    sessionId: string;
    sessionTitle: string;
    date: string;
    present: number;
    late: number;
    absent: number;
    excused: number;
    attendanceRate: number;
  }[];

  @ApiProperty({ type: [Object] })
  assessmentResults: {
    sessionId: string;
    sessionTitle: string;
    averageScore: number;
    passRate: number;
    totalAttempts: number;
  }[];
}

// Attendee progress tracking
export class AttendeeProgressDto {
  @ApiProperty()
  registrationId: string;

  @ApiProperty()
  attendeeName: string;

  @ApiProperty()
  attendeeEmail: string;

  @ApiProperty()
  attendeeType: string;

  @ApiProperty()
  memberId?: string;

  @ApiProperty()
  totalSessionsAttended: number;

  @ApiProperty()
  totalSessionsRequired: number;

  @ApiProperty()
  attendancePercentage: number;

  @ApiProperty()
  averageAssessmentScore: number;

  @ApiProperty()
  assessmentsPassed: number;

  @ApiProperty()
  assessmentsFailed: number;

  @ApiProperty()
  objectivesCompleted: number;

  @ApiProperty()
  totalObjectives: number;

  @ApiProperty()
  overallProgress: number;

  @ApiProperty()
  isCompleted: boolean;

  @ApiProperty()
  isCertified: boolean;

  @ApiProperty()
  certificationDate?: Date;

  @ApiProperty({ type: [Object] })
  sessionDetails: {
    sessionId: string;
    sessionTitle: string;
    date: string;
    status: string;
    assessmentScore?: number;
    assessmentPassed?: boolean;
  }[];
}

// Training completion summary
export class TrainingCompletionSummaryDto {
  @ApiProperty()
  totalEnrolled: number;

  @ApiProperty()
  totalCompleted: number;

  @ApiProperty()
  totalCertified: number;

  @ApiProperty()
  totalInProgress: number;

  @ApiProperty()
  totalDropped: number;

  @ApiProperty()
  completionRate: number;

  @ApiProperty()
  certificationRate: number;

  @ApiProperty()
  averageCompletionTime: number; // in days

  @ApiProperty({ type: [Object] })
  completionByRequirement: {
    requirementType: string;
    description: string;
    completedCount: number;
    totalRequired: number;
    completionRate: number;
  }[];
}

// Event comparison analytics
export class EventComparisonDto {
  @ApiProperty()
  eventId: string;

  @ApiProperty()
  eventTitle: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  registrationCount: number;

  @ApiProperty()
  attendanceCount: number;

  @ApiProperty()
  attendanceRate: number;

  @ApiProperty()
  completionRate?: number;

  @ApiProperty()
  certificationRate?: number;

  @ApiProperty()
  averageAssessmentScore?: number;
}

// Full event analytics response
export class FullEventAnalyticsDto {
  @ApiProperty()
  eventId: string;

  @ApiProperty()
  eventTitle: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: RegistrationAnalyticsDto })
  registrations: RegistrationAnalyticsDto;

  @ApiProperty({ type: SessionAnalyticsDto })
  sessions?: SessionAnalyticsDto;

  @ApiProperty({ type: TrainingCompletionSummaryDto })
  completion?: TrainingCompletionSummaryDto;

  @ApiProperty({ type: [AttendeeProgressDto] })
  attendeeProgress?: AttendeeProgressDto[];
}

// ========== ENHANCED ANALYTICS & ACCOUNTABILITY DTOs ==========

// Committee member performance tracking
export class CommitteeMemberPerformanceDto {
  @ApiProperty()
  memberId: string;

  @ApiProperty()
  memberName: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  assignedAt: Date;

  @ApiProperty()
  eventsAssigned: number;

  @ApiProperty()
  tasksCompleted: number;

  @ApiProperty()
  tasksTotal: number;

  @ApiProperty()
  checkInsPerformed: number;

  @ApiProperty()
  registrationsProcessed: number;

  @ApiProperty()
  lastActivityDate?: Date;

  @ApiProperty()
  performanceScore: number; // Calculated score 0-100
}

// Committee analytics for an event
export class EventCommitteeAnalyticsDto {
  @ApiProperty()
  totalCommitteeMembers: number;

  @ApiProperty()
  rolesDistribution: { role: string; count: number }[];

  @ApiProperty()
  totalCheckInsPerformed: number;

  @ApiProperty()
  totalRegistrationsProcessed: number;

  @ApiProperty({ type: [CommitteeMemberPerformanceDto] })
  memberPerformance: CommitteeMemberPerformanceDto[];
}

// Attendance trend analytics
export class AttendanceTrendDto {
  @ApiProperty()
  period: string; // 'daily' | 'weekly' | 'monthly'

  @ApiProperty({ type: [Object] })
  trends: {
    date: string;
    registrations: number;
    attendees: number;
    noShows: number;
    attendanceRate: number;
  }[];

  @ApiProperty()
  averageAttendanceRate: number;

  @ApiProperty()
  peakAttendanceDate: string;

  @ApiProperty()
  peakAttendanceCount: number;

  @ApiProperty()
  lowestAttendanceDate: string;

  @ApiProperty()
  lowestAttendanceCount: number;

  @ApiProperty()
  growthRate: number; // Percentage change over period
}

// Event accountability change record
export class EventChangeRecordDto {
  @ApiProperty()
  changeId: string;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  userName: string;

  @ApiProperty()
  action: string; // 'created' | 'updated' | 'deleted' | 'status_changed' | 'registration_added' | etc.

  @ApiProperty()
  entityType: string; // 'event' | 'registration' | 'session' | 'attendance' | 'committee'

  @ApiProperty()
  entityId: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  previousValues?: Record<string, any>;

  @ApiProperty()
  newValues?: Record<string, any>;

  @ApiProperty()
  ipAddress?: string;

  @ApiProperty()
  userAgent?: string;
}

// Event accountability summary
export class EventAccountabilitySummaryDto {
  @ApiProperty()
  eventId: string;

  @ApiProperty()
  totalChanges: number;

  @ApiProperty()
  changesByUser: { userId: string; userName: string; count: number }[];

  @ApiProperty()
  changesByAction: { action: string; count: number }[];

  @ApiProperty()
  changesByEntity: { entityType: string; count: number }[];

  @ApiProperty({ type: [EventChangeRecordDto] })
  recentChanges: EventChangeRecordDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  createdBy: { userId: string; userName: string };

  @ApiProperty()
  lastModifiedAt: Date;

  @ApiProperty()
  lastModifiedBy: { userId: string; userName: string };
}

// Registration funnel analytics
export class RegistrationFunnelDto {
  @ApiProperty()
  eventId: string;

  @ApiProperty()
  stages: {
    stage: string;
    count: number;
    percentage: number;
    dropOffRate: number;
  }[];

  @ApiProperty()
  overallConversionRate: number;

  @ApiProperty()
  averageTimeToConfirmation: number; // in hours

  @ApiProperty()
  averageTimeToCheckIn: number; // in hours

  @ApiProperty()
  peakRegistrationHour: number;

  @ApiProperty()
  peakRegistrationDay: string;
}

// Member engagement analytics
export class MemberEngagementAnalyticsDto {
  @ApiProperty()
  totalUniqueAttendees: number;

  @ApiProperty()
  repeatAttendees: number;

  @ApiProperty()
  firstTimeAttendees: number;

  @ApiProperty()
  repeatAttendeeRate: number;

  @ApiProperty({ type: [Object] })
  topAttendees: {
    memberId: string;
    memberName: string;
    eventsAttended: number;
    totalSessions: number;
    averageAttendanceRate: number;
  }[];

  @ApiProperty({ type: [Object] })
  attendeesByEventType: {
    eventType: string;
    uniqueAttendees: number;
    totalAttendances: number;
  }[];

  @ApiProperty({ type: [Object] })
  engagementTrend: {
    month: string;
    uniqueAttendees: number;
    totalAttendances: number;
    newAttendees: number;
  }[];
}

// Event comparison analytics (for multiple events)
export class EventsComparisonAnalyticsDto {
  @ApiProperty({ type: [EventComparisonDto] })
  events: EventComparisonDto[];

  @ApiProperty()
  bestPerformingEvent: {
    eventId: string;
    eventTitle: string;
    metric: string;
    value: number;
  };

  @ApiProperty()
  averageRegistrations: number;

  @ApiProperty()
  averageAttendanceRate: number;

  @ApiProperty()
  totalEventsAnalyzed: number;

  @ApiProperty({ type: [Object] })
  performanceByType: {
    eventType: string;
    eventCount: number;
    averageRegistrations: number;
    averageAttendanceRate: number;
  }[];
}

// Dashboard overview analytics
export class EventsDashboardAnalyticsDto {
  @ApiProperty({ type: EventOverviewStatsDto })
  overview: EventOverviewStatsDto;

  @ApiProperty({ type: AttendanceTrendDto })
  attendanceTrends: AttendanceTrendDto;

  @ApiProperty({ type: MemberEngagementAnalyticsDto })
  memberEngagement: MemberEngagementAnalyticsDto;

  @ApiProperty({ type: [Object] })
  upcomingEvents: {
    eventId: string;
    title: string;
    startDate: Date;
    registrationCount: number;
    capacity?: number;
    capacityPercentage?: number;
  }[];

  @ApiProperty({ type: [Object] })
  recentActivity: {
    timestamp: Date;
    action: string;
    description: string;
    user?: string;
  }[];

  @ApiProperty({ type: [Object] })
  eventsByMonth: {
    month: string;
    total: number;
    completed: number;
    cancelled: number;
  }[];
}

// Check-in analytics
export class CheckInAnalyticsDto {
  @ApiProperty()
  totalCheckIns: number;

  @ApiProperty()
  checkInsByMethod: { method: string; count: number }[]; // 'manual' | 'qr_code'

  @ApiProperty()
  averageCheckInTime: string; // Average time of check-in (HH:mm)

  @ApiProperty()
  peakCheckInHour: number;

  @ApiProperty({ type: [Object] })
  checkInTimeline: {
    time: string;
    count: number;
  }[];

  @ApiProperty()
  earlyCheckIns: number; // More than 30 mins before event

  @ApiProperty()
  onTimeCheckIns: number; // Within 15 mins of start

  @ApiProperty()
  lateCheckIns: number; // More than 15 mins after start

  @ApiProperty()
  checkedInByCommittee: { memberId: string; memberName: string; count: number }[];
}

// Query DTO for trend analytics
export class TrendAnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Start date for trend analysis' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for trend analysis' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Period granularity: daily, weekly, monthly' })
  @IsOptional()
  period?: 'daily' | 'weekly' | 'monthly';

  @ApiPropertyOptional({ description: 'Filter by event type' })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiPropertyOptional({ description: 'Campus ID filter' })
  @IsOptional()
  @IsMongoId()
  branchId?: string;
}

// Query DTO for accountability logs
export class AccountabilityQueryDto {
  @ApiPropertyOptional({ description: 'Start date for log range' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for log range' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by action type' })
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by entity type' })
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ========== PARTICIPANT ACCOUNTABILITY DTOs ==========

// Individual participant accountability record
export class ParticipantAccountabilityDto {
  @ApiProperty()
  registrationId: string;

  @ApiProperty()
  participantId?: string;

  @ApiProperty()
  participantName: string;

  @ApiProperty()
  participantEmail: string;

  @ApiProperty()
  participantPhone?: string;

  @ApiProperty()
  participantType: string; // 'member' | 'visitor'

  @ApiProperty()
  registrationDate: Date;

  @ApiProperty()
  registrationStatus: string;

  // Attendance accountability
  @ApiProperty()
  totalSessionsRequired: number;

  @ApiProperty()
  sessionsAttended: number;

  @ApiProperty()
  sessionsAbsent: number;

  @ApiProperty()
  sessionsExcused: number;

  @ApiProperty()
  lateArrivals: number;

  @ApiProperty()
  attendancePercentage: number;

  @ApiProperty()
  attendanceStatus: string; // 'excellent' | 'good' | 'needs_improvement' | 'at_risk' | 'failed'

  // Assessment accountability
  @ApiProperty()
  totalAssessments: number;

  @ApiProperty()
  assessmentsCompleted: number;

  @ApiProperty()
  assessmentsPassed: number;

  @ApiProperty()
  assessmentsFailed: number;

  @ApiProperty()
  averageAssessmentScore: number;

  @ApiProperty()
  assessmentStatus: string; // 'passing' | 'failing' | 'incomplete'

  // Training completion accountability
  @ApiProperty()
  completionPercentage: number;

  @ApiProperty()
  isEligibleForCertification: boolean;

  @ApiProperty()
  certificationStatus: string; // 'not_started' | 'in_progress' | 'completed' | 'certified' | 'failed'

  @ApiProperty()
  certificationDate?: Date;

  @ApiProperty()
  certificateNumber?: string;

  // Detailed session records
  @ApiProperty({ type: [Object] })
  sessionRecords: {
    sessionId: string;
    sessionTitle: string;
    sessionDate: Date;
    attendanceStatus: string;
    checkInTime?: Date;
    checkOutTime?: Date;
    lateByMinutes?: number;
    assessmentScore?: number;
    assessmentPassed?: boolean;
    facilitatorNotes?: string;
  }[];

  // Accountability flags
  @ApiProperty()
  requiresFollowUp: boolean;

  @ApiProperty()
  followUpReason?: string;

  @ApiProperty()
  lastActivityDate?: Date;

  @ApiProperty()
  daysInactive?: number;
}

// Participant accountability summary for an event
export class EventParticipantAccountabilitySummaryDto {
  @ApiProperty()
  eventId: string;

  @ApiProperty()
  eventTitle: string;

  @ApiProperty()
  totalParticipants: number;

  @ApiProperty()
  activeParticipants: number;

  @ApiProperty()
  inactiveParticipants: number;

  @ApiProperty()
  droppedParticipants: number;

  // Attendance summary
  @ApiProperty()
  averageAttendanceRate: number;

  @ApiProperty()
  excellentAttendance: number; // >= 90%

  @ApiProperty()
  goodAttendance: number; // 75-89%

  @ApiProperty()
  needsImprovement: number; // 60-74%

  @ApiProperty()
  atRisk: number; // 40-59%

  @ApiProperty()
  failed: number; // < 40%

  // Assessment summary
  @ApiProperty()
  averageAssessmentScore: number;

  @ApiProperty()
  passingParticipants: number;

  @ApiProperty()
  failingParticipants: number;

  @ApiProperty()
  incompleteAssessments: number;

  // Certification summary
  @ApiProperty()
  eligibleForCertification: number;

  @ApiProperty()
  certified: number;

  @ApiProperty()
  pendingCertification: number;

  @ApiProperty()
  certificationRate: number;

  // Accountability alerts
  @ApiProperty({ type: [Object] })
  alerts: {
    type: string; // 'missed_sessions' | 'failing_assessment' | 'inactive' | 'at_risk'
    severity: string; // 'low' | 'medium' | 'high' | 'critical'
    count: number;
    participants: { id: string; name: string }[];
  }[];

  @ApiProperty({ type: [ParticipantAccountabilityDto] })
  participants: ParticipantAccountabilityDto[];
}

// Participant attendance report
export class ParticipantAttendanceReportDto {
  @ApiProperty()
  participantId?: string;

  @ApiProperty()
  participantName: string;

  @ApiProperty()
  participantEmail: string;

  @ApiProperty()
  participantType: string;

  @ApiProperty({ type: [Object] })
  eventAttendance: {
    eventId: string;
    eventTitle: string;
    eventType: string;
    startDate: Date;
    endDate: Date;
    registrationStatus: string;
    sessionsTotal: number;
    sessionsAttended: number;
    attendanceRate: number;
    assessmentScore?: number;
    isCertified: boolean;
  }[];

  @ApiProperty()
  totalEventsRegistered: number;

  @ApiProperty()
  totalEventsAttended: number;

  @ApiProperty()
  totalSessionsAttended: number;

  @ApiProperty()
  overallAttendanceRate: number;

  @ApiProperty()
  totalCertifications: number;

  @ApiProperty()
  averageAssessmentScore: number;

  @ApiProperty()
  engagementScore: number; // Calculated engagement score
}

// Training accountability report
export class TrainingAccountabilityReportDto {
  @ApiProperty()
  eventId: string;

  @ApiProperty()
  eventTitle: string;

  @ApiProperty()
  reportGeneratedAt: Date;

  @ApiProperty()
  reportGeneratedBy?: string;

  // Summary statistics
  @ApiProperty()
  totalEnrolled: number;

  @ApiProperty()
  totalActive: number;

  @ApiProperty()
  totalCompleted: number;

  @ApiProperty()
  totalDropped: number;

  @ApiProperty()
  completionRate: number;

  @ApiProperty()
  averageProgress: number;

  // Session-by-session breakdown
  @ApiProperty({ type: [Object] })
  sessionBreakdown: {
    sessionId: string;
    sessionTitle: string;
    sessionDate: Date;
    expectedAttendees: number;
    actualAttendees: number;
    attendanceRate: number;
    lateArrivals: number;
    absences: number;
    excused: number;
    assessmentAverage?: number;
    assessmentPassRate?: number;
  }[];

  // Participant status breakdown
  @ApiProperty({ type: [Object] })
  participantStatusBreakdown: {
    status: string;
    count: number;
    percentage: number;
    participants: {
      id: string;
      name: string;
      email: string;
      progress: number;
    }[];
  }[];

  // At-risk participants
  @ApiProperty({ type: [Object] })
  atRiskParticipants: {
    registrationId: string;
    participantName: string;
    participantEmail: string;
    riskLevel: string; // 'medium' | 'high' | 'critical'
    riskFactors: string[];
    currentProgress: number;
    missedSessions: number;
    failedAssessments: number;
    recommendedAction: string;
  }[];

  // Top performers
  @ApiProperty({ type: [Object] })
  topPerformers: {
    registrationId: string;
    participantName: string;
    attendanceRate: number;
    assessmentAverage: number;
    overallScore: number;
  }[];
}

// Query DTO for participant accountability
export class ParticipantAccountabilityQueryDto {
  @ApiPropertyOptional({ description: 'Filter by attendance status' })
  @IsOptional()
  attendanceStatus?: 'excellent' | 'good' | 'needs_improvement' | 'at_risk' | 'failed';

  @ApiPropertyOptional({ description: 'Filter by certification status' })
  @IsOptional()
  certificationStatus?: 'not_started' | 'in_progress' | 'completed' | 'certified' | 'failed';

  @ApiPropertyOptional({ description: 'Filter only participants requiring follow-up' })
  @IsOptional()
  requiresFollowUp?: boolean;

  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsOptional()
  sortBy?: 'name' | 'attendance' | 'progress' | 'score' | 'lastActivity';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
