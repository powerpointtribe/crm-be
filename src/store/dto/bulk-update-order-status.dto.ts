import { IsArray, IsEnum, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../schemas/order.schema';

class OrderStatusItem {
  @ApiProperty({ example: 'ORD-20260827-ABC123' })
  @IsString()
  orderNumber: string;

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

export class BulkUpdateOrderStatusDto {
  @ApiProperty({ type: [OrderStatusItem] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderStatusItem)
  orders: OrderStatusItem[];
}
