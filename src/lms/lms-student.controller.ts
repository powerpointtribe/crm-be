import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PortalJwtGuard } from '../portal/guards/portal-jwt.guard';
import { CurrentPortalAccount } from '../portal/decorators/current-portal-account.decorator';
import { PortalAccountDocument } from '../portal/schemas/portal-account.schema';
import { LmsService } from './lms.service';
import {
  AssistantDto,
  SaveReflectionDto,
  SessionHeartbeatDto,
  SetLessonProgressDto,
  SubmitAssignmentDto,
  SubmitQuizDto,
} from './dto/lms.dto';

/**
 * Learner-facing LMS reads + progress. Portal-auth (PortalAccount).
 * Throttling is skipped here: these are authenticated per-learner endpoints and
 * the live-session ones (heartbeat every 30s, watch-source, zoom-join) are
 * naturally bursty when a whole cohort joins at once. The heartbeat is already
 * server-capped against abuse.
 */
@ApiTags('LMS (student)')
@Controller('trainee')
@UseGuards(PortalJwtGuard)
@SkipThrottle()
export class LmsStudentController {
  constructor(private readonly lms: LmsService) {}

  @Get('me/curriculum')
  getCurriculum(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Query('eventSlug') eventSlug?: string,
  ) {
    return this.lms.getCurriculum(account, eventSlug);
  }

  @Get('me/lessons/:lessonId')
  getLesson(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Param('lessonId') lessonId: string,
  ) {
    return this.lms.getLesson(account, lessonId);
  }

  // Signed Meeting SDK payload to watch a session's Zoom meeting/webinar
  // embedded in the portal (no separate Zoom login).
  @Get('me/sessions/:sessionId/zoom-join')
  getZoomJoin(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Param('sessionId') sessionId: string,
  ) {
    return this.lms.getZoomJoinInfo(account, sessionId);
  }

  // Which player to embed for this learner — Zoom until it nears live capacity,
  // then the YouTube simulcast (overflow). Sticky per learner for the session.
  @Get('me/sessions/:sessionId/watch-source')
  getWatchSource(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Param('sessionId') sessionId: string,
  ) {
    return this.lms.getWatchSource(account, sessionId);
  }

  @Get('me/progress')
  getProgress(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Query('eventSlug') eventSlug?: string,
  ) {
    return this.lms.getProgress(account, eventSlug);
  }

  @Post('me/progress')
  setProgress(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Body() dto: SetLessonProgressDto,
  ) {
    return this.lms.setProgress(account, dto.eventSlug, dto.lessonId, dto.completed);
  }

  @Post('me/reflections')
  saveReflection(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Body() dto: SaveReflectionDto,
  ) {
    return this.lms.saveReflection(account, dto.eventSlug, dto.lessonId, dto.content);
  }

  // A module's single sermon summary note (from its "Messages to listen to").
  @Get('me/modules/:moduleId/sermon-summary')
  getSermonSummary(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Param('moduleId') moduleId: string,
  ) {
    return this.lms.getSermonSummary(account, moduleId);
  }

  @Post('me/modules/:moduleId/sermon-summary')
  saveSermonSummary(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Param('moduleId') moduleId: string,
    @Body() dto: { content?: string },
  ) {
    return this.lms.saveSermonSummary(account, moduleId, dto?.content || '');
  }

  // Q&A community feed (read-only) + a single reaction per post.
  @Get('me/qa')
  getQaFeed(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Query('eventSlug') eventSlug?: string,
  ) {
    return this.lms.getQaFeed(account, eventSlug);
  }

  @Post('me/qa/:postId/react')
  reactToQaPost(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Param('postId') postId: string,
    @Body() dto: { emoji?: string },
  ) {
    return this.lms.reactToQaPost(account, postId, dto?.emoji || '');
  }

  @Get('me/sessions')
  getSessions(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Query('eventSlug') eventSlug?: string,
  ) {
    return this.lms.getSessions(account, eventSlug);
  }

  // NOTE: no student self check-in. Attendance is derived solely from
  // watch-time on the embedded player (below) — learners cannot mark their own
  // attendance.

  // Watch-time heartbeat from the embedded YouTube live player. Accumulates
  // minutes watched and updates attendance status live.
  @Post('me/sessions/:sessionId/heartbeat')
  sessionHeartbeat(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Param('sessionId') sessionId: string,
    @Body() dto: SessionHeartbeatDto,
  ) {
    return this.lms.recordWatchHeartbeat(account, sessionId, dto);
  }

  @Get('me/certificate')
  getCertificate(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Query('eventSlug') eventSlug?: string,
  ) {
    return this.lms.getCertificate(account, eventSlug);
  }

  @Get('me/lessons/:lessonId/quiz')
  getQuiz(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Param('lessonId') lessonId: string,
  ) {
    return this.lms.getQuizForStudent(account, lessonId);
  }

  @Post('me/lessons/:lessonId/quiz/submit')
  submitQuiz(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Param('lessonId') lessonId: string,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.lms.submitQuiz(account, lessonId, dto.responses);
  }

  @Get('me/assignments')
  getAssignments(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Query('eventSlug') eventSlug?: string,
  ) {
    return this.lms.getAssignmentsForStudent(account, eventSlug);
  }

  @Post('me/assignments/:assignmentId/submit')
  submitAssignment(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: SubmitAssignmentDto,
  ) {
    return this.lms.submitAssignment(account, assignmentId, {
      text: dto.text,
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
    });
  }

  @Get('me/profile')
  getProfile(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Query('eventSlug') eventSlug?: string,
  ) {
    return this.lms.getStudentProfile(account, eventSlug);
  }

  @Get('me/notifications')
  getNotifications(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Query('eventSlug') eventSlug?: string,
  ) {
    return this.lms.getNotifications(account, eventSlug);
  }

  @Post('me/notifications/read')
  markNotificationsRead(
    @CurrentPortalAccount() account: PortalAccountDocument,
  ) {
    return this.lms.markNotificationsRead(account);
  }

  @Post('me/assistant')
  askAssistant(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Body() dto: AssistantDto,
  ) {
    return this.lms.askAssistant(account, {
      eventSlug: dto.eventSlug,
      lessonId: dto.lessonId,
      message: dto.message,
      history: dto.history,
    });
  }
}
