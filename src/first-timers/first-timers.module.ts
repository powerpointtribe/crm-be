import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FirstTimersService } from './first-timers.service';
import { FirstTimersController } from './first-timers.controller';
import { FirstTimer, FirstTimerSchema } from './schemas/first-timer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FirstTimer.name, schema: FirstTimerSchema },
    ]),
  ],
  controllers: [FirstTimersController],
  providers: [FirstTimersService],
  exports: [FirstTimersService],
})
export class FirstTimersModule {}
