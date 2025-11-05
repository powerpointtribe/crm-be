import { PartialType } from '@nestjs/swagger';
import { CreateServiceReportDto } from './create-service-report.dto';

export class UpdateServiceReportDto extends PartialType(
  CreateServiceReportDto,
) {}
