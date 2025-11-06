import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CallReport, CallReportDocument } from './schemas/call-report.schema';
import { FirstTimer, FirstTimerDocument } from './schemas/first-timer.schema';
import { CreateCallReportDto } from './dto/create-call-report.dto';

@Injectable()
export class CallReportsService {
  constructor(
    @InjectModel(CallReport.name)
    private callReportModel: Model<CallReportDocument>,
    @InjectModel(FirstTimer.name)
    private firstTimerModel: Model<FirstTimerDocument>,
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

    // Check if report number already exists for this first timer
    const existingReport = await this.callReportModel.findOne({
      firstTimerId: createCallReportDto.firstTimerId,
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
        firstTimerId: createCallReportDto.firstTimerId,
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
      callMadeBy: userId,
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

    return savedReport.populate([
      { path: 'callMadeBy', select: 'firstName lastName email' },
      { path: 'firstTimerId', select: 'firstName lastName phone email' },
    ]);
  }

  async findByFirstTimer(firstTimerId: string): Promise<CallReport[]> {
    if (!Types.ObjectId.isValid(firstTimerId)) {
      throw new BadRequestException('Invalid first timer ID');
    }

    return this.callReportModel
      .find({ firstTimerId })
      .sort({ reportNumber: 1, createdAt: 1 })
      .populate([
        { path: 'callMadeBy', select: 'firstName lastName email' },
        { path: 'firstTimerId', select: 'firstName lastName phone email' },
      ])
      .exec();
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
    const statusBreakdown = reports.reduce((acc, report) => {
      acc[report.status] = (acc[report.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Contact method breakdown
    const contactMethodBreakdown = reports.reduce((acc, report) => {
      acc[report.contactMethod] = (acc[report.contactMethod] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

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
        (a, b) => new Date(a.callDate).getTime() - new Date(b.callDate).getTime(),
      );
      let totalDays = 0;
      for (let i = 1; i < chronologicalReports.length; i++) {
        const daysDiff = Math.abs(
          (new Date(chronologicalReports[i].callDate).getTime() -
           new Date(chronologicalReports[i-1].callDate).getTime()) /
           (1000 * 60 * 60 * 24)
        );
        totalDays += daysDiff;
      }
      avgDaysBetweenReports = Math.round(totalDays / (chronologicalReports.length - 1));
    }

    // Check if overdue (if last contact was more than 14 days ago and reports incomplete)
    const isOverdue = lastContactDate && remainingReports > 0 &&
      (Date.now() - new Date(lastContactDate).getTime()) > (14 * 24 * 60 * 60 * 1000);

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
  async getGlobalCallReportsAnalytics(): Promise<{
    totalReports: number;
    totalFirstTimers: number;
    avgReportsPerFirstTimer: number;
    completionRate: number;
    statusDistribution: Record<string, number>;
    contactMethodDistribution: Record<string, number>;
    overdueFirstTimers: number;
    monthlyTrends: Array<{
      month: string;
      reportsCreated: number;
      firstTimersWithReports: number;
    }>;
  }> {
    const [totalReports, reportsBreakdown, monthlyData] = await Promise.all([
      this.callReportModel.countDocuments(),
      this.callReportModel.aggregate([
        {
          $group: {
            _id: null,
            statusCounts: {
              $push: {
                k: '$status',
                v: 1
              }
            },
            contactMethodCounts: {
              $push: {
                k: '$contactMethod',
                v: 1
              }
            },
            uniqueFirstTimers: { $addToSet: '$firstTimerId' }
          }
        },
        {
          $project: {
            statusDistribution: { $arrayToObject: '$statusCounts' },
            contactMethodDistribution: { $arrayToObject: '$contactMethodCounts' },
            totalFirstTimers: { $size: '$uniqueFirstTimers' }
          }
        }
      ]),
      this.callReportModel.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            reportsCreated: { $sum: 1 },
            firstTimersWithReports: { $addToSet: '$firstTimerId' }
          }
        },
        {
          $project: {
            _id: 1,
            reportsCreated: 1,
            firstTimersWithReports: { $size: '$firstTimersWithReports' }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ])
    ]);

    const breakdown = reportsBreakdown[0] || {};
    const totalFirstTimers = breakdown.totalFirstTimers || 0;
    const avgReportsPerFirstTimer = totalFirstTimers > 0 ? totalReports / totalFirstTimers : 0;

    // Calculate completion rate (first timers with all 4 reports)
    const firstTimersWithAllReports = await this.firstTimerModel.countDocuments({
      callReportsCount: 4
    });
    const completionRate = totalFirstTimers > 0 ? (firstTimersWithAllReports / totalFirstTimers) * 100 : 0;

    // Count overdue first timers
    const twoWeeksAgo = new Date(Date.now() - (14 * 24 * 60 * 60 * 1000));
    const overdueFirstTimers = await this.firstTimerModel.countDocuments({
      callReportsCount: { $lt: 4 },
      lastStatusChange: { $lt: twoWeeksAgo },
      isActive: true,
      stage: { $ne: 'closed' }
    });

    // Format monthly trends
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const monthlyTrends = monthlyData.map(item => ({
      month: `${monthNames[item._id.month - 1]} ${item._id.year}`,
      reportsCreated: item.reportsCreated,
      firstTimersWithReports: item.firstTimersWithReports
    })).reverse();

    return {
      totalReports,
      totalFirstTimers,
      avgReportsPerFirstTimer: Math.round(avgReportsPerFirstTimer * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
      statusDistribution: breakdown.statusDistribution || {},
      contactMethodDistribution: breakdown.contactMethodDistribution || {},
      overdueFirstTimers,
      monthlyTrends
    };
  }

  async getTeamPerformanceAnalytics(): Promise<Array<{
    callMadeBy: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    totalReports: number;
    avgReportsPerFirstTimer: number;
    successRate: number;
    firstTimersManaged: number;
    avgDaysBetweenReports: number;
    overdueFirstTimers: number;
  }>> {
    const teamStats = await this.callReportModel.aggregate([
      {
        $lookup: {
          from: 'members',
          localField: 'callMadeBy',
          foreignField: '_id',
          as: 'memberInfo'
        }
      },
      {
        $unwind: '$memberInfo'
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
                0
              ]
            }
          },
          firstTimersManaged: { $addToSet: '$firstTimerId' },
          reports: { $push: '$$ROOT' }
        }
      },
      {
        $project: {
          _id: 1,
          memberInfo: 1,
          totalReports: 1,
          successfulReports: 1,
          firstTimersManaged: { $size: '$firstTimersManaged' },
          reports: 1
        }
      }
    ]);

    const result: Array<{
      callMadeBy: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
      totalReports: number;
      avgReportsPerFirstTimer: number;
      successRate: number;
      firstTimersManaged: number;
      avgDaysBetweenReports: number;
      overdueFirstTimers: number;
    }> = [];
    for (const stat of teamStats) {
      const successRate = stat.totalReports > 0 ? (stat.successfulReports / stat.totalReports) * 100 : 0;
      const avgReportsPerFirstTimer = stat.firstTimersManaged > 0 ?
        stat.totalReports / stat.firstTimersManaged : 0;

      // Calculate average days between reports
      const reports = stat.reports.sort((a, b) =>
        new Date(a.callDate).getTime() - new Date(b.callDate).getTime()
      );
      let avgDaysBetweenReports = 0;
      if (reports.length > 1) {
        let totalDays = 0;
        for (let i = 1; i < reports.length; i++) {
          const daysDiff = Math.abs(
            (new Date(reports[i].callDate).getTime() -
             new Date(reports[i-1].callDate).getTime()) /
             (1000 * 60 * 60 * 24)
          );
          totalDays += daysDiff;
        }
        avgDaysBetweenReports = Math.round(totalDays / (reports.length - 1));
      }

      // Count overdue first timers for this team member
      const twoWeeksAgo = new Date(Date.now() - (14 * 24 * 60 * 60 * 1000));
      const overdueFirstTimers = await this.firstTimerModel.countDocuments({
        assignedTo: stat._id,
        callReportsCount: { $lt: 4 },
        lastStatusChange: { $lt: twoWeeksAgo },
        isActive: true,
        stage: { $ne: 'closed' }
      });

      result.push({
        callMadeBy: {
          _id: stat.memberInfo._id,
          firstName: stat.memberInfo.firstName,
          lastName: stat.memberInfo.lastName,
          email: stat.memberInfo.email
        },
        totalReports: stat.totalReports,
        avgReportsPerFirstTimer: Math.round(avgReportsPerFirstTimer * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        firstTimersManaged: stat.firstTimersManaged,
        avgDaysBetweenReports,
        overdueFirstTimers
      });
    }

    return result.sort((a, b) => b.totalReports - a.totalReports);
  }

  async getOverdueReports(): Promise<Array<{
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
  }>> {
    const twoWeeksAgo = new Date(Date.now() - (14 * 24 * 60 * 60 * 1000));

    const overdueFirstTimers = await this.firstTimerModel
      .find({
        callReportsCount: { $lt: 4 },
        lastStatusChange: { $lt: twoWeeksAgo },
        isActive: true,
        stage: { $ne: 'closed' }
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
      const daysSinceLastContact = lastContactDate ?
        Math.floor((Date.now() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24)) :
        Math.floor((Date.now() - new Date(firstTimer.dateOfVisit).getTime()) / (1000 * 60 * 60 * 24));

      result.push({
        firstTimer: {
          _id: firstTimer._id as string,
          firstName: firstTimer.firstName,
          lastName: firstTimer.lastName,
          phone: firstTimer.phone,
          email: firstTimer.email,
          dateOfVisit: firstTimer.dateOfVisit
        },
        assignedTo: firstTimer.assignedTo ? {
          _id: (firstTimer.assignedTo as any)._id,
          firstName: (firstTimer.assignedTo as any).firstName,
          lastName: (firstTimer.assignedTo as any).lastName,
          email: (firstTimer.assignedTo as any).email
        } : undefined,
        lastContactDate,
        daysSinceLastContact,
        completedReports: firstTimer.callReportsCount,
        remainingReports: 4 - firstTimer.callReportsCount
      });
    }

    return result.sort((a, b) => b.daysSinceLastContact - a.daysSinceLastContact);
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
  }): Promise<{
    reports: CallReport[];
    total: number;
    pagination: {
      page: number;
      limit: number;
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
      firstTimerName
    } = params;

    const skip = (page - 1) * limit;
    const filter: any = {};

    if (status) filter.status = status;
    if (contactMethod) filter.contactMethod = contactMethod;
    if (callMadeBy) filter.callMadeBy = callMadeBy;

    if (fromDate || toDate) {
      filter.callDate = {};
      if (fromDate) filter.callDate.$gte = fromDate;
      if (toDate) filter.callDate.$lte = toDate;
    }

    let pipeline: any[] = [
      { $match: filter },
      {
        $lookup: {
          from: 'firsttimers',
          localField: 'firstTimerId',
          foreignField: '_id',
          as: 'firstTimerInfo'
        }
      },
      {
        $lookup: {
          from: 'members',
          localField: 'callMadeBy',
          foreignField: '_id',
          as: 'memberInfo'
        }
      },
      {
        $unwind: '$firstTimerInfo'
      },
      {
        $unwind: '$memberInfo'
      }
    ];

    // Add name search if provided
    if (firstTimerName) {
      pipeline.push({
        $match: {
          $or: [
            { 'firstTimerInfo.firstName': { $regex: firstTimerName, $options: 'i' } },
            { 'firstTimerInfo.lastName': { $regex: firstTimerName, $options: 'i' } },
            {
              $expr: {
                $regexMatch: {
                  input: {
                    $concat: ['$firstTimerInfo.firstName', ' ', '$firstTimerInfo.lastName']
                  },
                  regex: firstTimerName,
                  options: 'i'
                }
              }
            }
          ]
        }
      });
    }

    const [reports, totalCount] = await Promise.all([
      this.callReportModel.aggregate([
        ...pipeline,
        { $sort: { callDate: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]),
      this.callReportModel.aggregate([
        ...pipeline,
        { $count: 'total' }
      ])
    ]);

    const total = totalCount[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      reports: reports as CallReport[],
      total,
      pagination: {
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }
}
