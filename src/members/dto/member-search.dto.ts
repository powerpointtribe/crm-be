import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsMongoId,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SearchDto } from '../../common/dto/search.dto';
import { MembershipStatus } from '../../common/enums/member-status.enum';

export class MemberSearchDto extends SearchDto {
  @ApiPropertyOptional({
    description: 'Filter by branch ID (only for users with branches:view-all permission)',
  })
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Filter by membership status',
    enum: MembershipStatus,
  })
  @IsOptional()
  @IsEnum(MembershipStatus)
  membershipStatus?: MembershipStatus;

  @ApiPropertyOptional({
    description: 'Filter by gender',
    enum: ['male', 'female'],
  })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;

  @ApiPropertyOptional({
    description: 'Filter by marital status',
    enum: ['single', 'married', 'divorced', 'widowed'],
  })
  @IsOptional()
  @IsEnum(['single', 'married', 'divorced', 'widowed'])
  maritalStatus?: string;

  @ApiPropertyOptional({ description: 'Filter by district ID' })
  @IsOptional()
  @IsMongoId()
  districtId?: string;

  @ApiPropertyOptional({ description: 'Filter by unit ID' })
  @IsOptional()
  @IsMongoId()
  unitId?: string;

  @ApiPropertyOptional({ description: 'Filter by ministry involvement' })
  @IsOptional()
  @IsString()
  ministry?: string;

  @ApiPropertyOptional({ description: 'Filter members with leadership roles' })
  @IsOptional()
  @IsEnum(['district_pastor', 'champ', 'unit_head'])
  leadershipRole?: string;

  @ApiPropertyOptional({ description: 'Filter from date joined' })
  @IsOptional()
  @IsDateString()
  dateJoinedFrom?: Date;

  @ApiPropertyOptional({ description: 'Filter to date joined' })
  @IsOptional()
  @IsDateString()
  dateJoinedTo?: Date;

  @ApiPropertyOptional({ description: 'Filter by age range - minimum age' })
  @IsOptional()
  minAge?: number;

  @ApiPropertyOptional({ description: 'Filter by age range - maximum age' })
  @IsOptional()
  maxAge?: number;
}
