import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Cohort, CohortDocument } from './schemas/cohort.schema';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { CohortQueryDto } from './dto/cohort-query.dto';
import { CohortStatus } from '../common/enums/workers-training.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';

@Injectable()
export class CohortService {
  constructor(
    @InjectModel(Cohort.name)
    private cohortModel: Model<CohortDocument>,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(
    createCohortDto: CreateCohortDto,
    createdBy: any,
  ): Promise<Cohort> {
    // Check if cohort code already exists
    const existingCohort = await this.cohortModel.findOne({
      code: createCohortDto.code,
    });

    if (existingCohort) {
      throw new BadRequestException('Cohort code already exists');
    }

    // Validate dates
    if (createCohortDto.startDate >= createCohortDto.endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    if (
      createCohortDto.registrationEndDate &&
      createCohortDto.registrationStartDate
    ) {
      if (
        createCohortDto.registrationStartDate >=
        createCohortDto.registrationEndDate
      ) {
        throw new BadRequestException(
          'Registration start date must be before registration end date',
        );
      }
    }

    const cohort = new this.cohortModel({
      ...createCohortDto,
      createdBy: createdBy._id,
    });

    const savedCohort = await cohort.save();

    await this.auditLogsService.logAction(
      AuditAction.CREATE,
      AuditEntity.SYSTEM,
      savedCohort._id.toString(),
      createdBy,
      {
        description: `Created cohort: ${savedCohort.name} (${savedCohort.code})`,
        newValues: savedCohort.toObject(),
        severity: 'medium',
      },
    );

    return savedCohort;
  }

  async findAll(queryDto: CohortQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      startDateFrom,
      startDateTo,
      endDateFrom,
      endDateTo,
      ...filters
    } = queryDto;

    const query: FilterQuery<CohortDocument> = { isActive: true };

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query[key] = value;
      }
    });

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Date range filters
    if (startDateFrom || startDateTo) {
      query.startDate = {};
      if (startDateFrom) query.startDate.$gte = new Date(startDateFrom);
      if (startDateTo) query.startDate.$lte = new Date(startDateTo);
    }

    if (endDateFrom || endDateTo) {
      query.endDate = {};
      if (endDateFrom) query.endDate.$gte = new Date(endDateFrom);
      if (endDateTo) query.endDate.$lte = new Date(endDateTo);
    }

    const sortOptions: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'desc' ? -1 : 1,
    };

    const [cohorts, total] = await Promise.all([
      this.cohortModel
        .find(query)
        .populate('facilitators', 'firstName lastName email')
        .populate('coordinator', 'firstName lastName email')
        .populate('supervisor', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.cohortModel.countDocuments(query).exec(),
    ]);

    return {
      cohorts,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        count: cohorts.length,
        total,
      },
    };
  }

  async findOne(id: string): Promise<Cohort> {
    const cohort = await this.cohortModel
      .findById(id)
      .populate('facilitators', 'firstName lastName email systemRoles')
      .populate('coordinator', 'firstName lastName email systemRoles')
      .populate('supervisor', 'firstName lastName email systemRoles')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .exec();

    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }

    return cohort;
  }

  async update(
    id: string,
    updateData: Partial<CreateCohortDto>,
    updatedBy: any,
  ): Promise<Cohort> {
    const cohort = await this.cohortModel.findById(id);

    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }

    const oldValues = cohort.toObject();

    // Check if cohort code is being changed and if it's unique
    if (updateData.code && updateData.code !== cohort.code) {
      const existingCohort = await this.cohortModel.findOne({
        code: updateData.code,
        _id: { $ne: id },
      });

      if (existingCohort) {
        throw new BadRequestException('Cohort code already exists');
      }
    }

    // Validate dates if they are being updated
    const newStartDate = updateData.startDate || cohort.startDate;
    const newEndDate = updateData.endDate || cohort.endDate;

    if (newStartDate >= newEndDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    Object.assign(cohort, updateData, {
      updatedBy: updatedBy._id,
      updatedAt: new Date(),
    });

    const savedCohort = await cohort.save();

    await this.auditLogsService.logAction(
      AuditAction.UPDATE,
      AuditEntity.SYSTEM,
      savedCohort._id.toString(),
      updatedBy,
      {
        description: `Updated cohort: ${savedCohort.name} (${savedCohort.code})`,
        oldValues,
        newValues: savedCohort.toObject(),
        severity: 'medium',
      },
    );

    return savedCohort;
  }

  async updateStatus(
    id: string,
    status: CohortStatus,
    updatedBy: any,
  ): Promise<Cohort> {
    const cohort = await this.cohortModel.findById(id);

    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }

    const oldStatus = cohort.status;
    cohort.status = status;
    cohort.updatedBy = updatedBy._id;
    cohort.updatedAt = new Date();

    const savedCohort = await cohort.save();

    await this.auditLogsService.logAction(
      AuditAction.UPDATE,
      AuditEntity.SYSTEM,
      savedCohort._id.toString(),
      updatedBy,
      {
        description: `Changed cohort status from ${oldStatus} to ${status}: ${savedCohort.name}`,
        oldValues: { status: oldStatus },
        newValues: { status },
        severity: 'medium',
      },
    );

    return savedCohort;
  }

  async remove(id: string, deletedBy: any): Promise<void> {
    const cohort = await this.cohortModel.findById(id);

    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }

    // Soft delete by setting isActive to false
    cohort.isActive = false;
    cohort.updatedBy = deletedBy._id;
    cohort.updatedAt = new Date();

    await cohort.save();

    await this.auditLogsService.logAction(
      AuditAction.DELETE,
      AuditEntity.SYSTEM,
      cohort._id.toString(),
      deletedBy,
      {
        description: `Deleted cohort: ${cohort.name} (${cohort.code})`,
        oldValues: cohort.toObject(),
        severity: 'high',
      },
    );
  }

  async getCohortStatistics(cohortId?: string) {
    const matchStage: any = { isActive: true };
    if (cohortId) matchStage._id = cohortId;

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $facet: {
          statusCounts: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          typeCounts: [
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          summary: [
            {
              $group: {
                _id: null,
                totalCohorts: { $sum: 1 },
                totalParticipants: { $sum: '$currentParticipants' },
                averageSize: { $avg: '$currentParticipants' },
                totalCapacity: { $sum: '$maxParticipants' },
              },
            },
          ],
          upcomingCohorts: [
            { $match: { startDate: { $gt: new Date() } } },
            { $sort: { startDate: 1 } },
            { $limit: 5 },
          ],
          activeCohorts: [
            {
              $match: {
                status: CohortStatus.IN_PROGRESS,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
              },
            },
            { $sort: { startDate: 1 } },
          ],
        },
      },
    ];

    const [result] = await this.cohortModel.aggregate(pipeline).exec();

    return {
      statusCounts: result.statusCounts,
      typeCounts: result.typeCounts,
      summary: result.summary[0] || {
        totalCohorts: 0,
        totalParticipants: 0,
        averageSize: 0,
        totalCapacity: 0,
      },
      upcomingCohorts: result.upcomingCohorts,
      activeCohorts: result.activeCohorts,
    };
  }

  async getCohortsForFacilitator(facilitatorId: string, status?: CohortStatus) {
    const query: any = {
      facilitators: facilitatorId,
      isActive: true,
    };

    if (status) {
      query.status = status;
    }

    return this.cohortModel
      .find(query)
      .populate('coordinator', 'firstName lastName email')
      .populate('supervisor', 'firstName lastName email')
      .sort({ startDate: -1 })
      .exec();
  }

  async updateParticipantCount(
    cohortId: string,
    increment: number = 1,
  ): Promise<Cohort> {
    const cohort = await this.cohortModel.findByIdAndUpdate(
      cohortId,
      { $inc: { currentParticipants: increment } },
      { new: true },
    );

    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }

    return cohort;
  }
}
