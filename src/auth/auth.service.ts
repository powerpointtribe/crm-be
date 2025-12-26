import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MembersService } from '../members/members.service';
import { AccessControlService } from '../common/services/access-control.service';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { CreateMemberDto } from '../members/dto/create-member.dto';
import { MembershipStatus } from '../common/enums/member-status.enum';
import { UserRole } from '../common/enums/user-roles.enums';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserInvitation, UserInvitationDocument, InvitationStatus } from '../user-invitations/schemas/user-invitation.schema';

@Injectable()
export class AuthService {
  constructor(
    private membersService: MembersService,
    private jwtService: JwtService,
    private accessControlService: AccessControlService,
    private userPermissionsService: UserPermissionsService,
    @InjectModel(UserInvitation.name)
    private invitationModel: Model<UserInvitationDocument>,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find member by email (replaces user lookup)
    const member: MemberDocument | null =
      await this.membersService.findByEmail(email);
    if (!member) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if member has a password set
    if (!member.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, member.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is active
    if (!member.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Check for pending invitation and mark as accepted
    const pendingInvitation = await this.invitationModel.findOne({
      member: member._id,
      status: InvitationStatus.PENDING,
    });

    let isFirstLogin = false;
    let requirePasswordChange = false;

    if (pendingInvitation) {
      // Mark invitation as accepted
      pendingInvitation.status = InvitationStatus.ACCEPTED;
      pendingInvitation.acceptedAt = new Date();
      await pendingInvitation.save();

      // Assign the role from the invitation to the member if not already assigned
      if (!member.role || member.role.toString() !== pendingInvitation.role.toString()) {
        member.role = pendingInvitation.role;
        await member.save();
      }

      isFirstLogin = true;
      requirePasswordChange = true;
    }

    // Update last login
    await this.membersService.updateLastLogin(member._id.toString());

    // Get permissions for this member using permissions system
    let permissions: string[] = [];
    let accessibleModules: string[] = [];
    let roleInfo: { id: string; name: string; displayName: string; level: number } | null = null;

    if (member.role) {
      const userPermissions = await this.userPermissionsService.getUserPermissions(
        member.role,
      );
      permissions = userPermissions.permissions;
      accessibleModules = Object.keys(userPermissions.permissionsGrouped);
      roleInfo = userPermissions.role;
    } else {
      // If no role assigned, use legacy access control service
      accessibleModules =
        this.accessControlService.getAccessibleModules(member) as any;
      // Convert module names to basic view permissions for backward compatibility
      permissions = accessibleModules.map(module => `${module}:view`);
    }

    // Create JWT payload - minimal for smaller token size
    // Only sub (user ID) and role ID needed - permissions looked up from DB
    const payload = {
      sub: member._id,
      role: member.role?._id || member.role, // Extract just the ID, not the populated object
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      isFirstLogin,
      requirePasswordChange,
      member: {
        id: member._id,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        phone: member.phone,
        systemRoles: member.systemRoles,
        unitType: member.unitType,
        membershipStatus: member.membershipStatus,
        district: member.district,
        unit: member.unit,
        leadershipRoles: member.leadershipRoles,
        role: roleInfo,
        permissions,
        accessibleModules,
      },
    };
  }

  async register(registerDto: CreateMemberDto) {
    // Check if email is already registered
    const existingMember = await this.membersService.findByEmail(
      registerDto.email,
    );
    if (existingMember) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const defaultPassword = 'ppt12345'; // Default password for new registrations
    const hashedPassword = await bcrypt.hash(
      registerDto.password || defaultPassword,
      10,
    );

    // Create new member with authentication capabilities
    const memberData = {
      ...registerDto,
      password: hashedPassword,
      // Set default values for new members
      systemRoles: ['member'], // Default role
      isActive: true,
    };

    const member = await this.membersService.create(memberData);

    // Get accessible modules for new member
    const accessibleModules =
      this.accessControlService.getAccessibleModules(member);

    // Create JWT payload - minimal for smaller token size
    const payload = {
      sub: member._id,
      role: member.role?._id || member.role,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      member: {
        id: member._id,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        phone: member.phone,
        systemRoles: member.systemRoles,
        membershipStatus: member.membershipStatus,
        accessibleModules,
      },
    };
  }

  /**
   * Get current member's profile with access control context
   */
  async getProfile(memberId: string) {
    const member = await this.membersService.findById(memberId);
    if (!member) {
      throw new UnauthorizedException('Member not found');
    }

    let permissions: string[] = [];
    let accessibleModules: string[] = [];
    let roleInfo: { id: string; name: string; displayName: string; level: number } | null = null;

    if (member.role) {
      const userPermissions = await this.userPermissionsService.getUserPermissions(
        member.role,
      );
      permissions = userPermissions.permissions;
      accessibleModules = Object.keys(userPermissions.permissionsGrouped);
      roleInfo = userPermissions.role;
    } else {
      // If no role assigned, use legacy access control service
      accessibleModules =
        this.accessControlService.getAccessibleModules(member) as any;
      // Convert module names to basic view permissions for backward compatibility
      permissions = accessibleModules.map(module => `${module}:view`);
    }

    return {
      ...member.toObject(),
      role: roleInfo,
      permissions,
      accessibleModules,
    };
  }

  /**
   * Update member's access-related fields (roles, unit, etc.)
   */
  async updateMemberAccess(
    memberId: string,
    updateData: {
      systemRoles?: string[];
      unitType?: string;
      unit?: string;
      district?: string;
      leadershipRoles?: any;
    },
  ) {
    const member = await this.membersService.updateAccessFields(
      memberId,
      updateData,
    );

    // Refresh accessible modules after update
    const accessibleModules =
      this.accessControlService.getAccessibleModules(member);

    return {
      ...member.toObject(),
      accessibleModules,
    };
  }

  /**
   * Validate member has access to specific module
   */
  async validateModuleAccess(
    memberId: string,
    module: string,
  ): Promise<boolean> {
    const member = await this.membersService.findById(memberId);
    if (!member) {
      return false;
    }

    return this.accessControlService.canAccessModule(member, module as any);
  }

  /**
   * Get member's permissions summary
   */
  async getPermissionsSummary(memberId: string) {
    const member = await this.membersService.findById(memberId);
    if (!member) {
      throw new UnauthorizedException('Member not found');
    }

    let permissions: string[] = [];
    let accessibleModules: string[] = [];
    let roleInfo: { id: string; name: string; displayName: string; level: number } | null = null;

    if (member.role) {
      const userPermissions = await this.userPermissionsService.getUserPermissions(
        member.role,
      );
      permissions = userPermissions.permissions;
      accessibleModules = Object.keys(userPermissions.permissionsGrouped);
      roleInfo = userPermissions.role;
    } else {
      accessibleModules =
        this.accessControlService.getAccessibleModules(member) as any;
      permissions = accessibleModules.map(module => `${module}:view`);
    }

    return {
      memberId: member._id,
      name: `${member.firstName} ${member.lastName}`,
      systemRoles: member.systemRoles,
      unitType: member.unitType,
      leadershipRoles: member.leadershipRoles,
      role: roleInfo,
      permissions,
      accessibleModules,
      isLeader:
        member.leadershipRoles?.isDistrictPastor ||
        member.leadershipRoles?.isUnitHead ||
        member.leadershipRoles?.isChamp,
    };
  }

  // PASSWORD RESET METHODS
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    try {
      const { email } = forgotPasswordDto;

      // Check if member exists
      const member = await this.membersService.findByEmail(email);
      if (!member) {
        // Don't reveal if email exists or not for security
        return {
          message: 'If the email exists, a password reset OTP has been sent.',
        };
      }

      // Generate default OTP
      const otp = '123456';

      // Store OTP in database
      await this.membersService.setPasswordResetOtp(email, otp);

      // In a real application, you would send this OTP via email
      // For now, we'll just return success message
      return {
        message: 'If the email exists, a password reset OTP has been sent.',
        // For development purposes, include the OTP
        ...(process.env.NODE_ENV !== 'production' && { otp }),
      };
    } catch (error) {
      console.error('Error in forgotPassword:', error);
      throw new BadRequestException('Failed to process password reset request');
    }
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    const isValid = await this.membersService.verifyPasswordResetOtp(
      email,
      otp,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    return {
      message: 'OTP verified successfully. You can now reset your password.',
      verified: true,
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, otp, newPassword } = resetPasswordDto;

    try {
      await this.membersService.resetPassword(email, otp, newPassword);

      return {
        message:
          'Password reset successfully. You can now login with your new password.',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to reset password');
    }
  }

  /**
   * Change password for authenticated member
   * Used for first login password change or regular password updates
   */
  async changePassword(
    memberId: string,
    changePasswordDto: ChangePasswordDto,
  ) {
    const { currentPassword, newPassword } = changePasswordDto;

    // Get member
    const member = await this.membersService.findById(memberId);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      member.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    member.password = hashedPassword;
    await member.save();

    return {
      message: 'Password changed successfully',
    };
  }
}
