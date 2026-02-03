import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CallReport, CallReportDocument } from './schemas/call-report.schema';
import { FirstTimer, FirstTimerDocument } from './schemas/first-timer.schema';
import { CreateCallReportDto } from './dto/create-call-report.dto';
import { QueueService } from '../queue/queue.service';
import { Member, MemberDocument } from '../members/schemas/member.schema';

@Injectable()
export class CallReportsService {
  private readonly logger = new Logger(CallReportsService.name);

  constructor(
    @InjectModel(CallReport.name)
    private callReportModel: Model<CallReportDocument>,
    @InjectModel(FirstTimer.name)
    private firstTimerModel: Model<FirstTimerDocument>,
    @InjectModel(Member.name)
    private memberModel: Model<MemberDocument>,
    private queueService: QueueService,
  ) {}

  async create(
    createCallReportDto: CreateCallReportDto,
    userId: string,
  ): Promise<CallReport> {
    // Validate first timer exists
    const firstTimer = await this.firstTimerModel.findById(
      createCallReportDto.firstTimerId,
    );
    if (!firstTimer) {
      throw new NotFoundException('First timer not found');
    }

    const firstTimerObjectId = new Types.ObjectId(
      createCallReportDto.firstTimerId,
    );

    // Check if report number already exists for this first timer
    const existingReport = await this.callReportModel.findOne({
      firstTimerId: firstTimerObjectId,
      reportNumber: createCallReportDto.reportNumber,
    });

    if (existingReport) {
      throw new ConflictException(
        `Call report ${createCallReportDto.reportNumber} already exists for this first timer`,
      );
    }

    // Validate report number sequence
    if (createCallReportDto.reportNumber > 1) {
      const previousReportNumber = createCallReportDto.reportNumber - 1;
      const previousReport = await this.callReportModel.findOne({
        firstTimerId: firstTimerObjectId,
        reportNumber: previousReportNumber,
      });

      if (!previousReport) {
        throw new BadRequestException(
          `Call report ${previousReportNumber} must be created before report ${createCallReportDto.reportNumber}`,
        );
      }
    }

    // Create the call report
    const callReport = new this.callReportModel({
      ...createCallReportDto,
      firstTimerId: new Types.ObjectId(createCallReportDto.firstTimerId),
      callMadeBy: new Types.ObjectId(userId),
      callDate: new Date(createCallReportDto.callDate),
      nextFollowUpDate: createCallReportDto.nextFollowUpDate
        ? new Date(createCallReportDto.nextFollowUpDate)
        : undefined,
    });

    const savedReport = await callReport.save();

    // Update first timer's call reports count
    await this.firstTimerModel.findByIdAndUpdate(
      createCallReportDto.firstTimerId,
      {
        $inc: { callReportsCount: 1 },
        $set: {
          lastStatusChange: new Date(),
        },
      },
    );

    // Schedule follow-up reminder if nextFollowUpDate is provided
    if (createCallReportDto.nextFollowUpDate) {
      this.logger.log(
        `nextFollowUpDate provided: ${createCallReportDto.nextFollowUpDate}, scheduling reminder...`,
      );
      await this.scheduleFollowUpReminderForReport(
        firstTimer,
        userId,
        new Date(createCallReportDto.nextFollowUpDate),
        createCallReportDto.notes,
      );
    } else {
      this.logger.log('No nextFollowUpDate provided, skipping reminder scheduling');
    }

    return savedReport.populate([
      { path: 'callMadeBy', select: 'firstName lastName email' },
      { path: 'firstTimerId', select: 'firstName lastName phone email' },
    ]);
  }

  /**
   * Schedule a follow-up reminder for a call report
   */
  private async scheduleFollowUpReminderForReport(
    firstTimer: FirstTimerDocument,
    callMadeById: string,
    scheduledDate: Date,
    notes?: string,
  ): Promise<void> {
    this.logger.log(
      `scheduleFollowUpReminderForReport called - callMadeById: ${callMadeById}, scheduledDate: ${scheduledDate}`,
    );

    try {
      // Get the caller's information
      const caller = await this.memberModel.findById(callMadeById);
      if (!caller || !caller.email) {
        this.logger.warn(
          `Cannot schedule reminder: Caller ${callMadeById} not found or has no email`,
        );
        return;
      }

      this.logger.log(`Found caller: ${caller.firstName} ${caller.lastName} (${caller.email})`);

      const firstTimerId = (firstTimer._id as Types.ObjectId).toString();

      const job = await this.queueService.scheduleFollowUpReminder(
        {
          firstTimerId,
          assignedPersonEmail: caller.email,
          assignedPersonName: `${caller.firstName} ${caller.lastName}`,
          firstTimerName: `${firstTimer.firstName} ${firstTimer.lastName}`,
          firstTimerPhone: firstTimer.phone,
          firstTimerEmail: firstTimer.email,
          followUpNotes: notes,
        },
        scheduledDate,
      );

      this.logger.log(
        `✅ Successfully scheduled follow-up reminder - Job ID: ${job.id}, First Timer: ${firstTimerId}, Scheduled: ${scheduledDate}`,
      );
    } catch (error) {
      // Don't fail the call report creation if scheduling fails
      this.logger.error(
        `❌ Failed to schedule follow-up reminder: ${error.message}`,
      );
    }
  }

  async findByFirstTimer(firstTimerId: string): Promise<CallReport[]> {
    if (!Types.ObjectId.isValid(firstTimerId)) {
      throw new BadRequestException('Invalid first timer ID');
    }

    const reports = await this.callReportModel
      .find({ firstTimerId: new Types.ObjectId(firstTimerId) })
      .sort({ reportNumber: 1, createdAt: 1 })
      .populate([
        { path: 'callMadeBy', select: 'firstName lastName email' },
        { path: 'firstTimerId', select: 'firstName lastName phone email' },
      ])
      .exec();

    this.logger.log(
      `findByFirstTimer(${firstTimerId}): found ${reports.length} reports - numbers: [${reports.map((r) => r.reportNumber).join(', ')}]`,
    );

    return reports;
  }

  async findById(id: string): Promise<CallReport> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid call report ID');
    }

    const callReport = await this.callReportModel
      .findById(id)
      .populate([
        { path: 'callMadeBy', select: 'firstName lastName email' },
        { path: 'firstTimerId', select: 'firstName lastName phone email' },
      ])
      .exec();

    if (!callReport) {
      throw new NotFoundException('Call report not found');
    }

    return callReport;
  }

  async update(
    id: string,
    updateData: Partial<CreateCallReportDto>,
  ): Promise<CallReport> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid call report ID');
    }

    const callReport = await this.callReportModel.findById(id);
    if (!callReport) {
      throw new NotFoundException('Call report not found');
    }

    // Update the call report
    const updatedReport = await this.callReportModel
      .findByIdAndUpdate(
        id,
        {
          ...updateData,
          callDate: updateData.callDate
            ? new Date(updateData.callDate)
            : callReport.callDate,
          nextFollowUpDate: updateData.nextFollowUpDate
            ? new Date(updateData.nextFollowUpDate)
            : callReport.nextFollowUpDate,
        },
        { new: true },
      )
      .populate([
        { path: 'callMadeBy', select: 'firstName lastName email' },
        { path: 'firstTimerId', select: 'firstName lastName phone email' },
      ])
      .exec();

    return updatedReport!;
  }

  async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid call report ID');
    }

    const callReport = await this.callReportModel.findById(id);
    if (!callReport) {
      throw new NotFoundException('Call report not found');
    }

    await this.callReportModel.findByIdAndDelete(id);

    // Decrement first timer's call reports count
    await this.firstTimerModel.findByIdAndUpdate(callReport.firstTimerId, {
      $inc: { callReportsCount: -1 },
      $set: { lastStatusChange: new Date() },
    });
  }

  async getCallReportsSummary(firstTimerId: string): Promise<{
    totalReports: number;
    completedReports: number;
    remainingReports: number;
    lastContactDate?: Date;
    nextFollowUpDate?: Date;
    serviceAttendance: {
      attended2nd: boolean;
      attended3rd: boolean;
      attended4th: boolean;
    };
    statusBreakdown: Record<string, number>;
    contactMethodBreakdown: Record<string, number>;
    avgDaysBetweenReports?: number;
    isOverdue?: boolean;
  }> {
    if (!Types.ObjectId.isValid(firstTimerId)) {
      throw new BadRequestException('Invalid first timer ID');
    }

    const reports = await this.callReportModel
      .find({ firstTimerId })
      .sort({ reportNumber: 1 })
      .exec();

    const completedReports = reports.length;
    const remainingReports = Math.max(0, 4 - completedReports);

    // Get service attendance from reports
    const serviceAttendance = {
      attended2nd: reports.some((r) => r.attended2ndService),
      attended3rd: reports.some((r) => r.attended3rdService),
      attended4th: reports.some((r) => r.attended4thService),
    };

    // Status breakdown
    const statusBreakdown = reports.reduce(
      (acc, report) => {
        acc[report.status] = (acc[report.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Contact method breakdown
    const contactMethodBreakdown = reports.reduce(
      (acc, report) => {
        acc[report.contactMethod] = (acc[report.contactMethod] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Get dates
    const sortedReports = reports.sort(
      (a, b) => new Date(b.callDate).getTime() - new Date(a.callDate).getTime(),
    );
    const lastContactDate = sortedReports[0]?.callDate;
    const nextFollowUpDate = sortedReports.find(
      (r) => r.nextFollowUpDate,
    )?.nextFollowUpDate;

    // Calculate average days between reports
    let avgDaysBetweenReports: number | undefined;
    if (reports.length > 1) {
      const chronologicalReports = reports.sort(
        (a, b) =>
          new Date(a.callDate).getTime() - new Date(b.callDate).getTime(),
      );
      let totalDays = 0;
      for (let i = 1; i < chronologicalReports.length; i++) {
        const daysDiff = Math.abs(
          (new Date(chronologicalReports[i].callDate).getTime() -
            new Date(chronologicalReports[i - 1].callDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        totalDays += daysDiff;
      }
      avgDaysBetweenReports = Math.round(
        totalDays / (chronologicalReports.length - 1),
      );
    }

    // Check if overdue (if last contact was more than 14 days ago and reports incomplete)
    const isOverdue =
      lastContactDate &&
      remainingReports > 0 &&
      Date.now() - new Date(lastContactDate).getTime() >
        14 * 24 * 60 * 60 * 1000;

    return {
      totalReports: 4,
      completedReports,
      remainingReports,
      lastContactDate,
      nextFollowUpDate,
      serviceAttendance,
      statusBreakdown,
      contactMethodBreakdown,
      avgDaysBetweenReports,
      isOverdue,
    };
  }

  // New comprehensive analytics methods
  // Configurable threshold for pending follow-ups (in hours)
  private readonly PENDING_FOLLOWUP_THRESHOLD_HOURS = 48;

  async getGlobalCallReportsAnalytics(params?: {
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{
    totalReports: number;
    totalFirstTimers: number;
    avgReportsPerFirstTimer: number;
    completionRate: number;
    conversionRate: number;
    statusDistribution: Array<{ status: string; count: number }>;
    methodDistribution: Array<{ method: string; count: number }>;
    overdueFirstTimers: number;
    pendingFollowUps: number;
    contactedToday: number;
    monthlyTrends: Array<{
      month: string;
      reportsCreated: number;
      firstTimersWithReports: number;
    }>;
    dateRange?: {
      fromDate: Date;
      toDate: Date;
    };
  }> {
    // Build date filter if provided
    const dateFilter: any = {};
    if (params?.fromDate || params?.toDate) {
      dateFilter.callDate = {};
      if (params?.fromDate) {
        dateFilter.callDate.$gte = params.fromDate;
      }
      if (params?.toDate) {
        // Set toDate to end of day
        const endOfDay = new Date(params.toDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.callDate.$lte = endOfDay;
      }
    }

    const [totalReports, statusData, methodData, firstTimerCount, monthlyData] =
      await Promise.all([
        this.callReportModel.countDocuments(dateFilter),
        // Get status distribution as array
        this.callReportModel.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              status: '$_id',
              count: 1,
            },
          },
        ]),
        // Get method distribution as array
        this.callReportModel.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: '$contactMethod',
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              method: '$_id',
              count: 1,
            },
          },
        ]),
        // Get unique first timers count
        this.callReportModel.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: '$firstTimerId',
            },
          },
          {
            $count: 'total',
          },
        ]),
        // Get monthly trends
        this.callReportModel.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
              },
              reportsCreated: { $sum: 1 },
              firstTimersWithReports: { $addToSet: '$firstTimerId' },
            },
          },
          {
            $project: {
              _id: 1,
              reportsCreated: 1,
              firstTimersWithReports: { $size: '$firstTimersWithReports' },
            },
          },
          { $sort: { '_id.year': -1, '_id.month': -1 } },
          { $limit: 12 },
        ]),
      ]);

    const totalFirstTimers = firstTimerCount[0]?.total || 0;
    const avgReportsPerFirstTimer =
      totalFirstTimers > 0 ? totalReports / totalFirstTimers : 0;

    // Calculate completion rate (first timers with all 4 reports)
    const firstTimersWithAllReports = await this.firstTimerModel.countDocuments(
      {
        callReportsCount: 4,
      },
    );
    const completionRate =
      totalFirstTimers > 0
        ? (firstTimersWithAllReports / totalFirstTimers) * 100
        : 0;

    // Count overdue first timers
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const overdueFirstTimers = await this.firstTimerModel.countDocuments({
      callReportsCount: { $lt: 4 },
      lastStatusChange: { $lt: twoWeeksAgo },
      isActive: true,
      stage: { $ne: 'closed' },
    });

    // Count pending follow-ups: first timers created more than 48 hours ago with no follow-up records
    const thresholdDate = new Date(
      Date.now() - this.PENDING_FOLLOWUP_THRESHOLD_HOURS * 60 * 60 * 1000,
    );
    const pendingFollowUps = await this.firstTimerModel.countDocuments({
      createdAt: { $lt: thresholdDate },
      followUpCount: 0,
      isActive: true,
      isArchived: false,
      status: { $nin: ['CLOSED'] },
    });

    // Count follow-ups done today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const contactedToday = await this.callReportModel.countDocuments({
      callDate: { $gte: todayStart, $lte: todayEnd },
    });

    // Format monthly trends
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
    const monthlyTrends = monthlyData
      .map((item) => ({
        month: `${monthNames[item._id.month - 1]} ${item._id.year}`,
        reportsCreated: item.reportsCreated,
        firstTimersWithReports: item.firstTimersWithReports,
      }))
      .reverse();

    // Calculate conversion rate (successful + interested / total reports)
    const successfulCount = statusData.reduce((acc, item) => {
      if (['successful', 'interested', 'completed'].includes(item.status)) {
        return acc + item.count;
      }
      return acc;
    }, 0);
    const conversionRate =
      totalReports > 0 ? (successfulCount / totalReports) * 100 : 0;

    return {
      totalReports,
      totalFirstTimers,
      avgReportsPerFirstTimer: Math.round(avgReportsPerFirstTimer * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      statusDistribution: statusData,
      methodDistribution: methodData,
      overdueFirstTimers,
      pendingFollowUps,
      contactedToday,
      monthlyTrends,
      ...(params?.fromDate && params?.toDate
        ? {
            dateRange: {
              fromDate: params.fromDate,
              toDate: params.toDate,
            },
          }
        : {}),
    };
  }

  async getTeamPerformanceAnalytics(params?: {
    fromDate?: Date;
    toDate?: Date;
  }): Promise<
    Array<{
      member: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
      reportCount: number;
      contactCount: number;
      uniqueContacts: number;
      totalAssigned: number;
      expectedContacts: number;
      contactCompletionRate: number;
      pendingFollowUps: number;
      conversionRate: number;
      avgReportsPerFirstTimer: number;
      firstTimersManaged: number;
      avgDaysBetweenReports: number;
      overdueFirstTimers: number;
    }>
  > {
    // Build date filter if provided
    const dateFilter: any = {};
    if (params?.fromDate || params?.toDate) {
      dateFilter.callDate = {};
      if (params?.fromDate) {
        dateFilter.callDate.$gte = params.fromDate;
      }
      if (params?.toDate) {
        // Set toDate to end of day
        const endOfDay = new Date(params.toDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.callDate.$lte = endOfDay;
      }
    }

    const pipeline: any[] = [];

    // Add date filter match at the beginning if provided
    if (Object.keys(dateFilter).length > 0) {
      pipeline.push({ $match: dateFilter });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'members',
          localField: 'callMadeBy',
          foreignField: '_id',
          as: 'memberInfo',
        },
      },
      {
        $unwind: '$memberInfo',
      },
      {
        $group: {
          _id: '$callMadeBy',
          memberInfo: { $first: '$memberInfo' },
          totalReports: { $sum: 1 },
          successfulReports: {
            $sum: {
              $cond: [
                { $in: ['$status', ['successful', 'interested', 'completed']] },
                1,
                0,
              ],
            },
          },
          firstTimersManaged: { $addToSet: '$firstTimerId' },
          reports: { $push: '$$ROOT' },
        },
      },
      {
        $project: {
          _id: 1,
          memberInfo: 1,
          totalReports: 1,
          successfulReports: 1,
          firstTimersManaged: { $size: '$firstTimersManaged' },
          reports: 1,
        },
      },
    );

    const teamStats = await this.callReportModel.aggregate(pipeline);

    const result: Array<{
      member: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
      reportCount: number;
      contactCount: number;
      uniqueContacts: number;
      totalAssigned: number;
      expectedContacts: number;
      contactCompletionRate: number;
      pendingFollowUps: number;
      conversionRate: number;
      avgReportsPerFirstTimer: number;
      firstTimersManaged: number;
      avgDaysBetweenReports: number;
      overdueFirstTimers: number;
    }> = [];
    for (const stat of teamStats) {
      const successRate =
        stat.totalReports > 0
          ? (stat.successfulReports / stat.totalReports) * 100
          : 0;
      const avgReportsPerFirstTimer =
        stat.firstTimersManaged > 0
          ? stat.totalReports / stat.firstTimersManaged
          : 0;

      // Calculate average days between reports
      const reports = stat.reports.sort(
        (a, b) =>
          new Date(a.callDate).getTime() - new Date(b.callDate).getTime(),
      );
      let avgDaysBetweenReports = 0;
      if (reports.length > 1) {
        let totalDays = 0;
        for (let i = 1; i < reports.length; i++) {
          const daysDiff = Math.abs(
            (new Date(reports[i].callDate).getTime() -
              new Date(reports[i - 1].callDate).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          totalDays += daysDiff;
        }
        avgDaysBetweenReports = Math.round(totalDays / (reports.length - 1));
      }

      // Count overdue first timers for this team member
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const overdueFirstTimers = await this.firstTimerModel.countDocuments({
        assignedTo: stat._id,
        callReportsCount: { $lt: 4 },
        lastStatusChange: { $lt: twoWeeksAgo },
        isActive: true,
        stage: { $ne: 'closed' },
      });

      // Count pending follow-ups for this team member
      const memberPendingFollowUps = await this.firstTimerModel.countDocuments({
        assignedTo: stat._id,
        followUpCount: 0,
        isActive: true,
        isArchived: false,
        status: { $nin: ['CLOSED'] },
      });

      // Count total first timers assigned to this member
      const totalAssigned = await this.firstTimerModel.countDocuments({
        assignedTo: stat._id,
        isActive: true,
        isArchived: false,
      });

      // Expected contacts = total assigned (each first timer should be contacted)
      // Expected call reports = totalAssigned * 4 (4 reports per first timer)
      const expectedContacts = totalAssigned;
      const expectedCallReports = totalAssigned * 4;

      // Contact completion rate: unique contacts / total assigned * 100
      const contactCompletionRate =
        totalAssigned > 0
          ? (stat.firstTimersManaged / totalAssigned) * 100
          : 0;

      result.push({
        member: {
          _id: stat.memberInfo._id,
          firstName: stat.memberInfo.firstName,
          lastName: stat.memberInfo.lastName,
          email: stat.memberInfo.email,
        },
        reportCount: stat.totalReports,
        contactCount: stat.totalReports,
        uniqueContacts: stat.firstTimersManaged,
        totalAssigned,
        expectedContacts,
        contactCompletionRate: Math.round(contactCompletionRate * 100) / 100,
        pendingFollowUps: memberPendingFollowUps,
        conversionRate: Math.round(successRate * 100) / 100,
        avgReportsPerFirstTimer:
          Math.round(avgReportsPerFirstTimer * 100) / 100,
        firstTimersManaged: stat.firstTimersManaged,
        avgDaysBetweenReports,
        overdueFirstTimers,
      });
    }

    return result.sort((a, b) => b.reportCount - a.reportCount);
  }

  async getOverdueReports(): Promise<
    Array<{
      firstTimer: {
        _id: string;
        firstName: string;
        lastName: string;
        phone: string;
        email?: string;
        dateOfVisit: Date;
      };
      assignedTo?: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
      lastContactDate?: Date;
      daysSinceLastContact: number;
      completedReports: number;
      remainingReports: number;
    }>
  > {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const overdueFirstTimers = await this.firstTimerModel
      .find({
        callReportsCount: { $lt: 4 },
        lastStatusChange: { $lt: twoWeeksAgo },
        isActive: true,
        stage: { $ne: 'closed' },
      })
      .populate('assignedTo', 'firstName lastName email')
      .exec();

    const result: Array<{
      firstTimer: {
        _id: string;
        firstName: string;
        lastName: string;
        phone: string;
        email?: string;
        dateOfVisit: Date;
      };
      assignedTo?: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
      lastContactDate?: Date;
      daysSinceLastContact: number;
      completedReports: number;
      remainingReports: number;
    }> = [];
    for (const firstTimer of overdueFirstTimers) {
      const lastReport = await this.callReportModel
        .findOne({ firstTimerId: firstTimer._id })
        .sort({ callDate: -1 })
        .exec();

      const lastContactDate = lastReport?.callDate;
      const daysSinceLastContact = lastContactDate
        ? Math.floor(
            (Date.now() - new Date(lastContactDate).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : Math.floor(
            (Date.now() - new Date(firstTimer.dateOfVisit).getTime()) /
              (1000 * 60 * 60 * 24),
          );

      result.push({
        firstTimer: {
          _id: firstTimer._id as string,
          firstName: firstTimer.firstName,
          lastName: firstTimer.lastName,
          phone: firstTimer.phone,
          email: firstTimer.email,
          dateOfVisit: firstTimer.dateOfVisit,
        },
        assignedTo: firstTimer.assignedTo
          ? {
              _id: (firstTimer.assignedTo as any)._id,
              firstName: (firstTimer.assignedTo as any).firstName,
              lastName: (firstTimer.assignedTo as any).lastName,
              email: (firstTimer.assignedTo as any).email,
            }
          : undefined,
        lastContactDate,
        daysSinceLastContact,
        completedReports: firstTimer.callReportsCount,
        remainingReports: 4 - firstTimer.callReportsCount,
      });
    }

    return result.sort(
      (a, b) => b.daysSinceLastContact - a.daysSinceLastContact,
    );
  }

  async searchCallReports(params: {
    page?: number;
    limit?: number;
    status?: string;
    contactMethod?: string;
    callMadeBy?: string;
    fromDate?: Date;
    toDate?: Date;
    firstTimerName?: string;
    callerName?: string;
  }): Promise<{
    reports: CallReport[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      contactMethod,
      callMadeBy,
      fromDate,
      toDate,
      firstTimerName,
      callerName,
    } = params;

    const skip = (page - 1) * limit;
    const filter: any = {};

    if (status) filter.status = status;
    if (contactMethod) filter.contactMethod = contactMethod;
    if (callMadeBy) filter.callMadeBy = callMadeBy;

    if (fromDate || toDate) {
      filter.callDate = {};
      if (fromDate) {
        filter.callDate.$gte = fromDate;
      }
      if (toDate) {
        // Set toDate to end of day to include all records from that day
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        filter.callDate.$lte = endOfDay;
      }
    }

    const pipeline: any[] = [
      { $match: filter },
      // Convert firstTimerId string to ObjectId for lookup
      {
        $addFields: {
          firstTimerIdObj: {
            $cond: {
              if: { $eq: [{ $type: '$firstTimerId' }, 'string'] },
              then: { $toObjectId: '$firstTimerId' },
              else: '$firstTimerId',
            },
          },
        },
      },
      {
        $lookup: {
          from: 'firsttimers',
          localField: 'firstTimerIdObj',
          foreignField: '_id',
          as: 'firstTimerInfo',
        },
      },
      {
        $lookup: {
          from: 'members',
          localField: 'callMadeBy',
          foreignField: '_id',
          as: 'memberInfo',
        },
      },
      {
        $unwind: {
          path: '$firstTimerInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: '$memberInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    // Add first timer name search if provided
    if (firstTimerName) {
      pipeline.push({
        $match: {
          $or: [
            {
              'firstTimerInfo.firstName': {
                $regex: firstTimerName,
                $options: 'i',
              },
            },
            {
              'firstTimerInfo.lastName': {
                $regex: firstTimerName,
                $options: 'i',
              },
            },
            {
              $expr: {
                $regexMatch: {
                  input: {
                    $concat: [
                      '$firstTimerInfo.firstName',
                      ' ',
                      '$firstTimerInfo.lastName',
                    ],
                  },
                  regex: firstTimerName,
                  options: 'i',
                },
              },
            },
          ],
        },
      });
    }

    // Add caller name search if provided
    if (callerName) {
      pipeline.push({
        $match: {
          $or: [
            {
              'memberInfo.firstName': {
                $regex: callerName,
                $options: 'i',
              },
            },
            {
              'memberInfo.lastName': {
                $regex: callerName,
                $options: 'i',
              },
            },
            {
              $expr: {
                $regexMatch: {
                  input: {
                    $concat: [
                      '$memberInfo.firstName',
                      ' ',
                      '$memberInfo.lastName',
                    ],
                  },
                  regex: callerName,
                  options: 'i',
                },
              },
            },
          ],
        },
      });
    }

    // Add projection to rename fields to match frontend expectations
    const projectionStage = {
      $project: {
        _id: 1,
        firstTimerId: 1,
        callDate: 1,
        status: 1,
        notes: 1,
        deductions: 1,
        contactMethod: 1,
        nextFollowUpDate: 1,
        reportNumber: 1,
        visitNumber: 1,
        attended2ndService: 1,
        attended3rdService: 1,
        attended4thService: 1,
        createdAt: 1,
        updatedAt: 1,
        contactDate: '$callDate',
        // Rename firstTimerInfo to firstTimer (handle null)
        firstTimer: {
          $cond: {
            if: { $ifNull: ['$firstTimerInfo', false] },
            then: {
              _id: '$firstTimerInfo._id',
              firstName: '$firstTimerInfo.firstName',
              lastName: '$firstTimerInfo.lastName',
              phone: '$firstTimerInfo.phone',
              email: '$firstTimerInfo.email',
            },
            else: null,
          },
        },
        // Rename memberInfo to callMadeBy (handle null)
        callMadeBy: {
          $cond: {
            if: { $ifNull: ['$memberInfo', false] },
            then: {
              _id: '$memberInfo._id',
              firstName: '$memberInfo.firstName',
              lastName: '$memberInfo.lastName',
              email: '$memberInfo.email',
            },
            else: null,
          },
        },
      },
    };

    const [reports, totalCount] = await Promise.all([
      this.callReportModel.aggregate([
        ...pipeline,
        projectionStage,
        { $sort: { callDate: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      this.callReportModel.aggregate([...pipeline, { $count: 'total' }]),
    ]);

    const total = totalCount[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      reports: reports as CallReport[],
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}
