import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoleAssignmentDocument = RoleAssignment & Document;

/**
 * Scope types for role assignments
 * - global: No entity restriction (e.g., Super Admin)
 * - branch: Scoped to a specific branch
 * - district: Scoped to a specific district within a branch
 * - unit: Scoped to a specific unit within a district
 * - group: Scoped to a specific group (ministry, department, etc.)
 */
export enum ScopeType {
  GLOBAL = 'global',
  BRANCH = 'branch',
  DISTRICT = 'district',
  UNIT = 'unit',
  GROUP = 'group',
}

@Schema({ timestamps: true })
export class RoleAssignment {
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true, index: true })
  member: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: true, index: true })
  role: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ScopeType),
    required: true,
    default: ScopeType.GLOBAL,
  })
  scopeType: ScopeType;

  // The entity ID this assignment is scoped to (branch, district, unit, or group)
  // Required when scopeType is not 'global'
  @Prop({ type: Types.ObjectId, refPath: 'scopeRefModel' })
  scopeId?: Types.ObjectId;

  // Dynamic ref model based on scopeType
  @Prop({
    type: String,
    enum: ['Branch', 'Group'], // Group can represent districts, units, ministries
  })
  scopeRefModel?: string;

  // For users who can access multiple entities at the same scope level
  // e.g., Assistant Pastor assigned to multiple districts
  @Prop({ type: [Types.ObjectId], default: [] })
  additionalScopeIds: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  assignedBy?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  assignedAt: Date;

  @Prop({ type: Date })
  expiresAt?: Date; // For temporary assignments

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isPrimary: boolean; // Whether this is the member's primary role assignment

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>; // Additional context-specific data

  @Prop()
  notes?: string; // Admin notes about the assignment
}

export const RoleAssignmentSchema =
  SchemaFactory.createForClass(RoleAssignment);

// Indexes for efficient queries
RoleAssignmentSchema.index({ member: 1, isActive: 1 });
RoleAssignmentSchema.index({ member: 1, role: 1 });
RoleAssignmentSchema.index({ member: 1, scopeType: 1, scopeId: 1 });
RoleAssignmentSchema.index({ role: 1, scopeType: 1, scopeId: 1 });
RoleAssignmentSchema.index({ scopeType: 1, scopeId: 1, isActive: 1 });
RoleAssignmentSchema.index({ member: 1, isPrimary: 1 });
RoleAssignmentSchema.index({ expiresAt: 1 }, { sparse: true });

// Compound index for finding all assignments for a scope
RoleAssignmentSchema.index({
  scopeType: 1,
  scopeId: 1,
  role: 1,
  isActive: 1,
});

// Unique constraint: A member can only have one active assignment per role + scope combination
RoleAssignmentSchema.index(
  { member: 1, role: 1, scopeType: 1, scopeId: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  },
);
