import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FirstTimersService } from './first-timers.service';
import { FirstTimerSchedulerService } from './first-timer-scheduler.service';
import { CallReportsService } from './call-reports.service';
import { MessageDraftsService } from './message-drafts.service';
import { FirstTimersController } from './first-timers.controller';
import { MessageDraftsController } from './message-drafts.controller';
import { FirstTimer, FirstTimerSchema } from './schemas/first-timer.schema';
import { CallReport, CallReportSchema } from './schemas/call-report.schema';
import { MessageDraft, MessageDraftSchema } from './schemas/message-draft.schema';
import { QueueModule } from '../queue/queue.module';
import { MembersModule } from '../members/members.module';
import { GroupsModule } from '../groups/groups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesModule } from '../roles/roles.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FirstTimer.name, schema: FirstTimerSchema },
      { name: CallReport.name, schema: CallReportSchema },
      { name: MessageDraft.name, schema: MessageDraftSchema },
    ]),
    forwardRef(() => QueueModule),
    forwardRef(() => MembersModule),
    forwardRef(() => GroupsModule),
    forwardRef(() => NotificationsModule),
    RolesModule, // Import RolesModule to make PermissionGuard available
    forwardRef(() => AuditLogsModule), // Forward ref to avoid circular dependency
    forwardRef(() => BranchesModule), // Import BranchesModule for branch-specific form handling
  ],
  controllers: [MessageDraftsController, FirstTimersController],
  providers: [
    FirstTimersService,
    FirstTimerSchedulerService,
    CallReportsService,
    MessageDraftsService,
  ],
  exports: [FirstTimersService, CallReportsService, MessageDraftsService],
})
export class FirstTimersModule {}
