import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { LmsService } from './lms.service';
import { LmsFacilitatorController } from './lms-facilitator.controller';
import { LmsStudentController } from './lms-student.controller';
import {
  CourseModule as CourseModuleSchemaClass,
  CourseModuleSchema,
} from './schemas/course-module.schema';
import { Lesson, LessonSchema } from './schemas/lesson.schema';
import {
  LessonProgress,
  LessonProgressSchema,
} from './schemas/lesson-progress.schema';
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
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';
import { CommitteeScopeGuard } from './guards/committee-scope.guard';

@Module({
  imports: [
    PassportModule,
    MongooseModule.forFeature([
      { name: CourseModuleSchemaClass.name, schema: CourseModuleSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: LessonProgress.name, schema: LessonProgressSchema },
      { name: Event.name, schema: EventSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
      { name: EventSession.name, schema: EventSessionSchema },
      { name: SessionAttendance.name, schema: SessionAttendanceSchema },
    ]),
    forwardRef(() => AuthModule),
    RolesModule,
  ],
  controllers: [LmsFacilitatorController, LmsStudentController],
  providers: [LmsService, CommitteeScopeGuard],
  exports: [LmsService],
})
export class LmsModule {}
