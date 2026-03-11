import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import {
  UserInvitation,
  UserInvitationDocument,
  InvitationStatus,
} from './schemas/user-invitation.schema';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { CreateOperationalInvitationDto } from './dto/create-operational-invitation.dto';
import { RevokeInvitationDto } from './dto/revoke-invitation.dto';
import { UpdateInvitationRoleDto } from './dto/update-invitation-role.dto';
import { InvitationQueryDto } from './dto/invitation-query.dto';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { QueueService } from '../queue/queue.service';
import { AccountType } from '../common/enums/account-type.enum';

@Injectable()
export class UserInvitationsService {
  constructor(
    @InjectModel(UserInvitation.name)
    private invitationModel: Model<UserInvitationDocument>,
    @InjectModel(Member.name)
    private memberModel: Model<MemberDocument>,
    @InjectModel(Role.name)
    private roleModel: Model<RoleDocument>,
    @InjectModel(Branch.name)
    private branchModel: Model<BranchDocument>,
    private queueService: QueueService,
  ) {}

  /**
   * Generate a random temporary password
   */
  private generateTemporaryPassword(): string {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /**
   * Create a new user invitation
   */
  async create(
    createInvitationDto: CreateInvitationDto,
    invitedById: string,
  ): Promise<UserInvitation> {
    // Validate member exists
    if (!Types.ObjectId.isValid(createInvitationDto.memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    const member = await this.memberModel.findById(createInvitationDto.memberId);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Check if member already has platform access (isActive = true and has a role)
    if (member.isActive && member.role) {
      throw new ConflictException('Member already has platform access');
    }

    // Validate role exists
    if (!Types.ObjectId.isValid(createInvitationDto.roleId)) {
      throw new BadRequestException('Invalid role ID');
    }

    const role = await this.roleModel.findById(createInvitationDto.roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (!role.isActive) {
      throw new BadRequestException('Cannot assign inactive role');
    }

    // Validate branch exists
    if (!Types.ObjectId.isValid(createInvitationDto.branchId)) {
      throw new BadRequestException('Invalid branch ID');
    }

    const branch = await this.branchModel.findById(createInvitationDto.branchId);
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (!branch.isActive) {
      throw new BadRequestException('Cannot assign to inactive branch');
    }

    // Check for existing pending invitation for this member
    const existingInvitation = await this.invitationModel.findOne({
      member: createInvitationDto.memberId,
      status: InvitationStatus.PENDING,
    });

    if (existingInvitation) {
      throw new ConflictException(
        'Member already has a pending invitation. Please revoke it first or resend the existing invitation.',
      );
    }

    // Generate temporary password
    const temporaryPassword = this.generateTemporaryPassword();

    // Hash the temporary password before saving
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Create invitation with 7-day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Set the member's password using findByIdAndUpdate to avoid full document validation
    // Also set branch if not already set (for legacy members)
    // Set mustChangePassword to force password change on first login
    await this.memberModel.findByIdAndUpdate(
      createInvitationDto.memberId,
      {
        $set: {
          password: hashedPassword,
          isActive: true,
          mustChangePassword: true,
          ...(member.branch ? {} : { branch: createInvitationDto.branchId }),
        },
      },
      { runValidators: false },
    );

    const invitation = new this.invitationModel({
      member: new Types.ObjectId(createInvitationDto.memberId),
      role: new Types.ObjectId(createInvitationDto.roleId),
      branch: new Types.ObjectId(createInvitationDto.branchId),
      assignedDistricts: (createInvitationDto.assignedDistricts || []).map(id => new Types.ObjectId(id)),
      temporaryPassword: hashedPassword,
      status: InvitationStatus.PENDING,
      invitedBy: new Types.ObjectId(invitedById),
      expiresAt,
      notes: createInvitationDto.notes,
    });

    await invitation.save();

    // Queue invitation email for async sending (non-blocking)
    try {
      await this.queueService.addUserInvitationEmailJob({
        type: 'user_invitation',
        invitationId: invitation._id.toString(),
        memberEmail: member.email,
        memberFirstName: member.firstName,
        memberLastName: member.lastName,
        roleDisplayName: role.displayName || role.name,
        temporaryPassword,
        metadata: {
          invitedById,
          notes: createInvitationDto.notes,
        },
      });
    } catch (error) {
      console.error('Failed to queue invitation email:', error);
      // Don't fail the invitation creation if queueing fails
    }

    return invitation.populate(['member', 'role', 'branch', 'invitedBy']);
  }

  /**
   * Create an operational user and send invitation in one step.
   * Creates a minimal Member record (accountType: 'operational') and an invitation.
   */
  async createOperationalUser(
    dto: CreateOperationalInvitationDto,
    invitedById: string,
  ): Promise<UserInvitation> {
    // 1. Check email uniqueness
    const existingMember = await this.memberModel.findOne({
      email: dto.email.toLowerCase().trim(),
    });
    if (existingMember) {
      throw new ConflictException('A user with this email already exists');
    }

    // 2. Validate role exists and is active
    if (!Types.ObjectId.isValid(dto.roleId)) {
      throw new BadRequestException('Invalid role ID');
    }
    const role = await this.roleModel.findById(dto.roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (!role.isActive) {
      throw new BadRequestException('Cannot assign inactive role');
    }

    // 3. Validate branch exists and is active
    if (!Types.ObjectId.isValid(dto.branchId)) {
      throw new BadRequestException('Invalid branch ID');
    }
    const branch = await this.branchModel.findById(dto.branchId);
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (!branch.isActive) {
      throw new BadRequestException('Cannot assign to inactive branch');
    }

    // 4. Generate temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // 5. Create minimal Member record with accountType: 'operational'
    const memberDoc = await this.memberModel.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: dto.email.toLowerCase().trim(),
      password: hashedPassword,
      accountType: AccountType.OPERATIONAL,
      isActive: true,
      mustChangePassword: true,
      role: new Types.ObjectId(dto.roleId),
      branch: new Types.ObjectId(dto.branchId),
      assignedDistricts: (dto.assignedDistricts || []).map(
        (id) => new Types.ObjectId(id),
      ),
    });

    // 6. Create invitation with 7-day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = new this.invitationModel({
      member: memberDoc._id,
      role: new Types.ObjectId(dto.roleId),
      branch: new Types.ObjectId(dto.branchId),
      assignedDistricts: (dto.assignedDistricts || []).map(
        (id) => new Types.ObjectId(id),
      ),
      temporaryPassword: hashedPassword,
      status: InvitationStatus.PENDING,
      invitedBy: new Types.ObjectId(invitedById),
      expiresAt,
      notes: dto.notes,
    });

    await invitation.save();

    // 7. Queue invitation email
    try {
      await this.queueService.addUserInvitationEmailJob({
        type: 'user_invitation',
        invitationId: invitation._id.toString(),
        memberEmail: memberDoc.email,
        memberFirstName: memberDoc.firstName,
        memberLastName: memberDoc.lastName,
        roleDisplayName: role.displayName || role.name,
        temporaryPassword,
        metadata: {
          invitedById,
          accountType: AccountType.OPERATIONAL,
          notes: dto.notes,
        },
      });
    } catch (error) {
      console.error('Failed to queue operational invitation email:', error);
    }

    return invitation.populate(['member', 'role', 'branch', 'invitedBy']);
  }

  /**
   * Find all invitations with filters and pagination
   */
  async findAll(
    queryDto: InvitationQueryDto,
  ): Promise<{
    data: UserInvitation[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 10, status, memberId, roleId, invitedBy } = queryDto;

    const query: any = {};

    if (status) query.status = status;
    if (memberId && Types.ObjectId.isValid(memberId)) query.member = memberId;
    if (roleId && Types.ObjectId.isValid(roleId)) query.role = roleId;
    if (invitedBy && Types.ObjectId.isValid(invitedBy)) query.invitedBy = invitedBy;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.invitationModel
        .find(query)
        .populate('member', 'firstName lastName email phone')
        .populate('role', 'name displayName')
        .populate('branch', 'name code')
        .populate('invitedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.invitationModel.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find invitation by ID (unpopulated document for internal use)
   */
  private async findByIdRaw(id: string): Promise<UserInvitationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid invitation ID');
    }

    const invitation = await this.invitationModel.findById(id);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }

  /**
   * Find invitation by ID (populated for public use)
   */
  async findById(id: string): Promise<UserInvitation> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid invitation ID');
    }

    const invitation = await this.invitationModel
      .findById(id)
      .populate('member', 'firstName lastName email phone')
      .populate('role', 'name displayName')
      .populate('branch', 'name code')
      .populate('invitedBy', 'firstName lastName email')
      .exec();

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }

  /**
   * Resend invitation email
   */
  async resendInvitation(id: string): Promise<UserInvitation> {
    const invitation = await this.findByIdRaw(id);

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Can only resend pending invitations');
    }

    if (new Date() > invitation.expiresAt) {
      // Auto-expire the invitation
      invitation.status = InvitationStatus.EXPIRED;
      await invitation.save();
      throw new BadRequestException('Invitation has expired');
    }

    // Generate new temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    invitation.temporaryPassword = hashedPassword;
    invitation.resendCount += 1;
    invitation.lastResentAt = new Date();

    const member = await this.memberModel.findById(invitation.member);
    const role = await this.roleModel.findById(invitation.role);

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Update member's password using findByIdAndUpdate to avoid full document validation
    // This is necessary for members created before branch was required
    await this.memberModel.findByIdAndUpdate(
      invitation.member,
      {
        $set: {
          password: hashedPassword,
          isActive: true,
          mustChangePassword: true,
        },
      },
      { runValidators: false },
    );

    await invitation.save();

    // Queue invitation email for async sending (non-blocking)
    try {
      await this.queueService.addUserInvitationResendEmailJob({
        type: 'user_invitation_resend',
        invitationId: invitation._id.toString(),
        memberEmail: member.email,
        memberFirstName: member.firstName,
        memberLastName: member.lastName,
        roleDisplayName: role.displayName || role.name,
        temporaryPassword,
      });
    } catch (error) {
      console.error('Failed to queue invitation resend email:', error);
      // Don't fail the resend if queueing fails
    }

    return await invitation.populate(['member', 'role', 'branch', 'invitedBy']);
  }

  /**
   * Revoke invitation
   */
  async revokeInvitation(
    id: string,
    revokeDto: RevokeInvitationDto,
  ): Promise<UserInvitation> {
    const invitation = await this.findByIdRaw(id);

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Can only revoke pending invitations');
    }

    invitation.status = InvitationStatus.REVOKED;
    invitation.revokedAt = new Date();
    invitation.revocationReason = revokeDto.reason;

    await invitation.save();
    return await invitation.populate(['member', 'role', 'branch', 'invitedBy']);
  }

  /**
   * Update invitation role (only for pending invitations)
   */
  async updateRole(
    id: string,
    updateDto: UpdateInvitationRoleDto,
  ): Promise<UserInvitation> {
    const invitation = await this.findByIdRaw(id);

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Can only update role for pending invitations');
    }

    // Validate new role
    if (!Types.ObjectId.isValid(updateDto.roleId)) {
      throw new BadRequestException('Invalid role ID');
    }

    const role = await this.roleModel.findById(updateDto.roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (!role.isActive) {
      throw new BadRequestException('Cannot assign inactive role');
    }

    invitation.role = new Types.ObjectId(updateDto.roleId);
    if (updateDto.notes) {
      invitation.notes = updateDto.notes;
    }

    await invitation.save();
    return await invitation.populate(['member', 'role', 'branch', 'invitedBy']);
  }

  /**
   * Mark invitation as accepted (called after member's first login)
   */
  async markAsAccepted(invitationId: string): Promise<UserInvitation> {
    const invitation = await this.findByIdRaw(invitationId);

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is not pending');
    }

    invitation.status = InvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();

    await invitation.save();
    return invitation;
  }

  /**
   * Auto-expire old invitations (can be run as a cron job)
   */
  async expireOldInvitations(): Promise<number> {
    const result = await this.invitationModel.updateMany(
      {
        status: InvitationStatus.PENDING,
        expiresAt: { $lt: new Date() },
      },
      {
        $set: { status: InvitationStatus.EXPIRED },
      },
    );

    return result.modifiedCount;
  }

  /**
   * Get invitation statistics
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    accepted: number;
    revoked: number;
    expired: number;
  }> {
    const [total, pending, accepted, revoked, expired] = await Promise.all([
      this.invitationModel.countDocuments(),
      this.invitationModel.countDocuments({ status: InvitationStatus.PENDING }),
      this.invitationModel.countDocuments({ status: InvitationStatus.ACCEPTED }),
      this.invitationModel.countDocuments({ status: InvitationStatus.REVOKED }),
      this.invitationModel.countDocuments({ status: InvitationStatus.EXPIRED }),
    ]);

    return { total, pending, accepted, revoked, expired };
  }

  /**
   * Get all users with platform access (active members with roles)
   */
  async getActiveUsers(options?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    data: MemberDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 10, search = '' } = options || {};

    const query: any = {
      isActive: true,
      role: { $exists: true, $ne: null },
    };

    // Add search filter if provided
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.memberModel
        .find(query)
        .populate('role', 'name displayName')
        .select('firstName lastName email phone isActive role lastLogin accountType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.memberModel.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update user role (for active users)
   */
  async updateUserRole(memberId: string, roleId: string): Promise<MemberDocument> {
    if (!Types.ObjectId.isValid(memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    if (!Types.ObjectId.isValid(roleId)) {
      throw new BadRequestException('Invalid role ID');
    }

    const member = await this.memberModel.findById(memberId);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const role = await this.roleModel.findById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (!role.isActive) {
      throw new BadRequestException('Cannot assign inactive role');
    }

    // Use findByIdAndUpdate to avoid full document validation
    // This is necessary for members created before branch was required
    await this.memberModel.findByIdAndUpdate(
      memberId,
      { $set: { role: new Types.ObjectId(roleId) } },
      { runValidators: false },
    );

    member.role = new Types.ObjectId(roleId);
    return member.populate('role', 'name displayName');
  }

  /**
   * Deactivate user access (soft delete)
   */
  async deactivateUser(memberId: string): Promise<MemberDocument> {
    if (!Types.ObjectId.isValid(memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    const member = await this.memberModel.findById(memberId);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (!member.isActive) {
      throw new BadRequestException('User is already deactivated');
    }

    // Use findByIdAndUpdate to avoid full document validation
    await this.memberModel.findByIdAndUpdate(
      memberId,
      { $set: { isActive: false } },
      { runValidators: false },
    );

    member.isActive = false;
    return member;
  }

  /**
   * Activate user access
   */
  async activateUser(memberId: string): Promise<MemberDocument> {
    if (!Types.ObjectId.isValid(memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    const member = await this.memberModel.findById(memberId);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.isActive) {
      throw new BadRequestException('User is already active');
    }

    // Use findByIdAndUpdate to avoid full document validation
    await this.memberModel.findByIdAndUpdate(
      memberId,
      { $set: { isActive: true } },
      { runValidators: false },
    );

    member.isActive = true;
    return member;
  }

  /**
   * Permanently delete user access (remove role and deactivate)
   */
  async deleteUserAccess(memberId: string): Promise<MemberDocument> {
    if (!Types.ObjectId.isValid(memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    const member = await this.memberModel.findById(memberId);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Use findByIdAndUpdate to avoid full document validation
    // Remove role and deactivate to revoke platform access
    await this.memberModel.findByIdAndUpdate(
      memberId,
      { $set: { role: null, isActive: false } },
      { runValidators: false },
    );

    // Update local member object for return
    member.role = null;
    member.isActive = false;

    // Also revoke any pending invitations
    await this.invitationModel.updateMany(
      {
        member: memberId,
        status: InvitationStatus.PENDING,
      },
      {
        $set: {
          status: InvitationStatus.REVOKED,
          revokedAt: new Date(),
          revocationReason: 'User access deleted',
        },
      },
    );

    return member;
  }
}
