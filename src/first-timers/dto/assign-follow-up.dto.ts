import { IsNotEmpty, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignFollowUpDto {
  @ApiProperty({ description: 'Member ID of the follow-up person to assign' })
  @IsMongoId()
  @IsNotEmpty()
  followUpPersonId: string;
}
