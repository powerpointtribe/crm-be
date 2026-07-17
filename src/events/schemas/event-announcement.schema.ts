import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * A facilitator/admin broadcast to an event's attendees. Persisted so it also
 * surfaces in the learner portal as an in-app notification (bell + Updates
 * tab), in addition to being emailed at send time.
 */
@Schema({ timestamps: true, versionKey: false })
export class EventAnnouncement {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ required: true, trim: true })
  message: string;

  // Who it was aimed at when sent. Portal learners are accepted, so they see
  // both 'accepted' and 'all' announcements for their event.
  @Prop({ type: String, enum: ['accepted', 'all'], default: 'all' })
  audience: string;

  @Prop({ trim: true })
  senderName?: string;
}

export type EventAnnouncementDocument = HydratedDocument<EventAnnouncement>;
export const EventAnnouncementSchema =
  SchemaFactory.createForClass(EventAnnouncement);

EventAnnouncementSchema.index({ event: 1, createdAt: -1 });
