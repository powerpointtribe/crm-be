import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsEmail,
  Min,
  IsMongoId,
  IsIn,
  Matches,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FULFILMENT_METHODS,
  ORDER_CHANNELS,
  type FulfilmentMethod,
  type OrderChannel,
} from '../schemas/order.schema';

export class OrderItemDto {
  @ApiProperty()
  @IsMongoId()
  product: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  colour?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class DeliveryInfoDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '08012345678' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '12 Allen Avenue, Ikeja',
    description: 'Required for delivery (the default); not needed for pickup',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Lagos' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Lagos' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class FulfilmentDto {
  @ApiProperty({ enum: FULFILMENT_METHODS, default: 'delivery' })
  @IsIn(FULFILMENT_METHODS)
  method: FulfilmentMethod;

  @ApiPropertyOptional({
    description: 'Pickup campus: branch id or slug. Required for pickup.',
    example: 'ppt-anthony',
  })
  @ValidateIf((o: FulfilmentDto) => o.method === 'pickup' || o.branch !== undefined)
  @IsString()
  @Matches(/^([a-f\d]{24}|[a-z0-9-]{1,80})$/i, {
    message: 'fulfilment.branch must be a campus id or slug',
  })
  branch?: string;
}

/**
 * delivery.address is required unless the order is a pickup. Same message as
 * the @IsNotEmpty() it replaces, so delivery-only clients see no change.
 */
@ValidatorConstraint({ name: 'deliveryAddressRequired' })
class DeliveryAddressRequired implements ValidatorConstraintInterface {
  validate(delivery: unknown, args: ValidationArguments) {
    const dto = args.object as { fulfilment?: { method?: string } };
    if (dto.fulfilment?.method === 'pickup') return true;
    const address = (delivery as { address?: unknown } | undefined)?.address;
    return typeof address === 'string' && address.trim().length > 0;
  }

  defaultMessage() {
    return 'delivery.address should not be empty';
  }
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ type: DeliveryInfoDto })
  @ValidateNested()
  @Validate(DeliveryAddressRequired)
  @Type(() => DeliveryInfoDto)
  delivery: DeliveryInfoDto;

  @ApiPropertyOptional({ example: 'WELCOME10' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    example: 0,
    description:
      'Index of the item (in the items array) to apply a per-item coupon to. Required when the coupon has maxApplicableItems set.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  couponApplyToItemIndex?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({
    enum: ORDER_CHANNELS,
    default: 'crm',
    description: "Use 'website' so Flutterwave returns the payer to the website",
  })
  @IsOptional()
  @IsIn(ORDER_CHANNELS)
  channel?: OrderChannel;

  @ApiPropertyOptional({ type: FulfilmentDto, description: 'Default: delivery' })
  @IsOptional()
  @ValidateNested()
  @Type(() => FulfilmentDto)
  fulfilment?: FulfilmentDto;
}
