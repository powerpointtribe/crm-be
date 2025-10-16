import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-roles.enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';

@ApiTags('Queue Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('jobs/:jobId/status')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Get job status by ID' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
  })
  async getJobStatus(@Param('jobId') jobId: string) {
    const status = await this.queueService.getJobStatus(jobId);
    return ResponseUtil.success(status, 'Job status retrieved successfully');
  }

  @Get('jobs/history')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Get job history for current user' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of jobs to retrieve',
  })
  @ApiResponse({
    status: 200,
    description: 'Job history retrieved successfully',
  })
  async getJobHistory(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const history = await this.queueService.getJobHistory(user.sub, limitNum);
    return ResponseUtil.success(history, 'Job history retrieved successfully');
  }

  @Delete('jobs/:jobId')
  @Roles(UserRole.ADMIN, UserRole.PASTOR, UserRole.LXL)
  @ApiOperation({ summary: 'Cancel a job' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job cancelled successfully',
  })
  async cancelJob(@Param('jobId') jobId: string, @CurrentUser() user: any) {
    const success = await this.queueService.cancelJob(jobId, user.sub);

    if (success) {
      return ResponseUtil.success(null, 'Job cancelled successfully');
    } else {
      throw new BadRequestException('Failed to cancel job or job not found');
    }
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.PASTOR)
  @ApiOperation({ summary: 'Get queue statistics (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
  })
  async getQueueStats() {
    const stats = await this.queueService.getQueueStats();
    return ResponseUtil.success(
      stats,
      'Queue statistics retrieved successfully',
    );
  }
}
