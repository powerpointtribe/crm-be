import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Member, MemberSchema } from '../members/schemas/member-unified.schema';
import {
  FirstTimer,
  FirstTimerSchema,
} from '../first-timers/schemas/first-timer.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: FirstTimer.name, schema: FirstTimerSchema },
      { name: Group.name, schema: GroupSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
