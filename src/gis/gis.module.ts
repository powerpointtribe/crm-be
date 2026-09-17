import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GisController } from './gis.controller';
import { GisService } from './gis.service';
import { GisCronService } from './gis-cron.service';
import { GisSnapshot, GisSnapshotSchema } from './schemas/gis-snapshot.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { FirstTimer, FirstTimerSchema } from '../first-timers/schemas/first-timer.schema';
import {
  ServiceAttendance,
  ServiceAttendanceSchema,
} from '../service-attendance/schemas/service-attendance.schema';
import {
  ServiceReport,
  ServiceReportSchema,
} from '../service-reports/schemas/service-report.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import {
  WorkerTrainee,
  WorkerTraineeSchema,
} from '../workers-training/schemas/worker-trainee.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { RolesModule } from '../roles/roles.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GisSnapshot.name, schema: GisSnapshotSchema },
      { name: Member.name, schema: MemberSchema },
      { name: FirstTimer.name, schema: FirstTimerSchema },
      { name: ServiceAttendance.name, schema: ServiceAttendanceSchema },
      { name: ServiceReport.name, schema: ServiceReportSchema },
      { name: Group.name, schema: GroupSchema },
      { name: WorkerTrainee.name, schema: WorkerTraineeSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    RolesModule,
    CommonModule,
  ],
  controllers: [GisController],
  providers: [GisService, GisCronService],
  exports: [GisService],
})
export class GisModule {}
