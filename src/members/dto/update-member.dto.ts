import { PartialType } from '@nestjs/mapped-types';
import { CreateMemberDto } from './create-member.dto';

// PartialType from @nestjs/mapped-types makes all fields optional
// and properly handles class-validator decorators
export class UpdateMemberDto extends PartialType(CreateMemberDto) {}
