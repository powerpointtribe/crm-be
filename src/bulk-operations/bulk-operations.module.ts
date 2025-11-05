import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BulkOperationsController } from './bulk-operations.controller';
import { BulkOperationsService } from './bulk-operations.service';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { FirstTimer, FirstTimerSchema } from '../first-timers/schemas/first-timer.schema';
import { MembersModule } from '../members/members.module';
import { GroupsModule } from '../groups/groups.module';
import { FirstTimersModule } from '../first-timers/first-timers.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: Group.name, schema: GroupSchema },
      { name: FirstTimer.name, schema: FirstTimerSchema },
    ]),
    MembersModule,
    GroupsModule,
    FirstTimersModule,
    QueueModule,
  ],
  controllers: [BulkOperationsController],
  providers: [BulkOperationsService],
  exports: [BulkOperationsService],
})
export class BulkOperationsModule {}