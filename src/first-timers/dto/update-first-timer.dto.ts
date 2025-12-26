import { PartialType } from '@nestjs/mapped-types';
import { CreateFirstTimerDto } from './create-first-timer.dto';

// PartialType from @nestjs/mapped-types makes all fields optional
// and properly handles class-validator decorators
export class UpdateFirstTimerDto extends PartialType(CreateFirstTimerDto) {}
