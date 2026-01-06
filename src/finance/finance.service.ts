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
import { MemberDocument } from '../members/schemas/member.schema';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionDto } from './dto/update-requisition.dto';
import { ApproveRequisitionDto } from './dto/approve-requisition.dto';
import { RejectRequisitionDto } from './dto/reject-requisition.dto';
import { DisburseRequisitionDto } from './dto/disburse-requisition.dto';
import { RequisitionQueryDto } from './dto/requisition-query.dto';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { EmailProvider } from '../notifications/providers/email.provider';
import { FinancePermission } from './permissions';

@Injectable()
export class FinanceService {
  private frontendUrl: string;

  constructor(
    @InjectModel(Requisition.name)
    private requisitionModel: Model<RequisitionDocument>,
    private userPermissionsService: UserPermissionsService,
    private emailProvider: EmailProvider,
    private configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
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

    const requisition = new this.requisitionModel({
      ...dto,
      totalAmount,
      branch: branchId,
      requestor: user._id,
      createdBy: user._id,
      status: dto.isDraft ? RequisitionStatus.DRAFT : RequisitionStatus.PENDING_APPROVAL,
      submittedAt: dto.isDraft ? undefined : new Date(),
    });

    const savedRequisition = await requisition.save();

    // If not a draft, send notification to approvers
    if (!dto.isDraft) {
      await this.notifyApprovers(savedRequisition, user);
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

    // Only the owner can update
    if (requisition.requestor.toString() !== user._id.toString()) {
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

    if (requisition.requestor.toString() !== user._id.toString()) {
      throw new ForbiddenException('You can only submit your own requisitions');
    }

    requisition.status = RequisitionStatus.PENDING_APPROVAL;
    requisition.submittedAt = new Date();
    requisition.updatedBy = user._id;
    requisition.updatedAt = new Date();

    await requisition.save();

    // Notify approvers
    await this.notifyApprovers(requisition, user);

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

    // Notify requestor of approval
    await this.notifyRequestorOfApproval(requisition, user);

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
    requisition.disbursementReference = dto.disbursementReference;
    requisition.disbursementNotes = dto.notes;
    requisition.updatedBy = user._id;
    requisition.updatedAt = new Date();

    await requisition.save();

    // Notify requestor of disbursement
    await this.notifyRequestorOfDisbursement(requisition, user);

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

    if (requisition.requestor.toString() !== user._id.toString()) {
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

  // ============== Email Notification Methods ==============

  /**
   * Notify users with approve permission about new requisition
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

      const approverEmails = approvers
        .filter((a) => a.email)
        .map((a) => a.email);

      const html = this.generateNewRequisitionEmail(requisition, requestor);

      await this.emailProvider.sendEmail({
        to: approverEmails,
        subject: `New Requisition Requires Approval - ${requisition.eventDescription.substring(0, 50)}`,
        html,
      });
    } catch (error) {
      console.error('Failed to notify approvers:', error);
    }
  }

  /**
   * Notify requestor of approval
   */
  private async notifyRequestorOfApproval(
    requisition: RequisitionDocument,
    approver: MemberDocument,
  ): Promise<void> {
    try {
      const requestor = requisition.requestor as any;
      if (!requestor?.email) return;

      const html = this.generateApprovalEmail(requisition, approver);

      await this.emailProvider.sendEmail({
        to: requestor.email,
        subject: `Your Requisition Has Been Approved`,
        html,
      });
    } catch (error) {
      console.error('Failed to notify requestor of approval:', error);
    }
  }

  /**
   * Notify users with disburse permission
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

      const disburserEmails = disbursers
        .filter((d) => d.email)
        .map((d) => d.email);

      const html = this.generateDisbursementRequestEmail(requisition, approver);

      await this.emailProvider.sendEmail({
        to: disburserEmails,
        subject: `Requisition Ready for Disbursement - ${requisition.totalAmount.toLocaleString()} NGN`,
        html,
      });
    } catch (error) {
      console.error('Failed to notify disbursers:', error);
    }
  }

  /**
   * Notify requestor of rejection
   */
  private async notifyRequestorOfRejection(
    requisition: RequisitionDocument,
    rejector: MemberDocument,
  ): Promise<void> {
    try {
      const requestor = requisition.requestor as any;
      if (!requestor?.email) return;

      const html = this.generateRejectionEmail(requisition, rejector);

      await this.emailProvider.sendEmail({
        to: requestor.email,
        subject: `Your Requisition Has Been Declined`,
        html,
      });
    } catch (error) {
      console.error('Failed to notify requestor of rejection:', error);
    }
  }

  /**
   * Notify requestor of disbursement
   */
  private async notifyRequestorOfDisbursement(
    requisition: RequisitionDocument,
    disburser: MemberDocument,
  ): Promise<void> {
    try {
      const requestor = requisition.requestor as any;
      if (!requestor?.email) return;

      const html = this.generateDisbursementConfirmationEmail(requisition, disburser);

      await this.emailProvider.sendEmail({
        to: requestor.email,
        subject: `Funds Disbursed - ${requisition.totalAmount.toLocaleString()} NGN`,
        html,
      });
    } catch (error) {
      console.error('Failed to notify requestor of disbursement:', error);
    }
  }

  // ============== Email Template Methods ==============

  /**
   * Generate a table row for key-value display in emails
   */
  private generateInfoRow(label: string, value: string, isLast: boolean = false, valueStyle: string = ''): string {
    return `
      <tr>
        <td style="padding: 12px 0; border-bottom: ${isLast ? 'none' : '1px solid #e2e8f0'}; font-size: 14px; color: #6b7280; width: 40%;">${label}</td>
        <td style="padding: 12px 0; border-bottom: ${isLast ? 'none' : '1px solid #e2e8f0'}; font-size: 14px; font-weight: 500; color: #1f2937; text-align: right; ${valueStyle}">${value}</td>
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

              <!-- Requestor Info -->
              ${this.generateInfoCard('&#128100;', 'Requestor Details', [
                { label: 'Name', value: `${requestor.firstName} ${requestor.lastName}` },
                { label: 'Date Needed', value: new Date(requisition.dateNeeded).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) },
                { label: 'Discussed with P.Dams', value: requisition.discussedWithPDams ? '<span style="background: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 12px; font-size: 12px;">✓ Yes</span>' : '<span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 12px; font-size: 12px;">✗ No</span>' },
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

              <!-- Request Info -->
              ${this.generateInfoCard('&#128196;', 'Request Information', [
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
}
