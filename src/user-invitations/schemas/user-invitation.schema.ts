import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserInvitationDocument = UserInvitation &
  Document & { _id: Types.ObjectId };

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class UserInvitation {
  // Reference to the member being invited
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  member: Types.ObjectId;

  // Reference to the role being assigned
  @Prop({ type: Types.ObjectId, ref: 'Role', required: true })
  role: Types.ObjectId;

  // Branch assignment - required for RBAC scoping
  // The invited user will be assigned to this branch
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branch: Types.ObjectId;

  // Optional district assignments for Assistant Pastors
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Group' }], default: [] })
  assignedDistricts: Types.ObjectId[];

  // Temporary password for first login
  @Prop({ required: true })
  temporaryPassword: string;

  // Invitation status
  @Prop({
    type: String,
    enum: Object.values(InvitationStatus),
    default: InvitationStatus.PENDING,
    required: true,
  })
  status: InvitationStatus;

  // Reference to the admin who created the invitation
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  invitedBy: Types.ObjectId;

  // Expiration date (default: 7 days from creation)
  @Prop({ type: Date, required: true })
  expiresAt: Date;

  // Track if invitation email was sent
  @Prop({ default: false })
  emailSent: boolean;

  // Track when email was sent
  @Prop({ type: Date })
  emailSentAt?: Date;

  // Track when invitation was accepted
  @Prop({ type: Date })
  acceptedAt?: Date;

  // Track when invitation was revoked
  @Prop({ type: Date })
  revokedAt?: Date;

  // Reason for revocation (optional)
  @Prop({ type: String })
  revocationReason?: string;

  // Track number of times invitation email was resent
  @Prop({ default: 0 })
  resendCount: number;

  // Last time invitation email was resent
  @Prop({ type: Date })
  lastResentAt?: Date;

  // Additional notes about the invitation
  @Prop({ type: String })
  notes?: string;
}

export const UserInvitationSchema = SchemaFactory.createForClass(UserInvitation);

// Indexes for better query performance
UserInvitationSchema.index({ member: 1 });
UserInvitationSchema.index({ status: 1 });
UserInvitationSchema.index({ invitedBy: 1 });
UserInvitationSchema.index({ expiresAt: 1 });
UserInvitationSchema.index({ createdAt: -1 });
UserInvitationSchema.index({ branch: 1 }); // Branch index for RBAC filtering
UserInvitationSchema.index({ branch: 1, status: 1 }); // Compound index for branch-scoped queries
