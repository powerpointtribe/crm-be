import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MemberActivity, MemberActivitySchema } from './schemas/member-activity.schema';
import { MemberLifecycleService } from './member-lifecycle.service';
import { LifecycleLoggingInterceptor } from './interceptors/lifecycle-logging.interceptor';
import { ActivityTrackerController } from './activity-tracker.controller';
import { ActivityTrackerService } from './activity-tracker.service';
import { RolesModule } from '../roles/roles.module';

@Global() // Make this module global so other modules can use lifecycle logging
@Module({
  imports: [
    RolesModule,
    MongooseModule.forFeature([
      { name: MemberActivity.name, schema: MemberActivitySchema },
    ]),
  ],
  controllers: [ActivityTrackerController],
  providers: [
    ActivityTrackerService,
    MemberLifecycleService,
    LifecycleLoggingInterceptor,
  ],
  exports: [
    MemberLifecycleService,
    ActivityTrackerService,
    LifecycleLoggingInterceptor,
  ],
})
export class ActivityTrackerModule {}