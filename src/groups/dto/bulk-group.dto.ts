import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BulkOperationDto,
  GenericBulkResultDto,
} from '../../common/dto/bulk-operation.dto';

export class BulkGroupOperationDto extends BulkOperationDto {
  @ApiPropertyOptional({
    description: 'Default type assignment for all groups in the upload',
  })
  defaultType?: string;
}

export class BulkGroupResultDto extends GenericBulkResultDto<any> {
  @ApiPropertyOptional({ description: 'Successfully processed group records' })
  declare successfulRecords: any[];
}
