import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { EventsPermission } from '../events/permissions';
import { CommitteeScopeGuard } from './guards/committee-scope.guard';
import { LmsService } from './lms.service';
import {
  CreateLessonDto,
  CreateModuleDto,
  UpdateLessonDto,
  UpdateModuleDto,
} from './dto/lms.dto';

/**
 * Facilitator/admin course authoring. Member-auth; gated by events permissions.
 * (Committee-scoping to "your events only" is layered in the facilitator phase.)
 */
@ApiTags('LMS (facilitator)')
@Controller('lms')
@UseGuards(JwtAuthGuard, PermissionGuard, CommitteeScopeGuard)
export class LmsFacilitatorController {
  constructor(private readonly lms: LmsService) {}

  @Get('events/:eventId/modules')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  listModules(@Param('eventId') eventId: string) {
    return this.lms.listModules(eventId);
  }

  @Get('events/:eventId/engagement')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  engagement(@Param('eventId') eventId: string) {
    return this.lms.getEngagement(eventId);
  }

  @Post('events/:eventId/modules')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  createModule(
    @Param('eventId') eventId: string,
    @Body() dto: CreateModuleDto,
  ) {
    return this.lms.createModule(eventId, dto);
  }

  @Patch('modules/:moduleId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  updateModule(
    @Param('moduleId') moduleId: string,
    @Body() dto: UpdateModuleDto,
  ) {
    return this.lms.updateModule(moduleId, dto);
  }

  @Delete('modules/:moduleId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  deleteModule(@Param('moduleId') moduleId: string) {
    return this.lms.deleteModule(moduleId);
  }

  @Post('modules/:moduleId/lessons')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  createLesson(
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lms.createLesson(moduleId, dto);
  }

  @Patch('lessons/:lessonId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  updateLesson(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lms.updateLesson(lessonId, dto);
  }

  @Delete('lessons/:lessonId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  deleteLesson(@Param('lessonId') lessonId: string) {
    return this.lms.deleteLesson(lessonId);
  }
}
