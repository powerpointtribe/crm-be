import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MembersService } from '../members/members.service';
import { AccessControlService } from '../common/services/access-control.service';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { EmailProvider } from '../notifications/providers/email.provider';
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
import { generateDefaultPassword } from '../common/utils/password-generator';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private membersService: MembersService,
    private jwtService: JwtService,
    private accessControlService: AccessControlService,
    private userPermissionsService: UserPermissionsService,
    private emailProvider: EmailProvider,
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

    // Check for valid invitation (PENDING or ACCEPTED) - required for platform access
    const invitation = await this.invitationModel.findOne({
      member: member._id,
      status: { $in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
    });

    if (!invitation) {
      throw new UnauthorizedException({
        message: 'Access denied. You need an invitation to access this platform.',
        errorCode: 'INVITATION_REQUIRED',
      });
    }

    // Check if PENDING invitation has expired
    if (invitation.status === InvitationStatus.PENDING && new Date() > invitation.expiresAt) {
      invitation.status = InvitationStatus.EXPIRED;
      await invitation.save();
      throw new UnauthorizedException({
        message: 'Your invitation has expired. Please contact an administrator.',
        errorCode: 'INVITATION_EXPIRED',
      });
    }

    // Use the found invitation for the rest of the flow
    const pendingInvitation = invitation.status === InvitationStatus.PENDING ? invitation : null;

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

    // Generate secure default password if not provided
    // User will be required to change password on first login
    const defaultPassword = generateDefaultPassword();
    const hashedPassword = await bcrypt.hash(
      registerDto.password || defaultPassword,
      10,
    );

    // Log default password for admin notification (only if generated)
    if (!registerDto.password) {
      this.logger.log(
        `Generated default password for ${registerDto.email}: ${defaultPassword}`,
      );
      // TODO: Send password to user via email instead of logging
    }

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

    // Determine if member is a leader based on membershipStatus
    const leaderStatuses = [MembershipStatus.PASTOR, MembershipStatus.SENIOR_PASTOR, MembershipStatus.DIRECTOR];
    const isLeader = leaderStatuses.includes(member.membershipStatus) ||
      member.systemRoles?.includes(UserRole.ADMIN) ||
      member.systemRoles?.includes(UserRole.SUPER_ADMIN);

    return {
      memberId: member._id,
      name: `${member.firstName} ${member.lastName}`,
      systemRoles: member.systemRoles,
      unitType: member.unitType,
      membershipStatus: member.membershipStatus,
      role: roleInfo,
      permissions,
      accessibleModules,
      isLeader,
    };
  }

  // PASSWORD RESET METHODS

  /**
   * Generate a secure random reset token
   */
  private generateResetToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate password reset email HTML with reset link
   */
  private generatePasswordResetEmailHtml(firstName: string, resetLink: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset Request</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">Hello <strong>${firstName}</strong>,</p>
          <p style="font-size: 16px;">We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold;">Reset Password</a>
          </div>
          <p style="font-size: 14px; color: #666;">Or copy and paste this link in your browser:</p>
          <p style="font-size: 12px; color: #667eea; word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px;">${resetLink}</p>
          <p style="font-size: 14px; color: #666; margin-top: 20px;">This link will expire in <strong>15 minutes</strong>.</p>
          <p style="font-size: 14px; color: #666;">If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">
            This is an automated message from the Church Management System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    try {
      const { email } = forgotPasswordDto;

      // Check if member exists
      const member = await this.membersService.findByEmail(email);
      if (!member) {
        // Don't reveal if email exists or not for security
        return {
          message: 'If the email exists, a password reset link has been sent.',
        };
      }

      // Generate secure reset token
      const resetToken = this.generateResetToken();

      // Store token in database (reusing the OTP fields)
      await this.membersService.setPasswordResetOtp(email, resetToken);

      // Build reset link
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

      // Send password reset email
      try {
        await this.emailProvider.sendEmail({
          to: email,
          subject: 'Reset Your Password - Church Management System',
          html: this.generatePasswordResetEmailHtml(member.firstName, resetLink),
        });
        this.logger.log(`Password reset link email sent to ${email}`);
      } catch (emailError) {
        this.logger.error(`Failed to send password reset email to ${email}:`, emailError);
        // Don't throw - we still want to return success for security reasons
      }

      return {
        message: 'If the email exists, a password reset link has been sent.',
        // For development purposes only, include the reset link
        ...(process.env.NODE_ENV !== 'production' && { resetLink }),
      };
    } catch (error) {
      this.logger.error('Error in forgotPassword:', error);
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
    const { token, newPassword } = resetPasswordDto;

    try {
      await this.membersService.resetPasswordWithToken(token, newPassword);

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
   * Verify reset token validity
   */
  async verifyResetToken(token: string) {
    const result = await this.membersService.verifyResetToken(token);

    if (!result.valid) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    return {
      valid: true,
      email: result.email,
    };
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
