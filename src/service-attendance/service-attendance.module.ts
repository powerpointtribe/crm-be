import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceAttendanceController } from './service-attendance.controller';
import { ServiceAttendanceService } from './service-attendance.service';
import {
  ServiceAttendance,
  ServiceAttendanceSchema,
} from './schemas/service-attendance.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { RolesModule } from '../roles/roles.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ServiceAttendance.name, schema: ServiceAttendanceSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
    RolesModule,
    CommonModule,
  ],
  controllers: [ServiceAttendanceController],
  providers: [ServiceAttendanceService],
  exports: [ServiceAttendanceService],
})
export class ServiceAttendanceModule {}
