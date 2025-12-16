import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MemberActivity,
  MemberActivityDocument,
} from './schemas/member-activity.schema';
import {
  ActivityType,
  ActivityStatus,
  ActivityPriority,
  TransitionFrom,
  TransitionTo,
  TravelStatus,
} from '../common/enums/activity-tracker.enum';

export interface LifecycleEventData {
  memberId: string;
  activityType: ActivityType;
  title: string;
  description?: string;
  priority?: ActivityPriority;
  status?: ActivityStatus;
  effectiveDate?: Date;
  expiryDate?: Date;

  // Role transition data
  fromRole?: TransitionFrom;
  toRole?: TransitionTo;
  previousPosition?: string;
  newPosition?: string;

  // Group/Unit movement data
  fromUnit?: string;
  toUnit?: string;
  fromDistrict?: string;
  toDistrict?: string;
  fromMinistries?: string[];
  toMinistries?: string[];

  // Location data
  travelStatus?: TravelStatus;
  previousLocation?: string;
  newLocation?: string;
  travelReason?: string;
  expectedReturnDate?: Date;
  contactInformation?: string;

  // Training data
  relatedCohort?: string;
  relatedTraining?: string;
  trainingOutcome?: string;
  certification?: string;

  // Change tracking
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;

  // Administrative
  initiatedBy: string;
  approvedBy?: string;
  supervisedBy?: string;
  reason: string;
  justification?: string;
  supportingDocuments?: string[];

  // Metadata
  isTemporary?: boolean;
  requiresFollowUp?: boolean;
  nextFollowUpDate?: Date;
  tags?: string[];
  notes?: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    source?: string;
    requestId?: string;
    location?: {
      country?: string;
      city?: string;
      coordinates?: [number, number];
    };
  };
}

@Injectable()
export class MemberLifecycleService {
  constructor(
    @InjectModel(MemberActivity.name)
    private memberActivityModel: Model<MemberActivityDocument>,
  ) {}

  async logLifecycleEvent(eventData: LifecycleEventData): Promise<MemberActivity> {
    const activity = new this.memberActivityModel({
      member: new Types.ObjectId(eventData.memberId),
      activityType: eventData.activityType,
      title: eventData.title,
      description: eventData.description,
      priority: eventData.priority || ActivityPriority.MEDIUM,
      status: eventData.status || ActivityStatus.COMPLETED,
      activityDate: new Date(),
      effectiveDate: eventData.effectiveDate,
      expiryDate: eventData.expiryDate,

      fromRole: eventData.fromRole,
      toRole: eventData.toRole,
      previousPosition: eventData.previousPosition,
      newPosition: eventData.newPosition,

      fromUnit: eventData.fromUnit ? new Types.ObjectId(eventData.fromUnit) : undefined,
      toUnit: eventData.toUnit ? new Types.ObjectId(eventData.toUnit) : undefined,
      fromDistrict: eventData.fromDistrict ? new Types.ObjectId(eventData.fromDistrict) : undefined,
      toDistrict: eventData.toDistrict ? new Types.ObjectId(eventData.toDistrict) : undefined,
      fromMinistries: eventData.fromMinistries?.map(id => new Types.ObjectId(id)),
      toMinistries: eventData.toMinistries?.map(id => new Types.ObjectId(id)),

      travelStatus: eventData.travelStatus,
      previousLocation: eventData.previousLocation,
      newLocation: eventData.newLocation,
      travelReason: eventData.travelReason,
      expectedReturnDate: eventData.expectedReturnDate,
      contactInformation: eventData.contactInformation,

      relatedCohort: eventData.relatedCohort ? new Types.ObjectId(eventData.relatedCohort) : undefined,
      relatedTraining: eventData.relatedTraining ? new Types.ObjectId(eventData.relatedTraining) : undefined,
      trainingOutcome: eventData.trainingOutcome,
      certification: eventData.certification,

      previousValues: eventData.previousValues,
      newValues: eventData.newValues,

      initiatedBy: new Types.ObjectId(eventData.initiatedBy),
      approvedBy: eventData.approvedBy ? new Types.ObjectId(eventData.approvedBy) : undefined,
      supervisedBy: eventData.supervisedBy ? new Types.ObjectId(eventData.supervisedBy) : undefined,
      reason: eventData.reason,
      justification: eventData.justification,
      supportingDocuments: eventData.supportingDocuments,

      isTemporary: eventData.isTemporary || false,
      requiresFollowUp: eventData.requiresFollowUp || false,
      nextFollowUpDate: eventData.nextFollowUpDate,
      tags: eventData.tags,
      notes: eventData.notes,
      metadata: eventData.metadata,

      isSystemGenerated: true,
      isVisible: true,
    });

    return await activity.save();
  }

  // Quick helper methods for common lifecycle events

  async logMemberRegistration(memberId: string, registeredBy: string, source?: string): Promise<MemberActivity> {
    return this.logLifecycleEvent({
      memberId,
      activityType: ActivityType.MEMBER_REGISTRATION,
      title: 'Member Registration',
      description: 'New member registered in the system',
      priority: ActivityPriority.HIGH,
      initiatedBy: registeredBy,
      reason: 'New member registration',
      metadata: { source },
    });
  }

  async logFirstTimeVisitor(memberId: string, recordedBy: string, serviceDate?: Date): Promise<MemberActivity> {
    return this.logLifecycleEvent({
      memberId,
      activityType: ActivityType.FIRST_TIME_VISITOR,
      title: 'First Time Visitor',
      description: 'Member visited the church for the first time',
      priority: ActivityPriority.HIGH,
      effectiveDate: serviceDate,
      initiatedBy: recordedBy,
      reason: 'First time visitor record',
      requiresFollowUp: true,
    });
  }

  async logMembershipStatusChange(
    memberId: string,
    fromStatus: string,
    toStatus: string,
    changedBy: string,
    reason: string,
  ): Promise<MemberActivity> {
    return this.logLifecycleEvent({
      memberId,
      activityType: ActivityType.MEMBERSHIP_STATUS_CHANGE,
      title: `Membership Status Changed`,
      description: `Status changed from ${fromStatus} to ${toStatus}`,
      priority: ActivityPriority.HIGH,
      previousValues: { membershipStatus: fromStatus },
      newValues: { membershipStatus: toStatus },
      initiatedBy: changedBy,
      reason,
    });
  }

  async logUnitAssignment(
    memberId: string,
    unitId: string,
    unitName: string,
    assignedBy: string,
    previousUnitId?: string,
    previousUnitName?: string,
  ): Promise<MemberActivity> {
    const isTransfer = !!previousUnitId;

    return this.logLifecycleEvent({
      memberId,
      activityType: isTransfer ? ActivityType.UNIT_TRANSFER : ActivityType.UNIT_ASSIGNMENT,
      title: isTransfer ? `Unit Transfer` : `Unit Assignment`,
      description: isTransfer
        ? `Transferred from ${previousUnitName} to ${unitName}`
        : `Assigned to ${unitName}`,
      priority: ActivityPriority.MEDIUM,
      fromUnit: previousUnitId,
      toUnit: unitId,
      initiatedBy: assignedBy,
      reason: isTransfer ? 'Unit transfer' : 'Initial unit assignment',
    });
  }

  async logRoleChange(
    memberId: string,
    fromRole: TransitionFrom,
    toRole: TransitionTo,
    changedBy: string,
    reason: string,
    position?: string,
  ): Promise<MemberActivity> {
    const isPromotion = this.isRolePromotion(fromRole, toRole);
    const activityType = isPromotion
      ? ActivityType.ROLE_PROMOTION
      : ActivityType.ROLE_DEMOTION;

    return this.logLifecycleEvent({
      memberId,
      activityType,
      title: isPromotion ? 'Role Promotion' : 'Role Change',
      description: `Role changed from ${fromRole} to ${toRole}${position ? ` as ${position}` : ''}`,
      priority: ActivityPriority.HIGH,
      fromRole,
      toRole,
      newPosition: position,
      initiatedBy: changedBy,
      reason,
    });
  }

  async logTrainingEnrollment(
    memberId: string,
    cohortId: string,
    cohortName: string,
    enrolledBy: string,
    trainingType: string,
  ): Promise<MemberActivity> {
    const activityMap: Record<string, ActivityType> = {
      'DAVID_COMPANY': ActivityType.DC_ENROLLMENT,
      'LXL_FOUNDATION': ActivityType.LXL_ENROLLMENT,
      'LXL_INTERMEDIATE': ActivityType.LXL_ENROLLMENT,
      'LXL_ADVANCED': ActivityType.LXL_ENROLLMENT,
      'PASTORAL_TRAINING': ActivityType.PASTORAL_TRAINING_START,
    };

    return this.logLifecycleEvent({
      memberId,
      activityType: activityMap[trainingType] || ActivityType.TRAINING_ENROLLMENT,
      title: `Training Enrollment - ${cohortName}`,
      description: `Enrolled in ${cohortName} training program`,
      priority: ActivityPriority.HIGH,
      relatedCohort: cohortId,
      initiatedBy: enrolledBy,
      reason: 'Training enrollment',
      requiresFollowUp: true,
    });
  }

  async logTrainingGraduation(
    memberId: string,
    cohortId: string,
    cohortName: string,
    outcome: string,
    graduatedBy: string,
    certification?: string,
  ): Promise<MemberActivity> {
    return this.logLifecycleEvent({
      memberId,
      activityType: ActivityType.TRAINING_GRADUATION,
      title: `Training Graduation - ${cohortName}`,
      description: `Successfully graduated from ${cohortName}`,
      priority: ActivityPriority.HIGH,
      relatedCohort: cohortId,
      trainingOutcome: outcome,
      certification,
      initiatedBy: graduatedBy,
      reason: 'Training completion',
    });
  }

  async logInternshipAssignment(
    memberId: string,
    unitId: string,
    unitName: string,
    outcome: string,
    assignedBy: string,
  ): Promise<MemberActivity> {
    return this.logLifecycleEvent({
      memberId,
      activityType: ActivityType.INTERNSHIP_ASSIGNMENT,
      title: `Internship Assignment - ${unitName}`,
      description: `Assigned to ${unitName} for internship following training`,
      priority: ActivityPriority.HIGH,
      toUnit: unitId,
      trainingOutcome: outcome,
      initiatedBy: assignedBy,
      reason: 'Post-training internship assignment',
      requiresFollowUp: true,
    });
  }

  async logBaptism(
    memberId: string,
    baptismType: 'water' | 'spirit',
    baptizedBy: string,
    baptismDate: Date,
    location?: string,
  ): Promise<MemberActivity> {
    return this.logLifecycleEvent({
      memberId,
      activityType: baptismType === 'water' ? ActivityType.WATER_BAPTISM : ActivityType.SPIRIT_BAPTISM,
      title: `${baptismType === 'water' ? 'Water' : 'Spirit'} Baptism`,
      description: `${baptismType === 'water' ? 'Baptized in water' : 'Received baptism in the Holy Spirit'}${location ? ` at ${location}` : ''}`,
      priority: ActivityPriority.CRITICAL,
      effectiveDate: baptismDate,
      newLocation: location,
      initiatedBy: baptizedBy,
      reason: 'Spiritual milestone',
    });
  }

  async logSpecialEvent(
    memberId: string,
    eventType: ActivityType,
    title: string,
    description: string,
    recordedBy: string,
    eventDate?: Date,
  ): Promise<MemberActivity> {
    return this.logLifecycleEvent({
      memberId,
      activityType: eventType,
      title,
      description,
      priority: ActivityPriority.HIGH,
      effectiveDate: eventDate,
      initiatedBy: recordedBy,
      reason: 'Special life event',
    });
  }

  // Get member's complete lifecycle timeline
  async getMemberTimeline(
    memberId: string,
    limit?: number,
    offset?: number,
  ): Promise<{
    activities: MemberActivity[];
    total: number;
  }> {
    const query = {
      member: new Types.ObjectId(memberId),
      isVisible: true,
    };

    const [activities, total] = await Promise.all([
      this.memberActivityModel
        .find(query)
        .populate('initiatedBy', 'firstName lastName email')
        .populate('approvedBy', 'firstName lastName email')
        .populate('supervisedBy', 'firstName lastName email')
        .populate('fromUnit', 'name type')
        .populate('toUnit', 'name type')
        .populate('fromDistrict', 'name type')
        .populate('toDistrict', 'name type')
        .populate('fromMinistries', 'name type')
        .populate('toMinistries', 'name type')
        .populate('relatedCohort', 'name code type')
        .sort({ activityDate: -1 })
        .skip(offset || 0)
        .limit(limit || 50)
        .exec(),
      this.memberActivityModel.countDocuments(query).exec(),
    ]);

    return { activities, total };
  }

  // Get lifecycle statistics
  async getLifecycleStatistics(memberId: string): Promise<{
    totalActivities: number;
    recentActivities: number;
    milestones: number;
    roleChanges: number;
    trainings: number;
    lastActivity: Date;
  }> {
    const memberObjectId = new Types.ObjectId(memberId);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      total,
      recent,
      lastActivityResult,
      milestones,
      roleChanges,
      trainings,
    ] = await Promise.all([
      this.memberActivityModel.countDocuments({ member: memberObjectId, isVisible: true }),
      this.memberActivityModel.countDocuments({
        member: memberObjectId,
        isVisible: true,
        activityDate: { $gte: thirtyDaysAgo }
      }),
      this.memberActivityModel
        .findOne({ member: memberObjectId, isVisible: true })
        .sort({ activityDate: -1 })
        .select('activityDate')
        .exec(),
      this.memberActivityModel.countDocuments({
        member: memberObjectId,
        isVisible: true,
        activityType: {
          $in: [
            ActivityType.BAPTISM,
            ActivityType.WATER_BAPTISM,
            ActivityType.SPIRIT_BAPTISM,
            ActivityType.CONFIRMATION,
            ActivityType.SALVATION,
            ActivityType.MARRIAGE,
            ActivityType.TRAINING_GRADUATION,
          ]
        }
      }),
      this.memberActivityModel.countDocuments({
        member: memberObjectId,
        isVisible: true,
        activityType: {
          $in: [
            ActivityType.ROLE_PROMOTION,
            ActivityType.ROLE_CHANGE,
            ActivityType.LEADERSHIP_APPOINTMENT,
            ActivityType.LEADERSHIP_PROMOTION,
          ]
        }
      }),
      this.memberActivityModel.countDocuments({
        member: memberObjectId,
        isVisible: true,
        activityType: {
          $regex: /TRAINING_|DC_|LXL_|PASTORAL_/
        }
      }),
    ]);

    return {
      totalActivities: total,
      recentActivities: recent,
      milestones,
      roleChanges,
      trainings,
      lastActivity: lastActivityResult?.activityDate || new Date(),
    };
  }

  private isRolePromotion(fromRole: TransitionFrom, toRole: TransitionTo): boolean {
    const hierarchy = {
      [TransitionFrom.MEMBER]: 1,
      [TransitionFrom.DC]: 2,
      [TransitionFrom.LXL]: 3,
      [TransitionFrom.DIRECTOR]: 4,
      [TransitionFrom.PASTOR]: 4,
      [TransitionFrom.ADMIN]: 5,
    };

    const toHierarchy = {
      [TransitionTo.MEMBER]: 1,
      [TransitionTo.DC]: 2,
      [TransitionTo.LXL]: 3,
      [TransitionTo.DIRECTOR]: 4,
      [TransitionTo.PASTOR]: 4,
      [TransitionTo.ADMIN]: 5,
      [TransitionTo.INACTIVE]: 0,
      [TransitionTo.TRANSFERRED_OUT]: 0,
    };

    return (toHierarchy[toRole] || 0) > (hierarchy[fromRole] || 0);
  }
}