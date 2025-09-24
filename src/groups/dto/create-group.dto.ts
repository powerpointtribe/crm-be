import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsMongoId,
  IsArray,
  IsNumber,
  Min,
  ValidateNested,
  IsObject,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GroupType } from '../../common/enums/group-types.enum';

class MeetingScheduleDto {
  @ApiPropertyOptional({
    description: 'Meeting day',
    enum: [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ],
  })
  @IsOptional()
  @IsString()
  day?: string;

  @ApiPropertyOptional({ description: 'Meeting time', example: '7:00 PM' })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiPropertyOptional({
    description: 'Meeting location name',
    example: 'Church Hall A',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Meeting address',
    type: 'object',
    properties: {
      street: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      country: { type: 'string', default: 'Nigeria' },
    },
  })
  @IsOptional()
  @IsObject()
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
  };
}

class HostingInfoDto {
  @ApiPropertyOptional({ description: 'Primary host member ID' })
  @IsOptional()
  @IsMongoId()
  hostMember?: string;

  @ApiPropertyOptional({ description: 'List of rotating host member IDs' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  rotatingHosts?: string[];

  @ApiPropertyOptional({ description: 'Current host member ID' })
  @IsOptional()
  @IsMongoId()
  currentHost?: string;
}

export class CreateGroupDto {
  @ApiProperty({ description: 'Group name', example: 'Lagos Island District' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Group type',
    enum: GroupType,
    example: GroupType.DISTRICT,
  })
  @IsEnum(GroupType)
  @IsNotEmpty()
  type: GroupType;

  @ApiPropertyOptional({ description: 'Group description' })
  @IsOptional()
  @IsString()
  description?: string;

  // DISTRICT-SPECIFIC FIELDS
  @ApiPropertyOptional({
    description: 'District Pastor member ID (required for districts)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  districtPastor?: string;

  @ApiPropertyOptional({
    description: 'Champs (district assistants) member IDs',
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  champs?: string[];

  // UNIT-SPECIFIC FIELDS
  @ApiPropertyOptional({
    description: 'Unit Head member ID (required for units)',
    example: '507f1f77bcf86cd799439021',
  })
  @IsOptional()
  @IsMongoId()
  unitHead?: string;

  @ApiPropertyOptional({ description: 'Member IDs in this group' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  members?: string[];

  @ApiPropertyOptional({ description: 'Meeting schedule information' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MeetingScheduleDto)
  meetingSchedule?: MeetingScheduleDto;

  @ApiPropertyOptional({
    description: 'Hosting information (for districts/home cells)',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => HostingInfoDto)
  hostingInfo?: HostingInfoDto;

  @ApiPropertyOptional({ description: 'Maximum capacity', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxCapacity?: number;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Contact email address' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Group vision statement' })
  @IsOptional()
  @IsString()
  vision?: string;

  @ApiPropertyOptional({ description: 'Group mission statement' })
  @IsOptional()
  @IsString()
  mission?: string;

  @ApiPropertyOptional({ description: 'Group goals and objectives' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goals?: string[];
}
