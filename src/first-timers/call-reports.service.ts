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

    // Get dates
    const sortedReports = reports.sort(
      (a, b) => new Date(b.callDate).getTime() - new Date(a.callDate).getTime(),
    );
    const lastContactDate = sortedReports[0]?.callDate;
    const nextFollowUpDate = sortedReports.find(
      (r) => r.nextFollowUpDate,
    )?.nextFollowUpDate;

    return {
      totalReports: 4,
      completedReports,
      remainingReports,
      lastContactDate,
      nextFollowUpDate,
      serviceAttendance,
    };
  }
}
