import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { EventsPermission } from '../events/permissions';
import { CommitteeScopeGuard } from './guards/committee-scope.guard';
import { FacilitatorAuditInterceptor } from './facilitator-audit.interceptor';
import { LmsService } from './lms.service';
import {
  AddAudioMessageDto,
  ApplyCourseDto,
  CreateAssignmentDto,
  CreateLessonDto,
  CreateModuleDto,
  GenerateCourseDto,
  GradeSubmissionDto,
  PublishRecordingDto,
  ReorderDto,
  UpdateAssignmentDto,
  UpdateLessonDto,
  UpdateModuleDto,
  UpsertQuizDto,
} from './dto/lms.dto';

/**
 * Facilitator/admin course authoring. Member-auth; gated by events permissions.
 * (Committee-scoping to "your events only" is layered in the facilitator phase.)
 */
@ApiTags('LMS (facilitator)')
@Controller('lms')
@UseGuards(JwtAuthGuard, PermissionGuard, CommitteeScopeGuard)
@UseInterceptors(FacilitatorAuditInterceptor)
export class LmsFacilitatorController {
  constructor(private readonly lms: LmsService) {}

  @Get('events/:eventId/modules')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  listModules(@Param('eventId') eventId: string) {
    return this.lms.listModules(eventId);
  }

  @Get('events/:eventId/engagement')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  engagement(
    @Param('eventId') eventId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.lms.getEngagement(eventId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      sortBy,
    });
  }

  // ---- Leaderboard ----
  @Get('events/:eventId/leaderboard')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  leaderboard(
    @Param('eventId') eventId: string,
    @Query('scope') scope?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.lms.getLeaderboardForFacilitator(eventId, {
      scope: scope === 'weekly' ? 'weekly' : 'overall',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('events/:eventId/leaderboard/weights')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  leaderboardWeights(@Param('eventId') eventId: string) {
    return this.lms.getLeaderboardWeights(eventId);
  }

  @Put('events/:eventId/leaderboard/weights')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  saveLeaderboardWeights(
    @Param('eventId') eventId: string,
    @Body()
    dto: {
      perLesson?: number;
      perModule?: number;
      quizMax?: number;
      summaryMax?: number;
      streakBonusPerWeek?: number;
      excludedEmails?: string[];
    },
  ) {
    return this.lms.updateLeaderboardWeights(eventId, dto);
  }

  @Post('events/:eventId/leaderboard/recompute')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  recomputeLeaderboard(@Param('eventId') eventId: string) {
    return this.lms.recomputeLeaderboard(eventId);
  }

  @Get('events/:eventId/flagged-attendance')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  flaggedAttendance(@Param('eventId') eventId: string) {
    return this.lms.getFlaggedAttendance(eventId);
  }

  // Facilitator audit log — every change action, visible to all facilitators.
  @Get('events/:eventId/audit-log')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  auditLog(
    @Param('eventId') eventId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.lms.getAuditLog(eventId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // Reconcile/close a flagged attendance discrepancy (drops it from the list).
  @Patch('events/:eventId/attendance/:attendanceId/resolve-flag')
  @RequirePermission(EventsPermission.CHECK_IN)
  resolveAttendanceFlag(
    @Param('eventId') eventId: string,
    @Param('attendanceId') attendanceId: string,
  ) {
    return this.lms.resolveAttendanceFlag(eventId, attendanceId);
  }

  // ── Module sermon summaries (facilitator review + grading) ────────────────

  @Get('modules/:moduleId/sermon-summaries')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  listSermonSummaries(@Param('moduleId') moduleId: string) {
    return this.lms.listModuleSermonSummaries(moduleId);
  }

  // Every learner's written reflection for a lesson.
  @Get('lessons/:lessonId/reflections')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  lessonReflections(@Param('lessonId') lessonId: string) {
    return this.lms.getLessonReflections(lessonId);
  }

  @Patch('sermon-summaries/:summaryId/grade')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  gradeSermonSummary(
    @Param('summaryId') summaryId: string,
    @Body() dto: { grade?: number; feedback?: string },
  ) {
    return this.lms.gradeSermonSummary(summaryId, dto?.grade, dto?.feedback);
  }

  // Bulk-grade a module's summaries from a re-uploaded CSV (parsed client-side).
  @Post('modules/:moduleId/sermon-summaries/grade-bulk')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  bulkGradeSermonSummaries(
    @Param('moduleId') moduleId: string,
    @Body() dto: { grades: Array<{ id?: string; grade?: number; feedback?: string }> },
  ) {
    return this.lms.bulkGradeSermonSummaries(moduleId, dto?.grades || []);
  }

  // ── Q&A community feed (facilitator authoring) ────────────────────────────

  @Get('events/:eventId/qa')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  listQaPosts(@Param('eventId') eventId: string) {
    return this.lms.listQaPosts(eventId);
  }

  @Post('events/:eventId/qa')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  createQaPost(
    @Param('eventId') eventId: string,
    @Body()
    dto: {
      question: string;
      label?: string;
      answerType?: 'text' | 'audio';
      answerText?: string;
      answerAudioUrl?: string;
      answerAudioName?: string;
    },
  ) {
    return this.lms.createQaPost(eventId, dto);
  }

  @Delete('events/:eventId/qa/:postId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  deleteQaPost(@Param('postId') postId: string) {
    return this.lms.deleteQaPost(postId);
  }

  // Event-wide attendance breakdown (present/late/attending/absent per session).
  @Get('events/:eventId/attendance/overview')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  attendanceOverview(@Param('eventId') eventId: string) {
    return this.lms.getAttendanceOverview(eventId);
  }

  // Manually set a learner's attendance status for a session (present/absent/…).
  @Patch('events/:eventId/attendance/sessions/:sessionId/status')
  @RequirePermission(EventsPermission.CHECK_IN)
  setAttendanceStatus(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: { registrationId: string; status: string },
  ) {
    return this.lms.setAttendanceStatus(
      eventId,
      sessionId,
      dto?.registrationId,
      dto?.status,
    );
  }

  // Bulk-mark every learner who watched a session ≥ minMinutes as present.
  @Post('events/:eventId/attendance/sessions/:sessionId/mark-present')
  @RequirePermission(EventsPermission.CHECK_IN)
  bulkMarkPresent(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: { minMinutes?: number; field?: 'attended' | 'live' },
  ) {
    return this.lms.bulkMarkPresentByWatchTime(eventId, sessionId, {
      minMinutes: dto?.minMinutes,
      field: dto?.field,
    });
  }

  // Per-session attendance detail — each learner's watch-time, replays, status.
  @Get('events/:eventId/attendance/sessions/:sessionId')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  attendanceForSession(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.lms.getSessionAttendanceDetail(eventId, sessionId);
  }

  @Get('events/:eventId/overview')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  overview(@Param('eventId') eventId: string) {
    return this.lms.getEventOverview(eventId);
  }

  @Post('events/:eventId/modules')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  createModule(
    @Param('eventId') eventId: string,
    @Body() dto: CreateModuleDto,
  ) {
    return this.lms.createModule(eventId, dto);
  }

  @Patch('events/:eventId/modules/reorder')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  reorderModules(
    @Param('eventId') eventId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.lms.reorderModules(eventId, dto.orderedIds);
  }

  @Patch('modules/:moduleId/lessons/reorder')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  reorderLessons(
    @Param('moduleId') moduleId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.lms.reorderLessons(moduleId, dto.orderedIds);
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

  // ── Module audio messages ("Messages to listen to") ──────────────────────

  @Post('modules/:moduleId/audio-messages')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  addAudioMessage(
    @Param('moduleId') moduleId: string,
    @Body() dto: AddAudioMessageDto,
  ) {
    return this.lms.addModuleAudioMessage(moduleId, dto);
  }

  @Delete('modules/:moduleId/audio-messages/:messageId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  removeAudioMessage(
    @Param('moduleId') moduleId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.lms.removeModuleAudioMessage(moduleId, messageId);
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

  // ── Quizzes (per lesson) ──────────────────────────────────────────────────

  @Get('lessons/:lessonId/quiz')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  getQuiz(@Param('lessonId') lessonId: string) {
    return this.lms.getQuizForLesson(lessonId);
  }

  @Put('lessons/:lessonId/quiz')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  upsertQuiz(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpsertQuizDto,
  ) {
    return this.lms.upsertQuiz(lessonId, dto);
  }

  @Delete('lessons/:lessonId/quiz')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  deleteQuiz(@Param('lessonId') lessonId: string) {
    return this.lms.deleteQuiz(lessonId);
  }

  @Get('lessons/:lessonId/quiz/responses')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  getQuizResponses(@Param('lessonId') lessonId: string) {
    return this.lms.getQuizResponses(lessonId);
  }

  // ── Assignments (event-scoped; :eventId keeps the committee guard happy) ───

  @Get('events/:eventId/assignments')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  listAssignments(@Param('eventId') eventId: string) {
    return this.lms.listAssignments(eventId);
  }

  @Post('events/:eventId/assignments')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  createAssignment(
    @Param('eventId') eventId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.lms.createAssignment(eventId, dto);
  }

  @Patch('events/:eventId/assignments/:assignmentId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  updateAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.lms.updateAssignment(assignmentId, dto);
  }

  @Delete('events/:eventId/assignments/:assignmentId')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  deleteAssignment(@Param('assignmentId') assignmentId: string) {
    return this.lms.deleteAssignment(assignmentId);
  }

  @Get('events/:eventId/assignments/:assignmentId/submissions')
  @RequirePermission(EventsPermission.VIEW_REGISTRATIONS)
  listSubmissions(@Param('assignmentId') assignmentId: string) {
    return this.lms.listSubmissions(assignmentId);
  }

  @Patch('events/:eventId/submissions/:submissionId/grade')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  gradeSubmission(
    @Param('submissionId') submissionId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.lms.gradeSubmission(submissionId, dto.grade, dto.feedback);
  }

  // ── AI course generation ──────────────────────────────────────────────────

  @Post('events/:eventId/ai/generate-course')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  generateCourse(
    @Param('eventId') eventId: string,
    @Body() dto: GenerateCourseDto,
  ) {
    return this.lms.generateCourseDraft(eventId, dto);
  }

  @Post('events/:eventId/ai/apply-course')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  applyCourse(@Param('eventId') eventId: string, @Body() dto: ApplyCourseDto) {
    return this.lms.applyCourseDraft(eventId, dto.modules);
  }

  // ── YouTube live-session attendance ───────────────────────────────────────

  // Finalize watch-time attendance after a session (below-threshold → absent).
  @Post('events/:eventId/sessions/:sessionId/finalize-attendance')
  @RequirePermission(EventsPermission.CHECK_IN)
  finalizeAttendance(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.lms.finalizeSessionAttendance(eventId, sessionId);
  }

  // Pull attendance from Zoom's participant report for a session and mark
  // present/late/absent. Returns a summary + any unmatched Zoom participants.
  @Post('events/:eventId/sessions/:sessionId/sync-zoom-attendance')
  @RequirePermission(EventsPermission.CHECK_IN)
  syncZoomAttendance(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.lms.syncSessionAttendanceFromZoom(eventId, sessionId);
  }

  // Upload a Zoom participant report CSV and reconcile it into attendance
  // (matched by name/email). The frontend posts the file's text as { csv }.
  @Post('events/:eventId/sessions/:sessionId/import-zoom-csv')
  @RequirePermission(EventsPermission.CHECK_IN)
  importZoomCsv(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: { csv?: string },
  ) {
    return this.lms.importZoomAttendanceCsv(eventId, sessionId, body?.csv || '');
  }

  // End the live session for students now (after ending the Zoom meeting as
  // host) so the portal stops showing it LIVE. Body { resume: true } reopens it.
  @Post('events/:eventId/sessions/:sessionId/end-live')
  @RequirePermission(EventsPermission.CHECK_IN)
  endLive(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: { resume?: boolean },
  ) {
    return this.lms.setSessionLiveEnded(eventId, sessionId, !!body?.resume);
  }

  // Live status of the session's YouTube broadcast (LIVE badge / viewer count).
  @Get('events/:eventId/sessions/:sessionId/live-status')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  sessionLiveStatus(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.lms.getSessionLiveStatus(eventId, sessionId);
  }

  // ── Session recordings ────────────────────────────────────────────────────

  // Check whether the session's recording is ready (and notify facilitators).
  @Post('events/:eventId/sessions/:sessionId/check-recording')
  @RequirePermission(EventsPermission.VIEW_EVENT_DETAILS)
  checkRecording(@Param('sessionId') sessionId: string) {
    return this.lms.checkAndNotifyRecording(sessionId);
  }

  // Publish the recording into a module as a replay video lesson.
  @Post('events/:eventId/sessions/:sessionId/publish-recording')
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  publishRecording(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: PublishRecordingDto,
  ) {
    return this.lms.publishSessionRecording(eventId, sessionId, dto);
  }
}
