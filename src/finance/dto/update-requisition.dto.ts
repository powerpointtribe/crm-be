import { PartialType } from '@nestjs/swagger';
import { CreateRequisitionDto } from './create-requisition.dto';

export class UpdateRequisitionDto extends PartialType(CreateRequisitionDto) {}
