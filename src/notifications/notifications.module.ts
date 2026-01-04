import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { EmailProvider } from './providers/email.provider';
import { NotificationsController } from './notifications.controller';
import { BirthdaySchedulerService } from './birthday-scheduler.service';
import { UserNotificationsService } from './user-notifications.service';
import { MembersModule } from '../members/members.module';
import { RolesModule } from '../roles/roles.module';
import { FirstTimer, FirstTimerSchema } from '../first-timers/schemas/first-timer.schema';
import { MemberActivity, MemberActivitySchema } from '../activity-tracker/schemas/member-activity.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { NotificationDismissal, NotificationDismissalSchema } from './schemas/notification-dismissal.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: FirstTimer.name, schema: FirstTimerSchema },
      { name: MemberActivity.name, schema: MemberActivitySchema },
      { name: Group.name, schema: GroupSchema },
      { name: NotificationDismissal.name, schema: NotificationDismissalSchema },
    ]),
    forwardRef(() => MembersModule),
    forwardRef(() => RolesModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailProvider, BirthdaySchedulerService, UserNotificationsService],
  exports: [NotificationsService, EmailProvider, BirthdaySchedulerService, UserNotificationsService],
})
export class NotificationsModule {}
