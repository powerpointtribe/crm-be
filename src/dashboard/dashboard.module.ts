import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { FirstTimer, FirstTimerSchema } from '../first-timers/schemas/first-timer.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: FirstTimer.name, schema: FirstTimerSchema },
      { name: User.name, schema: UserSchema },
      { name: Group.name, schema: GroupSchema },
    ]),
    forwardRef(() => QueueModule),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}