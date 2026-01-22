import { IsNotEmpty, IsString, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddCommitteeMemberDto {
  @ApiProperty({ description: 'Member ID to add to committee' })
  @IsMongoId()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({
    description: 'Role in the committee',
    example: 'Coordinator',
  })
  @IsString()
  @IsNotEmpty()
  role: string;
}

export class UpdateCommitteeMemberDto {
  @ApiProperty({
    description: 'Updated role in the committee',
    example: 'Lead Coordinator',
  })
  @IsString()
  @IsNotEmpty()
  role: string;
}
