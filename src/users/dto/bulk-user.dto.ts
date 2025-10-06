import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BulkOperationDto,
  GenericBulkResultDto,
} from '../../common/dto/bulk-operation.dto';

export class BulkUserOperationDto extends BulkOperationDto {
  @ApiPropertyOptional({
    description:
      'Default password for all users in the upload (for create operations)',
  })
  defaultPassword?: string;

  @ApiPropertyOptional({
    description: 'Default role assignment for all users in the upload',
  })
  defaultRole?: string;
}

export class BulkUserResultDto extends GenericBulkResultDto<any> {
  @ApiPropertyOptional({ description: 'Successfully processed user records' })
  declare successfulRecords: any[];
}
