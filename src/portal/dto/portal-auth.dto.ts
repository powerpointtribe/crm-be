import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestSetupDto {
  @ApiProperty({ example: 'attendee@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Event slug the learner is applying to' })
  @IsOptional()
  @IsString()
  eventSlug?: string;
}

export class SetPasswordDto {
  @ApiProperty({ description: 'Setup token from the invite link' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}

export class PortalLoginDto {
  @ApiProperty({ example: 'attendee@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventSlug?: string;
}
