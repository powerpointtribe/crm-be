import {
  IsOptional,
  IsString,
  IsEmail,
  IsEnum,
  IsObject,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Public payload for the per-registrant application form. Submitted via the
 * unique application link (`/apply/:token`) to fill in / update the details of
 * an already-existing event registration.
 *
 * Core attendee fields update `attendeeInfo`; everything else is merged into
 * the registration's `customFieldResponses` map.
 */
export class SubmitApplicationDto {
  @ApiPropertyOptional({ description: 'First name', example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Gender', enum: ['male', 'female'] })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;

  @ApiPropertyOptional({
    description: 'All other application answers as key-value pairs',
  })
  @IsOptional()
  @IsObject()
  customFieldResponses?: Record<string, string>;
}
