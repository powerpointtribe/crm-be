import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmailCampaignDocument = EmailCampaign & Document & { _id: Types.ObjectId };

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum RecipientFilterType {
  ALL_MEMBERS = 'all_members',
  BY_BRANCH = 'by_branch',
  BY_GROUP = 'by_group',
  BY_UNIT = 'by_unit',
  BY_DISTRICT = 'by_district',
  BY_MEMBERSHIP_STATUS = 'by_membership_status',
  BY_MAILING_LIST = 'by_mailing_list',
  CUSTOM = 'custom',
}

export interface RecipientFilter {
  filterType: RecipientFilterType;
  branchIds?: string[];
  groupIds?: string[];
  unitIds?: string[];
  districtIds?: string[];
  mailingListIds?: string[];
  membershipStatuses?: string[];
  customMemberIds?: string[];
}

export interface CampaignStats {
  totalRecipients: number;
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  clicked: number;
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class EmailCampaign {
  @Prop({
    type: Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branch: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ required: true })
  htmlContent: string;

  @Prop()
  plainTextContent?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'EmailTemplate',
  })
  template?: Types.ObjectId;

  @Prop({
    type: {
      filterType: {
        type: String,
        enum: Object.values(RecipientFilterType),
        default: RecipientFilterType.ALL_MEMBERS,
      },
      branchIds: [{ type: String }],
      groupIds: [{ type: String }],
      unitIds: [{ type: String }],
      districtIds: [{ type: String }],
      membershipStatuses: [{ type: String }],
      customMemberIds: [{ type: String }],
      mailingListIds: [{ type: String }],
    },
    default: { filterType: RecipientFilterType.ALL_MEMBERS },
  })
  recipientFilter: RecipientFilter;

  @Prop({
    type: String,
    enum: Object.values(CampaignStatus),
    default: CampaignStatus.DRAFT,
    index: true,
  })
  status: CampaignStatus;

  @Prop({ type: Date })
  scheduledAt?: Date;

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({
    type: {
      totalRecipients: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
    },
    default: {
      totalRecipients: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      opened: 0,
      clicked: 0,
    },
  })
  stats: CampaignStats;

  @Prop({ type: [String], default: [] })
  ccEmails: string[];

  @Prop({ type: [String], default: [] })
  bccEmails: string[];

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const EmailCampaignSchema = SchemaFactory.createForClass(EmailCampaign);

// Indexes
EmailCampaignSchema.index({ branch: 1, status: 1 });
EmailCampaignSchema.index({ branch: 1, scheduledAt: 1 });
EmailCampaignSchema.index({ branch: 1, createdAt: -1 });
EmailCampaignSchema.index({ name: 'text', subject: 'text' });
