import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BranchDocument = Branch & Document;

@Schema({ timestamps: true })
export class Branch {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string; // e.g., 'lagos-mainland', used in URLs for branch-specific forms

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Object })
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  // NOTE: branchPastor and assistantPastors have been removed.
  // Role assignments are now managed through the RoleAssignment entity.
  // Use RoleAssignmentService to find members with roles scoped to this branch.

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isMainBranch: boolean; // Flag to identify the main/default branch

  @Prop({ type: Object, default: {} })
  settings: Record<string, any>; // Branch-specific settings (configurable)

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>; // Additional custom data

  @Prop()
  timezone?: string; // Branch timezone for scheduling

  @Prop({ type: [String], default: [] })
  serviceTypes: string[]; // Types of services offered at this branch

  // Public website (campus pages). Off by default: a branch only appears on
  // the website once staff switch showOnWebsite on.
  @Prop({
    type: {
      showOnWebsite: { type: Boolean, default: false },
      venue: { type: String, trim: true },
      mapUrl: { type: String, trim: true },
      photoUrl: { type: String, trim: true },
      serviceTimes: {
        type: [{ label: String, day: String, time: String, _id: false }],
        default: [],
      },
      order: { type: Number, default: 0 },
      pastor: { type: Types.ObjectId, ref: 'WebPastor', default: null },
    },
    default: { showOnWebsite: false, serviceTimes: [], order: 0 },
  })
  website?: BranchWebsite;
}

export interface BranchWebsite {
  showOnWebsite: boolean;
  venue?: string;
  mapUrl?: string;
  photoUrl?: string;
  serviceTimes: { label: string; day: string; time: string }[];
  order: number;
  pastor?: Types.ObjectId | null;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);

// Indexes for efficient queries
BranchSchema.index({ slug: 1 });
BranchSchema.index({ isActive: 1 });
BranchSchema.index({ isMainBranch: 1 });
BranchSchema.index({ 'website.showOnWebsite': 1, 'website.order': 1 });
