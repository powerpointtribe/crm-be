import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document & { _id: Types.ObjectId };

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Schema({ _id: false, versionKey: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product: Types.ObjectId;

  @Prop({ required: true })
  productName: string;

  @Prop()
  size?: string;

  @Prop()
  colour?: string;

  @Prop({ type: Number, required: true, min: 1 })
  quantity: number;

  @Prop({ type: Number, required: true, min: 0 })
  unitPrice: number;

  @Prop({ type: Number, required: true, min: 0 })
  totalPrice: number;

  @Prop([String])
  images?: string[];
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false, versionKey: false })
export class DeliveryInfo {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ trim: true })
  email?: string;

  /** Required for delivery orders (enforced by CreateOrderDto); empty for pickup. */
  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true })
  city?: string;

  @Prop({ trim: true })
  state?: string;

  @Prop({ trim: true })
  notes?: string;
}

export const DeliveryInfoSchema = SchemaFactory.createForClass(DeliveryInfo);

export const ORDER_CHANNELS = ['crm', 'website'] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];
export const FULFILMENT_METHODS = ['delivery', 'pickup'] as const;
export type FulfilmentMethod = (typeof FULFILMENT_METHODS)[number];

/** How the order reaches the customer. Orders created before this field are delivery. */
@Schema({ _id: false, versionKey: false })
export class Fulfilment {
  @Prop({ type: String, enum: FULFILMENT_METHODS, default: 'delivery' })
  method: FulfilmentMethod;

  /** Pickup campus. */
  @Prop({ type: Types.ObjectId, ref: 'Branch' })
  branch?: Types.ObjectId;

  /** Campus name at order time, for emails and the order sheet. */
  @Prop({ trim: true })
  branchName?: string;
}

export const FulfilmentSchema = SchemaFactory.createForClass(Fulfilment);

@Schema({ timestamps: true, versionKey: false, collection: 'store_orders' })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'Branch', index: true })
  branch?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  orderNumber: string;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ type: DeliveryInfoSchema, required: true })
  delivery: DeliveryInfo;

  @Prop({ type: Number, required: true, min: 0 })
  subtotal: number;

  @Prop({ type: Number, default: 0, min: 0 })
  discountAmount: number;

  @Prop({ trim: true, uppercase: true })
  couponCode?: string;

  @Prop({ type: Number, required: true, min: 0 })
  totalAmount: number;

  @Prop({ type: String, default: 'NGN' })
  currency: string;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @Prop()
  flutterwaveRef?: string;

  @Prop()
  flutterwaveTransactionId?: string;

  @Prop({ type: Object })
  paymentMeta?: Record<string, any>;

  @Prop()
  customerEmail?: string;

  @Prop()
  customerPhone?: string;

  /** Which frontend placed the order; decides where Flutterwave returns the payer. */
  @Prop({ type: String, enum: ORDER_CHANNELS, default: 'crm' })
  channel: OrderChannel;

  @Prop({ type: FulfilmentSchema, default: () => ({ method: 'delivery' }) })
  fulfilment: Fulfilment;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ orderNumber: 1 }, { unique: true });
OrderSchema.index({ status: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ customerEmail: 1 });
OrderSchema.index({ createdAt: -1 });
