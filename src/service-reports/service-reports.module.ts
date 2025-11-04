import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceReportsService } from './service-reports.service';
import { ServiceReportsController } from './service-reports.controller';
import { ServiceReportsPdfService } from './service-reports-pdf.service';
import { ServiceReport, ServiceReportSchema } from './schemas/service-report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ServiceReport.name, schema: ServiceReportSchema },
    ]),
  ],
  controllers: [ServiceReportsController],
  providers: [ServiceReportsService, ServiceReportsPdfService],
  exports: [ServiceReportsService],
})
export class ServiceReportsModule {}