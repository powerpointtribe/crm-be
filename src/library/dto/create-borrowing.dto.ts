import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsDate,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Helper to transform date strings to Date objects
const transformToDate = ({ value }: { value: any }) => {
  if (!value) return value;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date;
};

export class CreateBorrowingDto {
  @ApiProperty({ description: 'Branch ID' })
  @IsNotEmpty({ message: 'Branch is required' })
  @IsMongoId()
  branch: string;

  @ApiProperty({ description: 'Book ID to borrow' })
  @IsNotEmpty({ message: 'Book is required' })
  @IsMongoId()
  book: string;

  @ApiProperty({ description: 'Member ID borrowing the book' })
  @IsNotEmpty({ message: 'Member is required' })
  @IsMongoId()
  member: string;

  @ApiPropertyOptional({ description: 'Borrow date (defaults to now)' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'borrowDate must be a valid date' })
  borrowDate?: Date;

  @ApiProperty({ description: 'Due date for return' })
  @IsNotEmpty({ message: 'Due date is required' })
  @Transform(transformToDate)
  @IsDate({ message: 'dueDate must be a valid date' })
  dueDate: Date;

  @ApiPropertyOptional({ description: 'Notes about the borrowing' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ReturnBookDto {
  @ApiPropertyOptional({ description: 'Return date (defaults to now)' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'returnDate must be a valid date' })
  returnDate?: Date;

  @ApiPropertyOptional({ description: 'Notes about the return' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ description: 'Mark book as lost instead of returned' })
  @IsOptional()
  markAsLost?: boolean;
}

export class UpdateBorrowingDto {
  @ApiPropertyOptional({ description: 'Due date for return' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'dueDate must be a valid date' })
  dueDate?: Date;

  @ApiPropertyOptional({ description: 'Notes about the borrowing' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
