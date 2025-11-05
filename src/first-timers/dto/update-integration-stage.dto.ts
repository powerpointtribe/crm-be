import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntegrationStage } from '../../common/enums/integration-stage.enum';

export class UpdateIntegrationStageDto {
  @ApiProperty({
    description: 'Integration stage',
    enum: Object.values(IntegrationStage),
  })
  @IsEnum(Object.values(IntegrationStage))
  @IsNotEmpty()
  integrationStage: IntegrationStage;

  @ApiPropertyOptional({ description: 'District assignment ID' })
  @IsOptional()
  @IsString()
  assignedDistrict?: string;

  @ApiPropertyOptional({
    description: 'Stage change date',
    example: '2024-01-15T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  integrationStageDate?: string;
}
