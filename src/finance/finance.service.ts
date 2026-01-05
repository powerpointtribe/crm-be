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
import { MembershipStatus } from '../common/enums/member-status.enum';

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

  // Allowed membership statuses for creating requisitions
  private readonly allowedMembershipStatuses = [
    MembershipStatus.LXL,
    MembershipStatus.DIRECTOR,
    MembershipStatus.PASTOR,
    MembershipStatus.CAMPUS_PASTOR,
    MembershipStatus.SENIOR_PASTOR,
  ];

  /**
   * Create a new requisition
   */
  async create(
    dto: CreateRequisitionDto,
    user: MemberDocument,
  ): Promise<Requisition> {
    // Check if user has LXL or higher status
    if (!this.allowedMembershipStatuses.includes(user.membershipStatus as MembershipStatus)) {
      throw new ForbiddenException(
        'Only LXL members and above can create requisitions',
      );
    }

    // Calculate total amount from cost breakdown
    const totalAmount = dto.costBreakdown.reduce(
      (sum, item) => sum + item.total,
      0,
    );

    const requisition = new this.requisitionModel({
      ...dto,
      totalAmount,
      branch: user.branch,
      requestor: user._id,
      createdBy: user._id,
      status: dto.isDraft ? RequisitionStatus.DRAFT : RequisitionStatus.SUBMITTED,
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
      filter.branch = user.branch;
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
    return this.findAll(
      { ...query, status: RequisitionStatus.PENDING_APPROVAL },
      user,
    );
  }

  /**
   * Find requisitions pending disbursement
   */
  async findPendingDisbursement(
    query: RequisitionQueryDto,
    user: MemberDocument,
  ): Promise<{ data: Requisition[]; total: number; page: number; limit: number }> {
    return this.findAll(
      { ...query, status: RequisitionStatus.PENDING_DISBURSEMENT },
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

    requisition.status = RequisitionStatus.SUBMITTED;
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

    if (
      requisition.status !== RequisitionStatus.SUBMITTED &&
      requisition.status !== RequisitionStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException(
        'Only submitted requisitions can be approved',
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

    // Update status to pending disbursement
    requisition.status = RequisitionStatus.PENDING_DISBURSEMENT;
    await requisition.save();

    return this.findOne(id);
  }

  /**
   * Reject a requisition
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

    if (
      requisition.status !== RequisitionStatus.SUBMITTED &&
      requisition.status !== RequisitionStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException(
        'Only submitted requisitions can be rejected',
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

    if (
      requisition.status !== RequisitionStatus.APPROVED &&
      requisition.status !== RequisitionStatus.PENDING_DISBURSEMENT
    ) {
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
      byStatus,
      byCategory,
      totalAmountRequested,
      totalAmountDisbursed,
    ] = await Promise.all([
      this.requisitionModel.countDocuments(filter),
      this.requisitionModel.countDocuments({
        ...filter,
        status: { $in: [RequisitionStatus.SUBMITTED, RequisitionStatus.PENDING_APPROVAL] },
      }),
      this.requisitionModel.countDocuments({
        ...filter,
        status: RequisitionStatus.PENDING_DISBURSEMENT,
      }),
      this.requisitionModel.countDocuments({
        ...filter,
        status: RequisitionStatus.DISBURSED,
      }),
      this.requisitionModel.countDocuments({
        ...filter,
        status: RequisitionStatus.REJECTED,
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

  private generateNewRequisitionEmail(
    requisition: RequisitionDocument,
    requestor: MemberDocument,
  ): string {
    const loginUrl = `${this.frontendUrl}/finance/approvals`;
    const costBreakdownHtml = requisition.costBreakdown
      .map(
        (item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.item}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">NGN ${item.unitCost.toLocaleString()}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">NGN ${item.total.toLocaleString()}</td>
        </tr>
      `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .details-card { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f0f0f0; padding: 10px; text-align: left; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">New Requisition Requires Your Approval</h1>
          </div>
          <div class="content">
            <p>A new requisition has been submitted and requires your approval.</p>

            <div class="details-card">
              <h3 style="margin-top: 0;">Requisition Details</h3>
              <table>
                <tr><td><strong>Requestor:</strong></td><td>${requestor.firstName} ${requestor.lastName}</td></tr>
                <tr><td><strong>Amount:</strong></td><td>NGN ${requisition.totalAmount.toLocaleString()}</td></tr>
                <tr><td><strong>Date Needed:</strong></td><td>${new Date(requisition.dateNeeded).toLocaleDateString()}</td></tr>
                <tr><td><strong>Discussed with P.Dams:</strong></td><td>${requisition.discussedWithPDams ? 'Yes' : 'No'}</td></tr>
              </table>

              <h4>Event Description</h4>
              <p>${requisition.eventDescription}</p>

              <h4>Cost Breakdown</h4>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Unit Cost</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${costBreakdownHtml}
                  <tr style="font-weight: bold;">
                    <td colspan="3" style="padding: 10px; text-align: right;">Total:</td>
                    <td style="padding: 10px; text-align: right;">NGN ${requisition.totalAmount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <h4>Bank Account for Disbursement</h4>
              <table>
                <tr><td><strong>Bank:</strong></td><td>${requisition.creditAccount.bankName}</td></tr>
                <tr><td><strong>Account Name:</strong></td><td>${requisition.creditAccount.accountName}</td></tr>
                <tr><td><strong>Account Number:</strong></td><td>${requisition.creditAccount.accountNumber}</td></tr>
              </table>
            </div>

            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">Login to Review & Approve</a>
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
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .success-box { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Your Requisition Has Been Approved!</h1>
          </div>
          <div class="content">
            <div class="success-box">
              <p><strong>Approved by:</strong> ${approver.firstName} ${approver.lastName}</p>
              ${requisition.approvalNotes ? `<p><strong>Notes:</strong> ${requisition.approvalNotes}</p>` : ''}
              <p>Your requisition for <strong>NGN ${requisition.totalAmount.toLocaleString()}</strong> has been approved and is now pending disbursement.</p>
            </div>

            <h4>Requisition Details</h4>
            <p><strong>Event:</strong> ${requisition.eventDescription}</p>
            <p><strong>Amount:</strong> NGN ${requisition.totalAmount.toLocaleString()}</p>
            <p><strong>Date Needed:</strong> ${new Date(requisition.dateNeeded).toLocaleDateString()}</p>

            <p style="margin-top: 20px;">You will receive another notification once the funds have been disbursed.</p>
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
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .error-box { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Your Requisition Has Been Declined</h1>
          </div>
          <div class="content">
            <div class="error-box">
              <p><strong>Declined by:</strong> ${rejector.firstName} ${rejector.lastName}</p>
              <p><strong>Reason:</strong> ${requisition.rejectionReason}</p>
            </div>

            <h4>Requisition Details</h4>
            <p><strong>Event:</strong> ${requisition.eventDescription}</p>
            <p><strong>Amount:</strong> NGN ${requisition.totalAmount.toLocaleString()}</p>

            <p style="margin-top: 20px;">Please review the feedback and resubmit if necessary.</p>
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
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .details-card { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Requisition Ready for Disbursement</h1>
          </div>
          <div class="content">
            <p>A requisition has been approved and is ready for disbursement.</p>

            <div class="details-card">
              <h3 style="margin-top: 0;">Payment Details</h3>
              <table>
                <tr><td><strong>Amount:</strong></td><td>NGN ${requisition.totalAmount.toLocaleString()}</td></tr>
                <tr><td><strong>Bank:</strong></td><td>${requisition.creditAccount.bankName}</td></tr>
                <tr><td><strong>Account Name:</strong></td><td>${requisition.creditAccount.accountName}</td></tr>
                <tr><td><strong>Account Number:</strong></td><td>${requisition.creditAccount.accountNumber}</td></tr>
              </table>

              <h4 style="margin-top: 15px;">Requisition Info</h4>
              <p><strong>Event:</strong> ${requisition.eventDescription}</p>
              <p><strong>Approved by:</strong> ${approver.firstName} ${approver.lastName}</p>
              <p><strong>Date Needed:</strong> ${new Date(requisition.dateNeeded).toLocaleDateString()}</p>
            </div>

            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">Process Disbursement</a>
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
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .success-box { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Funds Have Been Disbursed!</h1>
          </div>
          <div class="content">
            <div class="success-box">
              <p>Your requisition has been successfully disbursed.</p>
              <p><strong>Reference Number:</strong> ${requisition.disbursementReference}</p>
              <p><strong>Amount:</strong> NGN ${requisition.totalAmount.toLocaleString()}</p>
              <p><strong>Disbursed to:</strong> ${requisition.creditAccount.accountName} (${requisition.creditAccount.bankName})</p>
              ${requisition.disbursementNotes ? `<p><strong>Notes:</strong> ${requisition.disbursementNotes}</p>` : ''}
            </div>

            <h4>Requisition Details</h4>
            <p><strong>Event:</strong> ${requisition.eventDescription}</p>
            <p><strong>Disbursed by:</strong> ${disburser.firstName} ${disburser.lastName}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
