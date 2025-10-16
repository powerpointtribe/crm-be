import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserRole } from '../../common/enums/user-roles.enums';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class User {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: [String],
    enum: Object.values(UserRole),
    default: [UserRole.MEMBER],
  })
  roles: UserRole[];

  @Prop({ trim: true })
  phone?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date })
  lastLogin?: Date;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'Ministry' })
  ministry?: Types.ObjectId; // For DC workers grouped by ministry

  @Prop({ type: Types.ObjectId, ref: 'Unit' })
  unit?: Types.ObjectId; // Unit membership

  @Prop({ type: Types.ObjectId, ref: 'Unit' })
  leaderOfUnit?: Types.ObjectId; // Only for LXL members who lead units

  @Prop({ type: [Types.ObjectId], ref: 'Ministry' })
  directorOfMinistries?: Types.ObjectId[]; // For directors managing multiple ministries
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add indexes
UserSchema.index({ email: 1 });
UserSchema.index({ roles: 1 });
UserSchema.index({ ministry: 1 });
UserSchema.index({ unit: 1 });
UserSchema.index({ leaderOfUnit: 1 });
UserSchema.index({ directorOfMinistries: 1 });
UserSchema.index({ createdAt: -1 });
