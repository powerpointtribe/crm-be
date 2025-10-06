import { ApiProperty } from '@nestjs/swagger';
import {
  BulkOperationDto,
  GenericBulkResultDto,
} from '../../common/dto/bulk-operation.dto';
import { CreateMemberDto } from './create-member.dto';
import { UpdateMemberDto } from './update-member.dto';

export class BulkMemberOperationDto extends BulkOperationDto {
  @ApiProperty({
    description: 'Default district assignment for all members in the upload',
  })
  defaultDistrict?: string;

  @ApiProperty({
    description: 'Default unit assignment for all members in the upload',
  })
  defaultUnit?: string;
}

export class BulkMemberResultDto extends GenericBulkResultDto<any> {
  @ApiProperty({ description: 'Successfully processed member records' })
  declare successfulRecords: any[];
}
