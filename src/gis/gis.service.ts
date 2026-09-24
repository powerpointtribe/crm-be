import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { FirstTimer, FirstTimerDocument } from '../first-timers/schemas/first-timer.schema';
import {
  ServiceAttendance,
  ServiceAttendanceDocument,
  ServiceType,
  AttendanceStatus,
} from '../service-attendance/schemas/service-attendance.schema';
import {
  ServiceReport,
  ServiceReportDocument,
} from '../service-reports/schemas/service-report.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import {
  WorkerTrainee,
  WorkerTraineeDocument,
} from '../workers-training/schemas/worker-trainee.schema';
import { GisSnapshot, GisSnapshotDocument } from './schemas/gis-snapshot.schema';
import { Branch } from '../branches/schemas/branch.schema';
import { MembershipStatus } from '../common/enums/member-status.enum';
import { GroupType } from '../common/enums/group-types.enum';
import { WorkersTrainingStatus } from '../common/enums/workers-training.enum';

@Injectable()
export class GisService {
  constructor(
    @InjectModel(Member.name) private readonly memberModel: Model<MemberDocument>,
    @InjectModel(FirstTimer.name) private readonly firstTimerModel: Model<FirstTimerDocument>,
    @InjectModel(ServiceAttendance.name) private readonly attendanceModel: Model<ServiceAttendanceDocument>,
    @InjectModel(ServiceReport.name) private readonly serviceReportModel: Model<ServiceReportDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(WorkerTrainee.name) private readonly traineeModel: Model<WorkerTraineeDocument>,
    @InjectModel(GisSnapshot.name) private readonly snapshotModel: Model<GisSnapshotDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<any>,
  ) {}

  async getDashboard(branch?: string, startDate?: Date, endDate?: Date) {
    const branchId = branch ? new Types.ObjectId(branch) : undefined;
    const end = endDate || new Date();
    const start = startDate || undefined;

    const [metrics, funnel] = await Promise.all([
      this.computeMetrics(branchId, end, start),
      this.computeFunnel(branchId, end, start),
    ]);

    return { metrics, funnel };
  }

  async computeMetrics(branchId: Types.ObjectId | undefined, now: Date, rangeStart?: Date) {
    const periodStart = rangeStart || new Date(now.getFullYear(), now.getMonth(), 1);
    const days60Ago = new Date(now.getTime() - 60 * 86400000);
    const longWindow = rangeStart || new Date(now.getTime() - 90 * 86400000);
    const attendanceWindow = rangeStart || new Date(now.getTime() - 28 * 86400000);

    const branchFilter = branchId ? { branch: branchId } : {};
    const activeFilter = {
      ...branchFilter,
      isActive: true,
      membershipStatus: { $nin: [MembershipStatus.LEFT, MembershipStatus.RELOCATED] },
    };

    const dateRange = rangeStart
      ? { $gte: rangeStart, $lte: now }
      : { $gte: periodStart };

    const [
      totalActiveMembers,
      avgSundayAttendance,
      firstTimerCount,
      firstTimerConverted,
      firstTimerTotal,
      attendedLast90,
      newMembersThisMonth,
      membersWithGroup,
      membersInUnits,
      baptizedMembers,
      inTraining,
      avgEngagement,
      attritionCount,
      followedUp,
      totalFirstTimersMonth,
      inactiveMembers,
    ] = await Promise.all([
      // 1. Total active members
      this.memberModel.countDocuments(activeFilter),

      // 2. Average Sunday attendance
      this.serviceReportModel.aggregate([
        {
          $match: {
            ...branchFilter,
            date: rangeStart ? dateRange : { $gte: attendanceWindow },
          },
        },
        { $group: { _id: null, avg: { $avg: '$totalAttendance' } } },
      ]).then((r) => Math.round(r[0]?.avg || 0)),

      // 3. First-timer count in period
      this.firstTimerModel.countDocuments({
        ...branchFilter,
        dateOfVisit: dateRange,
      }),

      // 4a. First-timers converted in period
      this.firstTimerModel.countDocuments({
        ...branchFilter,
        dateOfVisit: rangeStart ? dateRange : { $gte: longWindow },
        converted: true,
      }),

      // 4b. Total first-timers in period (for rate)
      this.firstTimerModel.countDocuments({
        ...branchFilter,
        dateOfVisit: rangeStart ? dateRange : { $gte: longWindow },
      }),

      // 5. Members who attended at least once in period
      this.attendanceModel
        .distinct('member', {
          ...branchFilter,
          serviceDate: rangeStart ? dateRange : { $gte: longWindow },
        })
        .then((ids) => ids.length),

      // 8. New members in period
      this.memberModel.countDocuments({
        ...activeFilter,
        dateJoined: dateRange,
      }),

      // 6. Members in a district or fellowship group (small group participation)
      this.groupModel.aggregate([
        {
          $match: {
            ...branchFilter,
            isActive: true,
            type: { $in: [GroupType.DISTRICT, GroupType.FELLOWSHIP] },
          },
        },
        { $project: { memberCount: { $size: '$members' } } },
        { $group: { _id: null, total: { $sum: '$memberCount' } } },
      ]).then((r) => r[0]?.total || 0),

      // 7. Members assigned to a unit (serving)
      this.memberModel.countDocuments({
        ...activeFilter,
        unit: { $ne: null },
      }),

      // 10. Members who completed baptism class or have baptism date
      this.memberModel.countDocuments({
        ...activeFilter,
        $or: [
          { 'spiritualJourney.baptismClass.completed': true },
          { baptismDate: { $ne: null } },
        ],
      }),

      // 11. Currently in training
      this.traineeModel.countDocuments({
        ...branchFilter,
        status: { $in: [WorkersTrainingStatus.REGISTERED, WorkersTrainingStatus.IN_PROGRESS] },
      }),

      // 13. Average engagement score
      this.memberModel.aggregate([
        { $match: activeFilter },
        { $group: { _id: null, avg: { $avg: '$engagement.engagementScore' } } },
      ]).then((r) => Math.round((r[0]?.avg || 0) * 10) / 10),

      // 14. Attrition in period
      this.memberModel.countDocuments({
        ...branchFilter,
        membershipStatus: { $in: [MembershipStatus.LEFT, MembershipStatus.RELOCATED] },
        exitDate: dateRange,
      }),

      // 15a. First-timers who got at least one follow-up in period
      this.firstTimerModel.countDocuments({
        ...branchFilter,
        dateOfVisit: dateRange,
        followUpCount: { $gte: 1 },
      }),

      // 15b. Total first-timers in period (for follow-up rate)
      this.firstTimerModel.countDocuments({
        ...branchFilter,
        dateOfVisit: dateRange,
      }),

      // 9. Inactive members — when a custom range is given, members who didn't attend in that range;
      // otherwise members with no attendance in the last 60 days
      rangeStart
        ? this.attendanceModel
            .distinct('member', { ...branchFilter, serviceDate: { $gte: rangeStart, $lte: now } })
            .then(async (attendedIds) => {
              const total = await this.memberModel.countDocuments(activeFilter);
              return total - attendedIds.length;
            })
        : this.memberModel.countDocuments({
            ...activeFilter,
            $or: [
              { 'engagement.lastAttendance': { $lt: days60Ago } },
              { 'engagement.lastAttendance': null },
            ],
          }),
    ]);

    const firstTimerConversionRate =
      firstTimerTotal > 0
        ? Math.round((firstTimerConverted / firstTimerTotal) * 1000) / 10
        : 0;

    const retentionRate90Day =
      totalActiveMembers > 0
        ? Math.round((attendedLast90 / totalActiveMembers) * 1000) / 10
        : 0;

    const smallGroupParticipationRate =
      totalActiveMembers > 0
        ? Math.round((membersWithGroup / totalActiveMembers) * 1000) / 10
        : 0;

    const servingRate =
      totalActiveMembers > 0
        ? Math.round((membersInUnits / totalActiveMembers) * 1000) / 10
        : 0;

    const baptismRate =
      totalActiveMembers > 0
        ? Math.round((baptizedMembers / totalActiveMembers) * 1000) / 10
        : 0;

    const meetingAttendanceFilter: any = {
      serviceType: { $in: [ServiceType.DISTRICT_MEETING, ServiceType.UNIT_MEETING] },
      status: AttendanceStatus.PRESENT,
      serviceDate: rangeStart ? { $gte: rangeStart, $lte: now } : { $gte: longWindow },
    };
    if (branchId) meetingAttendanceFilter.branch = branchId;
    const distinctMeetingAttendees = await this.attendanceModel.distinct(
      'member',
      meetingAttendanceFilter,
    );
    const districtUnitParticipationRate =
      totalActiveMembers > 0
        ? Math.round((distinctMeetingAttendees.length / totalActiveMembers) * 1000) / 10
        : 0;

    // Estimate last month's total: current - joined this month + left this month
    const estimatedPrevTotal = totalActiveMembers - newMembersThisMonth + attritionCount;
    const growthRate =
      estimatedPrevTotal > 0
        ? Math.round(((totalActiveMembers - estimatedPrevTotal) / estimatedPrevTotal) * 1000) / 10
        : 0;

    const followUpRate =
      totalFirstTimersMonth > 0
        ? Math.round((followedUp / totalFirstTimersMonth) * 1000) / 10
        : 0;

    const [regularAttendees, exitReasons] = await Promise.all([
      this.attendanceModel.aggregate([
        {
          $match: {
            ...branchFilter,
            serviceDate: rangeStart ? { $gte: rangeStart, $lte: now } : { $gte: longWindow },
          },
        },
        { $group: { _id: '$member', count: { $sum: 1 } } },
        { $match: { count: { $gte: 4 } } },
        { $count: 'total' },
      ]).then((r) => r[0]?.total || 0),

      this.memberModel.aggregate([
        {
          $match: {
            ...branchFilter,
            membershipStatus: { $in: [MembershipStatus.LEFT, MembershipStatus.RELOCATED] },
            exitDate: rangeStart ? { $gte: rangeStart, $lte: now } : dateRange,
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$exitReason', 'Not specified'] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]).then((r) => r.map((item) => ({ reason: item._id, count: item.count }))),
    ]);

    return {
      totalActiveMembers,
      avgSundayAttendance,
      firstTimerCount,
      firstTimerConversionRate,
      retentionRate90Day,
      smallGroupParticipationRate,
      servingRate,
      newMembersThisMonth,
      inactiveMembers,
      baptismRate,
      districtUnitParticipationRate,
      leadershipPipelineCount: inTraining,
      growthRate,
      avgEngagementScore: avgEngagement,
      attritionCount,
      followUpRate,
      regularAttendees,
      exitReasons,
    };
  }

  async computeFunnel(branchId: Types.ObjectId | undefined, now: Date, rangeStart?: Date) {
    const longWindow = rangeStart || new Date(now.getTime() - 90 * 86400000);
    const dateRange = rangeStart ? { $gte: rangeStart, $lte: now } : { $gte: longWindow };
    const branchFilter = branchId ? { branch: branchId } : {};
    const activeFilter = {
      ...branchFilter,
      isActive: true,
      membershipStatus: { $nin: [MembershipStatus.LEFT, MembershipStatus.RELOCATED] },
    };

    const [
      reachCount,
      visitCount,
      allMembers,
      membersInDistricts,
      completedFoundation,
      membersInUnits,
      leadersCount,
    ] = await Promise.all([
      // Reach: aggregate service attendance (total footfall)
      this.serviceReportModel.aggregate([
        {
          $match: {
            ...branchFilter,
            date: dateRange,
          },
        },
        { $group: { _id: null, total: { $sum: '$totalAttendance' } } },
      ]).then((r) => r[0]?.total || 0),

      // Visit: first-timers in period
      this.firstTimerModel.countDocuments({
        ...branchFilter,
        dateOfVisit: dateRange,
      }),

      // Connect + Belong base: all active members
      this.memberModel.countDocuments(activeFilter),

      // Belong: members assigned to a district
      this.memberModel.countDocuments({ ...activeFilter, district: { $ne: null } }),

      // Grow: completed foundation class
      this.memberModel.countDocuments({
        ...activeFilter,
        'spiritualJourney.foundationClass.completed': true,
      }),

      // Serve: members assigned to a unit
      this.memberModel.countDocuments({ ...activeFilter, unit: { $ne: null } }),

      // Lead: LXL or higher
      this.memberModel.countDocuments({
        ...activeFilter,
        membershipStatus: {
          $in: [
            MembershipStatus.LXL,
            MembershipStatus.DIRECTOR,
            MembershipStatus.PASTOR,
            MembershipStatus.CAMPUS_PASTOR,
            MembershipStatus.SENIOR_PASTOR,
          ],
        },
      }),
    ]);

    return {
      reach: reachCount,
      visit: visitCount,
      connect: allMembers,
      belong: membersInDistricts,
      grow: completedFoundation,
      serve: membersInUnits,
      lead: leadersCount,
      multiply: 0,
    };
  }

  async getDistrictView(districtId: string) {
    const district = await this.groupModel.findById(districtId);
    if (!district) throw new NotFoundException('District not found');

    const memberIds = district.members.map((m) => new Types.ObjectId(m.toString()));
    if (memberIds.length === 0) {
      return {
        district: { id: districtId, name: district.name },
        memberCount: 0,
        metrics: null,
      };
    }

    const now = new Date();
    const days60Ago = new Date(now.getTime() - 60 * 86400000);
    const days90Ago = new Date(now.getTime() - 90 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const memberFilter = { _id: { $in: memberIds }, isActive: true };

    const [
      totalMembers,
      attendedLast90,
      inactiveCount,
      withUnit,
      avgEngagement,
      firstTimersConverted,
    ] = await Promise.all([
      this.memberModel.countDocuments(memberFilter),
      this.attendanceModel
        .distinct('member', {
          member: { $in: memberIds },
          serviceDate: { $gte: days90Ago },
        })
        .then((ids) => ids.length),
      this.memberModel.countDocuments({
        ...memberFilter,
        $or: [
          { 'engagement.lastAttendance': { $lt: days60Ago } },
          { 'engagement.lastAttendance': null },
        ],
      }),
      this.memberModel.countDocuments({
        ...memberFilter,
        unit: { $ne: null },
      }),
      this.memberModel.aggregate([
        { $match: memberFilter },
        { $group: { _id: null, avg: { $avg: '$engagement.engagementScore' } } },
      ]).then((r) => Math.round((r[0]?.avg || 0) * 10) / 10),
      this.firstTimerModel.countDocuments({
        branch: district.branch,
        converted: true,
        memberRecord: { $in: memberIds },
      }),
    ]);

    return {
      district: { id: districtId, name: district.name },
      memberCount: totalMembers,
      metrics: {
        retentionRate: totalMembers > 0
          ? Math.round((attendedLast90 / totalMembers) * 1000) / 10
          : 0,
        inactiveCount,
        servingRate: totalMembers > 0
          ? Math.round((withUnit / totalMembers) * 1000) / 10
          : 0,
        avgEngagementScore: avgEngagement,
        conversionsFromFirstTimers: firstTimersConverted,
      },
    };
  }

  async getUnitView(unitId: string) {
    const unit = await this.groupModel.findById(unitId);
    if (!unit) throw new NotFoundException('Unit not found');

    const memberIds = unit.members.map((m) => new Types.ObjectId(m.toString()));
    const days90Ago = new Date(Date.now() - 90 * 86400000);

    const [totalMembers, activeInPeriod, avgEngagement] = await Promise.all([
      memberIds.length,
      this.attendanceModel
        .distinct('member', {
          member: { $in: memberIds },
          serviceDate: { $gte: days90Ago },
        })
        .then((ids) => ids.length),
      this.memberModel.aggregate([
        { $match: { _id: { $in: memberIds }, isActive: true } },
        { $group: { _id: null, avg: { $avg: '$engagement.engagementScore' } } },
      ]).then((r) => Math.round((r[0]?.avg || 0) * 10) / 10),
    ]);

    return {
      unit: { id: unitId, name: unit.name, type: unit.type },
      memberCount: totalMembers,
      metrics: {
        activeRate: totalMembers > 0
          ? Math.round((activeInPeriod / totalMembers) * 1000) / 10
          : 0,
        avgEngagementScore: avgEngagement,
      },
    };
  }

  async getMemberJourney(memberId: string) {
    const member = await this.memberModel
      .findById(memberId)
      .select(
        'firstName lastName membershipStatus district unit dateJoined baptismDate engagement spiritualJourney exitDate exitReason previousStatus',
      )
      .populate('district', 'name')
      .populate('unit', 'name')
      .exec();

    if (!member) throw new NotFoundException('Member not found');

    const days90Ago = new Date(Date.now() - 90 * 86400000);

    const [attendanceCount, isInTraining, firstTimerRecord] = await Promise.all([
      this.attendanceModel.countDocuments({
        member: new Types.ObjectId(memberId),
        serviceDate: { $gte: days90Ago },
      }),
      this.traineeModel.findOne({
        member: new Types.ObjectId(memberId),
        status: { $in: [WorkersTrainingStatus.REGISTERED, WorkersTrainingStatus.IN_PROGRESS] },
      }),
      this.firstTimerModel.findOne({
        memberRecord: new Types.ObjectId(memberId),
      }).select('dateOfVisit conversionDate followUpCount'),
    ]);

    const stage = this.assignFunnelStage(member, attendanceCount, isInTraining);

    return {
      member: {
        id: memberId,
        name: `${member.firstName} ${member.lastName}`,
        status: member.membershipStatus,
        dateJoined: member.dateJoined,
      },
      funnelStage: stage,
      engagement: member.engagement,
      spiritualJourney: member.spiritualJourney,
      attendance90Days: attendanceCount,
      inTraining: !!isInTraining,
      district: member.district,
      unit: member.unit,
      firstTimerOrigin: firstTimerRecord
        ? {
            visitDate: firstTimerRecord.dateOfVisit,
            conversionDate: firstTimerRecord.conversionDate,
            followUps: firstTimerRecord.followUpCount,
          }
        : null,
    };
  }

  private assignFunnelStage(
    member: MemberDocument,
    attendanceCount: number,
    inTraining: any,
  ): string {
    const status = member.membershipStatus;
    const leaderStatuses = [
      MembershipStatus.LXL,
      MembershipStatus.DIRECTOR,
      MembershipStatus.PASTOR,
      MembershipStatus.CAMPUS_PASTOR,
      MembershipStatus.SENIOR_PASTOR,
    ];

    if (leaderStatuses.includes(status as MembershipStatus)) return 'lead';
    if (member.unit) return 'serve';
    if (
      member.spiritualJourney?.foundationClass?.completed ||
      member.spiritualJourney?.baptismClass?.completed ||
      inTraining
    )
      return 'grow';
    if (member.district) return 'belong';
    if (attendanceCount >= 4) return 'connect';
    return 'connect';
  }

  async getTrends(branch?: string, months: number = 6, period: 'weekly' | 'monthly' = 'weekly') {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const filter: any = {
      snapshotDate: { $gte: since },
      period,
    };
    if (branch) filter.branch = new Types.ObjectId(branch);

    const snapshots = await this.snapshotModel
      .find(filter)
      .sort({ snapshotDate: 1 })
      .select('snapshotDate branch metrics funnelCounts')
      .exec();

    if (!branch && snapshots.length > 0) {
      const byDate = new Map<string, any>();
      for (const s of snapshots) {
        const key = s.snapshotDate.toISOString().slice(0, 10);
        if (!byDate.has(key)) {
          byDate.set(key, {
            snapshotDate: s.snapshotDate,
            metrics: { ...s.metrics },
            funnelCounts: { ...s.funnelCounts },
          });
        } else {
          const agg = byDate.get(key);
          const m = agg.metrics;
          const sm = s.metrics as any;
          m.totalActiveMembers += sm.totalActiveMembers || 0;
          m.avgSundayAttendance += sm.avgSundayAttendance || 0;
          m.firstTimerCount += sm.firstTimerCount || 0;
          m.newMembersThisMonth += sm.newMembersThisMonth || 0;
          m.inactiveMembers += sm.inactiveMembers || 0;
          m.leadershipPipelineCount += sm.leadershipPipelineCount || 0;
          m.attritionCount += sm.attritionCount || 0;
          const f = agg.funnelCounts;
          const sf = s.funnelCounts as any;
          for (const k of ['reach', 'visit', 'connect', 'belong', 'grow', 'serve', 'lead', 'multiply']) {
            f[k] = (f[k] || 0) + (sf[k] || 0);
          }
        }
      }
      return Array.from(byDate.values());
    }

    return snapshots;
  }

  async getDirectorateView(directorateGroupId: string) {
    const directorateGroup = await this.groupModel.findById(directorateGroupId);
    if (!directorateGroup) throw new NotFoundException('Directorate group not found');

    const districts: GroupDocument[] = await this.groupModel.find({
      branch: directorateGroup.branch,
      type: GroupType.DISTRICT,
      isActive: true,
    });

    const districtViews = await Promise.all(
      districts.map((d) => this.getDistrictView((d as any)._id.toString())),
    );

    const totalMembers = districtViews.reduce((sum, d) => sum + d.memberCount, 0);

    return {
      directorate: {
        id: directorateGroupId,
        name: directorateGroup.name,
      },
      totalMembers,
      districtCount: districts.length,
      districts: districtViews,
    };
  }

  async takeSnapshot(branchId: string, period: 'weekly' | 'monthly' = 'weekly') {
    const branch = new Types.ObjectId(branchId);
    const now = new Date();

    const [metrics, funnel] = await Promise.all([
      this.computeMetrics(branch, now),
      this.computeFunnel(branch, now),
    ]);

    const districts: GroupDocument[] = await this.groupModel.find({
      branch,
      type: GroupType.DISTRICT,
      isActive: true,
    });

    const districtBreakdowns = await Promise.all(
      districts.map(async (d) => {
        const view = await this.getDistrictView((d as any)._id.toString());
        return {
          districtId: (d as any)._id.toString(),
          districtName: d.name,
          memberCount: view.memberCount,
          avgAttendance: 0,
          firstTimerCount: 0,
          conversionRate: 0,
          engagementScore: view.metrics?.avgEngagementScore || 0,
        };
      }),
    );

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return this.snapshotModel.findOneAndUpdate(
      { branch, snapshotDate: today, period },
      {
        $set: {
          metrics,
          funnelCounts: funnel,
          districtBreakdowns,
        },
      },
      { upsert: true, new: true },
    );
  }

  async takeSnapshotAllBranches(period: 'weekly' | 'monthly' = 'weekly') {
    const branches = await this.branchModel.find({ isActive: true }).select('_id name');
    const results: any[] = [];
    for (const branch of branches) {
      const snapshot = await this.takeSnapshot(branch._id.toString(), period);
      results.push({ branch: branch.name, snapshot });
    }
    return results;
  }
}
