import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { LmsService } from './lms.service';
import { LmsFacilitatorController } from './lms-facilitator.controller';
import { LmsStudentController } from './lms-student.controller';
import { LmsZoomWebhookController } from './lms-zoom-webhook.controller';
import { LmsMediaController } from './lms-media.controller';
import {
  CourseModule as CourseModuleSchemaClass,
  CourseModuleSchema,
} from './schemas/course-module.schema';
import { Lesson, LessonSchema } from './schemas/lesson.schema';
import {
  SermonSummary,
  SermonSummarySchema,
} from './schemas/sermon-summary.schema';
import { QaPost, QaPostSchema } from './schemas/qa-post.schema';
import {
  LessonProgress,
  LessonProgressSchema,
} from './schemas/lesson-progress.schema';
import { Quiz, QuizSchema } from './schemas/quiz.schema';
import {
  QuizAttempt,
  QuizAttemptSchema,
} from './schemas/quiz-attempt.schema';
import { Assignment, AssignmentSchema } from './schemas/assignment.schema';
import { Submission, SubmissionSchema } from './schemas/submission.schema';
import { Event, EventSchema } from '../events/schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationSchema,
} from '../events/schemas/event-registration.schema';
import {
  EventSession,
  EventSessionSchema,
} from '../events/schemas/event-session.schema';
import {
  SessionAttendance,
  SessionAttendanceSchema,
} from '../events/schemas/session-attendance.schema';
import {
  EventAnnouncement,
  EventAnnouncementSchema,
} from '../events/schemas/event-announcement.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';
import { AiModule } from '../ai/ai.module';
import { YoutubeModule } from '../youtube/youtube.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailTemplateSharedModule } from '../bulk-email/email-template-shared.module';
import { ZoomModule } from '../zoom/zoom.module';
import { PortalModule } from '../portal/portal.module';
import { CommitteeScopeGuard } from './guards/committee-scope.guard';

@Module({
  imports: [
    PassportModule,
    MongooseModule.forFeature([
      { name: CourseModuleSchemaClass.name, schema: CourseModuleSchema },
      { name: SermonSummary.name, schema: SermonSummarySchema },
      { name: QaPost.name, schema: QaPostSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: LessonProgress.name, schema: LessonProgressSchema },
      { name: Quiz.name, schema: QuizSchema },
      { name: QuizAttempt.name, schema: QuizAttemptSchema },
      { name: Assignment.name, schema: AssignmentSchema },
      { name: Submission.name, schema: SubmissionSchema },
      { name: Event.name, schema: EventSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
      { name: EventSession.name, schema: EventSessionSchema },
      { name: SessionAttendance.name, schema: SessionAttendanceSchema },
      { name: EventAnnouncement.name, schema: EventAnnouncementSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
    forwardRef(() => AuthModule),
    RolesModule,
    AiModule,
    YoutubeModule,
    NotificationsModule,
    EmailTemplateSharedModule,
    ZoomModule,
    PortalModule,
  ],
  controllers: [
    LmsFacilitatorController,
    LmsStudentController,
    LmsZoomWebhookController,
    LmsMediaController,
  ],
  providers: [LmsService, CommitteeScopeGuard],
  exports: [LmsService],
})
export class LmsModule {}
