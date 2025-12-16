import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FirstTimersService } from './first-timers.service';
import { FirstTimerSchedulerService } from './first-timer-scheduler.service';
import { FirstTimerMessagingService } from './first-timer-messaging.service';
import { CallReportsService } from './call-reports.service';
import { FirstTimersController } from './first-timers.controller';
import { FirstTimer, FirstTimerSchema } from './schemas/first-timer.schema';
import { CallReport, CallReportSchema } from './schemas/call-report.schema';
import {
  MessageHistory,
  MessageHistorySchema,
} from './schemas/message-history.schema';
import {
  DailyMessage,
  DailyMessageSchema,
} from './schemas/daily-message.schema';
import { QueueModule } from '../queue/queue.module';
import { MembersModule } from '../members/members.module';
import { GroupsModule } from '../groups/groups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesModule } from '../roles/roles.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FirstTimer.name, schema: FirstTimerSchema },
      { name: CallReport.name, schema: CallReportSchema },
      { name: MessageHistory.name, schema: MessageHistorySchema },
      { name: DailyMessage.name, schema: DailyMessageSchema },
    ]),
    forwardRef(() => QueueModule),
    forwardRef(() => MembersModule),
    forwardRef(() => GroupsModule),
    forwardRef(() => NotificationsModule),
    RolesModule, // Import RolesModule to make PermissionGuard available
    forwardRef(() => AuditLogsModule), // Forward ref to avoid circular dependency
  ],
  controllers: [FirstTimersController],
  providers: [
    FirstTimersService,
    FirstTimerSchedulerService,
    FirstTimerMessagingService,
    CallReportsService,
  ],
  exports: [FirstTimersService, FirstTimerMessagingService, CallReportsService],
})
export class FirstTimersModule {}
