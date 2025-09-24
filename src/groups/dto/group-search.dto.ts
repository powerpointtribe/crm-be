import { IsOptional, IsEnum, IsMongoId, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SearchDto } from '../../common/dto/search.dto';
import { GroupType } from '../../common/enums/group-types.enum';

export class GroupSearchDto extends SearchDto {
  @ApiPropertyOptional({
    description: 'Filter by group type',
    enum: GroupType,
  })
  @IsOptional()
  @IsEnum(GroupType)
  type?: GroupType;

  @ApiPropertyOptional({ description: 'Filter by district pastor ID' })
  @IsOptional()
  @IsMongoId()
  districtPastorId?: string;

  @ApiPropertyOptional({ description: 'Filter by unit head ID' })
  @IsOptional()
  @IsMongoId()
  unitHeadId?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter groups that need leaders (missing pastor/head)',
  })
  @IsOptional()
  @IsBoolean()
  needsLeaders?: boolean;

  @ApiPropertyOptional({ description: 'Filter groups at/near capacity' })
  @IsOptional()
  @IsBoolean()
  nearCapacity?: boolean;
}
