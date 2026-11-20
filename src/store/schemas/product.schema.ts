import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/** Website shop category pills. */
export const PRODUCT_CATEGORIES = ['books', 'merch', 'accessories'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export const PRODUCT_BADGES = ['new', 'bestseller'] as const;
export type ProductBadge = (typeof PRODUCT_BADGES)[number];

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

  /** Website shop category; null = not shown under a category pill. */
  @Prop({ type: String, enum: PRODUCT_CATEGORIES, default: null })
  category?: ProductCategory | null;

  /** Short line under the name, e.g. the author of a book. */
  @Prop({ trim: true, maxlength: 120 })
  byline?: string;

  @Prop({ type: String, enum: PRODUCT_BADGES, default: null })
  badge?: ProductBadge | null;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  createdBy: Types.ObjectId;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ isActive: 1, category: 1 });
ProductSchema.index({ name: 'text', description: 'text' });
