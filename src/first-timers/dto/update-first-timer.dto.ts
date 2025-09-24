import { PartialType } from '@nestjs/swagger';
import { CreateFirstTimerDto } from './create-first-timer.dto';

export class UpdateFirstTimerDto extends PartialType(CreateFirstTimerDto) {}
