import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import {
  FirstTimer,
  FirstTimerSchema,
} from '../first-timers/schemas/first-timer.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: FirstTimer.name, schema: FirstTimerSchema },
      { name: Group.name, schema: GroupSchema },
    ]),
    RolesModule, // Import RolesModule to make PermissionGuard available
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
