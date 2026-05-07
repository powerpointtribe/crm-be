import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { CohortService } from './cohort.service';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { CohortQueryDto } from './dto/cohort-query.dto';
import { CohortStatus } from '../common/enums/workers-training.enum';
import { WorkersTrainingPermission } from './permissions';

@ApiTags('Workers Training - Cohorts')
@Controller('workers-training/cohorts')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class CohortController {
  constructor(
    private readonly cohortService: CohortService,
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

  @Post()
  @RequirePermission(WorkersTrainingPermission.CREATE_COHORT)
  @ApiOperation({ summary: 'Create a new cohort' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Cohort created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async create(@Body() createCohortDto: CreateCohortDto, @Request() req) {
    return this.cohortService.create(createCohortDto, req.user);
  }

  @Get()
  @RequirePermission(WorkersTrainingPermission.VIEW_COHORTS)
  @ApiOperation({ summary: 'Get all cohorts with filtering and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cohorts retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: CohortStatus })
  @ApiQuery({ name: 'type', required: false, type: String })
  async findAll(@Query() query: CohortQueryDto) {
    return this.cohortService.findAll(query);
  }

  @Get('statistics')
  @RequirePermission(WorkersTrainingPermission.VIEW_COHORT_STATS)
  @ApiOperation({ summary: 'Get cohort statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  async getStatistics(@Request() req) {
    const branchId = await this.getUserBranchId(req.user);
    return this.cohortService.getCohortStatistics(undefined, branchId);
  }

  @Get('facilitator/:facilitatorId')
  @RequirePermission(WorkersTrainingPermission.VIEW_FACILITATOR_COHORTS)
  @ApiOperation({ summary: 'Get cohorts for a specific facilitator' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Facilitator cohorts retrieved successfully',
  })
  @ApiQuery({ name: 'status', required: false, enum: CohortStatus })
  async getCohortsForFacilitator(
    @Param('facilitatorId') facilitatorId: string,
    @Query('status') status?: CohortStatus,
  ) {
    return this.cohortService.getCohortsForFacilitator(facilitatorId, status);
  }

  @Get(':id')
  @RequirePermission(WorkersTrainingPermission.VIEW_COHORT_DETAILS)
  @ApiOperation({ summary: 'Get a specific cohort by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cohort retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cohort not found',
  })
  async findOne(@Param('id') id: string) {
    return this.cohortService.findOne(id);
  }

  @Get(':id/statistics')
  @RequirePermission(WorkersTrainingPermission.VIEW_COHORT_STATS)
  @ApiOperation({ summary: 'Get statistics for a specific cohort' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cohort statistics retrieved successfully',
  })
  async getCohortStatistics(@Param('id') id: string) {
    return this.cohortService.getCohortStatistics(id);
  }

  @Patch(':id')
  @RequirePermission(WorkersTrainingPermission.UPDATE_COHORT)
  @ApiOperation({ summary: 'Update a cohort' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cohort updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cohort not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateCohortDto>,
    @Request() req,
  ) {
    return this.cohortService.update(id, updateData, req.user);
  }

  @Patch(':id/status')
  @RequirePermission(WorkersTrainingPermission.UPDATE_COHORT_STATUS)
  @ApiOperation({ summary: 'Update cohort status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cohort status updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cohort not found',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: CohortStatus,
    @Request() req,
  ) {
    return this.cohortService.updateStatus(id, status, req.user);
  }

  @Delete(':id')
  @RequirePermission(WorkersTrainingPermission.DELETE_COHORT)
  @ApiOperation({ summary: 'Delete a cohort (soft delete)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cohort deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cohort not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async remove(@Param('id') id: string, @Request() req) {
    return this.cohortService.remove(id, req.user);
  }
}