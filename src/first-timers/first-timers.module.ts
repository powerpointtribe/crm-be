import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FirstTimersService } from './first-timers.service';
import { FirstTimerSchedulerService } from './first-timer-scheduler.service';
import { FirstTimersController } from './first-timers.controller';
import { FirstTimer, FirstTimerSchema } from './schemas/first-timer.schema';
import { QueueModule } from '../queue/queue.module';
import { MembersModule } from '../members/members.module';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FirstTimer.name, schema: FirstTimerSchema },
    ]),
    forwardRef(() => QueueModule),
    forwardRef(() => MembersModule),
    forwardRef(() => GroupsModule),
  ],
  controllers: [FirstTimersController],
  providers: [FirstTimersService, FirstTimerSchedulerService],
  exports: [FirstTimersService],
})
export class FirstTimersModule {}
