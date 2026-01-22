import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicRegistrationDto {
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

  @ApiPropertyOptional({
    description: 'Custom field responses (key-value pairs)',
  })
  @IsOptional()
  @IsObject()
  customFieldResponses?: Record<string, string>;
}
