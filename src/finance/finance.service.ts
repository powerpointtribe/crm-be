import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  Requisition,
  RequisitionDocument,
  RequisitionStatus,
} from './schemas/requisition.schema';
import { ActionTokenType } from './schemas/action-token.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { MembershipStatus } from '../common/enums/member-status.enum';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionDto } from './dto/update-requisition.dto';
import { ApproveRequisitionDto } from './dto/approve-requisition.dto';
import { RejectRequisitionDto } from './dto/reject-requisition.dto';
import { DisburseRequisitionDto } from './dto/disburse-requisition.dto';
import { RequisitionQueryDto } from './dto/requisition-query.dto';
import { PublicCreateRequisitionDto } from './dto/public-requisition.dto';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { EmailProvider } from '../notifications/providers/email.provider';
import { ActionTokenService } from './action-token.service';
import { FinancePermission } from './permissions';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class FinanceService {
  private frontendUrl: string;

  constructor(
    @InjectModel(Requisition.name)
    private requisitionModel: Model<RequisitionDocument>,
    @InjectModel(Branch.name)
    private branchModel: Model<BranchDocument>,
    @InjectModel(Member.name)
    private memberModel: Model<MemberDocument>,
    @InjectModel(Group.name)
    private groupModel: Model<GroupDocument>,
    private userPermissionsService: UserPermissionsService,
    private emailProvider: EmailProvider,
    private actionTokenService: ActionTokenService,
    private configService: ConfigService,
    private queueService: QueueService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
  }

  /**
   * Generate a unique reference number for requisitions
   * Format: REQ-YYYY-NNNNNN (e.g., REQ-2024-000123)
   */
  private async generateReferenceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REQ-${year}-`;

    // Find the highest reference number for this year
    const lastRequisition = await this.requisitionModel
      .findOne({ referenceNumber: { $regex: `^${prefix}` } })
      .sort({ referenceNumber: -1 })
      .select('referenceNumber');

    let nextNumber = 1;
    if (lastRequisition?.referenceNumber) {
      const lastNumberStr = lastRequisition.referenceNumber.replace(prefix, '');
      nextNumber = parseInt(lastNumberStr, 10) + 1;
    }

    // Pad with zeros to 6 digits
    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }

  /**
   * Create a new requisition
   * Note: Access control is handled by the permission guard via @RequirePermission decorator.
   * Permissions are automatically granted based on membershipStatus (LXL and above).
   */
  async create(
    dto: CreateRequisitionDto,
    user: MemberDocument,
  ): Promise<Requisition> {
    // Validate P.Dams discussion - cannot submit if set to 'no'
    if (!dto.isDraft && dto.discussedWithPDams === 'no') {
      throw new BadRequestException(
        'Requisitions cannot be submitted without discussing with P.Dams. Please save as draft or update the P.Dams discussion status.',
      );
    }

    // Calculate total amount from cost breakdown
    const totalAmount = dto.costBreakdown.reduce(
      (sum, item) => sum + item.total,
      0,
    );

    // Extract branch ID - handle both populated object and raw ObjectId
    const branchId = typeof user.branch === 'object' && user.branch?._id
      ? user.branch._id
      : user.branch;

    if (!branchId) {
      throw new BadRequestException('User must be assigned to a branch to create requisitions');
    }

    // Always generate reference number (serves as unique ticket ID throughout lifecycle)
    const referenceNumber = await this.generateReferenceNumber();

    const requisition = new this.requisitionModel({
      ...dto,
      totalAmount,
      branch: branchId,
      requestor: user._id,
      createdBy: user._id,
      referenceNumber,
      status: dto.isDraft ? RequisitionStatus.DRAFT : RequisitionStatus.PENDING_APPROVAL,
      submittedAt: dto.isDraft ? undefined : new Date(),
    });

    const savedRequisition = await requisition.save();

    // If not a draft, send notification to approvers
    if (!dto.isDraft) {
      await this.notifyApprovers(savedRequisition, user);
      await this.notifyRequestorOfSubmission(savedRequisition, user);
    }

    return this.findOne(savedRequisition._id.toString());
  }

  /**
   * Find all requisitions with filtering
   */
  async findAll(
    query: RequisitionQueryDto,
    user: MemberDocument,
  ): Promise<{ data: Requisition[]; total: number; page: number; limit: number }> {
    const filter: any = {};

    // Branch filter - users can only see requisitions in their branch
    if (query.branch) {
      filter.branch = new Types.ObjectId(query.branch);
    } else if (user.branch) {
      // Handle both populated object and raw ObjectId
      filter.branch = typeof user.branch === 'object' && user.branch?._id
        ? user.branch._id
        : user.branch;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.expenseCategory) {
      filter.expenseCategory = new Types.ObjectId(query.expenseCategory);
    }

    if (query.unit) {
      filter.unit = new Types.ObjectId(query.unit);
    }

    if (query.requestor) {
      filter.requestor = new Types.ObjectId(query.requestor);
    }

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        filter.createdAt.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.createdAt.$lte = new Date(query.endDate);
      }
    }

    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      filter.totalAmount = {};
      if (query.minAmount !== undefined) {
        filter.totalAmount.$gte = query.minAmount;
      }
      if (query.maxAmount !== undefined) {
        filter.totalAmount.$lte = query.maxAmount;
      }
    }

    if (query.search) {
      filter.$text = { $search: query.search };
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.requisitionModel
        .find(filter)
        .populate('requestor', 'firstName lastName email')
        .populate('branch', 'name')
        .populate('unit', 'name')
        .populate('expenseCategory', 'name')
        .populate('approvedBy', 'firstName lastName email')
        .populate('rejectedBy', 'firstName lastName email')
        .populate('disbursedBy', 'firstName lastName email')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.requisitionModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Find user's own requisitions
   */
  async findMyRequisitions(
    query: RequisitionQueryDto,
    user: MemberDocument,
  ): Promise<{ data: Requisition[]; total: number; page: number; limit: number }> {
    return this.findAll({ ...query, requestor: user._id.toString() }, user);
  }

  /**
   * Find requisitions pending approval
   */
  async findPendingApproval(
    query: RequisitionQueryDto,
    user: MemberDocument,
  ): Promise<{ data: Requisition[]; total: number; page: number; limit: number }> {
    const filter: any = {};

    // Branch filter - users can only see requisitions in their branch
    if (query.branch) {
      filter.branch = new Types.ObjectId(query.branch);
    } else if (user.branch) {
      filter.branch = typeof user.branch === 'object' && user.branch?._id
        ? user.branch._id
        : user.branch;
    }

    // Filter by PENDING_APPROVAL status
    filter.status = RequisitionStatus.PENDING_APPROVAL;

    if (query.expenseCategory) {
      filter.expenseCategory = new Types.ObjectId(query.expenseCategory);
    }

    if (query.unit) {
      filter.unit = new Types.ObjectId(query.unit);
    }

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        filter.createdAt.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.createdAt.$lte = new Date(query.endDate);
      }
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const sortField = query.sortBy || 'submittedAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.requisitionModel
        .find(filter)
        .populate('requestor', 'firstName lastName email')
        .populate('branch', 'name')
        .populate('unit', 'name')
        .populate('expenseCategory', 'name')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.requisitionModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Find requisitions pending disbursement (APPROVED status)
   */
  async findPendingDisbursement(
    query: RequisitionQueryDto,
    user: MemberDocument,
  ): Promise<{ data: Requisition[]; total: number; page: number; limit: number }> {
    return this.findAll(
      { ...query, status: RequisitionStatus.APPROVED },
      user,
    );
  }

  /**
   * Find a single requisition by ID
   */
  async findOne(id: string): Promise<Requisition> {
    const requisition = await this.requisitionModel
      .findById(id)
      .populate('requestor', 'firstName lastName email phone')
      .populate('branch', 'name')
      .populate('unit', 'name')
      .populate('expenseCategory', 'name description')
      .populate('approvedBy', 'firstName lastName email')
      .populate('rejectedBy', 'firstName lastName email')
      .populate('disbursedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .exec();

    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    return requisition;
  }

  /**
   * Update a draft requisition
   */
  async update(
    id: string,
    dto: UpdateRequisitionDto,
    user: MemberDocument,
  ): Promise<Requisition> {
    const requisition = await this.requisitionModel.findById(id);

    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    // Only allow updates to draft requisitions
    if (requisition.status !== RequisitionStatus.DRAFT) {
      throw new BadRequestException('Only draft requisitions can be updated');
    }

    // Only the owner can update (skip for public submissions which have no requestor)
    if (requisition.requestor && requisition.requestor.toString() !== user._id.toString()) {
      throw new ForbiddenException('You can only update your own requisitions');
    }

    // Recalculate total if cost breakdown changed
    if (dto.costBreakdown) {
      dto['totalAmount'] = dto.costBreakdown.reduce(
        (sum, item) => sum + item.total,
        0,
      );
    }

    Object.assign(requisition, dto, {
      updatedBy: user._id,
      updatedAt: new Date(),
    });

    await requisition.save();
    return this.findOne(id);
  }

  /**
   * Submit a draft requisition
   */
  async submit(id: string, user: MemberDocument): Promise<Requisition> {
    const requisition = await this.requisitionModel.findById(id);

    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    if (requisition.status !== RequisitionStatus.DRAFT) {
      throw new BadRequestException('Only draft requisitions can be submitted');
    }

    // Validate P.Dams discussion - cannot submit if set to 'no'
    if (requisition.discussedWithPDams === 'no') {
      throw new BadRequestException(
        'Requisitions cannot be submitted without discussing with P.Dams. Please update the P.Dams discussion status before submitting.',
      );
    }

    // Only the owner can submit (skip for public submissions which have no requestor)
    if (requisition.requestor && requisition.requestor.toString() !== user._id.toString()) {
      throw new ForbiddenException('You can only submit your own requisitions');
    }

    // Generate reference number if not already set
    if (!requisition.referenceNumber) {
      requisition.referenceNumber = await this.generateReferenceNumber();
    }

    requisition.status = RequisitionStatus.PENDING_APPROVAL;
    requisition.submittedAt = new Date();
    requisition.updatedBy = user._id;
    requisition.updatedAt = new Date();

    await requisition.save();

    // Notify approvers
    await this.notifyApprovers(requisition, user);
    await this.notifyRequestorOfSubmission(requisition, user);

    return this.findOne(id);
  }

  /**
   * Approve a requisition
   * Workflow: PENDING_APPROVAL -> APPROVED
   */
  async approve(
    id: string,
    dto: ApproveRequisitionDto,
    user: MemberDocument,
  ): Promise<Requisition> {
    const requisition = await this.requisitionModel
      .findById(id)
      .populate('requestor', 'firstName lastName email');

    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    if (requisition.status !== RequisitionStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Only pending approval requisitions can be approved',
      );
    }

    requisition.status = RequisitionStatus.APPROVED;
    requisition.approvedAt = new Date();
    requisition.approvedBy = user._id;
    requisition.approvalNotes = dto.notes;
    requisition.updatedBy = user._id;
    requisition.updatedAt = new Date();

    await requisition.save();

    // Notify disbursers
    await this.notifyDisbursers(requisition, user);

    return this.findOne(id);
  }

  /**
   * Reject a requisition
   * Workflow: PENDING_APPROVAL -> REJECTED
   */
  async reject(
    id: string,
    dto: RejectRequisitionDto,
    user: MemberDocument,
  ): Promise<Requisition> {
    const requisition = await this.requisitionModel
      .findById(id)
      .populate('requestor', 'firstName lastName email');

    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    if (requisition.status !== RequisitionStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Only pending approval requisitions can be rejected',
      );
    }

    requisition.status = RequisitionStatus.REJECTED;
    requisition.rejectedAt = new Date();
    requisition.rejectedBy = user._id;
    requisition.rejectionReason = dto.reason;
    requisition.updatedBy = user._id;
    requisition.updatedAt = new Date();

    await requisition.save();

    // Notify requestor of rejection
    await this.notifyRequestorOfRejection(requisition, user);

    return this.findOne(id);
  }

  /**
   * Disburse funds for a requisition
   * Workflow: APPROVED -> DISBURSED
   */
  async disburse(
    id: string,
    dto: DisburseRequisitionDto,
    user: MemberDocument,
  ): Promise<Requisition> {
    const requisition = await this.requisitionModel
      .findById(id)
      .populate('requestor', 'firstName lastName email');

    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    if (requisition.status !== RequisitionStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved requisitions can be disbursed',
      );
    }

    requisition.status = RequisitionStatus.DISBURSED;
    requisition.disbursedAt = new Date();
    requisition.disbursedBy = user._id;
    requisition.disbursementReference = requisition.referenceNumber;
    requisition.disbursementNotes = dto.notes;
    requisition.updatedBy = user._id;
    requisition.updatedAt = new Date();

    await requisition.save();

    // Notify requestor of disbursement
    await this.notifyRequestorOfDisbursement(requisition, user);

    // Notify approver that disbursement is complete
    await this.notifyApproverOfDisbursement(requisition, user);

    return this.findOne(id);
  }

  /**
   * Close a disbursed requisition
   * Workflow: DISBURSED -> CLOSED
   */
  async close(id: string, user: MemberDocument): Promise<Requisition> {
    const requisition = await this.requisitionModel.findById(id);

    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    if (requisition.status !== RequisitionStatus.DISBURSED) {
      throw new BadRequestException(
        'Only disbursed requisitions can be closed',
      );
    }

    requisition.status = RequisitionStatus.CLOSED;
    requisition.updatedBy = user._id;
    requisition.updatedAt = new Date();

    await requisition.save();

    return this.findOne(id);
  }

  /**
   * Delete a requisition (only drafts)
   */
  async remove(id: string, user: MemberDocument): Promise<void> {
    const requisition = await this.requisitionModel.findById(id);

    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    if (requisition.status !== RequisitionStatus.DRAFT) {
      throw new BadRequestException('Only draft requisitions can be deleted');
    }

    // Only the owner can delete (skip for public submissions which have no requestor)
    if (requisition.requestor && requisition.requestor.toString() !== user._id.toString()) {
      throw new ForbiddenException('You can only delete your own requisitions');
    }

    await this.requisitionModel.findByIdAndDelete(id);
  }

  /**
   * Get dashboard statistics
   */
  async getStatistics(branchId?: string): Promise<any> {
    const filter: any = {};
    // Validate branchId is a valid 24-character hex string before using it
    if (branchId && /^[a-fA-F0-9]{24}$/.test(branchId)) {
      filter.branch = new Types.ObjectId(branchId);
    }

    const [
      totalRequisitions,
      pendingApproval,
      pendingDisbursement,
      disbursed,
      rejected,
      closed,
      byStatus,
      byCategory,
      totalAmountRequested,
      totalAmountDisbursed,
    ] = await Promise.all([
      this.requisitionModel.countDocuments(filter),
      this.requisitionModel.countDocuments({
        ...filter,
        status: RequisitionStatus.PENDING_APPROVAL,
      }),
      this.requisitionModel.countDocuments({
        ...filter,
        status: RequisitionStatus.APPROVED, // APPROVED = pending disbursement
      }),
      this.requisitionModel.countDocuments({
        ...filter,
        status: RequisitionStatus.DISBURSED,
      }),
      this.requisitionModel.countDocuments({
        ...filter,
        status: RequisitionStatus.REJECTED,
      }),
      this.requisitionModel.countDocuments({
        ...filter,
        status: RequisitionStatus.CLOSED,
      }),
      this.requisitionModel.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.requisitionModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$expenseCategory',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
          },
        },
        {
          $lookup: {
            from: 'expense_categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      ]),
      this.requisitionModel.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      this.requisitionModel.aggregate([
        { $match: { ...filter, status: RequisitionStatus.DISBURSED } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    return {
      totalRequisitions,
      pendingApproval,
      pendingDisbursement,
      disbursed,
      rejected,
      closed,
      totalAmountRequested: totalAmountRequested[0]?.total || 0,
      totalAmountDisbursed: totalAmountDisbursed[0]?.total || 0,
      byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
      byCategory: byCategory.map((c) => ({
        category: c.category?.name || 'Unknown',
        categoryId: c._id,
        count: c.count,
        totalAmount: c.totalAmount,
      })),
    };
  }

  // ============== Public Requisition Methods ==============

  /**
   * Create a public requisition (no authentication required)
   */
  async createPublicRequisition(
    dto: PublicCreateRequisitionDto,
  ): Promise<Requisition> {
    // Validate P.Dams discussion - cannot submit if set to 'no'
    if (dto.discussedWithPDams === 'no') {
      throw new BadRequestException(
        'Requisitions cannot be submitted without discussing with P.Dams. Please update the P.Dams discussion status.',
      );
    }

    // Find branch by slug
    const branch = await this.branchModel.findOne({
      slug: dto.branchSlug.toLowerCase(),
      isActive: true,
    });

    if (!branch) {
      throw new BadRequestException(`Branch with slug "${dto.branchSlug}" not found`);
    }

    // Calculate total amount from cost breakdown
    const totalAmount = dto.costBreakdown.reduce(
      (sum, item) => sum + item.total,
      0,
    );

    // Generate reference number for public submissions
    const referenceNumber = await this.generateReferenceNumber();

    const requisition = new this.requisitionModel({
      // Public submission info
      isPublicSubmission: true,
      submitterName: dto.submitterName,
      submitterEmail: dto.submitterEmail.toLowerCase(),
      submitterPhone: dto.submitterPhone,
      // Branch from slug
      branch: branch._id,
      // Regular fields
      referenceNumber,
      unit: dto.unit ? new Types.ObjectId(dto.unit) : undefined,
      customUnit: dto.customUnit || undefined,
      expenseCategory: new Types.ObjectId(dto.expenseCategory),
      eventDescription: dto.eventDescription,
      dateNeeded: new Date(dto.dateNeeded),
      lastRequest: dto.lastRequest || undefined,
      costBreakdown: dto.costBreakdown,
      creditAccount: dto.creditAccount,
      documentUrls: dto.documentUrls || [],
      discussedWithPDams: dto.discussedWithPDams,
      discussedDate: dto.discussedDate ? new Date(dto.discussedDate) : undefined,
      totalAmount,
      currency: 'NGN',
      status: RequisitionStatus.PENDING_APPROVAL,
      submittedAt: new Date(),
      // No requestor or createdBy for public submissions
    });

    const savedRequisition = await requisition.save();

    // Notify approvers with action tokens
    await this.notifyApproversWithTokens(savedRequisition);

    // Confirm submission to submitter
    await this.notifyPublicSubmitterOfSubmission(savedRequisition);

    return this.findOne(savedRequisition._id.toString());
  }

  /**
   * Approve a requisition using an action token
   */
  async approveWithToken(token: string, notes?: string): Promise<Requisition> {
    const validation = await this.actionTokenService.validateToken(token);

    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const actionToken = validation.actionToken!;

    if (actionToken.actionType !== ActionTokenType.APPROVE) {
      throw new BadRequestException('Invalid token type for approval');
    }

    const requisition = await this.requisitionModel
      .findById(actionToken.requisitionId)
      .populate('requestor', 'firstName lastName email');

    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    if (requisition.status !== RequisitionStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Only pending approval requisitions can be approved',
      );
    }

    // Mark token as used
    await this.actionTokenService.markTokenAsUsed(token);

    // Invalidate all other approval/rejection tokens for this requisition
    await this.actionTokenService.invalidateTokensForRequisition(actionToken.requisitionId);

    // Update requisition
    requisition.status = RequisitionStatus.APPROVED;
    requisition.approvedAt = new Date();
    requisition.approvalNotes = notes;
    requisition.updatedAt = new Date();

    await requisition.save();

    // Notify disbursers with action token
    await this.notifyDisbursersWithTokens(requisition);

    return this.findOne(requisition._id.toString());
  }

  /**
   * Reject a requisition using an action token
   */
  async rejectWithToken(token: string, reason: string): Promise<Requisition> {
    const validation = await this.actionTokenService.validateToken(token);

    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const actionToken = validation.actionToken!;

    if (actionToken.actionType !== ActionTokenType.REJECT) {
      throw new BadRequestException('Invalid token type for rejection');
    }

    const requisition = await this.requisitionModel
      .findById(actionToken.requisitionId)
      .populate('requestor', 'firstName lastName email');

    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    if (requisition.status !== RequisitionStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Only pending approval requisitions can be rejected',
      );
    }

    // Mark token as used
    await this.actionTokenService.markTokenAsUsed(token);

    // Invalidate all other tokens for this requisition
    await this.actionTokenService.invalidateTokensForRequisition(actionToken.requisitionId);

    // Update requisition
    requisition.status = RequisitionStatus.REJECTED;
    requisition.rejectedAt = new Date();
    requisition.rejectionReason = reason;
    requisition.updatedAt = new Date();

    await requisition.save();

    // Notify submitter of rejection
    await this.notifyPublicSubmitterOfRejection(requisition, reason, actionToken.recipientEmail);

    return this.findOne(requisition._id.toString());
  }

  /**
   * Disburse a requisition using an action token
   */
  async disburseWithToken(
    token: string,
    notes?: string,
  ): Promise<Requisition> {
    const validation = await this.actionTokenService.validateToken(token);

    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const actionToken = validation.actionToken!;

    if (actionToken.actionType !== ActionTokenType.DISBURSE) {
      throw new BadRequestException('Invalid token type for disbursement');
    }

    const requisition = await this.requisitionModel
      .findById(actionToken.requisitionId)
      .populate('requestor', 'firstName lastName email');

    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    if (requisition.status !== RequisitionStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved requisitions can be disbursed',
      );
    }

    // Mark token as used
    await this.actionTokenService.markTokenAsUsed(token);

    // Invalidate all other tokens for this requisition
    await this.actionTokenService.invalidateTokensForRequisition(actionToken.requisitionId);

    // Update requisition
    requisition.status = RequisitionStatus.DISBURSED;
    requisition.disbursedAt = new Date();
    requisition.disbursementReference = requisition.referenceNumber;
    requisition.disbursementNotes = notes;
    requisition.updatedAt = new Date();

    await requisition.save();

    // Notify submitter of disbursement
    await this.notifyPublicSubmitterOfDisbursement(requisition, actionToken.recipientEmail);

    // Notify approver that disbursement is complete
    await this.notifyApproverOfDisbursementPublic(requisition);

    return this.findOne(requisition._id.toString());
  }

  /**
   * Get all branches for public requisition form
   */
  async getPublicBranches(): Promise<any[]> {
    const branches = await this.branchModel
      .find({ isActive: true })
      .select('_id name slug description address.city address.state')
      .sort({ name: 1 })
      .exec();

    return branches.map((branch) => ({
      _id: branch._id,
      name: branch.name,
      slug: branch.slug,
      description: branch.description,
      address: branch.address,
    }));
  }

  /**
   * Get a single branch by slug for public requisition form
   */
  async getPublicBranchBySlug(slug: string): Promise<any> {
    const branch = await this.branchModel
      .findOne({ slug: slug.toLowerCase(), isActive: true })
      .select('_id name slug description address.city address.state')
      .exec();

    if (!branch) {
      throw new NotFoundException(`Branch with slug "${slug}" not found`);
    }

    return {
      _id: branch._id,
      name: branch.name,
      slug: branch.slug,
      description: branch.description,
      address: branch.address,
    };
  }

  /**
   * Get groups/units for a branch (public, no auth required)
   */
  async getPublicGroups(branchSlug: string): Promise<any[]> {
    const branch = await this.branchModel.findOne({
      slug: branchSlug.toLowerCase(),
      isActive: true,
    });
    if (!branch) return [];

    const groups = await this.groupModel
      .find({ branch: branch._id, isActive: true, type: 'unit' })
      .select('_id name')
      .sort({ name: 1 })
      .exec();

    return groups.map((g) => ({
      _id: g._id,
      name: g.name,
    }));
  }

  /**
   * Check if a member is eligible to raise requisitions (LXL status)
   * LXL members include: members with LXL, DIRECTOR, PASTOR, CAMPUS_PASTOR, SENIOR_PASTOR status
   * Also includes: Unit Heads, Assistant Unit Heads, District Pastors, Ministry Directors
   * Champs (DC, MEMBER status without leadership roles) are NOT eligible
   */
  async checkLxlEligibility(
    email: string,
    branchSlug: string,
  ): Promise<{
    eligible: boolean;
    memberName?: string;
    reason?: string;
    leadershipRole?: string;
  }> {
    // Find the branch first
    const branch = await this.branchModel.findOne({
      slug: branchSlug.toLowerCase(),
      isActive: true,
    });

    if (!branch) {
      return {
        eligible: false,
        reason: 'Branch not found',
      };
    }

    // Find member by email in the branch
    const member = await this.memberModel.findOne({
      email: email.toLowerCase(),
      branch: branch._id,
      isActive: true,
    });

    if (!member) {
      return {
        eligible: false,
        reason: 'Member not found. Please ensure you are a registered member of this branch.',
      };
    }

    const memberName = `${member.firstName} ${member.lastName}`;

    // LXL membership statuses that automatically qualify
    const lxlStatuses = [
      MembershipStatus.LXL,
      MembershipStatus.DIRECTOR,
      MembershipStatus.PASTOR,
      MembershipStatus.CAMPUS_PASTOR,
      MembershipStatus.SENIOR_PASTOR,
    ];

    // Check if member has LXL membership status
    if (lxlStatuses.includes(member.membershipStatus)) {
      return {
        eligible: true,
        memberName,
        leadershipRole: this.getLeadershipRoleDisplay(member.membershipStatus),
      };
    }

    // Check if member is a Unit Head, Assistant Unit Head, District Pastor, or Ministry Director
    const leadershipGroup = await this.groupModel.findOne({
      branch: branch._id,
      isActive: true,
      $or: [
        { unitHead: member._id },
        { assistantUnitHead: member._id },
        { districtPastor: member._id },
        { ministryDirector: member._id },
      ],
    });

    if (leadershipGroup) {
      let role = '';
      if (leadershipGroup.unitHead?.toString() === member._id.toString()) {
        role = `Unit Head (${leadershipGroup.name})`;
      } else if (leadershipGroup.assistantUnitHead?.toString() === member._id.toString()) {
        role = `Assistant Unit Head (${leadershipGroup.name})`;
      } else if (leadershipGroup.districtPastor?.toString() === member._id.toString()) {
        role = `District Pastor (${leadershipGroup.name})`;
      } else if (leadershipGroup.ministryDirector?.toString() === member._id.toString()) {
        role = `Ministry Director (${leadershipGroup.name})`;
      }

      return {
        eligible: true,
        memberName,
        leadershipRole: role,
      };
    }

    // Member is not LXL - likely a regular member or champ (DC)
    return {
      eligible: false,
      memberName,
      reason: 'You are not authorized to raise requisitions. Only members with leadership roles (LXL and above) can raise requisitions.',
    };
  }

  /**
   * Get display name for membership status
   */
  private getLeadershipRoleDisplay(status: MembershipStatus): string {
    const displayNames: Record<MembershipStatus, string> = {
      [MembershipStatus.MEMBER]: 'Member',
      [MembershipStatus.DC]: 'David\'s Company',
      [MembershipStatus.LXL]: 'League of Extraordinary Leaders',
      [MembershipStatus.DIRECTOR]: 'Director',
      [MembershipStatus.PASTOR]: 'Pastor',
      [MembershipStatus.CAMPUS_PASTOR]: 'Campus Pastor',
      [MembershipStatus.SENIOR_PASTOR]: 'Senior Pastor',
      [MembershipStatus.LEFT]: 'Left',
      [MembershipStatus.RELOCATED]: 'Relocated',
    };
    return displayNames[status] || status;
  }

  // ============== Email Notification Methods ==============

  /**
   * Notify users with approve permission about new requisition
   * Non-blocking: queues email for async delivery
   */
  private async notifyApprovers(
    requisition: RequisitionDocument,
    requestor: MemberDocument,
  ): Promise<void> {
    try {
      const approvers = await this.userPermissionsService.getMembersWithPermission(
        FinancePermission.APPROVE_REQUISITION,
        requisition.branch?.toString(),
      );

      if (approvers.length === 0) return;

      const recipients = approvers
        .filter((a) => a.email)
        .map((a) => ({ email: a.email, name: `${a.firstName || ''} ${a.lastName || ''}`.trim() }));

      if (recipients.length === 0) return;

      const html = this.generateNewRequisitionEmail(requisition, requestor);
      const subject = `New Requisition Requires Approval - ${requisition.eventDescription.substring(0, 50)}`;

      // Queue email for async delivery (non-blocking)
      this.queueService.queueApproverNotification(
        requisition._id.toString(),
        html,
        subject,
        recipients,
      );
    } catch (error) {
      console.error('Failed to queue approver notification:', error);
    }
  }

  /**
   * Notify requestor of approval
   * Non-blocking: queues email for async delivery
   */
  private async notifyRequestorOfApproval(
    requisition: RequisitionDocument,
    approver: MemberDocument,
  ): Promise<void> {
    try {
      if (!requisition.requestor) return;
      const requestor = await this.memberModel
        .findById(requisition.requestor)
        .select('firstName lastName email');
      if (!requestor?.email) return;

      const html = this.generateApprovalEmail(requisition, approver);
      const subject = `Your Requisition Has Been Approved`;

      // Queue email for async delivery (non-blocking)
      this.queueService.queueRequestorApprovalNotification(
        requisition._id.toString(),
        html,
        subject,
        [{ email: requestor.email, name: `${requestor.firstName || ''} ${requestor.lastName || ''}`.trim() }],
      );
    } catch (error) {
      console.error('Failed to queue approval notification to requestor:', error);
    }
  }

  /**
   * Notify users with disburse permission
   * Non-blocking: queues email for async delivery
   */
  private async notifyDisbursers(
    requisition: RequisitionDocument,
    approver: MemberDocument,
  ): Promise<void> {
    try {
      const disbursers = await this.userPermissionsService.getMembersWithPermission(
        FinancePermission.DISBURSE,
        requisition.branch?.toString(),
      );

      if (disbursers.length === 0) return;

      const recipients = disbursers
        .filter((d) => d.email)
        .map((d) => ({ email: d.email, name: `${d.firstName || ''} ${d.lastName || ''}`.trim() }));

      if (recipients.length === 0) return;

      const html = this.generateDisbursementRequestEmail(requisition, approver);
      const subject = `Requisition Ready for Disbursement - ${requisition.totalAmount.toLocaleString()} NGN`;

      // Queue email for async delivery (non-blocking)
      this.queueService.queueDisburserNotification(
        requisition._id.toString(),
        html,
        subject,
        recipients,
      );
    } catch (error) {
      console.error('Failed to queue disburser notification:', error);
    }
  }

  /**
   * Notify requestor of rejection
   * Non-blocking: queues email for async delivery
   */
  private async notifyRequestorOfRejection(
    requisition: RequisitionDocument,
    rejector: MemberDocument,
  ): Promise<void> {
    try {
      if (!requisition.requestor) return;
      const requestor = await this.memberModel
        .findById(requisition.requestor)
        .select('firstName lastName email');
      if (!requestor?.email) return;

      const html = this.generateRejectionEmail(requisition, rejector);
      const subject = `Your Requisition Has Been Declined`;

      // Queue email for async delivery (non-blocking)
      this.queueService.queueRequestorRejectionNotification(
        requisition._id.toString(),
        html,
        subject,
        [{ email: requestor.email, name: `${requestor.firstName || ''} ${requestor.lastName || ''}`.trim() }],
      );
    } catch (error) {
      console.error('Failed to queue rejection notification to requestor:', error);
    }
  }

  /**
   * Notify requestor of disbursement
   * Non-blocking: queues email for async delivery
   */
  private async notifyRequestorOfDisbursement(
    requisition: RequisitionDocument,
    disburser: MemberDocument,
  ): Promise<void> {
    try {
      if (!requisition.requestor) return;
      const requestor = await this.memberModel
        .findById(requisition.requestor)
        .select('firstName lastName email');
      if (!requestor?.email) return;

      const html = this.generateDisbursementConfirmationEmail(requisition, disburser);
      const subject = `Funds Disbursed - ${requisition.totalAmount.toLocaleString()} NGN`;

      // Queue email for async delivery (non-blocking)
      this.queueService.queueRequestorDisbursementNotification(
        requisition._id.toString(),
        html,
        subject,
        [{ email: requestor.email, name: `${requestor.firstName || ''} ${requestor.lastName || ''}`.trim() }],
      );
    } catch (error) {
      console.error('Failed to queue disbursement notification to requestor:', error);
    }
  }

  // ============== Public Requisition Email Methods ==============

  /**
   * Notify approvers with action tokens (for public submissions)
   * Excludes Super Admin role - only Senior Pastor and Campus Pastor receive emails
   * Non-blocking: token creation is sync, but email sending is queued
   */
  private async notifyApproversWithTokens(
    requisition: RequisitionDocument,
  ): Promise<void> {
    try {
      const approvers = await this.userPermissionsService.getMembersWithPermission(
        FinancePermission.APPROVE_REQUISITION,
        requisition.branch?.toString(),
      );

      // Filter out Super Admins - they shouldn't receive approval emails
      const filteredApprovers = approvers.filter((a) => {
        const roleAssignment = (a as any).roleAssignments?.find((ra: any) =>
          ra.role?.slug !== 'super-admin'
        );
        // Keep approver if they don't have super-admin role or have other approval roles
        return !((a as any).roleAssignments?.some((ra: any) => ra.role?.slug === 'super-admin' && (a as any).roleAssignments?.length === 1));
      });

      if (filteredApprovers.length === 0) return;

      const subject = `New Requisition Requires Your Approval - ${requisition.eventDescription.substring(0, 50)}`;

      // Create tokens and queue emails for each approver (non-blocking email send)
      for (const approver of filteredApprovers) {
        if (!approver.email) continue;

        try {
          // Create approve and reject tokens for this approver (sync - needed for email content)
          const { approveToken, rejectToken } = await this.actionTokenService.createApprovalTokens(
            requisition._id,
            approver.email,
            approver._id,
          );

          const html = this.generateApproverEmailWithTokens(
            requisition,
            approveToken.token,
            rejectToken.token,
          );

          // Queue email for async delivery (non-blocking)
          this.queueService.queueApproverNotification(
            requisition._id.toString(),
            html,
            subject,
            [{ email: approver.email, name: `${approver.firstName || ''} ${approver.lastName || ''}`.trim() }],
          );
        } catch (err) {
          console.error(`Failed to queue approval email for ${approver.email}:`, err);
        }
      }
    } catch (error) {
      console.error('Failed to notify approvers with tokens:', error);
    }
  }

  /**
   * Notify disbursers with info-only email (no action required yet)
   * Non-blocking: queues email for async delivery
   */
  private async notifyDisbursersInfoOnly(
    requisition: RequisitionDocument,
  ): Promise<void> {
    try {
      const disbursers = await this.userPermissionsService.getMembersWithPermission(
        FinancePermission.DISBURSE,
        requisition.branch?.toString(),
      );

      if (disbursers.length === 0) return;

      const recipients = disbursers
        .filter((d) => d.email)
        .map((d) => ({ email: d.email, name: `${d.firstName || ''} ${d.lastName || ''}`.trim() }));

      if (recipients.length === 0) return;

      const html = this.generateDisburserInfoEmail(requisition);
      const subject = `New Requisition Submitted - ${requisition.totalAmount.toLocaleString()} NGN`;

      // Queue email for async delivery (non-blocking)
      this.queueService.queueDisburserNotification(
        requisition._id.toString(),
        html,
        subject,
        recipients,
      );
    } catch (error) {
      console.error('Failed to queue disbursers info notification:', error);
    }
  }

  /**
   * Notify disbursers with action tokens (after approval)
   * Non-blocking: token creation is sync, but email sending is queued
   */
  private async notifyDisbursersWithTokens(
    requisition: RequisitionDocument,
  ): Promise<void> {
    try {
      const disbursers = await this.userPermissionsService.getMembersWithPermission(
        FinancePermission.DISBURSE,
        requisition.branch?.toString(),
      );

      if (disbursers.length === 0) return;

      const subject = `Requisition Approved - Ready for Disbursement - ${requisition.totalAmount.toLocaleString()} NGN`;

      // Create tokens and queue emails for each disburser (non-blocking email send)
      for (const disburser of disbursers) {
        if (!disburser.email) continue;

        try {
          // Create disburse token for this disburser (sync - needed for email content)
          const disburseToken = await this.actionTokenService.createActionToken(
            requisition._id,
            ActionTokenType.DISBURSE,
            disburser.email,
            disburser._id,
          );

          const html = this.generateDisburserEmailWithToken(requisition, disburseToken.token);

          // Queue email for async delivery (non-blocking)
          this.queueService.queueDisburserNotification(
            requisition._id.toString(),
            html,
            subject,
            [{ email: disburser.email, name: `${disburser.firstName || ''} ${disburser.lastName || ''}`.trim() }],
          );
        } catch (err) {
          console.error(`Failed to queue disburse email for ${disburser.email}:`, err);
        }
      }
    } catch (error) {
      console.error('Failed to notify disbursers with tokens:', error);
    }
  }

  /**
   * Notify public submitter of approval
   * Non-blocking: queues email for async delivery
   */
  private async notifyPublicSubmitterOfApproval(
    requisition: RequisitionDocument,
    approverEmail: string,
  ): Promise<void> {
    try {
      const email = requisition.isPublicSubmission
        ? requisition.submitterEmail
        : (requisition.requestor as any)?.email;

      if (!email) return;

      const html = this.generatePublicApprovalEmail(requisition, approverEmail);
      const subject = `Your Requisition Has Been Approved`;
      const name = requisition.isPublicSubmission
        ? requisition.submitterName || ''
        : `${(requisition.requestor as any)?.firstName || ''} ${(requisition.requestor as any)?.lastName || ''}`.trim();

      // Queue email for async delivery (non-blocking)
      this.queueService.queueRequestorApprovalNotification(
        requisition._id.toString(),
        html,
        subject,
        [{ email, name }],
      );
    } catch (error) {
      console.error('Failed to queue approval notification to submitter:', error);
    }
  }

  /**
   * Notify public submitter of rejection
   * Non-blocking: queues email for async delivery
   */
  private async notifyPublicSubmitterOfRejection(
    requisition: RequisitionDocument,
    reason: string,
    rejectorEmail: string,
  ): Promise<void> {
    try {
      const email = requisition.isPublicSubmission
        ? requisition.submitterEmail
        : (requisition.requestor as any)?.email;

      if (!email) return;

      const html = this.generatePublicRejectionEmail(requisition, reason);
      const subject = `Your Requisition Has Been Declined`;
      const name = requisition.isPublicSubmission
        ? requisition.submitterName || ''
        : `${(requisition.requestor as any)?.firstName || ''} ${(requisition.requestor as any)?.lastName || ''}`.trim();

      // Queue email for async delivery (non-blocking)
      this.queueService.queueRequestorRejectionNotification(
        requisition._id.toString(),
        html,
        subject,
        [{ email, name }],
      );
    } catch (error) {
      console.error('Failed to queue rejection notification to submitter:', error);
    }
  }

  /**
   * Notify public submitter of disbursement
   * Non-blocking: queues email for async delivery
   */
  private async notifyPublicSubmitterOfDisbursement(
    requisition: RequisitionDocument,
    disburserEmail: string,
  ): Promise<void> {
    try {
      const submitterEmail = requisition.isPublicSubmission
        ? requisition.submitterEmail
        : (requisition.requestor as any)?.email;

      const html = this.generatePublicDisbursementEmail(requisition);
      const subject = `Funds Disbursed - ${requisition.totalAmount.toLocaleString()} NGN`;

      // Queue email to submitter if email exists (non-blocking)
      if (submitterEmail) {
        const name = requisition.isPublicSubmission
          ? requisition.submitterName || ''
          : `${(requisition.requestor as any)?.firstName || ''} ${(requisition.requestor as any)?.lastName || ''}`.trim();

        this.queueService.queueRequestorDisbursementNotification(
          requisition._id.toString(),
          html,
          subject,
          [{ email: submitterEmail, name }],
        );
      }

      // Also notify users with RECEIVE_DISBURSE_CONFIRMATION permission (non-blocking)
      this.notifyDisburseConfirmationRecipients(requisition);
    } catch (error) {
      console.error('Failed to queue disbursement notification to submitter:', error);
    }
  }

  /**
   * Notify users with RECEIVE_DISBURSE_CONFIRMATION permission about successful disbursement
   * Non-blocking: queues email for async delivery
   */
  private async notifyDisburseConfirmationRecipients(
    requisition: RequisitionDocument,
  ): Promise<void> {
    try {
      const members = await this.userPermissionsService.getMembersWithPermission(
        FinancePermission.RECEIVE_DISBURSE_CONFIRMATION,
        requisition.branch?.toString(),
      );

      if (members.length === 0) return;

      const recipients = members
        .filter((r) => r.email)
        .map((r) => ({ email: r.email, name: `${r.firstName || ''} ${r.lastName || ''}`.trim() }));

      if (recipients.length === 0) return;

      const submitterName = requisition.isPublicSubmission
        ? (requisition.submitterName || 'Unknown')
        : (`${(requisition.requestor as any)?.firstName || ''} ${(requisition.requestor as any)?.lastName || ''}`.trim() || 'Unknown');

      const html = this.generateDisburseConfirmationNotificationEmail(requisition, submitterName);
      const subject = `Disbursement Confirmation - ${requisition.totalAmount.toLocaleString()} NGN disbursed to ${submitterName}`;

      // Queue email for async delivery (non-blocking)
      this.queueService.queueDisburseConfirmationNotification(
        requisition._id.toString(),
        html,
        subject,
        recipients,
      );
    } catch (error) {
      console.error('Failed to queue disburse confirmation notification:', error);
    }
  }

  /**
   * Generate email for disburse confirmation notification recipients
   */
  private generateDisburseConfirmationNotificationEmail(
    requisition: RequisitionDocument,
    submitterName: string,
  ): string {
    const bankAccount = requisition.creditAccount;
    const expenseCategory = (requisition as any).expenseCategory?.name || 'N/A';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Disbursement Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f0f2f5;">
        <div style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="padding: 32px 32px 24px; text-align: center;">
              <div style="width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 28px;">&#10003;</span>
              </div>
              <h1 style="font-size: 24px; font-weight: 700; color: #1f2937; margin: 0 0 8px;">Disbursement Complete</h1>
              <p style="font-size: 15px; color: #6b7280; margin: 0;">A requisition has been successfully disbursed</p>
            </div>

            <!-- Content -->
            <div style="padding: 0 32px 32px;">
              <!-- Amount Display -->
              <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin: 0 0 4px;">Amount Disbursed</p>
                <p style="font-size: 36px; font-weight: 700; color: #0f172a; margin: 0;"><span style="font-size: 18px; font-weight: 500; color: #64748b;">NGN</span> ${requisition.totalAmount.toLocaleString()}</p>
              </div>

              ${this.generateInfoCard('&#128100;', 'Recipient Details', [
                { label: 'Name', value: submitterName },
                { label: 'Bank', value: bankAccount?.bankName || 'N/A' },
                { label: 'Account Name', value: bankAccount?.accountName || 'N/A' },
                { label: 'Account Number', value: bankAccount?.accountNumber || 'N/A' },
              ])}

              ${this.generateInfoCard('&#128196;', 'Requisition Details', [
                { label: 'Category', value: expenseCategory },
                { label: 'Purpose', value: requisition.eventDescription?.substring(0, 100) || 'N/A' },
                { label: 'Disbursement Ref', value: requisition.disbursementReference || 'N/A' },
                { label: 'Disbursed On', value: requisition.disbursedAt ? new Date(requisition.disbursedAt).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : 'N/A' },
              ])}
            </div>

            <!-- Footer -->
            <div style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 13px; color: #6b7280; margin: 0;">This is an automated notification from the Requisition System</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ============== Email Template Methods ==============

  /**
   * Generate a table row for key-value display in emails
   */
  private generateInfoRow(label: string, value: string, isLast: boolean = false, valueStyle: string = ''): string {
    return `
      <tr>
        <td style="padding: 12px 8px 12px 0; border-bottom: ${isLast ? 'none' : '1px solid #e2e8f0'}; font-size: 14px; color: #6b7280; width: 40%; vertical-align: top;">${label}</td>
        <td style="padding: 12px 0 12px 8px; border-bottom: ${isLast ? 'none' : '1px solid #e2e8f0'}; font-size: 14px; font-weight: 500; color: #1f2937; text-align: right; ${valueStyle}">${value}</td>
      </tr>
    `;
  }

  /**
   * Generate an info card section for emails
   */
  private generateInfoCard(icon: string, title: string, rows: Array<{label: string, value: string, valueStyle?: string}>, cardStyle: string = ''): string {
    const rowsHtml = rows.map((row, index) =>
      this.generateInfoRow(row.label, row.value, index === rows.length - 1, row.valueStyle || '')
    ).join('');

    return `
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px; ${cardStyle}">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
          <tr>
            <td style="font-size: 16px;">${icon}</td>
            <td style="font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; padding-left: 10px;">${title}</td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${rowsHtml}
        </table>
      </div>
    `;
  }

  /**
   * Get the HTML badge for discussion status
   */
  private getDiscussionBadge(status: 'yes' | 'not_required' | 'no' | boolean): string {
    // Handle legacy boolean values
    if (typeof status === 'boolean') {
      return status
        ? '<span style="background: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 12px; font-size: 12px;">✓ Yes</span>'
        : '<span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 12px; font-size: 12px;">✗ No</span>';
    }

    switch (status) {
      case 'yes':
        return '<span style="background: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 12px; font-size: 12px;">✓ Yes</span>';
      case 'not_required':
        return '<span style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Not Required</span>';
      case 'no':
        return '<span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 12px; font-size: 12px;">✗ No</span>';
      default:
        return '<span style="background: #f3f4f6; color: #6b7280; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Unknown</span>';
    }
  }

  /**
   * Generate email-compatible workflow/progress tracker
   */
  private generateWorkflowTracker(currentStep: 1 | 2 | 3 | 4): string {
    const getStepStyle = (stepNum: number) => {
      if (stepNum < currentStep) {
        return { bg: '#10b981', color: '#ffffff', text: '✓', labelColor: '#10b981' };
      } else if (stepNum === currentStep) {
        return { bg: '#6366f1', color: '#ffffff', text: stepNum.toString(), labelColor: '#6366f1' };
      } else {
        return { bg: '#e2e8f0', color: '#9ca3af', text: stepNum.toString(), labelColor: '#9ca3af' };
      }
    };

    const s1 = getStepStyle(1);
    const s2 = getStepStyle(2);
    const s3 = getStepStyle(3);
    const s4 = getStepStyle(4);

    const line1 = currentStep > 1 ? '#10b981' : '#e2e8f0';
    const line2 = currentStep > 2 ? '#10b981' : '#e2e8f0';
    const line3 = currentStep > 3 ? '#10b981' : '#e2e8f0';

    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0; table-layout: fixed;">
        <tr>
          <td width="22%" style="text-align: center; vertical-align: top; padding: 0;">
            <table cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="width: 32px; height: 32px; border-radius: 50%; background-color: ${s1.bg}; color: ${s1.color}; font-size: 14px; font-weight: bold; text-align: center; vertical-align: middle;">${s1.text}</td>
              </tr>
            </table>
            <p style="margin: 8px 0 0 0; font-size: 11px; color: ${s1.labelColor}; font-weight: ${currentStep === 1 ? 'bold' : 'normal'};">Submitted</p>
          </td>
          <td width="11%" style="vertical-align: top; padding-top: 15px;">
            <div style="height: 3px; background-color: ${line1}; border-radius: 2px;"></div>
          </td>
          <td width="22%" style="text-align: center; vertical-align: top; padding: 0;">
            <table cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="width: 32px; height: 32px; border-radius: 50%; background-color: ${s2.bg}; color: ${s2.color}; font-size: 14px; font-weight: bold; text-align: center; vertical-align: middle;">${s2.text}</td>
              </tr>
            </table>
            <p style="margin: 8px 0 0 0; font-size: 11px; color: ${s2.labelColor}; font-weight: ${currentStep === 2 ? 'bold' : 'normal'};">Approved</p>
          </td>
          <td width="11%" style="vertical-align: top; padding-top: 15px;">
            <div style="height: 3px; background-color: ${line2}; border-radius: 2px;"></div>
          </td>
          <td width="22%" style="text-align: center; vertical-align: top; padding: 0;">
            <table cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="width: 32px; height: 32px; border-radius: 50%; background-color: ${s3.bg}; color: ${s3.color}; font-size: 14px; font-weight: bold; text-align: center; vertical-align: middle;">${s3.text}</td>
              </tr>
            </table>
            <p style="margin: 8px 0 0 0; font-size: 11px; color: ${s3.labelColor}; font-weight: ${currentStep === 3 ? 'bold' : 'normal'};">Disbursed</p>
          </td>
          <td width="11%" style="vertical-align: top; padding-top: 15px;">
            <div style="height: 3px; background-color: ${line3}; border-radius: 2px;"></div>
          </td>
          <td width="22%" style="text-align: center; vertical-align: top; padding: 0;">
            <table cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="width: 32px; height: 32px; border-radius: 50%; background-color: ${s4.bg}; color: ${s4.color}; font-size: 14px; font-weight: bold; text-align: center; vertical-align: middle;">${s4.text}</td>
              </tr>
            </table>
            <p style="margin: 8px 0 0 0; font-size: 11px; color: ${s4.labelColor}; font-weight: ${currentStep === 4 ? 'bold' : 'normal'};">Closed</p>
          </td>
        </tr>
      </table>
    `;
  }

  /**
   * Common email styles for consistent branding
   */
  private getEmailStyles(): string {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        line-height: 1.6;
        color: #1a1a2e;
        background-color: #f0f2f5;
        -webkit-font-smoothing: antialiased;
      }
      .email-wrapper {
        max-width: 640px;
        margin: 0 auto;
        padding: 40px 20px;
      }
      .email-container {
        background: #ffffff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      }
      .header {
        padding: 32px 32px 24px;
        text-align: center;
      }
      .header-icon {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
        font-size: 28px;
      }
      .header h1 {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 8px;
        letter-spacing: -0.5px;
      }
      .header p {
        font-size: 15px;
        color: #6b7280;
      }
      .content {
        padding: 0 32px 32px;
      }
      .amount-display {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border-radius: 12px;
        padding: 24px;
        text-align: center;
        margin-bottom: 24px;
        border: 1px solid #e2e8f0;
      }
      .amount-label {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #64748b;
        margin-bottom: 4px;
      }
      .amount-value {
        font-size: 36px;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -1px;
      }
      .amount-currency {
        font-size: 18px;
        font-weight: 500;
        color: #64748b;
      }
      .info-card {
        background: #f8fafc;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
      }
      .info-card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e2e8f0;
      }
      .info-card-header h3 {
        font-size: 14px;
        font-weight: 600;
        color: #374151;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
      }
      .status-pending {
        background: #fef3c7;
        color: #92400e;
      }
      .status-approved {
        background: #d1fae5;
        color: #065f46;
      }
      .status-rejected {
        background: #fee2e2;
        color: #991b1b;
      }
      .cost-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
      }
      .cost-table th {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #6b7280;
        padding: 12px 8px;
        text-align: left;
        border-bottom: 2px solid #e2e8f0;
      }
      .cost-table td {
        font-size: 14px;
        padding: 12px 8px;
        border-bottom: 1px solid #f1f5f9;
        color: #374151;
      }
      .cost-table .total-row td {
        font-weight: 600;
        color: #0f172a;
        border-bottom: none;
        border-top: 2px solid #e2e8f0;
        padding-top: 16px;
      }
      .btn {
        display: inline-block;
        padding: 14px 32px;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 600;
        text-decoration: none;
        text-align: center;
        transition: all 0.2s;
      }
      .btn-primary {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: #ffffff !important;
        box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.4);
      }
      .btn-success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #ffffff !important;
        box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.4);
      }
      .btn-block {
        display: block;
        width: 100%;
      }
      .alert-box {
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 20px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .alert-success {
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
      }
      .alert-error {
        background: #fef2f2;
        border: 1px solid #fecaca;
      }
      .alert-warning {
        background: #fffbeb;
        border: 1px solid #fde68a;
      }
      .alert-icon {
        font-size: 20px;
        flex-shrink: 0;
      }
      .alert-content h4 {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .alert-content p {
        font-size: 14px;
        color: #6b7280;
      }
      .footer {
        padding: 24px 32px;
        background: #f8fafc;
        text-align: center;
        border-top: 1px solid #e2e8f0;
      }
      .footer p {
        font-size: 13px;
        color: #9ca3af;
      }
      .divider {
        height: 1px;
        background: #e2e8f0;
        margin: 24px 0;
      }
    `;
  }

  private generateNewRequisitionEmail(
    requisition: RequisitionDocument,
    requestor: MemberDocument,
  ): string {
    const loginUrl = `${this.frontendUrl}/finance/approvals`;
    const costBreakdownHtml = requisition.costBreakdown
      .map(
        (item) => `
        <tr>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151;">${item.item}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: center;">${item.quantity}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: right;">${item.unitCost.toLocaleString()}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: right; font-weight: 500;">${item.total.toLocaleString()}</td>
        </tr>
      `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Requisition Awaiting Approval</title>
        <style>${this.getEmailStyles()}</style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header">
              <div class="header-icon" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);">
                <span>&#128221;</span>
              </div>
              <h1>New Requisition Request</h1>
              <p>A requisition requires your review and approval</p>
            </div>

            <div class="content">
              <!-- Workflow Tracker -->
              ${this.generateWorkflowTracker(2)}

              <!-- Amount Display -->
              <div class="amount-display">
                <div class="amount-label">Requested Amount</div>
                <div class="amount-value">
                  <span class="amount-currency">NGN</span> ${requisition.totalAmount.toLocaleString()}
                </div>
              </div>

              <!-- Reference Number Badge -->
              ${requisition.referenceNumber ? `
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; border: 1px solid #bfdbfe;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 4px;">Reference Number</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e40af; font-family: monospace; letter-spacing: 2px;">${requisition.referenceNumber}</div>
              </div>
              ` : ''}

              <!-- Requestor Info -->
              ${this.generateInfoCard('&#128100;', 'Requestor Details', [
                { label: 'Name', value: `${requestor.firstName} ${requestor.lastName}` },
                { label: 'Date Needed', value: new Date(requisition.dateNeeded).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) },
                { label: 'Discussed with P.Dams', value: this.getDiscussionBadge(requisition.discussedWithPDams) },
                ...(requisition.lastRequest ? [{ label: 'Last Similar Request', value: requisition.lastRequest }] : []),
              ])}

              <!-- Purpose -->
              <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                  <tr>
                    <td style="font-size: 16px;">&#128196;</td>
                    <td style="font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; padding-left: 10px;">Purpose / Event Description</td>
                  </tr>
                </table>
                <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 0;">${requisition.eventDescription}</p>
              </div>

              <!-- Cost Breakdown -->
              <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                  <tr>
                    <td style="font-size: 16px;">&#128176;</td>
                    <td style="font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; padding-left: 10px;">Cost Breakdown</td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <thead>
                    <tr>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: left; border-bottom: 2px solid #e2e8f0;">Item</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: center; border-bottom: 2px solid #e2e8f0;">Qty</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Unit Cost</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${costBreakdownHtml}
                    <tr>
                      <td colspan="3" style="padding: 16px 8px 8px; text-align: right; font-weight: 600; color: #0f172a; border-top: 2px solid #e2e8f0;">Total Amount</td>
                      <td style="padding: 16px 8px 8px; text-align: right; font-weight: 600; color: #0f172a; border-top: 2px solid #e2e8f0;">NGN ${requisition.totalAmount.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Bank Details -->
              ${this.generateInfoCard('&#127974;', 'Disbursement Account', [
                { label: 'Bank', value: requisition.creditAccount.bankName },
                { label: 'Account Name', value: requisition.creditAccount.accountName },
                { label: 'Account Number', value: requisition.creditAccount.accountNumber, valueStyle: 'font-family: monospace; letter-spacing: 1px;' },
              ])}

              <div class="divider"></div>

              <!-- CTA Button -->
              <a href="${loginUrl}" class="btn btn-primary btn-block">
                Review & Take Action
              </a>
            </div>

            <div class="footer">
              <p>This is an automated notification from the Finance Module</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateApprovalEmail(
    requisition: RequisitionDocument,
    approver: MemberDocument,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Requisition Approved</title>
        <style>${this.getEmailStyles()}</style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);">
              <div class="header-icon" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <span style="color: white;">&#10003;</span>
              </div>
              <h1 style="color: #065f46;">Requisition Approved!</h1>
              <p style="color: #047857;">Great news - your request has been approved</p>
            </div>

            <div class="content">
              <!-- Workflow Tracker -->
              ${this.generateWorkflowTracker(3)}

              <!-- Success Alert -->
              <div class="alert-box alert-success">
                <span class="alert-icon">&#9989;</span>
                <div class="alert-content">
                  <h4 style="color: #065f46;">Approved by ${approver.firstName} ${approver.lastName}</h4>
                  <p>Your requisition is now awaiting disbursement. You'll be notified once the funds are released.</p>
                </div>
              </div>

              ${requisition.referenceNumber ? `
              <!-- Reference Number Badge -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; border: 1px solid #bfdbfe;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 4px;">Reference Number</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e40af; font-family: monospace; letter-spacing: 2px;">${requisition.referenceNumber}</div>
              </div>
              ` : ''}

              ${requisition.approvalNotes ? `
              <div class="info-card" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
                <div class="info-card-header" style="border-bottom-color: #bbf7d0;">
                  <span>&#128172;</span>
                  <h3>Approver's Notes</h3>
                </div>
                <p style="color: #166534; font-size: 14px; font-style: italic;">"${requisition.approvalNotes}"</p>
              </div>
              ` : ''}

              <!-- Amount Display -->
              <div class="amount-display" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-color: #bbf7d0;">
                <div class="amount-label">Approved Amount</div>
                <div class="amount-value" style="color: #166534;">
                  <span class="amount-currency">NGN</span> ${requisition.totalAmount.toLocaleString()}
                </div>
              </div>

              <!-- Details -->
              ${this.generateInfoCard('&#128196;', 'Requisition Details', [
                { label: 'Reference', value: requisition.referenceNumber || 'N/A' },
                { label: 'Purpose', value: `${requisition.eventDescription.substring(0, 50)}${requisition.eventDescription.length > 50 ? '...' : ''}` },
                { label: 'Date Needed', value: new Date(requisition.dateNeeded).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) },
                { label: 'Status', value: '<span style="background: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 12px; font-size: 12px;">✓ Approved</span>' },
              ])}
            </div>

            <div style="padding: 24px 32px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 13px; color: #9ca3af; margin: 0;">You'll receive another notification when funds are disbursed</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateRejectionEmail(
    requisition: RequisitionDocument,
    rejector: MemberDocument,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Requisition Declined</title>
        <style>${this.getEmailStyles()}</style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header" style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);">
              <div class="header-icon" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
                <span style="color: white;">&#10007;</span>
              </div>
              <h1 style="color: #991b1b;">Requisition Declined</h1>
              <p style="color: #b91c1c;">Your request could not be approved at this time</p>
            </div>

            <div class="content">
              ${requisition.referenceNumber ? `
              <!-- Reference Number Badge -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; border: 1px solid #bfdbfe;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 4px;">Reference Number</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e40af; font-family: monospace; letter-spacing: 2px;">${requisition.referenceNumber}</div>
              </div>
              ` : ''}

              <!-- Error Alert -->
              <div class="alert-box alert-error">
                <span class="alert-icon">&#128683;</span>
                <div class="alert-content">
                  <h4 style="color: #991b1b;">Declined by ${rejector.firstName} ${rejector.lastName}</h4>
                  <p>Please review the feedback below and consider resubmitting with the necessary changes.</p>
                </div>
              </div>

              <!-- Reason Box -->
              <div class="info-card" style="background: #fef2f2; border: 1px solid #fecaca;">
                <div class="info-card-header" style="border-bottom-color: #fecaca;">
                  <span>&#128172;</span>
                  <h3>Reason for Decline</h3>
                </div>
                <p style="color: #991b1b; font-size: 14px; line-height: 1.7;">"${requisition.rejectionReason}"</p>
              </div>

              <!-- Original Request Details -->
              ${this.generateInfoCard('&#128196;', 'Original Request', [
                { label: 'Amount Requested', value: `NGN ${requisition.totalAmount.toLocaleString()}` },
                { label: 'Purpose', value: `${requisition.eventDescription.substring(0, 50)}${requisition.eventDescription.length > 50 ? '...' : ''}` },
                { label: 'Status', value: '<span style="background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 12px; font-size: 12px;">✗ Declined</span>' },
              ])}

              <div style="height: 1px; background: #e2e8f0; margin: 24px 0;"></div>

              <div style="text-align: center; padding: 20px 0;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px 0;">
                  Need to make changes? You can submit a new requisition request.
                </p>
                <a href="${this.frontendUrl}/finance/requisitions/new" style="display: inline-block; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; text-decoration: none; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff;">
                  Create New Request
                </a>
              </div>
            </div>

            <div style="padding: 24px 32px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 13px; color: #9ca3af; margin: 0;">If you have questions, please contact the finance team</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateDisbursementRequestEmail(
    requisition: RequisitionDocument,
    approver: MemberDocument,
  ): string {
    const loginUrl = `${this.frontendUrl}/finance/disbursements`;
    const costBreakdownHtml = requisition.costBreakdown
      .map(
        (item) => `
        <tr>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151;">${item.item}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: center;">${item.quantity}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: right;">${item.unitCost.toLocaleString()}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: right; font-weight: 500;">${item.total.toLocaleString()}</td>
        </tr>
      `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Requisition Ready for Disbursement</title>
        <style>${this.getEmailStyles()}</style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header">
              <div class="header-icon" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);">
                <span>&#128179;</span>
              </div>
              <h1>Ready for Disbursement</h1>
              <p>An approved requisition is awaiting fund release</p>
            </div>

            <div class="content">
              <!-- Workflow Tracker -->
              ${this.generateWorkflowTracker(3)}

              ${requisition.referenceNumber ? `
              <!-- Reference Number Badge -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; border: 1px solid #bfdbfe;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 4px;">Reference Number</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e40af; font-family: monospace; letter-spacing: 2px;">${requisition.referenceNumber}</div>
              </div>
              ` : ''}

              <!-- Warning Alert -->
              <div class="alert-box alert-warning">
                <span class="alert-icon">&#9888;&#65039;</span>
                <div class="alert-content">
                  <h4 style="color: #92400e;">Action Required</h4>
                  <p>This requisition has been approved and needs disbursement processing.</p>
                </div>
              </div>

              <!-- Amount Display -->
              <div class="amount-display">
                <div class="amount-label">Amount to Disburse</div>
                <div class="amount-value">
                  <span class="amount-currency">NGN</span> ${requisition.totalAmount.toLocaleString()}
                </div>
              </div>

              <!-- Bank Details - Highlighted -->
              ${this.generateInfoCard('&#127974;', 'Payment Details', [
                { label: 'Bank', value: requisition.creditAccount.bankName, valueStyle: 'font-weight: 600;' },
                { label: 'Account Name', value: requisition.creditAccount.accountName, valueStyle: 'font-weight: 600;' },
                { label: 'Account Number', value: requisition.creditAccount.accountNumber, valueStyle: 'font-family: monospace; font-size: 16px; letter-spacing: 2px; font-weight: 600; color: #1d4ed8;' },
              ], 'background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #3b82f6;')}

              <!-- Cost Breakdown -->
              <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                  <tr>
                    <td style="font-size: 16px;">&#128176;</td>
                    <td style="font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; padding-left: 10px;">Cost Breakdown</td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <thead>
                    <tr>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: left; border-bottom: 2px solid #e2e8f0;">Item</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: center; border-bottom: 2px solid #e2e8f0;">Qty</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Unit Cost</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${costBreakdownHtml}
                    <tr>
                      <td colspan="3" style="padding: 16px 8px 8px; text-align: right; font-weight: 600; color: #0f172a; border-top: 2px solid #e2e8f0;">Total Amount</td>
                      <td style="padding: 16px 8px 8px; text-align: right; font-weight: 600; color: #0f172a; border-top: 2px solid #e2e8f0;">NGN ${requisition.totalAmount.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Request Info -->
              ${this.generateInfoCard('&#128196;', 'Request Information', [
                { label: 'Reference', value: requisition.referenceNumber || 'N/A' },
                { label: 'Purpose', value: `${requisition.eventDescription.substring(0, 40)}${requisition.eventDescription.length > 40 ? '...' : ''}` },
                { label: 'Approved By', value: `${approver.firstName} ${approver.lastName}` },
                { label: 'Date Needed', value: new Date(requisition.dateNeeded).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) },
              ])}

              <div style="height: 1px; background: #e2e8f0; margin: 24px 0;"></div>

              <!-- CTA Button -->
              <a href="${loginUrl}" style="display: block; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; text-decoration: none; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff;">
                Process Disbursement
              </a>
            </div>

            <div style="padding: 24px 32px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 13px; color: #9ca3af; margin: 0;">Please verify account details before processing payment</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateDisbursementConfirmationEmail(
    requisition: RequisitionDocument,
    disburser: MemberDocument,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Funds Disbursed</title>
        <style>${this.getEmailStyles()}</style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);">
              <div class="header-icon" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <span style="color: white;">&#128181;</span>
              </div>
              <h1 style="color: #065f46;">Funds Disbursed!</h1>
              <p style="color: #047857;">Your requisition has been completed</p>
            </div>

            <div class="content">
              <!-- Workflow Tracker - All Complete -->
              ${this.generateWorkflowTracker(4)}

              ${requisition.referenceNumber ? `
              <!-- Reference Number Badge -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; border: 1px solid #bfdbfe;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 4px;">Reference Number</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e40af; font-family: monospace; letter-spacing: 2px;">${requisition.referenceNumber}</div>
              </div>
              ` : ''}

              <!-- Success Alert -->
              <div class="alert-box alert-success">
                <span class="alert-icon">&#127881;</span>
                <div class="alert-content">
                  <h4 style="color: #065f46;">Payment Successful</h4>
                  <p>The funds have been transferred to the specified account.</p>
                </div>
              </div>

              <!-- Amount Display -->
              <div class="amount-display" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-color: #bbf7d0;">
                <div class="amount-label">Amount Disbursed</div>
                <div class="amount-value" style="color: #166534;">
                  <span class="amount-currency">NGN</span> ${requisition.totalAmount.toLocaleString()}
                </div>
              </div>

              <!-- Transaction Details -->
              ${this.generateInfoCard('&#128203;', 'Transaction Details', [
                { label: 'Reference', value: requisition.referenceNumber || 'N/A' },
                { label: 'Disbursed To', value: requisition.creditAccount.accountName },
                { label: 'Bank', value: requisition.creditAccount.bankName },
                { label: 'Account Number', value: requisition.creditAccount.accountNumber, valueStyle: 'font-family: monospace;' },
                { label: 'Processed By', value: `${disburser.firstName} ${disburser.lastName}` },
                { label: 'Date', value: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
              ], 'background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #bbf7d0;')}

              ${requisition.disbursementNotes ? `
              <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                  <tr>
                    <td style="font-size: 16px;">&#128172;</td>
                    <td style="font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; padding-left: 10px;">Notes</td>
                  </tr>
                </table>
                <p style="color: #374151; font-size: 14px; margin: 0;">${requisition.disbursementNotes}</p>
              </div>
              ` : ''}

              <!-- Original Request -->
              ${this.generateInfoCard('&#128196;', 'Original Request', [
                { label: 'Purpose', value: `${requisition.eventDescription.substring(0, 50)}${requisition.eventDescription.length > 50 ? '...' : ''}` },
                { label: 'Status', value: '<span style="background: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 12px; font-size: 12px;">✓ Completed</span>' },
              ])}
            </div>

            <div style="padding: 24px 32px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 13px; color: #9ca3af; margin: 0;">Thank you for using the Finance Module</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ============== Public Requisition Email Templates ==============

  /**
   * Generate approver email with action token buttons
   */
  private generateApproverEmailWithTokens(
    requisition: RequisitionDocument,
    approveToken: string,
    rejectToken: string,
  ): string {
    const approveUrl = `${this.frontendUrl}/requisition-action?token=${approveToken}&action=approve`;
    const rejectUrl = `${this.frontendUrl}/requisition-action?token=${rejectToken}&action=reject`;
    const submitterName = requisition.isPublicSubmission
      ? requisition.submitterName
      : `${(requisition.requestor as any)?.firstName || ''} ${(requisition.requestor as any)?.lastName || ''}`.trim();

    const costBreakdownHtml = requisition.costBreakdown
      .map(
        (item) => `
        <tr>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151;">${item.item}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: center;">${item.quantity}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: right;">${item.unitCost.toLocaleString()}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: right; font-weight: 500;">${item.total.toLocaleString()}</td>
        </tr>
      `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Requisition Awaiting Approval</title>
        <style>${this.getEmailStyles()}</style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header">
              <div class="header-icon" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);">
                <span>&#128221;</span>
              </div>
              <h1>New Requisition Request</h1>
              <p>A requisition requires your review and approval</p>
            </div>

            <div class="content">
              <!-- Workflow Tracker -->
              ${this.generateWorkflowTracker(2)}

              ${requisition.referenceNumber ? `
              <!-- Reference Number Badge -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; border: 1px solid #bfdbfe;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 4px;">Reference Number</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e40af; font-family: monospace; letter-spacing: 2px;">${requisition.referenceNumber}</div>
              </div>
              ` : ''}

              <!-- Amount Display -->
              <div class="amount-display">
                <div class="amount-label">Requested Amount</div>
                <div class="amount-value">
                  <span class="amount-currency">NGN</span> ${requisition.totalAmount.toLocaleString()}
                </div>
              </div>

              <!-- Requestor Info -->
              ${this.generateInfoCard('&#128100;', 'Requestor Details', [
                { label: 'Name', value: submitterName || 'N/A' },
                { label: 'Email', value: requisition.isPublicSubmission ? requisition.submitterEmail || 'N/A' : (requisition.requestor as any)?.email || 'N/A' },
                { label: 'Date Needed', value: new Date(requisition.dateNeeded).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) },
                { label: 'Discussed with P.Dams', value: this.getDiscussionBadge(requisition.discussedWithPDams) },
                ...(requisition.lastRequest ? [{ label: 'Last Similar Request', value: requisition.lastRequest }] : []),
              ])}

              <!-- Purpose -->
              <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                  <tr>
                    <td style="font-size: 16px;">&#128196;</td>
                    <td style="font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; padding-left: 10px;">Purpose / Event Description</td>
                  </tr>
                </table>
                <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 0;">${requisition.eventDescription}</p>
              </div>

              <!-- Cost Breakdown -->
              <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                  <tr>
                    <td style="font-size: 16px;">&#128176;</td>
                    <td style="font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; padding-left: 10px;">Cost Breakdown</td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <thead>
                    <tr>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: left; border-bottom: 2px solid #e2e8f0;">Item</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: center; border-bottom: 2px solid #e2e8f0;">Qty</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Unit Cost</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${costBreakdownHtml}
                    <tr>
                      <td colspan="3" style="padding: 16px 8px 8px; text-align: right; font-weight: 600; color: #0f172a; border-top: 2px solid #e2e8f0;">Total Amount</td>
                      <td style="padding: 16px 8px 8px; text-align: right; font-weight: 600; color: #0f172a; border-top: 2px solid #e2e8f0;">NGN ${requisition.totalAmount.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Bank Details -->
              ${this.generateInfoCard('&#127974;', 'Disbursement Account', [
                { label: 'Bank', value: requisition.creditAccount.bankName },
                { label: 'Account Name', value: requisition.creditAccount.accountName },
                { label: 'Account Number', value: requisition.creditAccount.accountNumber, valueStyle: 'font-family: monospace; letter-spacing: 1px;' },
              ])}

              <div class="divider"></div>

              <!-- Action Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="48%" style="padding-right: 8px;">
                    <a href="${approveUrl}" style="display: block; padding: 16px 24px; border-radius: 10px; font-size: 15px; font-weight: 600; text-decoration: none; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.4);">
                      ✓ Approve
                    </a>
                  </td>
                  <td width="48%" style="padding-left: 8px;">
                    <a href="${rejectUrl}" style="display: block; padding: 16px 24px; border-radius: 10px; font-size: 15px; font-weight: 600; text-decoration: none; text-align: center; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; box-shadow: 0 4px 14px 0 rgba(239, 68, 68, 0.4);">
                      ✗ Reject
                    </a>
                  </td>
                </tr>
              </table>

              <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
                ⏰ These action links expire in 21 days
              </p>
            </div>

            <div class="footer">
              <p>This is an automated notification from the Finance Module</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate info-only email for disbursers (before approval)
   */
  private generateDisburserInfoEmail(requisition: RequisitionDocument): string {
    const submitterName = requisition.isPublicSubmission
      ? requisition.submitterName
      : `${(requisition.requestor as any)?.firstName || ''} ${(requisition.requestor as any)?.lastName || ''}`.trim();

    const costBreakdownHtml = requisition.costBreakdown
      .map(
        (item) => `
        <tr>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151;">${item.item}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: center;">${item.quantity}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: right;">${item.unitCost.toLocaleString()}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: right; font-weight: 500;">${item.total.toLocaleString()}</td>
        </tr>
      `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Requisition Submitted</title>
        <style>${this.getEmailStyles()}</style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header">
              <div class="header-icon" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);">
                <span>&#128221;</span>
              </div>
              <h1>New Requisition Submitted</h1>
              <p>A new requisition has been submitted for approval</p>
            </div>

            <div class="content">
              ${requisition.referenceNumber ? `
              <!-- Reference Number Badge -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; border: 1px solid #bfdbfe;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 4px;">Reference Number</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e40af; font-family: monospace; letter-spacing: 2px;">${requisition.referenceNumber}</div>
              </div>
              ` : ''}

              <!-- Info Alert -->
              <div class="alert-box" style="background: #eff6ff; border: 1px solid #bfdbfe;">
                <span class="alert-icon">&#128712;</span>
                <div class="alert-content">
                  <h4 style="color: #1e40af;">For Your Information</h4>
                  <p style="color: #3b82f6;">This requisition is currently awaiting approval. You will receive an actionable email once it has been approved.</p>
                </div>
              </div>

              <!-- Amount Display -->
              <div class="amount-display">
                <div class="amount-label">Requested Amount</div>
                <div class="amount-value">
                  <span class="amount-currency">NGN</span> ${requisition.totalAmount.toLocaleString()}
                </div>
              </div>

              <!-- Bank Details -->
              ${this.generateInfoCard('&#127974;', 'Payment Details', [
                { label: 'Bank', value: requisition.creditAccount.bankName, valueStyle: 'font-weight: 600;' },
                { label: 'Account Name', value: requisition.creditAccount.accountName, valueStyle: 'font-weight: 600;' },
                { label: 'Account Number', value: requisition.creditAccount.accountNumber, valueStyle: 'font-family: monospace; font-size: 16px; letter-spacing: 2px; font-weight: 600; color: #1d4ed8;' },
              ], 'background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #3b82f6;')}

              <!-- Cost Breakdown -->
              <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                  <tr>
                    <td style="font-size: 16px;">&#128176;</td>
                    <td style="font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; padding-left: 10px;">Cost Breakdown</td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <thead>
                    <tr>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: left; border-bottom: 2px solid #e2e8f0;">Item</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: center; border-bottom: 2px solid #e2e8f0;">Qty</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Unit Cost</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${costBreakdownHtml}
                    <tr>
                      <td colspan="3" style="padding: 16px 8px 8px; text-align: right; font-weight: 600; color: #0f172a; border-top: 2px solid #e2e8f0;">Total Amount</td>
                      <td style="padding: 16px 8px 8px; text-align: right; font-weight: 600; color: #0f172a; border-top: 2px solid #e2e8f0;">NGN ${requisition.totalAmount.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Basic Info -->
              ${this.generateInfoCard('&#128196;', 'Request Summary', [
                { label: 'Reference', value: requisition.referenceNumber || 'N/A' },
                { label: 'Submitted By', value: submitterName || 'N/A' },
                { label: 'Purpose', value: `${requisition.eventDescription.substring(0, 50)}${requisition.eventDescription.length > 50 ? '...' : ''}` },
                { label: 'Date Needed', value: new Date(requisition.dateNeeded).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) },
                { label: 'Status', value: '<span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 12px; font-size: 12px;">⏳ Pending Approval</span>' },
              ])}
            </div>

            <div class="footer">
              <p>You will receive another email when this requisition is ready for disbursement</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate disburser email with action token
   */
  private generateDisburserEmailWithToken(
    requisition: RequisitionDocument,
    disburseToken: string,
  ): string {
    const disburseUrl = `${this.frontendUrl}/requisition-action?token=${disburseToken}&action=disburse`;
    const submitterName = requisition.isPublicSubmission
      ? requisition.submitterName
      : `${(requisition.requestor as any)?.firstName || ''} ${(requisition.requestor as any)?.lastName || ''}`.trim();

    const costBreakdownHtml = requisition.costBreakdown
      .map(
        (item) => `
        <tr>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151;">${item.item}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: center;">${item.quantity}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: right;">${item.unitCost.toLocaleString()}</td>
          <td style="font-size: 14px; padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #374151; text-align: right; font-weight: 500;">${item.total.toLocaleString()}</td>
        </tr>
      `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Requisition Approved - Ready for Disbursement</title>
        <style>${this.getEmailStyles()}</style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);">
              <div class="header-icon" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <span style="color: white;">&#128179;</span>
              </div>
              <h1 style="color: #065f46;">Ready for Disbursement</h1>
              <p style="color: #047857;">This requisition has been approved and is ready for payment</p>
            </div>

            <div class="content">
              <!-- Workflow Tracker -->
              ${this.generateWorkflowTracker(3)}

              ${requisition.referenceNumber ? `
              <!-- Reference Number Badge -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; border: 1px solid #bfdbfe;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 4px;">Reference Number</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e40af; font-family: monospace; letter-spacing: 2px;">${requisition.referenceNumber}</div>
              </div>
              ` : ''}

              <!-- Action Alert -->
              <div class="alert-box alert-warning">
                <span class="alert-icon">⚡</span>
                <div class="alert-content">
                  <h4 style="color: #92400e;">Action Required</h4>
                  <p>Please process the payment and mark as disbursed using the button below.</p>
                </div>
              </div>

              <!-- Amount Display -->
              <div class="amount-display" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #10b981;">
                <div class="amount-label">Amount to Disburse</div>
                <div class="amount-value" style="color: #166534;">
                  <span class="amount-currency">NGN</span> ${requisition.totalAmount.toLocaleString()}
                </div>
              </div>

              <!-- Bank Details - Highlighted -->
              ${this.generateInfoCard('&#127974;', 'Payment Details', [
                { label: 'Bank', value: requisition.creditAccount.bankName, valueStyle: 'font-weight: 600;' },
                { label: 'Account Name', value: requisition.creditAccount.accountName, valueStyle: 'font-weight: 600;' },
                { label: 'Account Number', value: requisition.creditAccount.accountNumber, valueStyle: 'font-family: monospace; font-size: 18px; letter-spacing: 2px; font-weight: 700; color: #1d4ed8;' },
              ], 'background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #3b82f6;')}

              <!-- Cost Breakdown -->
              <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                  <tr>
                    <td style="font-size: 16px;">&#128176;</td>
                    <td style="font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; padding-left: 10px;">Cost Breakdown</td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <thead>
                    <tr>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: left; border-bottom: 2px solid #e2e8f0;">Item</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: center; border-bottom: 2px solid #e2e8f0;">Qty</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Unit Cost</th>
                      <th style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${costBreakdownHtml}
                    <tr>
                      <td colspan="3" style="padding: 16px 8px 8px; text-align: right; font-weight: 600; color: #0f172a; border-top: 2px solid #e2e8f0;">Total Amount</td>
                      <td style="padding: 16px 8px 8px; text-align: right; font-weight: 600; color: #0f172a; border-top: 2px solid #e2e8f0;">NGN ${requisition.totalAmount.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Request Info -->
              ${this.generateInfoCard('&#128196;', 'Request Information', [
                { label: 'Reference', value: requisition.referenceNumber || 'N/A' },
                { label: 'Submitted By', value: submitterName || 'N/A' },
                { label: 'Purpose', value: `${requisition.eventDescription.substring(0, 40)}${requisition.eventDescription.length > 40 ? '...' : ''}` },
                { label: 'Date Needed', value: new Date(requisition.dateNeeded).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) },
              ])}

              <div class="divider"></div>

              <!-- CTA Button -->
              <a href="${disburseUrl}" style="display: block; padding: 18px 32px; border-radius: 10px; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.4);">
                ✓ Mark as Disbursed
              </a>

              <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
                ⏰ This action link expires in 21 days
              </p>
            </div>

            <div class="footer">
              <p>Please verify account details before processing payment</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate approval email for public submitter
   */
  private generatePublicApprovalEmail(
    requisition: RequisitionDocument,
    approverEmail: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Requisition Approved</title>
        <style>${this.getEmailStyles()}</style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);">
              <div class="header-icon" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <span style="color: white;">&#10003;</span>
              </div>
              <h1 style="color: #065f46;">Requisition Approved!</h1>
              <p style="color: #047857;">Great news - your request has been approved</p>
            </div>

            <div class="content">
              <!-- Workflow Tracker -->
              ${this.generateWorkflowTracker(3)}

              ${requisition.referenceNumber ? `
              <!-- Reference Number Badge -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; border: 1px solid #bfdbfe;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 4px;">Reference Number</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e40af; font-family: monospace; letter-spacing: 2px;">${requisition.referenceNumber}</div>
              </div>
              ` : ''}

              <!-- Success Alert -->
              <div class="alert-box alert-success">
                <span class="alert-icon">&#9989;</span>
                <div class="alert-content">
                  <h4 style="color: #065f46;">Approval Confirmed</h4>
                  <p>Your requisition is now awaiting disbursement. You'll be notified once the funds are released.</p>
                </div>
              </div>

              ${requisition.approvalNotes ? `
              <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px;">
                  <tr>
                    <td style="font-size: 16px;">&#128172;</td>
                    <td style="font-size: 14px; font-weight: 600; color: #374151; padding-left: 10px;">Approver's Notes</td>
                  </tr>
                </table>
                <p style="color: #166534; font-size: 14px; font-style: italic; margin: 0;">"${requisition.approvalNotes}"</p>
              </div>
              ` : ''}

              <!-- Amount Display -->
              <div class="amount-display" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-color: #bbf7d0;">
                <div class="amount-label">Approved Amount</div>
                <div class="amount-value" style="color: #166534;">
                  <span class="amount-currency">NGN</span> ${requisition.totalAmount.toLocaleString()}
                </div>
              </div>

              <!-- Details -->
              ${this.generateInfoCard('&#128196;', 'Requisition Details', [
                { label: 'Reference', value: requisition.referenceNumber || 'N/A' },
                { label: 'Purpose', value: `${requisition.eventDescription.substring(0, 50)}${requisition.eventDescription.length > 50 ? '...' : ''}` },
                { label: 'Date Needed', value: new Date(requisition.dateNeeded).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) },
                { label: 'Status', value: '<span style="background: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 12px; font-size: 12px;">✓ Approved</span>' },
              ])}
            </div>

            <div class="footer">
              <p>You'll receive another notification when funds are disbursed</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate rejection email for public submitter
   */
  private generatePublicRejectionEmail(
    requisition: RequisitionDocument,
    reason: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Request Declined</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">

            <!-- Header -->
            <div style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #f3f4f6;">
              <div style="width: 56px; height: 56px; background: #fef2f2; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 24px;">✗</span>
              </div>
              <h1 style="margin: 0 0 4px; font-size: 20px; font-weight: 600; color: #111827;">Request Declined</h1>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Your expense request could not be approved</p>
            </div>

            <!-- Content -->
            <div style="padding: 24px;">

              ${requisition.referenceNumber ? `
              <!-- Reference Number Badge -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; border: 1px solid #bfdbfe;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 4px;">Reference Number</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e40af; font-family: monospace; letter-spacing: 2px;">${requisition.referenceNumber}</div>
              </div>
              ` : ''}

              <!-- Amount -->
              <div style="text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;">Amount Requested</p>
                <p style="margin: 0; font-size: 28px; font-weight: 700; color: #111827;">₦${requisition.totalAmount.toLocaleString()}</p>
              </div>

              <!-- Reason -->
              <div style="background: #fef2f2; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Reason</p>
                <p style="margin: 0; font-size: 14px; color: #7f1d1d; line-height: 1.6;">${reason}</p>
              </div>

              <!-- Details -->
              <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${requisition.referenceNumber ? `
                  <tr>
                    <td style="padding: 8px 8px 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; width: 40%;">Reference</td>
                    <td style="padding: 8px 0 8px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #111827; font-weight: 500; font-family: monospace; text-align: right;">${requisition.referenceNumber}</td>
                  </tr>
                ` : ''}
                  <tr>
                    <td style="padding: 8px 8px 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; width: 40%;">Purpose</td>
                    <td style="padding: 8px 0 8px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #111827; font-weight: 500; text-align: right;">${requisition.eventDescription.length > 30 ? requisition.eventDescription.substring(0, 30) + '...' : requisition.eventDescription}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 8px 8px 0; font-size: 13px; color: #6b7280; width: 40%;">Date Needed</td>
                    <td style="padding: 8px 0 8px 8px; font-size: 13px; color: #111827; font-weight: 500; text-align: right;">${new Date(requisition.dateNeeded).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                </table>
              </div>

              <!-- CTA -->
              <div style="text-align: center;">
                <a href="${this.frontendUrl}/requisition" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                  Submit New Request
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="padding: 16px 24px; background: #f9fafb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Questions? Contact the finance team</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate disbursement email for public submitter
   */
  private generatePublicDisbursementEmail(requisition: RequisitionDocument): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Sent</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">

            <!-- Header -->
            <div style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #f3f4f6;">
              <div style="width: 56px; height: 56px; background: #ecfdf5; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 24px;">✓</span>
              </div>
              <h1 style="margin: 0 0 4px; font-size: 20px; font-weight: 600; color: #111827;">Payment Sent</h1>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Your expense request has been completed</p>
            </div>

            <!-- Content -->
            <div style="padding: 24px;">

              ${requisition.referenceNumber ? `
              <!-- Reference Number Badge -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; border: 1px solid #bfdbfe;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 4px;">Reference Number</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e40af; font-family: monospace; letter-spacing: 2px;">${requisition.referenceNumber}</div>
              </div>
              ` : ''}

              <!-- Amount -->
              <div style="text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;">Amount Disbursed</p>
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #059669;">₦${requisition.totalAmount.toLocaleString()}</p>
              </div>

              <!-- Bank Details -->
              <div style="background: #ecfdf5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px; font-size: 12px; font-weight: 600; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px;">Paid To</p>
                <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #111827;">${requisition.creditAccount.accountName}</p>
                <p style="margin: 0 0 4px; font-size: 14px; color: #374151;">${requisition.creditAccount.bankName}</p>
                <p style="margin: 0; font-size: 16px; font-family: monospace; font-weight: 600; color: #065f46;">${requisition.creditAccount.accountNumber}</p>
              </div>

              <!-- Details -->
              <div style="background: #f9fafb; border-radius: 12px; padding: 16px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${requisition.referenceNumber ? `
                  <tr>
                    <td style="padding: 8px 8px 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; width: 40%;">Reference</td>
                    <td style="padding: 8px 0 8px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #111827; font-weight: 500; font-family: monospace; text-align: right;">${requisition.referenceNumber}</td>
                  </tr>
                ` : ''}
                  <tr>
                    <td style="padding: 8px 8px 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; width: 40%;">Purpose</td>
                    <td style="padding: 8px 0 8px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #111827; font-weight: 500; text-align: right;">${requisition.eventDescription.length > 25 ? requisition.eventDescription.substring(0, 25) + '...' : requisition.eventDescription}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 8px 8px 0; font-size: 13px; color: #6b7280; width: 40%;">Date</td>
                    <td style="padding: 8px 0 8px 8px; font-size: 13px; color: #111827; font-weight: 500; text-align: right;">${new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                </table>
              </div>
            </div>

            <!-- Footer -->
            <div style="padding: 16px 24px; background: #f9fafb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Thank you for using the Finance Module</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Notify requestor of successful submission
   * Non-blocking: queues email for async delivery
   */
  private async notifyRequestorOfSubmission(
    requisition: RequisitionDocument,
    requestor: MemberDocument,
  ): Promise<void> {
    try {
      if (!requestor?.email) return;

      const html = this.generateSubmissionConfirmationEmail(requisition);
      const subject = `Requisition Submitted - ${requisition.referenceNumber}`;

      this.queueService.queueRequestorSubmissionNotification(
        requisition._id.toString(),
        html,
        subject,
        [{ email: requestor.email, name: `${requestor.firstName || ''} ${requestor.lastName || ''}`.trim() }],
      );
    } catch (error) {
      console.error('Failed to queue submission confirmation to requestor:', error);
    }
  }

  /**
   * Notify public submitter of successful submission
   */
  private async notifyPublicSubmitterOfSubmission(
    requisition: RequisitionDocument,
  ): Promise<void> {
    try {
      const email = requisition.submitterEmail;
      if (!email) return;

      const html = this.generateSubmissionConfirmationEmail(requisition);
      const subject = `Requisition Submitted - ${requisition.referenceNumber}`;

      this.queueService.queueRequestorSubmissionNotification(
        requisition._id.toString(),
        html,
        subject,
        [{ email, name: requisition.submitterName || '' }],
      );
    } catch (error) {
      console.error('Failed to queue submission confirmation to public submitter:', error);
    }
  }

  /**
   * Notify the approver when disbursement is completed
   */
  private async notifyApproverOfDisbursement(
    requisition: RequisitionDocument,
    disburser: MemberDocument,
  ): Promise<void> {
    try {
      if (!requisition.approvedBy) return;
      const approver = await this.memberModel
        .findById(requisition.approvedBy)
        .select('firstName lastName email');
      if (!approver?.email) return;

      const html = this.generateApproverDisbursementNotificationEmail(requisition, disburser);
      const subject = `Requisition Disbursed - ${requisition.totalAmount.toLocaleString()} NGN`;

      this.queueService.queueApproverDisbursementNotification(
        requisition._id.toString(),
        html,
        subject,
        [{ email: approver.email, name: `${approver.firstName || ''} ${approver.lastName || ''}`.trim() }],
      );
    } catch (error) {
      console.error('Failed to queue disbursement notification to approver:', error);
    }
  }

  /**
   * Notify the approver when disbursement is completed (public flow)
   * Finds the approver via used action token
   */
  private async notifyApproverOfDisbursementPublic(
    requisition: RequisitionDocument,
  ): Promise<void> {
    try {
      const approveToken = await this.actionTokenService.findUsedApprovalToken(
        requisition._id,
      );
      if (!approveToken?.recipientEmail) return;

      const html = this.generateApproverDisbursementNotificationEmail(requisition, null);
      const subject = `Requisition Disbursed - ${requisition.totalAmount.toLocaleString()} NGN`;

      this.queueService.queueApproverDisbursementNotification(
        requisition._id.toString(),
        html,
        subject,
        [{ email: approveToken.recipientEmail }],
      );
    } catch (error) {
      console.error('Failed to queue disbursement notification to approver (public):', error);
    }
  }

  /**
   * Notify the disburser that disbursement is completed (confirmation)
   */
  private async notifyDisburserOfCompletion(
    requisition: RequisitionDocument,
    disburser: MemberDocument,
  ): Promise<void> {
    try {
      if (!disburser?.email) return;

      const html = this.generateDisburserCompletionEmail(requisition);
      const subject = `Disbursement Completed - ${requisition.totalAmount.toLocaleString()} NGN`;

      this.queueService.queueDisburserCompletionNotification(
        requisition._id.toString(),
        html,
        subject,
        [{ email: disburser.email, name: `${disburser.firstName || ''} ${disburser.lastName || ''}`.trim() }],
      );
    } catch (error) {
      console.error('Failed to queue disbursement completion to disburser:', error);
    }
  }

  /**
   * Notify the disburser that disbursement is completed (public flow)
   */
  private async notifyDisburserOfCompletionPublic(
    requisition: RequisitionDocument,
    disburserEmail: string,
  ): Promise<void> {
    try {
      if (!disburserEmail) return;

      const html = this.generateDisburserCompletionEmail(requisition);
      const subject = `Disbursement Completed - ${requisition.totalAmount.toLocaleString()} NGN`;

      this.queueService.queueDisburserCompletionNotification(
        requisition._id.toString(),
        html,
        subject,
        [{ email: disburserEmail }],
      );
    } catch (error) {
      console.error('Failed to queue disbursement completion to disburser (public):', error);
    }
  }

  /**
   * Generate submission confirmation email for requestor
   */
  private generateSubmissionConfirmationEmail(requisition: RequisitionDocument): string {
    const expenseCategory = (requisition as any).expenseCategory?.name || 'N/A';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Requisition Submitted</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f0f2f5;">
        <div style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="padding: 32px 32px 24px; text-align: center;">
              <div style="width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 28px;">&#128203;</span>
              </div>
              <h1 style="font-size: 24px; font-weight: 700; color: #1f2937; margin: 0 0 8px;">Requisition Submitted</h1>
              <p style="font-size: 15px; color: #6b7280; margin: 0;">Your requisition has been submitted for approval</p>
            </div>

            <!-- Content -->
            <div style="padding: 0 32px 32px;">
              ${this.generateWorkflowTracker(1)}

              <!-- Amount Display -->
              <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                <p style="font-size: 13px; color: #6b7280; margin: 0 0 4px;">Total Amount</p>
                <p style="font-size: 32px; font-weight: 800; color: #1f2937; margin: 0;">&#8358;${requisition.totalAmount.toLocaleString()}</p>
              </div>

              ${this.generateInfoCard('&#128203;', 'Requisition Details', [
                { label: 'Reference', value: requisition.referenceNumber || 'N/A' },
                { label: 'Category', value: expenseCategory },
                { label: 'Description', value: requisition.eventDescription.substring(0, 100) },
                { label: 'Date Needed', value: new Date(requisition.dateNeeded).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) },
              ])}

              <!-- What's Next -->
              <div style="background: #eff6ff; border-radius: 12px; padding: 16px; margin-top: 20px;">
                <p style="font-size: 14px; font-weight: 600; color: #1e40af; margin: 0 0 8px;">What happens next?</p>
                <p style="font-size: 13px; color: #3b82f6; margin: 0;">Your requisition is now awaiting approval. You will be notified once it has been reviewed and disbursed.</p>
              </div>
            </div>

            <!-- Footer -->
            <div style="padding: 16px 24px; background: #f9fafb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Thank you for using the Finance Module</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate email notifying the approver that disbursement is complete
   */
  private generateApproverDisbursementNotificationEmail(
    requisition: RequisitionDocument,
    disburser: MemberDocument | null,
  ): string {
    const expenseCategory = (requisition as any).expenseCategory?.name || 'N/A';
    const disburserName = disburser
      ? `${disburser.firstName || ''} ${disburser.lastName || ''}`.trim()
      : 'Finance Team';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Requisition Disbursed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f0f2f5;">
        <div style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="padding: 32px 32px 24px; text-align: center;">
              <div style="width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 28px;">&#10003;</span>
              </div>
              <h1 style="font-size: 24px; font-weight: 700; color: #1f2937; margin: 0 0 8px;">Requisition Disbursed</h1>
              <p style="font-size: 15px; color: #6b7280; margin: 0;">A requisition you approved has been disbursed</p>
            </div>

            <!-- Content -->
            <div style="padding: 0 32px 32px;">
              ${this.generateWorkflowTracker(3)}

              <!-- Amount Display -->
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid #bbf7d0;">
                <p style="font-size: 13px; color: #16a34a; margin: 0 0 4px;">Amount Disbursed</p>
                <p style="font-size: 32px; font-weight: 800; color: #15803d; margin: 0;">&#8358;${requisition.totalAmount.toLocaleString()}</p>
              </div>

              ${this.generateInfoCard('&#128203;', 'Requisition Details', [
                { label: 'Reference', value: requisition.referenceNumber || 'N/A' },
                { label: 'Category', value: expenseCategory },
                { label: 'Description', value: requisition.eventDescription.substring(0, 100) },
                { label: 'Disbursed By', value: disburserName },
                { label: 'Disbursed At', value: requisition.disbursedAt ? new Date(requisition.disbursedAt).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A' },
              ])}
            </div>

            <!-- Footer -->
            <div style="padding: 16px 24px; background: #f9fafb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Thank you for using the Finance Module</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate email confirming disbursement completion to the disburser
   */
  private generateDisburserCompletionEmail(requisition: RequisitionDocument): string {
    const expenseCategory = (requisition as any).expenseCategory?.name || 'N/A';
    const bankAccount = requisition.creditAccount;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Disbursement Completed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f0f2f5;">
        <div style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="padding: 32px 32px 24px; text-align: center;">
              <div style="width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 28px;">&#10003;</span>
              </div>
              <h1 style="font-size: 24px; font-weight: 700; color: #1f2937; margin: 0 0 8px;">Disbursement Completed</h1>
              <p style="font-size: 15px; color: #6b7280; margin: 0;">This is your confirmation record</p>
            </div>

            <!-- Content -->
            <div style="padding: 0 32px 32px;">
              ${this.generateWorkflowTracker(3)}

              <!-- Amount Display -->
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid #bbf7d0;">
                <p style="font-size: 13px; color: #16a34a; margin: 0 0 4px;">Amount Disbursed</p>
                <p style="font-size: 32px; font-weight: 800; color: #15803d; margin: 0;">&#8358;${requisition.totalAmount.toLocaleString()}</p>
              </div>

              ${this.generateInfoCard('&#128203;', 'Requisition Details', [
                { label: 'Reference', value: requisition.referenceNumber || 'N/A' },
                { label: 'Category', value: expenseCategory },
                { label: 'Description', value: requisition.eventDescription.substring(0, 100) },
              ])}

              ${bankAccount ? this.generateInfoCard('&#127974;', 'Payment Details', [
                { label: 'Bank', value: bankAccount.bankName || 'N/A' },
                { label: 'Account Name', value: bankAccount.accountName || 'N/A' },
                { label: 'Account Number', value: bankAccount.accountNumber || 'N/A' },
              ]) : ''}
            </div>

            <!-- Footer -->
            <div style="padding: 16px 24px; background: #f9fafb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Thank you for using the Finance Module</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
