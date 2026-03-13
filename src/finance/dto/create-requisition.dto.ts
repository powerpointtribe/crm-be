import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsMongoId,
  IsArray,
  IsIn,
  ValidateNested,
  IsDateString,
  MaxLength,
  IsNotEmpty,
  ArrayMinSize,
  Length,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CostBreakdownItemDto {
  @ApiProperty({ description: 'Description of the item' })
  @IsString()
  @IsNotEmpty()
  item: string;

  @ApiProperty({ description: 'Quantity of items', minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Cost per unit', minimum: 0 })
  @IsNumber()
  @Min(0)
  unitCost: number;

  @ApiProperty({ description: 'Total cost (quantity * unitCost)', minimum: 0 })
  @IsNumber()
  @Min(0)
  total: number;
}

export class BankAccountDto {
  @ApiProperty({ description: 'Name of the bank' })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({ description: 'Name on the account' })
  @IsString()
  @IsNotEmpty()
  accountName: string;

  @ApiProperty({ description: 'Bank account number (10 digits)' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
  accountNumber: string;
}

export class CreateRequisitionDto {
  @ApiPropertyOptional({ description: 'Unit ID for the requisition' })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiPropertyOptional({ description: 'Custom unit name if "Others" is selected' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customUnit?: string;

  @ApiProperty({ description: 'Expense category ID' })
  @IsMongoId()
  @IsNotEmpty()
  expenseCategory: string;

  @ApiProperty({ description: 'Description of the event/purpose', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  eventDescription: string;

  @ApiProperty({ description: 'Date when the funds are needed' })
  @IsDateString()
  @IsNotEmpty()
  dateNeeded: string;

  @ApiPropertyOptional({ description: 'When a similar request was last made' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  lastRequest?: string;

  @ApiProperty({
    description: 'Breakdown of costs',
    type: [CostBreakdownItemDto],
    minItems: 1,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: 'At least one cost breakdown item is required' })
  @Type(() => CostBreakdownItemDto)
  costBreakdown: CostBreakdownItemDto[];

  @ApiProperty({ description: 'Bank account details for disbursement' })
  @ValidateNested()
  @Type(() => BankAccountDto)
  creditAccount: BankAccountDto;

  @ApiPropertyOptional({ description: 'URLs of supporting documents' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentUrls?: string[];

  @ApiProperty({
    description: 'Whether this has been discussed with P.Dams',
    enum: ['yes', 'not_required', 'no'],
  })
  @IsString()
  @IsIn(['yes', 'not_required', 'no'], { message: 'discussedWithPDams must be one of: yes, not_required, no' })
  discussedWithPDams: 'yes' | 'not_required' | 'no';

  @ApiPropertyOptional({ description: 'Date when discussed with P.Dams' })
  @IsOptional()
  @IsDateString()
  discussedDate?: string;

  @ApiPropertyOptional({ description: 'Save as draft instead of submitting' })
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}
