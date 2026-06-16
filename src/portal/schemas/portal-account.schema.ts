import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PortalAccountDocument = PortalAccount &
  Document & { _id: Types.ObjectId };

export enum PortalAccountStatus {
  INVITED = 'invited',
  ACTIVE = 'active',
}

/**
 * A learner (LMS) login identity, keyed by email. Decoupled from staff `Member`
 * accounts and from any single event — one login spans every event the person
 * has been accepted into. Provisioned only when an event registration is
 * accepted (see EventsService.setAdmission → PortalService.provisionAndInvite).
 */
@Schema({ timestamps: true, versionKey: false })
export class PortalAccount {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // Set once the learner completes the set-password step.
  @Prop()
  passwordHash?: string;

  @Prop({ trim: true })
  firstName?: string;

  @Prop({ trim: true })
  lastName?: string;

  @Prop({
    type: String,
    enum: Object.values(PortalAccountStatus),
    default: PortalAccountStatus.INVITED,
  })
  status: PortalAccountStatus;

  // Single-use token for the set-password invite link.
  @Prop({ trim: true })
  setupToken?: string;

  @Prop({ type: Date })
  setupTokenExpiresAt?: Date;

  @Prop({ type: Date })
  lastLoginAt?: Date;
}

export const PortalAccountSchema = SchemaFactory.createForClass(PortalAccount);

PortalAccountSchema.index({ setupToken: 1 });
