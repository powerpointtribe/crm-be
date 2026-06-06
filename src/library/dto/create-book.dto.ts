import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsMongoId,
  IsArray,
  IsDate,
  MaxLength,
  Min,
  IsUrl,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Helper to transform date strings to Date objects
const transformToDate = ({ value }: { value: any }) => {
  if (!value) return value;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date;
};

export class CreateBookDto {
  @ApiProperty({ description: 'Campus ID' })
  @IsNotEmpty({ message: 'Campus is required' })
  @IsMongoId()
  branch: string;

  @ApiProperty({ description: 'Book title', example: 'The Purpose Driven Life' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title: string;

  @ApiProperty({ description: 'Author name', example: 'Rick Warren' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  author: string;

  @ApiPropertyOptional({ description: 'ISBN', example: '978-0-310-20571-5' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string;

  @ApiPropertyOptional({ description: 'Book description' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  coverImage?: string;

  @ApiPropertyOptional({ description: 'Total quantity available', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalQuantity?: number;

  @ApiPropertyOptional({ description: 'Category ID' })
  @IsOptional()
  @IsMongoId()
  category?: string;

  @ApiPropertyOptional({ description: 'Publisher name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  publisher?: string;

  @ApiPropertyOptional({ description: 'Publication date' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'publishedDate must be a valid date' })
  publishedDate?: Date;

  @ApiPropertyOptional({ description: 'Number of pages' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pageCount?: number;

  @ApiPropertyOptional({ description: 'Physical location in library', example: 'Shelf A-3' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ description: 'Book tags', example: ['christian', 'devotional'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateBookDto {
  @ApiPropertyOptional({ description: 'Book title' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @ApiPropertyOptional({ description: 'Author name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @ApiPropertyOptional({ description: 'ISBN' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string;

  @ApiPropertyOptional({ description: 'Book description' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  coverImage?: string;

  @ApiPropertyOptional({ description: 'Total quantity available' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalQuantity?: number;

  @ApiPropertyOptional({ description: 'Available quantity (recalculated if totalQuantity changes)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  availableQuantity?: number;

  @ApiPropertyOptional({ description: 'Category ID' })
  @IsOptional()
  @IsMongoId()
  category?: string;

  @ApiPropertyOptional({ description: 'Publisher name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  publisher?: string;

  @ApiPropertyOptional({ description: 'Publication date' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'publishedDate must be a valid date' })
  publishedDate?: Date;

  @ApiPropertyOptional({ description: 'Number of pages' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pageCount?: number;

  @ApiPropertyOptional({ description: 'Physical location in library' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ description: 'Book tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
