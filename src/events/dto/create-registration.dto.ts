import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsMongoId,
  IsEmail,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AttendeeType,
  RegistrationStatus,
} from '../schemas/event-registration.schema';

class AttendeeInfoDto {
  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+2348012345678',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Gender',
    enum: ['male', 'female'],
  })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;
}

export class CreateRegistrationDto {
  @ApiPropertyOptional({ description: 'Member ID (for member registrations)' })
  @IsOptional()
  @IsMongoId()
  memberId?: string;

  @ApiProperty({
    description: 'Attendee type',
    enum: AttendeeType,
    example: AttendeeType.VISITOR,
  })
  @IsEnum(AttendeeType)
  @IsNotEmpty()
  attendeeType: AttendeeType;

  @ApiProperty({ description: 'Attendee information' })
  @ValidateNested()
  @Type(() => AttendeeInfoDto)
  attendeeInfo: AttendeeInfoDto;

  @ApiPropertyOptional({
    description: 'Registration status (admin can set initial status)',
    enum: RegistrationStatus,
  })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @ApiPropertyOptional({
    description: 'Custom field responses (key-value pairs)',
  })
  @IsOptional()
  @IsObject()
  customFieldResponses?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRegistrationStatusDto {
  @ApiProperty({
    description: 'New registration status',
    enum: RegistrationStatus,
  })
  @IsEnum(RegistrationStatus)
  @IsNotEmpty()
  status: RegistrationStatus;

  @ApiPropertyOptional({ description: 'Notes for the status change' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRegistrationDetailsDto {
  @ApiPropertyOptional({ description: 'First name', example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+2348012345678',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Gender',
    enum: ['male', 'female'],
  })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Custom field responses (key-value pairs)',
  })
  @IsOptional()
  @IsObject()
  customFieldResponses?: Record<string, string>;
}

export class RegistrationSearchDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search term for attendee name/email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by registration status',
    enum: RegistrationStatus,
  })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @ApiPropertyOptional({
    description: 'Filter by attendee type',
    enum: AttendeeType,
  })
  @IsOptional()
  @IsEnum(AttendeeType)
  attendeeType?: AttendeeType;
}
