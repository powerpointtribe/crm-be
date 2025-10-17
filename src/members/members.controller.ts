import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleAccessGuard } from '../auth/guards/module-access.guard';
import {
  RequireMembersAccess,
  RequireMemberEdit,
  RequireMemberDelete,
  RequireAdminOrPastor,
  AllowSelfAccess,
} from '../common/decorators/access-control.decorators';
import { MembersService } from './members.service';
import { AccessControlService } from '../common/services/access-control.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { Member, MemberDocument } from './schemas/member.schema';
import { UserRole } from '../common/enums/user-roles.enums';

@Controller('members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly accessControlService: AccessControlService,
  ) {}

  @Post()
  @RequireMembersAccess()
  @UseGuards(ModuleAccessGuard)
  async create(@Body() createMemberDto: CreateMemberDto, @Request() req) {
    // Additional check: only certain roles can create members
    if (
      !this.accessControlService.canPerformAction(req.user, 'create', 'member')
    ) {
      throw new ForbiddenException(
        'Insufficient permissions to create members',
      );
    }

    return this.membersService.create(createMemberDto);
  }

  @Get()
  @RequireMembersAccess()
  @UseGuards(ModuleAccessGuard)
  async findAll(@Query() query: any, @Request() req) {
    const { user: currentMember } = req;

    // Get all members
    const data = await this.membersService.findAll(query);

    // Filter based on member's access level
    data.data = this.filterMembersByAccess(currentMember, data.data);

    return data;
  }

  @Get('stats')
  @RequireMembersAccess()
  @UseGuards(ModuleAccessGuard)
  async getMemberStats(@Request() req) {
    // Only admins and pastors can access stats
    if (
      !req.user.systemRoles.includes('admin') &&
      !req.user.systemRoles.includes('pastor')
    ) {
      throw new ForbiddenException(
        'Only admins and pastors can access member statistics',
      );
    }

    return this.membersService.getMemberStats();
  }

  @Get('my-profile')
  @AllowSelfAccess()
  async getMyProfile(@Request() req) {
    return this.membersService.findById(req.user.sub);
  }

  @Get('my-district')
  @RequireMembersAccess()
  @UseGuards(ModuleAccessGuard)
  async getMyDistrictMembers(@Request() req, @Query() query: any) {
    const { user: currentMember } = req;

    // Only district pastors and unit heads can see their district/unit members
    if (
      !currentMember.leadershipRoles?.isDistrictPastor &&
      !currentMember.leadershipRoles?.isUnitHead
    ) {
      throw new ForbiddenException(
        'Only district pastors and unit heads can access this endpoint',
      );
    }

    return this.membersService.getDistrictMembers(
      currentMember.district,
      // query,
    );
  }

  @Get('accessible-modules')
  async getAccessibleModules(@Request() req) {
    const modules = this.accessControlService.getAccessibleModules(req.user);
    return { modules };
  }

  @Get(':id')
  @RequireMembersAccess()
  @UseGuards(ModuleAccessGuard)
  async findOne(@Param('id') id: string, @Request() req) {
    const member = await this.membersService.findById(id);
    if (!member) {
      throw new NotFoundException(`Member with ID ${id} not found`);
    }

    // Check if user can access this specific member
    if (!this.canAccessMember(req.user, member)) {
      throw new ForbiddenException('Access denied to this member profile');
    }

    return member;
  }

  @Patch(':id')
  @RequireMemberEdit()
  @UseGuards(ModuleAccessGuard)
  async update(
    @Param('id') id: string,
    @Body() updateMemberDto: UpdateMemberDto,
    @Request() req,
  ) {
    const member = await this.membersService.findById(id);

    if (!member) {
      throw new NotFoundException(`Member with ID ${id} not found`);
    }

    // Check if user can edit this specific member
    if (!this.canEditMember(req.user, member)) {
      throw new ForbiddenException('Access denied to edit this member');
    }

    return this.membersService.update(id, updateMemberDto);
  }

  @Delete(':id')
  @RequireMemberDelete()
  @UseGuards(ModuleAccessGuard)
  async remove(@Param('id') id: string, @Request() req) {
    // Only admins and pastors can delete members
    if (
      !req.user.systemRoles.includes('admin') &&
      !req.user.systemRoles.includes('pastor')
    ) {
      throw new ForbiddenException(
        'Only admins and pastors can delete members',
      );
    }

    return this.membersService.remove(id);
  }

  @Patch(':id/assign-role')
  @RequireAdminOrPastor()
  @UseGuards(ModuleAccessGuard)
  async assignRole(
    @Param('id') id: string,
    @Body() roleData: { systemRoles: string[]; leadershipRoles?: any },
    @Request() req,
  ) {
    // Only high-level roles can assign system roles
    return this.membersService.updateAccessFields(id, roleData);
  }

  @Patch(':id/assign-unit')
  @RequireAdminOrPastor()
  @UseGuards(ModuleAccessGuard)
  async assignUnit(
    @Param('id') id: string,
    @Body() unitData: { unit: string; unitType: string; district?: string },
    @Request() req,
  ) {
    return this.membersService.updateAccessFields(id, unitData);
  }

  // Private helper methods
  private filterMembersByAccess(
    currentMember: MemberDocument,
    members: MemberDocument[],
  ): MemberDocument[] {
    // Admin sees all
    if (currentMember.systemRoles.includes(UserRole.ADMIN)) {
      return members;
    }

    // District pastors see their district
    if (currentMember.leadershipRoles?.isDistrictPastor) {
      return members.filter(
        (member) =>
          member.district?.toString() ===
          currentMember.leadershipRoles.pastorsDistrict?.toString(),
      );
    }

    // Unit heads see their unit
    if (currentMember.leadershipRoles?.isUnitHead) {
      return members.filter(
        (member) =>
          member.unit?.toString() ===
          currentMember.leadershipRoles.leadsUnit?.toString(),
      );
    }

    // GIA sees all for integration purposes
    if (currentMember.unitType === 'gia') {
      return members;
    }

    // Regular members see limited info or none
    return [];
  }

  private canAccessMember(
    currentMember: MemberDocument,
    targetMember: MemberDocument,
  ): boolean {
    // Self access
    if (currentMember._id.toString() === targetMember._id.toString()) {
      return true;
    }

    // Use access control service
    return this.accessControlService.canPerformAction(
      currentMember,
      'view',
      'member',
      targetMember._id.toString(),
    );
  }

  private canEditMember(
    currentMember: MemberDocument,
    targetMember: MemberDocument,
  ): boolean {
    // Self edit (limited fields)
    if (currentMember._id.toString() === targetMember._id.toString()) {
      return true;
    }

    // Use access control service
    return this.accessControlService.canPerformAction(
      currentMember,
      'edit',
      'member',
      targetMember._id.toString(),
    );
  }
}
