import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-roles.enums';
import { Types } from 'mongoose';

export class CreateUserDto {
  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Password', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    description: 'User roles',
    enum: UserRole,
    isArray: true,
    default: [UserRole.MEMBER],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+234801234567',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'User active status', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Ministry ID for DC workers',
    example: '64c3f8a1b12345678901234a'
  })
  @IsOptional()
  @IsMongoId()
  ministry?: string;

  @ApiPropertyOptional({
    description: 'Unit ID for unit membership',
    example: '64c3f8a1b12345678901234b'
  })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiPropertyOptional({
    description: 'Unit ID that this user leads (LXL members only)',
    example: '64c3f8a1b12345678901234c'
  })
  @IsOptional()
  @IsMongoId()
  leaderOfUnit?: string;

  @ApiPropertyOptional({
    description: 'Ministry IDs that this user directs (directors only)',
    type: [String],
    example: ['64c3f8a1b12345678901234d', '64c3f8a1b12345678901234e']
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  directorOfMinistries?: string[];
}
