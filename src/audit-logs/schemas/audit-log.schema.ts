import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AuditAction, AuditEntity } from '../../common/enums/audit-action.enum';

export type AuditLogDocument = AuditLog & Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'audit_logs',
})
export class AuditLog {
  @Prop({
    type: String,
    enum: Object.values(AuditAction),
    required: true,
  })
  action: AuditAction;

  @Prop({
    type: String,
    enum: Object.values(AuditEntity),
    required: true,
  })
  entityType: AuditEntity;

  @Prop({ type: String, required: true })
  entityId: string;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  performedBy: Types.ObjectId;

  @Prop({ type: String, required: true })
  performedByName: string;

  @Prop({ type: String, required: true })
  performedByEmail: string;

  @Prop({
    type: [String],
    enum: ['MEMBER', 'ADMIN', 'PASTOR', 'LEADER', 'SUPER_ADMIN'],
    required: true,
  })
  performedByRoles: string[];

  @Prop({ type: String })
  description?: string;

  @Prop({ type: Object })
  oldValues?: Record<string, any>;

  @Prop({ type: Object })
  newValues?: Record<string, any>;

  @Prop({ type: Object })
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    source?: string; // 'web', 'mobile', 'api'
    requestId?: string;
    sessionId?: string;
    location?: {
      country?: string;
      city?: string;
      coordinates?: [number, number];
    };
  };

  @Prop({ type: String })
  tableName?: string;

  @Prop({
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  })
  severity: string;

  @Prop({ type: Boolean, default: false })
  isSystemGenerated: boolean;

  @Prop({ type: Boolean, default: true })
  success: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  relatedUnit?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  relatedDistrict?: Types.ObjectId;

  @Prop([{ type: String }])
  tags?: string[];

  @Prop({ type: Date, default: Date.now, index: true })
  timestamp: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Indexes for better query performance
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
AuditLogSchema.index({ performedBy: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ relatedUnit: 1, timestamp: -1 });
AuditLogSchema.index({ relatedDistrict: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, timestamp: -1 });
AuditLogSchema.index({ isSystemGenerated: 1, timestamp: -1 });
AuditLogSchema.index({ success: 1, timestamp: -1 });

// Compound indexes for common queries
AuditLogSchema.index({ entityType: 1, action: 1, timestamp: -1 });
AuditLogSchema.index({ performedBy: 1, entityType: 1, timestamp: -1 });
