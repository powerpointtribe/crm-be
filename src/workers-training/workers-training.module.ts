import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CohortController } from './cohort.controller';
import { WorkerTraineeController } from './worker-trainee.controller';
import { CohortService } from './cohort.service';
import { WorkerTraineeService } from './worker-trainee.service';
import { Cohort, CohortSchema } from './schemas/cohort.schema';
import { WorkerTrainee, WorkerTraineeSchema } from './schemas/worker-trainee.schema';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MembersModule } from '../members/members.module';
import { GroupsModule } from '../groups/groups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    RolesModule,
    MongooseModule.forFeature([
      { name: Cohort.name, schema: CohortSchema },
      { name: WorkerTrainee.name, schema: WorkerTraineeSchema },
    ]),
    AuditLogsModule,
    MembersModule,
    GroupsModule,
    NotificationsModule,
  ],
  controllers: [CohortController, WorkerTraineeController],
  providers: [CohortService, WorkerTraineeService],
  exports: [CohortService, WorkerTraineeService],
})
export class WorkersTrainingModule {}