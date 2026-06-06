import {
  IsNotEmpty,
  IsMongoId,
  IsOptional,
  IsString,
  IsEmail,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOperationalInvitationDto {
  @ApiProperty({ description: 'First name of the operational user' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name of the operational user' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'Email address for the operational account' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Role ID to assign' })
  @IsNotEmpty()
  @IsMongoId()
  roleId: string;

  @ApiProperty({ description: 'Campus ID to assign' })
  @IsNotEmpty()
  @IsMongoId()
  branchId: string;

  @ApiPropertyOptional({ description: 'District IDs for Assistant Pastors' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  assignedDistricts?: string[];

  @ApiPropertyOptional({ description: 'Notes about this invitation' })
  @IsOptional()
  @IsString()
  notes?: string;
}
