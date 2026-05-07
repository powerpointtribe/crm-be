import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { WorkerTraineeService } from './worker-trainee.service';
import { CreateWorkerTraineeDto } from './dto/create-worker-trainee.dto';
import { TraineeQueryDto } from './dto/trainee-query.dto';
import {
  WorkersTrainingStatus,
  TrainingOutcome,
  AttendanceStatus,
} from '../common/enums/workers-training.enum';
import { WorkersTrainingPermission } from './permissions';

@ApiTags('Workers Training - Trainees')
@Controller('workers-training/trainees')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class WorkerTraineeController {
  constructor(
    private readonly workerTraineeService: WorkerTraineeService,
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  private async getUserBranchId(user: any): Promise<string | undefined> {
    const roleId = user.role?._id || user.role;
    const result = await this.userPermissionsService.getUserPermissions(roleId);
    const allPermissions = [...result.permissions];
    if (user.additionalRoles?.length > 0) {
      for (const addRole of user.additionalRoles) {
        try {
          const addResult = await this.userPermissionsService.getUserPermissions(addRole._id || addRole);
          allPermissions.push(...addResult.permissions);
        } catch {}
      }
    }
    if (allPermissions.includes('branches:view-all')) return undefined;
    return (user.branch?._id || user.branch)?.toString();
  }

  @Post('enroll')
  @RequirePermission(WorkersTrainingPermission.CREATE_TRAINEE)
  @ApiOperation({ summary: 'Enroll a member in a cohort' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Trainee enrolled successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Registration not open or cohort full',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Member already enrolled',
  })
  async enrollTrainee(
    @Body() createTraineeDto: CreateWorkerTraineeDto,
    @Request() req,
  ) {
    return this.workerTraineeService.enrollTrainee(createTraineeDto, req.user);
  }

  @Post('public-enrollment')
  @Public()
  @ApiOperation({
    summary: 'Public enrollment form (no authentication required)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Enrollment request submitted successfully',
  })
  async publicEnrollment(@Body() enrollmentData: any) {
    return this.workerTraineeService.bulkEnrollFromForm(enrollmentData);
  }

  @Get()
  @RequirePermission(WorkersTrainingPermission.VIEW_TRAINEES)
  @ApiOperation({ summary: 'Get all trainees with filtering and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Trainees retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'cohort', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: WorkersTrainingStatus })
  async findAll(@Query() query: TraineeQueryDto) {
    return this.workerTraineeService.findAll(query);
  }

  @Get('statistics')
  @RequirePermission(WorkersTrainingPermission.VIEW_TRAINEE_STATS)
  @ApiOperation({ summary: 'Get trainee statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  @ApiQuery({ name: 'cohortId', required: false, type: String })
  async getStatistics(
    @Query('cohortId') cohortId?: string,
    @Request() req?,
  ) {
    const branchId = await this.getUserBranchId(req.user);
    return this.workerTraineeService.getTraineeStatistics(cohortId, branchId);
  }

  @Get('cohort/:cohortId')
  @RequirePermission(WorkersTrainingPermission.VIEW_COHORT_TRAINEES)
  @ApiOperation({ summary: 'Get all trainees in a specific cohort' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cohort trainees retrieved successfully',
  })
  @ApiParam({ name: 'cohortId', description: 'Cohort ID' })
  async findByCohort(
    @Param('cohortId') cohortId: string,
    @Query() query: TraineeQueryDto,
  ) {
    return this.workerTraineeService.findByCohort(cohortId, query);
  }

  @Get('member/:memberId')
  @RequirePermission(WorkersTrainingPermission.VIEW_MEMBER_TRAINING)
  @ApiOperation({ summary: 'Get all training records for a specific member' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member training records retrieved successfully',
  })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  async findByMember(@Param('memberId') memberId: string) {
    return this.workerTraineeService.findByMember(memberId);
  }

  @Get(':id')
  @RequirePermission(WorkersTrainingPermission.VIEW_TRAINEE_DETAILS)
  @ApiOperation({ summary: 'Get a specific trainee by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Trainee retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trainee not found',
  })
  async findOne(@Param('id') id: string) {
    return this.workerTraineeService.findOne(id);
  }

  @Patch(':id/status')
  @RequirePermission(WorkersTrainingPermission.UPDATE_TRAINEE_STATUS)
  @ApiOperation({ summary: 'Update trainee status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Trainee status updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trainee not found',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body()
    updateData: {
      status: WorkersTrainingStatus;
      reason?: string;
    },
    @Request() req,
  ) {
    return this.workerTraineeService.updateStatus(
      id,
      updateData.status,
      req.user,
      updateData.reason,
    );
  }

  @Patch(':id/assign-unit')
  @RequirePermission(WorkersTrainingPermission.ASSIGN_TRAINEE_TO_UNIT)
  @ApiOperation({ summary: 'Assign trainee to a unit for internship' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Trainee assigned to unit successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trainee not found',
  })
  async assignToUnit(
    @Param('id') id: string,
    @Body()
    assignmentData: {
      unitId: string;
      outcome: TrainingOutcome;
    },
    @Request() req,
  ) {
    return this.workerTraineeService.assignToUnit(
      id,
      assignmentData.unitId,
      assignmentData.outcome,
      req.user,
    );
  }

  @Post(':id/attendance')
  @RequirePermission(WorkersTrainingPermission.RECORD_ATTENDANCE)
  @ApiOperation({ summary: 'Record attendance for a trainee' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Attendance recorded successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trainee not found',
  })
  async recordAttendance(
    @Param('id') id: string,
    @Body()
    attendanceData: {
      sessionId: string;
      sessionDate: Date;
      status: AttendanceStatus;
      checkinTime?: Date;
      checkoutTime?: Date;
      notes?: string;
    },
    @Request() req,
  ) {
    return this.workerTraineeService.recordAttendance(
      id,
      attendanceData,
      req.user,
    );
  }

  @Post(':id/grade-assignment')
  @RequirePermission(WorkersTrainingPermission.GRADE_ASSIGNMENT)
  @ApiOperation({ summary: 'Grade an assignment for a trainee' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Assignment graded successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trainee or assignment not found',
  })
  async gradeAssignment(
    @Param('id') id: string,
    @Body()
    gradingData: {
      assignmentId: string;
      title: string;
      score: number;
      maxScore: number;
      grade?: string;
      feedback?: string;
    },
    @Request() req,
  ) {
    return this.workerTraineeService.recordAssignmentGrade(
      id,
      gradingData,
      req.user,
    );
  }
}