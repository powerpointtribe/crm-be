import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import {
  ServiceReport,
  ServiceReportDocument,
  ServiceTag,
} from './schemas/service-report.schema';
import { CreateServiceReportDto } from './dto/create-service-report.dto';
import { UpdateServiceReportDto } from './dto/update-service-report.dto';
import { ServiceReportSearchDto } from './dto/service-report-search.dto';
import {
  PaginatedResult,
  createPaginatedResult,
} from '../common/utils/pagination.util';
import { QueryBuilder } from '../common/utils/query-builder.util';
import {
  ServiceReportsPdfService,
  PdfComparisonStats,
} from './service-reports-pdf.service';
import {
  BranchAccessService,
  BranchFilterContext,
} from '../common/services/branch-access.service';

@Injectable()
export class ServiceReportsService {
  private readonly logger = new Logger(ServiceReportsService.name);

  constructor(
    @InjectModel(ServiceReport.name)
    private serviceReportModel: Model<ServiceReportDocument>,
    private pdfService: ServiceReportsPdfService,
    private branchAccessService: BranchAccessService,
  ) {}

  async create(
    createServiceReportDto: CreateServiceReportDto,
    reportedBy: string,
    branchId: string,
  ): Promise<ServiceReportDocument> {
    // Validate date is not in the future
    const reportDate = new Date(createServiceReportDto.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of today to allow today's date

    if (reportDate > today) {
      throw new BadRequestException(
        'Cannot create a service report for a future date. Please select today or a past date.',
      );
    }

    // Validate attendance numbers
    const {
      totalAttendance,
      numberOfMales,
      numberOfFemales,
      numberOfChildren,
      numberOfFirstTimers,
    } = createServiceReportDto;

    const calculatedTotal = numberOfMales + numberOfFemales + numberOfChildren;
    if (calculatedTotal !== totalAttendance) {
      throw new BadRequestException(
        `Total attendance (${totalAttendance}) must equal sum of males (${numberOfMales}) + females (${numberOfFemales}) + children (${numberOfChildren}) = ${calculatedTotal}`,
      );
    }

    if (numberOfFirstTimers > totalAttendance) {
      throw new BadRequestException(
        `Number of first timers (${numberOfFirstTimers}) cannot exceed total attendance (${totalAttendance})`,
      );
    }

    // Check if a report already exists for this date and service within the same branch
    const existingReport = await this.serviceReportModel.findOne({
      branch: new Types.ObjectId(branchId),
      date: new Date(createServiceReportDto.date),
      serviceName: createServiceReportDto.serviceName,
      isActive: true,
    });

    if (existingReport) {
      throw new BadRequestException(
        `A service report already exists for ${createServiceReportDto.serviceName} on ${createServiceReportDto.date}`,
      );
    }

    const serviceReport = new this.serviceReportModel({
      ...createServiceReportDto,
      date: new Date(createServiceReportDto.date),
      reportedBy: new Types.ObjectId(reportedBy),
      branch: new Types.ObjectId(branchId),
      serviceTags: createServiceReportDto.serviceTags || [],
    });

    return serviceReport.save();
  }

  async findAll(
    searchDto: ServiceReportSearchDto,
    branchFilterContext?: BranchFilterContext,
  ): Promise<PaginatedResult<ServiceReportDocument>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'date',
      sortOrder = 'desc',
      serviceTag,
      dateFrom,
      dateTo,
      reportedBy,
      serviceName,
      minAttendance,
      maxAttendance,
      minFirstTimers,
      branchId,
    } = searchDto;

    const skip = (page - 1) * limit;
    let filterQuery: FilterQuery<ServiceReportDocument> = { isActive: true };

    // Apply branch filtering based on user permissions
    if (branchFilterContext) {
      const effectiveContext: BranchFilterContext = {
        ...branchFilterContext,
        selectedBranchId: branchId || branchFilterContext.selectedBranchId,
      };
      filterQuery = this.branchAccessService.applyBranchFilter(
        filterQuery,
        effectiveContext,
        'branch',
      );
    }

    // Text search across service name and notes
    if (search) {
      const searchQuery = QueryBuilder.buildSearchQuery(search, [
        'serviceName',
        'notes',
      ]);
      Object.assign(filterQuery, searchQuery);
    }

    // Service tag filter
    if (serviceTag) {
      filterQuery.serviceTags = { $in: [serviceTag] };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filterQuery.date = {};
      if (dateFrom) {
        filterQuery.date.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filterQuery.date.$lte = new Date(dateTo);
      }
    }

    // Reporter filter
    if (reportedBy) {
      filterQuery.reportedBy = new Types.ObjectId(reportedBy);
    }

    // Service name filter
    if (serviceName) {
      filterQuery.serviceName = { $regex: serviceName, $options: 'i' };
    }

    // Attendance filters
    if (minAttendance !== undefined) {
      filterQuery.totalAttendance = {
        ...filterQuery.totalAttendance,
        $gte: minAttendance,
      };
    }
    if (maxAttendance !== undefined) {
      filterQuery.totalAttendance = {
        ...filterQuery.totalAttendance,
        $lte: maxAttendance,
      };
    }

    // First timers filter
    if (minFirstTimers !== undefined) {
      filterQuery.numberOfFirstTimers = { $gte: minFirstTimers };
    }

    const [reports, total] = await Promise.all([
      this.serviceReportModel
        .find(filterQuery)
        .populate('reportedBy', 'firstName lastName email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      this.serviceReportModel.countDocuments(filterQuery),
    ]);

    return createPaginatedResult(reports, total, page, limit);
  }

  async findById(id: string): Promise<ServiceReportDocument> {
    const report = await this.serviceReportModel
      .findOne({ _id: id, isActive: true })
      .populate('reportedBy', 'firstName lastName email')
      .exec();

    if (!report) {
      throw new NotFoundException('Service report not found');
    }

    return report;
  }

  async update(
    id: string,
    updateServiceReportDto: UpdateServiceReportDto,
    userId: string,
  ): Promise<ServiceReportDocument> {
    const report = await this.findById(id);

    // Check if user has permission to update this report
    const reportedByIdString = typeof report.reportedBy === 'object' && report.reportedBy._id
      ? report.reportedBy._id.toString()
      : report.reportedBy.toString();

    if (reportedByIdString !== userId.toString()) {
      throw new ForbiddenException(
        'You can only update reports that you created',
      );
    }

    // Validate attendance numbers if provided
    if (
      updateServiceReportDto.totalAttendance !== undefined ||
      updateServiceReportDto.numberOfMales !== undefined ||
      updateServiceReportDto.numberOfFemales !== undefined ||
      updateServiceReportDto.numberOfChildren !== undefined ||
      updateServiceReportDto.numberOfFirstTimers !== undefined
    ) {
      const totalAttendance =
        updateServiceReportDto.totalAttendance ?? report.totalAttendance;
      const numberOfMales =
        updateServiceReportDto.numberOfMales ?? report.numberOfMales;
      const numberOfFemales =
        updateServiceReportDto.numberOfFemales ?? report.numberOfFemales;
      const numberOfChildren =
        updateServiceReportDto.numberOfChildren ?? report.numberOfChildren;
      const numberOfFirstTimers =
        updateServiceReportDto.numberOfFirstTimers ??
        report.numberOfFirstTimers;

      const calculatedTotal =
        numberOfMales + numberOfFemales + numberOfChildren;
      if (calculatedTotal !== totalAttendance) {
        throw new BadRequestException(
          `Total attendance (${totalAttendance}) must equal sum of males (${numberOfMales}) + females (${numberOfFemales}) + children (${numberOfChildren}) = ${calculatedTotal}`,
        );
      }

      if (numberOfFirstTimers > totalAttendance) {
        throw new BadRequestException(
          `Number of first timers (${numberOfFirstTimers}) cannot exceed total attendance (${totalAttendance})`,
        );
      }
    }

    const updateData: any = { ...updateServiceReportDto };
    if (updateServiceReportDto.date) {
      updateData.date = new Date(updateServiceReportDto.date);
    }

    const updatedReport = await this.serviceReportModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('reportedBy', 'firstName lastName email')
      .exec();

    if (!updatedReport) {
      throw new NotFoundException('Service report not found after update');
    }

    return updatedReport;
  }

  async remove(id: string, userId: string): Promise<void> {
    const report = await this.findById(id);

    // Check if user has permission to delete this report
    const reportedByIdString = typeof report.reportedBy === 'object' && report.reportedBy._id
      ? report.reportedBy._id.toString()
      : report.reportedBy.toString();

    if (reportedByIdString !== userId.toString()) {
      throw new ForbiddenException(
        'You can only delete reports that you created',
      );
    }

    await this.serviceReportModel.findByIdAndUpdate(id, { isActive: false });
  }

  async getServiceReportStats(dateFrom?: string, dateTo?: string): Promise<any> {
    // Build date filter
    const dateFilter: any = { isActive: true };
    if (dateFrom || dateTo) {
      dateFilter.date = {};
      if (dateFrom) {
        dateFilter.date.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.date.$lte = new Date(dateTo);
      }
    }

    const stats = await this.serviceReportModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          totalAttendance: { $sum: '$totalAttendance' },
          highestAttendance: { $max: '$totalAttendance' },
          totalFirstTimers: { $sum: '$numberOfFirstTimers' },
          averageAttendance: { $avg: '$totalAttendance' },
          averageFirstTimers: { $avg: '$numberOfFirstTimers' },
          totalMales: { $sum: '$numberOfMales' },
          totalFemales: { $sum: '$numberOfFemales' },
          totalChildren: { $sum: '$numberOfChildren' },
        },
      },
    ]);

    // Get reports by service tag (also filtered by date)
    const reportsByTag = await this.serviceReportModel.aggregate([
      { $match: dateFilter },
      { $unwind: '$serviceTags' },
      {
        $group: {
          _id: '$serviceTags',
          count: { $sum: 1 },
          totalAttendance: { $sum: '$totalAttendance' },
          averageAttendance: { $avg: '$totalAttendance' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get monthly trends - use provided date range or default to last 12 months
    let trendsStartDate: Date;
    if (dateFrom) {
      trendsStartDate = new Date(dateFrom);
    } else {
      trendsStartDate = new Date();
      trendsStartDate.setMonth(trendsStartDate.getMonth() - 12);
    }

    const trendsFilter: any = {
      isActive: true,
      date: { $gte: trendsStartDate },
    };
    if (dateTo) {
      trendsFilter.date.$lte = new Date(dateTo);
    }

    const monthlyTrends = await this.serviceReportModel.aggregate([
      { $match: trendsFilter },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
          },
          reportCount: { $sum: 1 },
          totalAttendance: { $sum: '$totalAttendance' },
          totalFirstTimers: { $sum: '$numberOfFirstTimers' },
          averageAttendance: { $avg: '$totalAttendance' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    return {
      overall: stats[0] || {
        totalReports: 0,
        totalAttendance: 0,
        highestAttendance: 0,
        totalFirstTimers: 0,
        averageAttendance: 0,
        averageFirstTimers: 0,
        totalMales: 0,
        totalFemales: 0,
        totalChildren: 0,
      },
      byServiceTag: reportsByTag,
      monthlyTrends,
    };
  }

  async getMyReports(
    userId: string,
    searchDto: ServiceReportSearchDto,
  ): Promise<PaginatedResult<ServiceReportDocument>> {
    const modifiedSearchDto = { ...searchDto, reportedBy: userId };
    return this.findAll(modifiedSearchDto);
  }

  async getRecentReports(
    days: number = 30,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResult<ServiceReportDocument>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const searchDto: ServiceReportSearchDto = {
      page,
      limit,
      dateFrom: startDate.toISOString().split('T')[0],
      sortBy: 'date',
      sortOrder: 'desc',
    };

    return this.findAll(searchDto);
  }

  async getAttendanceChartData(
    limit: number = 10,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<any[]> {
    // Build date filter
    const dateFilter: any = { isActive: true };
    if (dateFrom || dateTo) {
      dateFilter.date = {};
      if (dateFrom) {
        dateFilter.date.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.date.$lte = new Date(dateTo);
      }
    }

    const reports = await this.serviceReportModel
      .find(dateFilter)
      .select('date serviceName totalAttendance')
      .sort({ date: -1 })
      .limit(limit)
      .lean()
      .exec();

    return reports.reverse().map((report) => ({
      date: report.date.toISOString().split('T')[0],
      serviceName: report.serviceName,
      attendance: report.totalAttendance,
      formattedDate: new Date(report.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }

  async getPdfComparisonStats(
    reportDate: Date,
  ): Promise<PdfComparisonStats | undefined> {
    try {
      // Get overall statistics
      const overallStats = await this.serviceReportModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalReports: { $sum: 1 },
            averageAttendance: { $avg: '$totalAttendance' },
            averageFirstTimers: { $avg: '$numberOfFirstTimers' },
            averageMales: { $avg: '$numberOfMales' },
            averageFemales: { $avg: '$numberOfFemales' },
            averageChildren: { $avg: '$numberOfChildren' },
            highestAttendance: { $max: '$totalAttendance' },
            lowestAttendance: { $min: '$totalAttendance' },
          },
        },
      ]);

      if (!overallStats.length) {
        return undefined;
      }

      // Get previous service report (before this report's date)
      const previousReport = await this.serviceReportModel
        .findOne({
          isActive: true,
          date: { $lt: reportDate },
        })
        .sort({ date: -1 })
        .select('date serviceName totalAttendance numberOfFirstTimers')
        .lean()
        .exec();

      // Get monthly trend data (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const monthlyTrendData = await this.serviceReportModel.aggregate([
        {
          $match: {
            isActive: true,
            date: { $gte: twelveMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
            },
            totalAttendance: { $sum: '$totalAttendance' },
            reportCount: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
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

      const monthlyTrend = monthlyTrendData.map((item) => ({
        month: `${monthNames[item._id.month - 1]} ${item._id.year.toString().slice(-2)}`,
        attendance: Math.round(item.totalAttendance / item.reportCount),
      }));

      const stats = overallStats[0];

      return {
        averageAttendance: stats.averageAttendance || 0,
        averageFirstTimers: stats.averageFirstTimers || 0,
        averageMales: stats.averageMales || 0,
        averageFemales: stats.averageFemales || 0,
        averageChildren: stats.averageChildren || 0,
        highestAttendance: stats.highestAttendance || 0,
        lowestAttendance: stats.lowestAttendance || 0,
        totalReports: stats.totalReports || 0,
        previousReport: previousReport
          ? {
              date: previousReport.date,
              serviceName: previousReport.serviceName,
              totalAttendance: previousReport.totalAttendance,
              numberOfFirstTimers: previousReport.numberOfFirstTimers,
            }
          : undefined,
        monthlyTrend: monthlyTrend.length >= 2 ? monthlyTrend : undefined,
      };
    } catch (error) {
      console.error('Error fetching PDF comparison stats:', error);
      return undefined;
    }
  }

  async generatePdfHtml(id: string): Promise<string> {
    // Fetch report with branch populated for PDF
    const report = await this.serviceReportModel
      .findOne({ _id: id, isActive: true })
      .populate('reportedBy', 'firstName lastName email')
      .populate('branch', 'name')
      .exec();

    if (!report) {
      throw new NotFoundException('Service report not found');
    }

    const stats = await this.getPdfComparisonStats(report.date);
    return this.pdfService.generatePdf(report, stats);
  }
}
