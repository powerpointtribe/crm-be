import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import {
  ServiceAttendance,
  ServiceAttendanceDocument,
  AttendanceStatus,
  CheckInMethod,
  ServiceType,
} from './schemas/service-attendance.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { GroupType } from '../common/enums/group-types.enum';
import { MembershipStatus } from '../common/enums/member-status.enum';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { BulkCheckInDto } from './dto/bulk-check-in.dto';
import { GroupMeetingAttendanceDto } from './dto/group-meeting-attendance.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';

@Injectable()
export class ServiceAttendanceService {
  constructor(
    @InjectModel(ServiceAttendance.name)
    private readonly attendanceModel: Model<ServiceAttendanceDocument>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
  ) {}

  private async updateMemberEngagement(
    memberId: string,
    serviceDate: Date,
  ): Promise<void> {
    await this.memberModel.findByIdAndUpdate(memberId, {
      $set: { 'engagement.lastAttendance': serviceDate },
      $inc: { 'engagement.attendanceCount': 1 },
    });
  }

  async checkIn(
    dto: CreateAttendanceDto,
    checkedInBy: string,
    branch: string,
  ): Promise<ServiceAttendanceDocument> {
    const existing = await this.attendanceModel.findOne({
      member: dto.member,
      serviceDate: dto.serviceDate,
      serviceType: dto.serviceType,
    });

    if (existing) {
      throw new ConflictException(
        'Attendance already recorded for this member at this service',
      );
    }

    const record = new this.attendanceModel({
      ...dto,
      branch,
      checkedInBy,
      checkInTime: dto.checkInTime || new Date(),
      status: dto.status || AttendanceStatus.PRESENT,
      checkInMethod: dto.checkInMethod || CheckInMethod.MANUAL,
    });

    const saved = await record.save();
    this.updateMemberEngagement(dto.member, dto.serviceDate).catch(() => {});
    return saved;
  }

  async bulkCheckIn(
    dto: BulkCheckInDto,
    checkedInBy: string,
    branch: string,
  ): Promise<{ created: number; skipped: number }> {
    const existing = await this.attendanceModel.find({
      member: { $in: dto.memberIds },
      serviceDate: dto.serviceDate,
      serviceType: dto.serviceType,
    }).select('member');

    const existingMemberIds = new Set(
      existing.map((r) => r.member.toString()),
    );

    const newRecords = dto.memberIds
      .filter((id) => !existingMemberIds.has(id))
      .map((memberId) => ({
        member: memberId,
        branch,
        serviceDate: dto.serviceDate,
        serviceType: dto.serviceType,
        status: AttendanceStatus.PRESENT,
        checkInMethod: dto.checkInMethod || CheckInMethod.MANUAL,
        checkInTime: new Date(),
        checkedInBy,
        serviceReport: dto.serviceReport,
      }));

    if (newRecords.length > 0) {
      await this.attendanceModel.insertMany(newRecords, { ordered: false });
      Promise.all(
        newRecords.map((r) =>
          this.updateMemberEngagement(r.member as string, dto.serviceDate),
        ),
      ).catch(() => {});
    }

    return {
      created: newRecords.length,
      skipped: existingMemberIds.size,
    };
  }

  async recordGroupMeeting(
    dto: GroupMeetingAttendanceDto,
    checkedInBy: string,
  ): Promise<{ present: number; absent: number; skipped: number }> {
    const group = await this.groupModel
      .findById(dto.groupId)
      .select('members branch type')
      .exec();
    if (!group) throw new NotFoundException('Group not found');

    const serviceType =
      group.type === GroupType.DISTRICT
        ? ServiceType.DISTRICT_MEETING
        : ServiceType.UNIT_MEETING;

    const allMemberIds = group.members.map((m) => m.toString());
    const presentSet = new Set(dto.presentMemberIds);

    const existing = await this.attendanceModel
      .find({
        group: new Types.ObjectId(dto.groupId),
        serviceDate: dto.meetingDate,
        serviceType,
      })
      .select('member');
    const existingSet = new Set(existing.map((r) => r.member.toString()));

    const records = allMemberIds
      .filter((id) => !existingSet.has(id))
      .map((memberId) => ({
        member: new Types.ObjectId(memberId),
        branch: group.branch,
        serviceDate: dto.meetingDate,
        serviceType,
        status: presentSet.has(memberId)
          ? AttendanceStatus.PRESENT
          : AttendanceStatus.ABSENT,
        checkInMethod: CheckInMethod.MANUAL,
        checkInTime: new Date(),
        checkedInBy: new Types.ObjectId(checkedInBy),
        group: new Types.ObjectId(dto.groupId),
        notes: dto.notes,
      }));

    let present = 0;
    let absent = 0;
    if (records.length > 0) {
      await this.attendanceModel.insertMany(records, { ordered: false });
      for (const r of records) {
        if (r.status === AttendanceStatus.PRESENT) {
          present++;
          this.updateMemberEngagement(
            r.member.toString(),
            dto.meetingDate,
          ).catch(() => {});
        } else {
          absent++;
        }
      }
    }

    return { present, absent, skipped: existingSet.size };
  }

  async getGroupMeetingHistory(
    groupId: string,
    limit = 10,
  ): Promise<any[]> {
    const meetings = await this.attendanceModel.aggregate([
      {
        $match: {
          group: new Types.ObjectId(groupId),
          serviceType: {
            $in: [ServiceType.DISTRICT_MEETING, ServiceType.UNIT_MEETING],
          },
        },
      },
      {
        $group: {
          _id: '$serviceDate',
          present: {
            $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.PRESENT] }, 1, 0] },
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.ABSENT] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: limit },
    ]);

    return meetings.map((m) => ({
      date: m._id,
      present: m.present,
      absent: m.absent,
      total: m.total,
      rate: m.total > 0 ? Math.round((m.present / m.total) * 100) : 0,
    }));
  }

  async getGroupMeetingOverview(branchId?: string) {
    const branchFilter: any = branchId ? { branch: new Types.ObjectId(branchId) } : {};

    // Get all active districts and units
    const groups = await this.groupModel
      .find({
        type: { $in: [GroupType.DISTRICT, GroupType.UNIT] },
        isActive: true,
        ...branchFilter,
      })
      .select('_id name type members districtPastor unitHead')
      .exec();

    if (groups.length === 0) return [];

    const groupIds = groups.map((g: any) => g._id);

    // Aggregate meeting stats per group
    const stats = await this.attendanceModel.aggregate([
      {
        $match: {
          group: { $in: groupIds },
          serviceType: {
            $in: [ServiceType.DISTRICT_MEETING, ServiceType.UNIT_MEETING],
          },
        },
      },
      {
        $group: {
          _id: { group: '$group', date: '$serviceDate' },
          present: {
            $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.PRESENT] }, 1, 0] },
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.ABSENT] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.group',
          totalMeetings: { $sum: 1 },
          lastMeetingDate: { $max: '$_id.date' },
          totalPresent: { $sum: '$present' },
          totalAbsent: { $sum: '$absent' },
          totalRecords: { $sum: '$total' },
        },
      },
    ]);

    const statsMap = new Map(
      stats.map((s) => [s._id.toString(), s]),
    );

    // Get leader names
    const leaderIds = groups
      .flatMap((g: any) => [g.districtPastor, g.unitHead].filter(Boolean))
      .map((id: any) => id.toString());
    const uniqueLeaderIds = [...new Set(leaderIds)];
    const leaders = uniqueLeaderIds.length > 0
      ? await this.memberModel
          .find({ _id: { $in: uniqueLeaderIds } })
          .select('_id firstName lastName')
          .exec()
      : [];
    const leaderMap = new Map(
      leaders.map((l) => [l._id.toString(), `${l.firstName} ${l.lastName}`]),
    );

    const allMemberIds = new Set<string>();
    for (const g of groups) {
      for (const m of (g as any).members || []) {
        allMemberIds.add(m.toString());
      }
    }

    const groupData = groups.map((g: any) => {
      const s = statsMap.get(g._id.toString());
      const leaderId = g.type === 'district' ? g.districtPastor : g.unitHead;
      return {
        _id: g._id,
        name: g.name,
        type: g.type,
        memberCount: g.members?.length || 0,
        leader: leaderId ? leaderMap.get(leaderId.toString()) || null : null,
        totalMeetings: s?.totalMeetings || 0,
        lastMeetingDate: s?.lastMeetingDate || null,
        avgAttendanceRate:
          s && s.totalRecords > 0
            ? Math.round((s.totalPresent / s.totalRecords) * 100)
            : 0,
      };
    });

    return { groups: groupData, uniqueMemberCount: allMemberIds.size };
  }

  async publicVerifyLeader(email: string, password: string) {
    const member = await this.memberModel
      .findOne({ email: email.toLowerCase(), isActive: true })
      .select('_id firstName lastName password branch district unit role additionalRoles')
      .exec();
    if (!member || !member.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, member.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Groups where this member is a formal leader
    const leaderGroups = await this.groupModel
      .find({
        type: { $in: [GroupType.DISTRICT, GroupType.UNIT] },
        isActive: true,
        $or: [
          { districtPastor: member._id },
          { unitHead: member._id },
          { assistantUnitHead: member._id },
        ],
      })
      .select('_id name type members')
      .exec();

    // Also check if member has attendance:record permission and a district/unit assigned
    const leaderGroupIds = new Set(leaderGroups.map((g: any) => g._id.toString()));
    const assignedGroupIds: string[] = [];
    if (member.district && !leaderGroupIds.has(member.district.toString())) {
      assignedGroupIds.push(member.district.toString());
    }
    if (member.unit && !leaderGroupIds.has(member.unit.toString())) {
      assignedGroupIds.push(member.unit.toString());
    }

    let assignedGroups: GroupDocument[] = [];
    if (assignedGroupIds.length > 0) {
      const roleIds = [member.role, ...(member.additionalRoles || [])].filter(Boolean);
      let hasPermission = false;
      if (roleIds.length > 0) {
        const roles = await this.roleModel
          .find({ _id: { $in: roleIds } })
          .populate('permissions', 'name')
          .exec();
        hasPermission = roles.some((r: any) =>
          r.permissions?.some((p: any) => p.name === 'attendance:record'),
        );
      }
      if (hasPermission) {
        assignedGroups = await this.groupModel
          .find({
            _id: { $in: assignedGroupIds },
            type: { $in: [GroupType.DISTRICT, GroupType.UNIT] },
            isActive: true,
          })
          .select('_id name type members')
          .exec();
      }
    }

    const allGroups = [...leaderGroups, ...assignedGroups];
    if (allGroups.length === 0) {
      throw new UnauthorizedException(
        'You are not a leader of any district or unit, or you do not have the required permission',
      );
    }

    // Collect all member IDs across groups and fetch their names
    const allMemberIds = [
      ...new Set(allGroups.flatMap((g: any) => g.members.map((m: any) => m.toString()))),
    ];
    const memberDocs = await this.memberModel
      .find({ _id: { $in: allMemberIds } })
      .select('_id firstName lastName')
      .exec();
    const memberMap = new Map(
      memberDocs.map((m) => [m._id.toString(), { _id: m._id, firstName: m.firstName, lastName: m.lastName }]),
    );

    return {
      leader: {
        _id: member._id,
        firstName: member.firstName,
        lastName: member.lastName,
      },
      groups: allGroups.map((g: any) => ({
        _id: g._id,
        name: g.name,
        type: g.type,
        members: g.members
          .map((id: any) => memberMap.get(id.toString()))
          .filter(Boolean),
      })),
    };
  }

  async selfCheckIn(
    identifier: string,
    serviceDate: Date,
    serviceType: string,
    branch: string,
    notes?: string,
    serviceTitle?: string,
  ): Promise<{ member: { firstName: string; lastName: string }; alreadyCheckedIn: boolean }> {
    const query = identifier.includes('@')
      ? { email: identifier.toLowerCase() }
      : { phone: identifier };

    const member = await this.memberModel.findOne({
      ...query,
      branch: new Types.ObjectId(branch),
      isActive: true,
    });

    if (!member) {
      throw new NotFoundException(
        'No active member found with that phone number or email in this campus',
      );
    }

    const existing = await this.attendanceModel.findOne({
      member: member._id,
      serviceDate,
      serviceType,
    });

    if (existing) {
      return {
        member: { firstName: member.firstName, lastName: member.lastName },
        alreadyCheckedIn: true,
      };
    }

    const record = new this.attendanceModel({
      member: member._id,
      branch: new Types.ObjectId(branch),
      serviceDate,
      serviceType,
      status: AttendanceStatus.PRESENT,
      checkInMethod: CheckInMethod.QR,
      checkInTime: new Date(),
      notes,
      serviceTitle,
    });

    await record.save();
    this.updateMemberEngagement(
      (member._id as Types.ObjectId).toString(),
      serviceDate,
    ).catch(() => {});

    return {
      member: { firstName: member.firstName, lastName: member.lastName },
      alreadyCheckedIn: false,
    };
  }

  async findAll(query: QueryAttendanceDto, userBranch: string) {
    const filter: any = {};

    if (query.branch) {
      filter.branch = query.branch;
    } else {
      filter.branch = userBranch;
    }

    if (query.member) filter.member = query.member;
    if (query.serviceType) filter.serviceType = query.serviceType;

    if (query.startDate || query.endDate) {
      filter.serviceDate = {};
      if (query.startDate) filter.serviceDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.serviceDate.$lte = new Date(query.endDate);
    }

    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const skip = (page - 1) * limit;
    const sortField = query.sortBy || 'serviceDate';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.attendanceModel
        .find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('member', 'firstName lastName email phone profilePicture')
        .populate('checkedInBy', 'firstName lastName')
        .exec(),
      this.attendanceModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findByMember(memberId: string, query: QueryAttendanceDto) {
    const filter: any = { member: memberId };

    if (query.serviceType) filter.serviceType = query.serviceType;
    if (query.startDate || query.endDate) {
      filter.serviceDate = {};
      if (query.startDate) filter.serviceDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.serviceDate.$lte = new Date(query.endDate);
    }

    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.attendanceModel
        .find(filter)
        .sort({ serviceDate: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.attendanceModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async getServiceSessions(branch: string, limit = 20, page = 1) {
    const skip = (page - 1) * limit;
    const match: any = {
      branch: new Types.ObjectId(branch),
      serviceType: {
        $nin: [ServiceType.DISTRICT_MEETING, ServiceType.UNIT_MEETING],
      },
    };

    const [sessions, totalAgg] = await Promise.all([
      this.attendanceModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: { serviceDate: '$serviceDate', serviceType: '$serviceType' },
            totalCheckedIn: {
              $sum: { $cond: [{ $ne: ['$status', AttendanceStatus.ABSENT] }, 1, 0] },
            },
            totalPresent: {
              $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.PRESENT] }, 1, 0] },
            },
            totalLate: {
              $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.LATE] }, 1, 0] },
            },
            totalAbsent: {
              $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.ABSENT] }, 1, 0] },
            },
            total: { $sum: 1 },
            serviceTitle: { $first: '$serviceTitle' },
            lastCheckIn: { $max: '$checkInTime' },
          },
        },
        { $sort: { '_id.serviceDate': -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      this.attendanceModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: { serviceDate: '$serviceDate', serviceType: '$serviceType' },
          },
        },
        { $count: 'total' },
      ]),
    ]);

    const total = totalAgg[0]?.total || 0;

    return {
      data: sessions.map((s) => ({
        serviceDate: s._id.serviceDate,
        serviceType: s._id.serviceType,
        serviceTitle: s.serviceTitle || null,
        totalCheckedIn: s.totalCheckedIn,
        totalPresent: s.totalPresent,
        totalLate: s.totalLate,
        totalAbsent: s.totalAbsent,
        total: s.total,
        lastCheckIn: s.lastCheckIn,
      })),
      total,
      page,
      limit,
    };
  }

  async getServiceAttendees(
    serviceDate: Date,
    serviceType: string,
    branch: string,
  ) {
    const filter: any = { serviceDate, serviceType };
    if (branch) {
      filter.branch = new Types.ObjectId(branch);
    }
    return this.attendanceModel
      .find(filter)
      .populate('member', 'firstName lastName email phone profilePicture')
      .sort({ checkInTime: 1 })
      .exec();
  }

  async update(
    id: string,
    updates: Partial<CreateAttendanceDto>,
  ): Promise<ServiceAttendanceDocument> {
    const record = await this.attendanceModel
      .findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true })
      .exec();

    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }

    return record;
  }

  async delete(id: string): Promise<void> {
    const result = await this.attendanceModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Attendance record not found');
    }
  }

  async getStats(branch: string, startDate?: string, endDate?: string) {
    const match: any = { branch: new Types.ObjectId(branch) };

    if (startDate || endDate) {
      match.serviceDate = {};
      if (startDate) match.serviceDate.$gte = new Date(startDate);
      if (endDate) match.serviceDate.$lte = new Date(endDate);
    }

    const [totalRecords, uniqueMembers, byServiceType, byStatus] =
      await Promise.all([
        this.attendanceModel.countDocuments(match),
        this.attendanceModel.distinct('member', match).then((ids) => ids.length),
        this.attendanceModel.aggregate([
          { $match: match },
          { $group: { _id: '$serviceType', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        this.attendanceModel.aggregate([
          { $match: match },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
      ]);

    return {
      totalRecords,
      uniqueMembers,
      byServiceType: byServiceType.map((s) => ({
        serviceType: s._id,
        count: s.count,
      })),
      byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
    };
  }

  async getTrends(
    branch: string,
    serviceType?: string,
    months: number = 6,
  ) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const match: any = {
      branch: new Types.ObjectId(branch),
      serviceDate: { $gte: startDate },
    };
    if (serviceType) match.serviceType = serviceType;

    return this.attendanceModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: '$serviceDate' },
            month: { $month: '$serviceDate' },
            week: { $isoWeek: '$serviceDate' },
          },
          uniqueMembers: { $addToSet: '$member' },
          totalCheckIns: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          week: '$_id.week',
          uniqueMembers: { $size: '$uniqueMembers' },
          totalCheckIns: 1,
        },
      },
      { $sort: { year: 1, month: 1, week: 1 } },
    ]);
  }

  async getMemberAttendanceSummary(memberId: string, days: number = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const match = {
      member: new Types.ObjectId(memberId),
      serviceDate: { $gte: since },
    };

    const [records, byType] = await Promise.all([
      this.attendanceModel.countDocuments(match),
      this.attendanceModel.aggregate([
        { $match: match },
        { $group: { _id: '$serviceType', count: { $sum: 1 } } },
      ]),
    ]);

    const lastAttendance = await this.attendanceModel
      .findOne({ member: memberId })
      .sort({ serviceDate: -1 })
      .select('serviceDate serviceType')
      .exec();

    return {
      totalInPeriod: records,
      periodDays: days,
      byServiceType: byType.map((t) => ({
        serviceType: t._id,
        count: t.count,
      })),
      lastAttendance: lastAttendance
        ? {
            date: lastAttendance.serviceDate,
            serviceType: lastAttendance.serviceType,
          }
        : null,
    };
  }

  async getRetentionCohorts(branch: string) {
    const now = new Date();
    const periods = [30, 60, 90, 180, 365];

    const cohorts = await Promise.all(
      periods.map(async (days) => {
        const since = new Date(now);
        since.setDate(since.getDate() - days);

        const activeMembers = await this.attendanceModel.distinct('member', {
          branch: new Types.ObjectId(branch),
          serviceDate: { $gte: since },
        });

        return { days, activeCount: activeMembers.length };
      }),
    );

    return cohorts;
  }

  async getAttendanceFrequencyDistribution(
    branch: string,
    days: number = 90,
  ) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const distribution = await this.attendanceModel.aggregate([
      {
        $match: {
          branch: new Types.ObjectId(branch),
          serviceDate: { $gte: since },
        },
      },
      { $group: { _id: '$member', count: { $sum: 1 } } },
      {
        $bucket: {
          groupBy: '$count',
          boundaries: [1, 2, 4, 8, 13, 26, 52, 1000],
          default: '52+',
          output: { members: { $sum: 1 } },
        },
      },
    ]);

    return distribution;
  }

  private readonly logger = new Logger(ServiceAttendanceService.name);

  async markAbsentees(
    branch: string,
    serviceDate: Date,
    serviceType: string,
  ): Promise<{ marked: number }> {
    const branchId = new Types.ObjectId(branch);

    const presentIds = await this.attendanceModel
      .distinct('member', { branch: branchId, serviceDate, serviceType })
      .then((ids) => ids.map((id) => id.toString()));

    const presentSet = new Set(presentIds);

    const activeMembers = await this.memberModel.find(
      {
        branch: branchId,
        isActive: true,
        membershipStatus: { $nin: [MembershipStatus.LEFT, MembershipStatus.RELOCATED] },
      },
      '_id',
    );

    const absentRecords = activeMembers
      .filter((m) => !presentSet.has(m._id.toString()))
      .map((m) => ({
        member: m._id,
        branch: branchId,
        serviceDate,
        serviceType,
        status: AttendanceStatus.ABSENT,
        checkInMethod: CheckInMethod.MANUAL,
      }));

    if (absentRecords.length === 0) return { marked: 0 };

    await this.attendanceModel.insertMany(absentRecords, { ordered: false }).catch(() => {});

    return { marked: absentRecords.length };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoAbsent() {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recentServices = await this.attendanceModel.aggregate([
      {
        $match: {
          serviceDate: { $gte: today },
          createdAt: { $lte: sixHoursAgo },
        },
      },
      {
        $group: {
          _id: { branch: '$branch', serviceDate: '$serviceDate', serviceType: '$serviceType' },
        },
      },
    ]);

    for (const svc of recentServices) {
      const { branch, serviceDate, serviceType } = svc._id;

      const alreadyHasAbsent = await this.attendanceModel.exists({
        branch,
        serviceDate,
        serviceType,
        status: AttendanceStatus.ABSENT,
      });
      if (alreadyHasAbsent) continue;

      const result = await this.markAbsentees(
        branch.toString(),
        serviceDate,
        serviceType,
      );
      if (result.marked > 0) {
        this.logger.log(
          `Auto-marked ${result.marked} absentees for ${serviceType} on ${serviceDate.toISOString().split('T')[0]}`,
        );
      }
    }
  }
}
