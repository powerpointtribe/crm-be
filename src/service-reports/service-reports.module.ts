import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceReportsService } from './service-reports.service';
import { ServiceReportsController } from './service-reports.controller';
import { ServiceReport, ServiceReportSchema } from './schemas/service-report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ServiceReport.name, schema: ServiceReportSchema },
    ]),
  ],
  controllers: [ServiceReportsController],
  providers: [ServiceReportsService],
  exports: [ServiceReportsService],
})
export class ServiceReportsModule {}