import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProfileSubmissionDocument = ProfileSubmission & Document;

export enum SubmissionStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  CREATED = 'created',
  DISMISSED = 'dismissed',
}

@Schema({ timestamps: true, versionKey: false })
export class ProfileSubmission {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  phone: string;

  @Prop()
  dateOfBirth: Date;

  @Prop({ enum: ['male', 'female'] })
  gender: string;

  @Prop({ enum: ['single', 'married', 'divorced', 'widowed'] })
  maritalStatus: string;

  @Prop({ trim: true })
  occupation: string;

  @Prop({ trim: true })
  profession: string;

  @Prop({ trim: true })
  businessName: string;

  @Prop({ trim: true })
  businessType: string;

  @Prop({ trim: true })
  employer: string;

  @Prop({ trim: true })
  workAddress: string;

  @Prop([String])
  interests: string[];

  @Prop([String])
  skills: string[];

  @Prop({ trim: true })
  district: string;

  @Prop({ trim: true })
  unit: string;

  @Prop({ type: Object, default: {} })
  address: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    lga?: string;
    landmark?: string;
  };

  @Prop({ type: Object, default: {} })
  emergencyContact: {
    name?: string;
    relationship?: string;
    phone?: string;
  };

  @Prop({ trim: true })
  weddingAnniversary: string;

  @Prop({ enum: ['member', 'first-timer', 'visitor'] })
  memberCategory: string;

  @Prop({ trim: true })
  howLongAttending: string;

  @Prop({ trim: true })
  previousChurch: string;

  @Prop({ type: Object, default: {} })
  socialMedia: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    tiktok?: string;
  };

  @Prop({ type: String, enum: SubmissionStatus, default: SubmissionStatus.PENDING })
  status: SubmissionStatus;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  matchedMember: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  processedBy: Types.ObjectId;

  @Prop()
  processedAt: Date;
}

export const ProfileSubmissionSchema = SchemaFactory.createForClass(ProfileSubmission);

ProfileSubmissionSchema.index({ status: 1, createdAt: -1 });
ProfileSubmissionSchema.index({ email: 1 });
ProfileSubmissionSchema.index({ phone: 1 });
