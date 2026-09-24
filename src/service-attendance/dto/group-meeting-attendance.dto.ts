import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsDate,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const transformToDate = ({ value }: { value: any }) => {
  if (!value) return value;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date;
};

export class GroupMeetingAttendanceDto {
  @ApiProperty({ description: 'Group (district or unit) ID' })
  @IsMongoId()
  @IsNotEmpty()
  groupId: string;

  @ApiProperty({ description: 'Date of the meeting' })
  @Transform(transformToDate)
  @IsDate()
  @IsNotEmpty()
  meetingDate: Date;

  @ApiProperty({ description: 'Array of member IDs who were present', type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  presentMemberIds: string[];

  @ApiPropertyOptional({ description: 'Optional notes about the meeting' })
  @IsOptional()
  @IsString()
  notes?: string;
}
