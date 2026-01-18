import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ActionTokenType {
  APPROVE = 'approve',
  REJECT = 'reject',
  DISBURSE = 'disburse',
}

export type ActionTokenDocument = ActionToken & Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'action_tokens',
})
export class ActionToken {
  @Prop({ required: true, unique: true, length: 64, index: true })
  token: string;

  @Prop({ type: Types.ObjectId, ref: 'Requisition', required: true, index: true })
  requisitionId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ActionTokenType),
    required: true,
  })
  actionType: ActionTokenType;

  @Prop({ required: true, trim: true, lowercase: true })
  recipientEmail: string;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  recipientMemberId?: Types.ObjectId;

  @Prop({ required: true, type: Date, index: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  usedAt: Date | null;

  @Prop({ default: false })
  isUsed: boolean;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const ActionTokenSchema = SchemaFactory.createForClass(ActionToken);

// Indexes
ActionTokenSchema.index({ token: 1 }, { unique: true });
ActionTokenSchema.index({ requisitionId: 1, actionType: 1 });
ActionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-cleanup
ActionTokenSchema.index({ recipientEmail: 1 });
