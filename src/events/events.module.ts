import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventsAdminController } from './events-admin.controller';
import { EventReminderScheduler } from './event-reminder.scheduler';
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
import {
  EventPartner,
  EventPartnerSchema,
} from './schemas/event-partner.schema';
import {
  AccountabilityEntry,
  AccountabilityEntrySchema,
} from './schemas/accountability-entry.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { CommonModule } from '../common/common.module';
import { RolesModule } from '../roles/roles.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MembersModule } from '../members/members.module';
import { BranchesModule } from '../branches/branches.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueName } from '../common/interfaces/queue-job.interface';
import { EventEmailProcessor } from '../queue/processors/event-email.processor';
import { PortalModule } from '../portal/portal.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
      { name: EventSession.name, schema: EventSessionSchema },
      { name: SessionAttendance.name, schema: SessionAttendanceSchema },
      { name: EventPartner.name, schema: EventPartnerSchema },
      { name: AccountabilityEntry.name, schema: AccountabilityEntrySchema },
      { name: Member.name, schema: MemberSchema },
    ]),
    BullModule.registerQueue({
      name: QueueName.EMAIL_NOTIFICATIONS,
    }),
    CommonModule,
    RolesModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AuditLogsModule),
    forwardRef(() => MembersModule),
    forwardRef(() => BranchesModule),
    NotificationsModule,
    PortalModule,
  ],
  controllers: [EventsController, EventsAdminController],
  providers: [EventsService, EventEmailProcessor, EventReminderScheduler],
  exports: [EventsService, MongooseModule],
})
export class EventsModule {}
