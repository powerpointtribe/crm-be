import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event, EventSchema } from './schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationSchema,
} from './schemas/event-registration.schema';
import {
  EventSession,
  EventSessionSchema,
} from './schemas/event-session.schema';
import {
  SessionAttendance,
  SessionAttendanceSchema,
} from './schemas/session-attendance.schema';
import { CommonModule } from '../common/common.module';
import { RolesModule } from '../roles/roles.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MembersModule } from '../members/members.module';
import { BranchesModule } from '../branches/branches.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
      { name: EventSession.name, schema: EventSessionSchema },
      { name: SessionAttendance.name, schema: SessionAttendanceSchema },
    ]),
    CommonModule,
    RolesModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AuditLogsModule),
    forwardRef(() => MembersModule),
    forwardRef(() => BranchesModule),
    NotificationsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService, MongooseModule],
})
export class EventsModule {}
