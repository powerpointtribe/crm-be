import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FacilitatorAuditDocument = FacilitatorAudit &
  Document & { _id: Types.ObjectId };

/**
 * A record of a change action taken on the facilitator dashboard (who did what,
 * when). Event-scoped and visible to all facilitators of that event.
 */
@Schema({ timestamps: true, versionKey: false })
export class FacilitatorAudit {
  @Prop({ type: Types.ObjectId, ref: 'Event', index: true })
  event?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  actor?: Types.ObjectId;

  @Prop({ trim: true })
  actorName?: string;

  @Prop({ trim: true })
  actorEmail?: string;

  // Human-readable action, e.g. "Graded sermon summary", "Created module".
  @Prop({ required: true, trim: true })
  action: string;

  @Prop({ trim: true })
  method?: string;

  @Prop({ trim: true })
  path?: string;

  @Prop({ type: Date })
  createdAt: Date;
}

export const FacilitatorAuditSchema =
  SchemaFactory.createForClass(FacilitatorAudit);
FacilitatorAuditSchema.index({ event: 1, createdAt: -1 });
