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
import { RevokeInvitationDto } from './dto/revoke-invitation.dto';
import { UpdateInvitationRoleDto } from './dto/update-invitation-role.dto';
import { InvitationQueryDto } from './dto/invitation-query.dto';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class UserInvitationsService {
  constructor(
    @InjectModel(UserInvitation.name)
    private invitationModel: Model<UserInvitationDocument>,
    @InjectModel(Member.name)
    private memberModel: Model<MemberDocument>,
    @InjectModel(Role.name)
    private roleModel: Model<RoleDocument>,
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

    const invitation = new this.invitationModel({
      member: createInvitationDto.memberId,
      role: createInvitationDto.roleId,
      temporaryPassword: hashedPassword,
      status: InvitationStatus.PENDING,
      invitedBy: invitedById,
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

    return invitation.populate(['member', 'role', 'invitedBy']);
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

    return await invitation.populate(['member', 'role', 'invitedBy']);
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
    return await invitation.populate(['member', 'role', 'invitedBy']);
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
    return await invitation.populate(['member', 'role', 'invitedBy']);
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
        .select('firstName lastName email phone isActive role lastLogin')
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

    member.role = new Types.ObjectId(roleId);
    await member.save();

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

    member.isActive = false;
    await member.save();

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

    member.isActive = true;
    await member.save();

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

    // Remove role and deactivate
    member.role = null as any; // Force null to remove platform access
    member.isActive = false;
    await member.save();

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
