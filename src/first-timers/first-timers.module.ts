import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FirstTimersService } from './first-timers.service';
import { FirstTimersController } from './first-timers.controller';
import { FirstTimer, FirstTimerSchema } from './schemas/first-timer.schema';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FirstTimer.name, schema: FirstTimerSchema },
    ]),
    forwardRef(() => QueueModule),
  ],
  controllers: [FirstTimersController],
  providers: [FirstTimersService],
  exports: [FirstTimersService],
})
export class FirstTimersModule {}
