import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MembersService } from '../members/members.service';
import { AccessControlService } from '../common/services/access-control.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Member, MemberDocument } from '../members/schemas/member-unified.schema';
import { CreateMemberDto } from 'src/members/dto/create-member.dto';
import { MembershipStatus } from 'src/common/enums/member-status.enum';
import { UserRole } from 'src/common/enums/user-roles.enums';

@Injectable()
export class AuthService {
  constructor(
    private membersService: MembersService,
    private jwtService: JwtService,
    private accessControlService: AccessControlService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find member by email (replaces user lookup)
    const member: MemberDocument | null = await this.membersService.findByEmail(email);
    if (!member) {
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

    // Update last login
    await this.membersService.updateLastLogin(member._id.toString());

    // Get accessible modules for this member
    const accessibleModules =
      this.accessControlService.getAccessibleModules(member);

    // Create JWT payload with comprehensive member data
    const payload = {
      sub: member._id,
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      systemRoles: member.systemRoles,
      unitType: member.unitType,
      district: member.district,
      unit: member.unit,
      leadershipRoles: member.leadershipRoles,
      accessibleModules,
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
        unitType: member.unitType,
        membershipStatus: member.membershipStatus,
        district: member.district,
        unit: member.unit,
        leadershipRoles: member.leadershipRoles,
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

    // Create JWT payload
    const payload = {
      sub: member._id,
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      systemRoles: member.systemRoles,
      unitType: member.unitType,
      accessibleModules,
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

    const accessibleModules =
      this.accessControlService.getAccessibleModules(member);

    return {
      ...member.toObject(),
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

    const accessibleModules =
      this.accessControlService.getAccessibleModules(member);

    return {
      memberId: member._id,
      name: `${member.firstName} ${member.lastName}`,
      systemRoles: member.systemRoles,
      unitType: member.unitType,
      leadershipRoles: member.leadershipRoles,
      accessibleModules,
      isAdmin: member.systemRoles.includes(UserRole.ADMIN),
      isPastor: member.systemRoles.includes(UserRole.PASTOR),
      isLeader:
        member.leadershipRoles.isDistrictPastor ||
        member.leadershipRoles.isUnitHead ||
        member.leadershipRoles.isChamp,
    };
  }
}
