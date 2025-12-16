import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoleDocument = Role & Document & { _id: Types.ObjectId };

/**
 * Role Schema
 * Defines roles with assigned permissions
 */
@Schema({
  timestamps: true,
  versionKey: false,
})
export class Role {
  @Prop({ required: true, unique: true, trim: true })
  name: string; // e.g., 'admin', 'pastor', 'district_pastor', 'member'

  @Prop({ required: true, unique: true, trim: true })
  slug: string; // e.g., 'admin', 'pastor', 'district-pastor', 'member'

  @Prop({ required: true, trim: true })
  displayName: string; // e.g., 'Administrator', 'Pastor', 'District Pastor'

  @Prop({ trim: true })
  description: string; // Description of what this role does

  // Many-to-many relationship with permissions
  @Prop([{ type: Types.ObjectId, ref: 'Permission' }])
  permissions: Types.ObjectId[];

  // Role hierarchy (for role inheritance)
  @Prop({ type: Types.ObjectId, ref: 'Role' })
  parentRole?: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  level: number; // Hierarchy level (higher = more permissions)

  // System roles cannot be deleted or modified
  @Prop({ default: false })
  isSystemRole: boolean;

  // Role status
  @Prop({ default: true })
  isActive: boolean;

  // Color code for UI display (optional)
  @Prop({ trim: true })
  colorCode?: string;

  // Role metadata
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const RoleSchema = SchemaFactory.createForClass(Role);

// Add indexes for better performance
RoleSchema.index({ name: 1 });
RoleSchema.index({ slug: 1 });
RoleSchema.index({ isActive: 1 });
RoleSchema.index({ isSystemRole: 1 });
RoleSchema.index({ level: -1 });
