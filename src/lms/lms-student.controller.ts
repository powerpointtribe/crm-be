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
import { PortalJwtGuard } from '../portal/guards/portal-jwt.guard';
import { CurrentPortalAccount } from '../portal/decorators/current-portal-account.decorator';
import { PortalAccountDocument } from '../portal/schemas/portal-account.schema';
import { LmsService } from './lms.service';
import {
  AssistantDto,
  SaveReflectionDto,
  SetLessonProgressDto,
  SubmitAssignmentDto,
  SubmitQuizDto,
} from './dto/lms.dto';

/** Learner-facing LMS reads + progress. Portal-auth (PortalAccount). */
@ApiTags('LMS (student)')
@Controller('trainee')
@UseGuards(PortalJwtGuard)
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

  @Get('me/sessions')
  getSessions(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Query('eventSlug') eventSlug?: string,
  ) {
    return this.lms.getSessions(account, eventSlug);
  }

  @Post('me/sessions/:sessionId/check-in')
  checkIn(
    @CurrentPortalAccount() account: PortalAccountDocument,
    @Param('sessionId') sessionId: string,
  ) {
    return this.lms.checkIn(account, sessionId);
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
    return this.lms.submitQuiz(account, lessonId, dto.answers);
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
