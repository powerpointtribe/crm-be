import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import {
  WorkerTrainee,
  WorkerTraineeDocument,
} from './schemas/worker-trainee.schema';
import { Cohort, CohortDocument } from './schemas/cohort.schema';
import { CreateWorkerTraineeDto } from './dto/create-worker-trainee.dto';
import { TraineeQueryDto } from './dto/trainee-query.dto';
import {
  WorkersTrainingStatus,
  AttendanceStatus,
  AssignmentStatus,
  TrainingOutcome,
  CohortStatus,
} from '../common/enums/workers-training.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
import { CohortService } from './cohort.service';

@Injectable()
export class WorkerTraineeService {
  constructor(
    @InjectModel(WorkerTrainee.name)
    private workerTraineeModel: Model<WorkerTraineeDocument>,
    @InjectModel(Cohort.name)
    private cohortModel: Model<CohortDocument>,
    private auditLogsService: AuditLogsService,
    private notificationsService: NotificationsService,
    private cohortService: CohortService,
  ) {}

  async enrollTrainee(
    createTraineeDto: CreateWorkerTraineeDto,
    enrolledBy?: any,
  ): Promise<WorkerTrainee> {
    const cohort = await this.cohortModel.findById(createTraineeDto.cohort);
    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }

    if (cohort.status !== CohortStatus.REGISTRATION_OPEN) {
      throw new BadRequestException('Registration is not open for this cohort');
    }

    if (
      cohort.maxParticipants > 0 &&
      cohort.currentParticipants >= cohort.maxParticipants
    ) {
      throw new BadRequestException('Cohort is at maximum capacity');
    }

    if (
      cohort.registrationEndDate &&
      new Date() > cohort.registrationEndDate
    ) {
      throw new BadRequestException('Registration period has ended');
    }

    const existingEnrollment = await this.workerTraineeModel.findOne({
      member: createTraineeDto.member,
      cohort: createTraineeDto.cohort,
    });

    if (existingEnrollment) {
      throw new ConflictException(
        'Member is already enrolled in this cohort',
      );
    }

    const trainee = new this.workerTraineeModel({
      ...createTraineeDto,
      enrolledBy: enrolledBy?._id || createTraineeDto.member,
      status: WorkersTrainingStatus.REGISTERED,
    });

    const savedTrainee = await trainee.save();

    await this.cohortService.updateParticipantCount(
      createTraineeDto.cohort.toString(),
      1,
    );

    if (enrolledBy) {
      await this.auditLogsService.logAction(
        AuditAction.CREATE,
        AuditEntity.MEMBER,
        savedTrainee._id.toString(),
        enrolledBy,
        {
          description: `Enrolled trainee in cohort: ${cohort.name}`,
          newValues: savedTrainee.toObject(),
          severity: 'medium',
        },
      );
    }

    // TODO: Implement notification system
    // await this.notificationsService.createNotification({
    //   title: 'Training Enrollment Successful',
    //   message: `You have been successfully enrolled in ${cohort.name}`,
    //   type: 'info',
    //   priority: 'medium',
    //   recipients: [createTraineeDto.member.toString()],
    //   data: {
    //     cohortId: cohort._id.toString(),
    //     cohortName: cohort.name,
    //     startDate: cohort.startDate,
    //   },
    // });

    return savedTrainee;
  }

  async findAll(queryDto: TraineeQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'enrollmentDate',
      sortOrder = 'desc',
      search,
      cohort,
      ...filters
    } = queryDto;

    const query: FilterQuery<WorkerTraineeDocument> = {};

    if (cohort) {
      query.cohort = cohort;
    }

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query[key] = value;
      }
    });

    const sortOptions: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'desc' ? -1 : 1,
    };

    const [trainees, total] = await Promise.all([
      this.workerTraineeModel
        .find(query)
        .populate('member', 'firstName lastName email phone')
        .populate('cohort', 'name code type status startDate endDate')
        .populate('assignedMentor', 'firstName lastName email')
        .populate('supervisor', 'firstName lastName email')
        .populate('assignedUnit', 'name type')
        .populate('assignedDistrict', 'name type')
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.workerTraineeModel.countDocuments(query).exec(),
    ]);

    return {
      trainees,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        count: trainees.length,
        total,
      },
    };
  }

  async findOne(id: string): Promise<WorkerTrainee> {
    const trainee = await this.workerTraineeModel
      .findById(id)
      .populate('member', 'firstName lastName email phone address')
      .populate('cohort')
      .populate('assignedMentor', 'firstName lastName email systemRoles')
      .populate('supervisor', 'firstName lastName email systemRoles')
      .populate('assignedUnit', 'name type leader')
      .populate('assignedDistrict', 'name type leader')
      .populate('assignedMinistries', 'name type leader')
      .exec();

    if (!trainee) {
      throw new NotFoundException('Worker trainee not found');
    }

    return trainee;
  }

  async findByCohort(cohortId: string, queryDto: Partial<TraineeQueryDto> = {}) {
    return this.findAll({ ...queryDto, cohort: cohortId });
  }

  async findByMember(memberId: string) {
    return this.workerTraineeModel
      .find({ member: memberId })
      .populate('cohort', 'name code type status startDate endDate')
      .populate('assignedMentor', 'firstName lastName email')
      .sort({ enrollmentDate: -1 })
      .exec();
  }

  async updateStatus(
    id: string,
    status: WorkersTrainingStatus,
    updatedBy: any,
    reason?: string,
  ): Promise<WorkerTrainee> {
    const trainee = await this.workerTraineeModel.findById(id);
    if (!trainee) {
      throw new NotFoundException('Worker trainee not found');
    }

    const oldStatus = trainee.status;
    trainee.status = status;
    trainee.updatedBy = updatedBy._id;

    if (status === WorkersTrainingStatus.COMPLETED) {
      trainee.completionDate = new Date();
    } else if (status === WorkersTrainingStatus.DROPPED_OUT) {
      trainee.dropoutDate = new Date();
      trainee.dropoutReason = reason;
    }

    const savedTrainee = await trainee.save();

    await this.auditLogsService.logAction(
      AuditAction.UPDATE,
      AuditEntity.MEMBER,
      savedTrainee._id.toString(),
      updatedBy,
      {
        description: `Changed trainee status from ${oldStatus} to ${status}`,
        oldValues: { status: oldStatus },
        newValues: { status, reason },
        severity: 'medium',
      },
    );

    return savedTrainee;
  }

  async assignToUnit(
    traineeId: string,
    unitId: string,
    outcome: TrainingOutcome,
    assignedBy: any,
  ): Promise<WorkerTrainee> {
    const trainee = await this.workerTraineeModel.findById(traineeId);
    if (!trainee) {
      throw new NotFoundException('Worker trainee not found');
    }

    trainee.assignedUnit = unitId as any;
    trainee.outcome = outcome;
    trainee.placementDate = new Date();
    trainee.placementApprovedBy = assignedBy._id;
    trainee.updatedBy = assignedBy._id;

    const savedTrainee = await trainee.save();

    await this.auditLogsService.logAction(
      AuditAction.UPDATE,
      AuditEntity.MEMBER,
      savedTrainee._id.toString(),
      assignedBy,
      {
        description: `Assigned trainee to unit with outcome: ${outcome}`,
        newValues: {
          assignedUnit: unitId,
          outcome,
          placementDate: trainee.placementDate,
        },
        severity: 'medium',
      },
    );

    return savedTrainee;
  }

  async recordAttendance(
    traineeId: string,
    sessionData: {
      sessionId: string;
      sessionDate: Date;
      status: AttendanceStatus;
      checkinTime?: Date;
      checkoutTime?: Date;
      notes?: string;
    },
    markedBy: any,
  ): Promise<WorkerTrainee> {
    const trainee = await this.workerTraineeModel.findById(traineeId);
    if (!trainee) {
      throw new NotFoundException('Worker trainee not found');
    }

    const attendanceRecord = {
      ...sessionData,
      sessionId: sessionData.sessionId as any,
      markedBy: markedBy._id,
    };

    const existingRecordIndex = trainee.attendanceRecords.findIndex(
      (record) => record.sessionId.toString() === sessionData.sessionId,
    );

    if (existingRecordIndex >= 0) {
      trainee.attendanceRecords[existingRecordIndex] = attendanceRecord;
    } else {
      trainee.attendanceRecords.push(attendanceRecord);
      trainee.attendance.totalSessions += 1;
    }

    if (sessionData.status === AttendanceStatus.PRESENT) {
      trainee.attendance.attendedSessions += 1;
    } else if (sessionData.status === AttendanceStatus.EXCUSED) {
      trainee.attendance.excusedAbsences += 1;
    }

    trainee.attendance.attendancePercentage =
      trainee.attendance.totalSessions > 0
        ? (trainee.attendance.attendedSessions /
            trainee.attendance.totalSessions) *
          100
        : 0;

    const savedTrainee = await trainee.save();

    await this.auditLogsService.logAction(
      AuditAction.UPDATE,
      AuditEntity.MEMBER,
      savedTrainee._id.toString(),
      markedBy,
      {
        description: `Recorded attendance: ${sessionData.status}`,
        newValues: { attendanceRecord, attendance: trainee.attendance },
        severity: 'low',
      },
    );

    return savedTrainee;
  }

  async recordAssignmentGrade(
    traineeId: string,
    assignmentData: {
      assignmentId: string;
      title: string;
      score: number;
      maxScore: number;
      grade?: string;
      feedback?: string;
    },
    gradedBy: any,
  ): Promise<WorkerTrainee> {
    const trainee = await this.workerTraineeModel.findById(traineeId);
    if (!trainee) {
      throw new NotFoundException('Worker trainee not found');
    }

    const existingAssignmentIndex = trainee.assignments.findIndex(
      (assignment) =>
        assignment.assignmentId.toString() === assignmentData.assignmentId,
    );

    if (existingAssignmentIndex >= 0) {
      const existingAssignment = trainee.assignments[existingAssignmentIndex];
      trainee.assignments[existingAssignmentIndex] = {
        ...existingAssignment,
        ...assignmentData,
        assignmentId: assignmentData.assignmentId as any,
        status: AssignmentStatus.GRADED,
        gradedBy: gradedBy._id,
      };
    } else {
      throw new NotFoundException('Assignment not found for this trainee');
    }

    this.calculateAcademicPerformance(trainee);

    const savedTrainee = await trainee.save();

    await this.auditLogsService.logAction(
      AuditAction.UPDATE,
      AuditEntity.MEMBER,
      savedTrainee._id.toString(),
      gradedBy,
      {
        description: `Graded assignment: ${assignmentData.title} - ${assignmentData.score}/${assignmentData.maxScore}`,
        newValues: {
          assignment: assignmentData,
          academicPerformance: trainee.academicPerformance,
        },
        severity: 'low',
      },
    );

    return savedTrainee;
  }

  private calculateAcademicPerformance(trainee: WorkerTrainee): void {
    const gradedAssignments = trainee.assignments.filter(
      (a) => a.status === AssignmentStatus.GRADED && a.score !== undefined,
    );

    if (gradedAssignments.length === 0) {
      return;
    }

    const totalScore = gradedAssignments.reduce((sum, a) => sum + (a.score || 0), 0);
    const totalMaxScore = gradedAssignments.reduce(
      (sum, a) => sum + a.maxScore,
      0,
    );

    trainee.academicPerformance.totalAssignments = trainee.assignments.length;
    trainee.academicPerformance.gradedAssignments = gradedAssignments.length;
    trainee.academicPerformance.averageScore =
      totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
    trainee.academicPerformance.overallGrade =
      trainee.academicPerformance.averageScore;
    trainee.academicPerformance.passedAssignments = gradedAssignments.filter(
      (a) => ((a.score || 0) / a.maxScore) * 100 >= 60,
    ).length;
  }

  async getTraineeStatistics(cohortId?: string, branchId?: string) {
    const matchStage: any = {};
    if (branchId) matchStage.branch = new Types.ObjectId(branchId);
    if (cohortId) matchStage.cohort = cohortId;

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $facet: {
          statusCounts: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          outcomeCounts: [
            { $match: { outcome: { $exists: true } } },
            { $group: { _id: '$outcome', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          performanceStats: [
            {
              $group: {
                _id: null,
                averageAttendance: { $avg: '$attendance.attendancePercentage' },
                averageGrade: { $avg: '$academicPerformance.overallGrade' },
                totalTrainees: { $sum: 1 },
              },
            },
          ],
          placementStats: [
            { $match: { assignedUnit: { $exists: true } } },
            {
              $group: {
                _id: '$assignedUnit',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ],
        },
      },
    ];

    const [result] = await this.workerTraineeModel.aggregate(pipeline).exec();

    return {
      statusCounts: result.statusCounts,
      outcomeCounts: result.outcomeCounts,
      performanceStats: result.performanceStats[0] || {
        averageAttendance: 0,
        averageGrade: 0,
        totalTrainees: 0,
      },
      placementStats: result.placementStats,
    };
  }

  async bulkEnrollFromForm(enrollmentData: {
    cohortId: string;
    trainees: Array<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      emergencyContact?: string;
      emergencyPhone?: string;
      medicalNotes?: string;
      dietaryRestrictions?: string;
      hasTransportation?: boolean;
      needsAccommodation?: boolean;
      accommodationDetails?: string;
    }>;
  }) {
    const cohort = await this.cohortModel.findById(enrollmentData.cohortId);
    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }

    if (cohort.status !== CohortStatus.REGISTRATION_OPEN) {
      throw new BadRequestException('Registration is not open for this cohort');
    }

    const results = {
      successful: [],
      failed: [],
      total: enrollmentData.trainees.length,
    };

    for (const traineeData of enrollmentData.trainees) {
      try {
        const trainee = new this.workerTraineeModel({
          member: null,
          cohort: enrollmentData.cohortId,
          status: WorkersTrainingStatus.REGISTERED,
          enrolledBy: null,
          emergencyContact: traineeData.emergencyContact,
          emergencyPhone: traineeData.emergencyPhone,
          medicalNotes: traineeData.medicalNotes,
          dietaryRestrictions: traineeData.dietaryRestrictions,
          hasTransportation: traineeData.hasTransportation || false,
          needsAccommodation: traineeData.needsAccommodation || false,
          accommodationDetails: traineeData.accommodationDetails,
        });

        const savedTrainee = await trainee.save();
        (results.successful as any[]).push({
          ...traineeData,
          traineeId: savedTrainee._id,
        });

        await this.cohortService.updateParticipantCount(
          enrollmentData.cohortId,
          1,
        );
      } catch (error) {
        (results.failed as any[]).push({
          ...traineeData,
          error: error.message,
        });
      }
    }

    return results;
  }
}