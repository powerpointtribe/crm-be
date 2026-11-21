import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Most people one public enrolment request may register. */
export const PUBLIC_ENROLLMENT_MAX_TRAINEES = 50;

export class PublicEnrollmentTraineeDto {
  @ApiProperty({ example: 'Ada' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Obi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: '+2348030000000' })
  @IsString()
  @Length(7, 20)
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  medicalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  dietaryRestrictions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasTransportation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  needsAccommodation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  accommodationDetails?: string;
}

/** Body of POST /workers-training/trainees/public-enrollment (was untyped `any`). */
export class PublicEnrollmentDto {
  @ApiProperty({ description: 'Cohort to enrol into' })
  @IsMongoId()
  cohortId: string;

  @ApiProperty({
    type: [PublicEnrollmentTraineeDto],
    minItems: 1,
    maxItems: PUBLIC_ENROLLMENT_MAX_TRAINEES,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PUBLIC_ENROLLMENT_MAX_TRAINEES)
  @ValidateNested({ each: true })
  @Type(() => PublicEnrollmentTraineeDto)
  trainees: PublicEnrollmentTraineeDto[];
}
