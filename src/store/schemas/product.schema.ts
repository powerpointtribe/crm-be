import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document & { _id: Types.ObjectId };

@Schema({ _id: true, versionKey: false })
export class ProductVariant {
  @Prop({ required: true, trim: true })
  size: string;

  @Prop({ required: true, trim: true })
  colour: string;

  @Prop({ type: Number, required: true, min: 0 })
  stock: number;

  @Prop({ type: Number, min: 0 })
  additionalPrice?: number;

  @Prop([String])
  images?: string[];
}

export const ProductVariantSchema =
  SchemaFactory.createForClass(ProductVariant);

@Schema({ timestamps: true, versionKey: false, collection: 'store_products' })
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Branch', index: true })
  branch?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Number, required: true, min: 0 })
  price: number;

  @Prop({ type: String, default: 'NGN' })
  currency: string;

  @Prop([String])
  images: string[];

  @Prop({ type: [ProductVariantSchema], default: [] })
  variants: ProductVariant[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isFeatured: boolean;

  @Prop([String])
  tags?: string[];

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  createdBy: Types.ObjectId;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ name: 'text', description: 'text' });
