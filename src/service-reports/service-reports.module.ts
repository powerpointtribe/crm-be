import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceReportsService } from './service-reports.service';
import { ServiceReportsController } from './service-reports.controller';
import { ServiceReportsPdfService } from './service-reports-pdf.service';
import {
  ServiceReport,
  ServiceReportSchema,
} from './schemas/service-report.schema';
import { RolesModule } from '../roles/roles.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ServiceReport.name, schema: ServiceReportSchema },
    ]),
    RolesModule, // Import RolesModule to make PermissionGuard and UserPermissionsService available
    CommonModule, // Import CommonModule for BranchAccessService
  ],
  controllers: [ServiceReportsController],
  providers: [ServiceReportsService, ServiceReportsPdfService],
  exports: [ServiceReportsService],
})
export class ServiceReportsModule {}
