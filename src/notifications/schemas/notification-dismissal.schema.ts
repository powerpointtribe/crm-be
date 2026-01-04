import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDismissalDocument = NotificationDismissal & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'notification_dismissals',
})
export class NotificationDismissal {
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  notificationId: string;

  @Prop({ type: Date, default: Date.now })
  dismissedAt: Date;
}

export const NotificationDismissalSchema = SchemaFactory.createForClass(NotificationDismissal);

// Compound index for efficient lookups
NotificationDismissalSchema.index({ userId: 1, notificationId: 1 }, { unique: true });

// TTL index to auto-delete old dismissals after 60 days
NotificationDismissalSchema.index({ dismissedAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });
