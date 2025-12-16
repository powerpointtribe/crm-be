import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PermissionDocument = Permission & Document & { _id: Types.ObjectId };

/**
 * Permission Schema
 * Defines granular permissions tied to specific endpoints and actions
 */
@Schema({
  timestamps: true,
  versionKey: false,
})
export class Permission {
  @Prop({ required: true, unique: true, trim: true })
  name: string; // e.g., 'members:create', 'ministries:view'

  @Prop({ required: true, trim: true })
  displayName: string; // e.g., 'Create Member', 'View Ministries'

  @Prop({ trim: true })
  description: string; // Human-readable description

  @Prop({ required: true, trim: true })
  module: string; // e.g., 'members', 'ministries', 'units'

  @Prop({ required: true, trim: true })
  resource: string; // e.g., 'member', 'ministry', 'unit'

  @Prop({ required: true, trim: true })
  action: string; // e.g., 'create', 'read', 'update', 'delete', 'view-stats'

  // Endpoint metadata (optional - some permissions are not tied to specific endpoints)
  @Prop({
    type: {
      path: { type: String, required: false }, // e.g., '/members/:id'
      method: { type: String, required: false }, // e.g., 'GET', 'POST', 'PATCH', 'DELETE'
    },
    required: false,
  })
  endpoint?: {
    path?: string;
    method?: string;
  };

  // Permission status
  @Prop({ default: true })
  isActive: boolean;

  // Whether this is a public endpoint (no permission required)
  @Prop({ default: false })
  isPublic: boolean;

  // Metadata for special permissions
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);

// Add indexes for better performance
PermissionSchema.index({ name: 1 });
PermissionSchema.index({ module: 1 });
PermissionSchema.index({ resource: 1, action: 1 });
PermissionSchema.index({ 'endpoint.path': 1, 'endpoint.method': 1 });
PermissionSchema.index({ isActive: 1 });
PermissionSchema.index({ isPublic: 1 });
