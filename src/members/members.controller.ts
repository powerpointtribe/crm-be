import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberSearchDto } from './dto/member-search.dto';
import { AssignLeadershipDto } from './dto/leadership-assignment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-roles.enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';

@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
  )
  @ApiOperation({ summary: 'Create a new member' })
  async create(@Body() createMemberDto: CreateMemberDto) {
    const member = await this.membersService.create(createMemberDto);
    return ResponseUtil.success(member, 'Member created successfully');
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
  )
  @ApiOperation({ summary: 'Get all members with advanced filtering' })
  async findAll(@Query() searchDto: MemberSearchDto, @CurrentUser() user: any) {
    // Apply user-specific filters based on role
    const filteredSearch = await this.applyUserFilters(searchDto, user);
    const members = await this.membersService.findAll(filteredSearch);
    return ResponseUtil.success(members, 'Members retrieved successfully');
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @ApiOperation({ summary: 'Get comprehensive member statistics' })
  async getMemberStats() {
    const stats = await this.membersService.getMemberStats();
    return ResponseUtil.success(stats, 'Member stats retrieved successfully');
  }

  // DISTRICT-SPECIFIC ENDPOINTS
  @Get('district/:districtId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.GROUP_LEADER,
  )
  @ApiOperation({ summary: 'Get all members in a specific district' })
  @ApiParam({ name: 'districtId', description: 'District ID' })
  async getDistrictMembers(
    @Param('districtId') districtId: string,
    @CurrentUser() user: any,
  ) {
    // Check if user has access to this district
    if (user.role === UserRole.GROUP_LEADER) {
      const hasAccess = await this.checkDistrictAccess(user.email, districtId);
      if (!hasAccess) {
        throw new ForbiddenException(
          'You can only access members in your own district',
        );
      }
    }

    const members = await this.membersService.getDistrictMembers(districtId);
    return ResponseUtil.success(
      members,
      'District members retrieved successfully',
    );
  }

  @Get('my-district')
  @Roles(UserRole.GROUP_LEADER)
  @ApiOperation({ summary: "Get members in current user's district" })
  async getMyDistrictMembers(@CurrentUser() user: any) {
    const member = await this.membersService.findByEmail(user.email);
    if (!member?.district) {
      throw new ForbiddenException('User is not assigned to a district');
    }
    const members = await this.membersService.getDistrictMembers(
      member.district.toString(),
    );
    return ResponseUtil.success(
      members,
      'Your district members retrieved successfully',
    );
  }

  // UNIT-SPECIFIC ENDPOINTS
  @Get('unit/:unitId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.GROUP_LEADER,
  )
  @ApiOperation({ summary: 'Get all members in a specific unit' })
  @ApiParam({ name: 'unitId', description: 'Unit ID' })
  async getUnitMembers(
    @Param('unitId') unitId: string,
    @CurrentUser() user: any,
  ) {
    // Check if user has access to this unit
    if (user.role === UserRole.GROUP_LEADER) {
      const hasAccess = await this.checkUnitAccess(user.email, unitId);
      if (!hasAccess) {
        throw new ForbiddenException(
          'You can only access members in your own unit',
        );
      }
    }

    const members = await this.membersService.getUnitMembers(unitId);
    return ResponseUtil.success(members, 'Unit members retrieved successfully');
  }

  @Get('my-unit')
  @Roles(UserRole.GROUP_LEADER)
  @ApiOperation({ summary: "Get members in current user's unit" })
  async getMyUnitMembers(@CurrentUser() user: any) {
    const member = await this.membersService.findByEmail(user.email);
    if (!member?.unit || !member?.leadershipRoles?.isUnitHead) {
      throw new ForbiddenException('User does not lead a unit');
    }
    const members = await this.membersService.getUnitMembers(
      member.unit.toString(),
    );
    return ResponseUtil.success(
      members,
      'Your unit members retrieved successfully',
    );
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
    UserRole.MEMBER,
  )
  @ApiOperation({ summary: 'Get member by ID' })
  @ApiParam({ name: 'id', description: 'Member ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    // Check access for non-admin roles
    if (
      ![
        UserRole.SUPER_ADMIN,
        UserRole.PASTOR,
        UserRole.LEADERSHIP,
        UserRole.FOLLOW_UP_TEAM,
      ].includes(user.role)
    ) {
      const hasAccess = await this.checkMemberAccess(user.email, id);
      if (!hasAccess) {
        throw new ForbiddenException(
          'You can only access members under your authority',
        );
      }
    }

    const member = await this.membersService.findById(id);
    return ResponseUtil.success(member, 'Member retrieved successfully');
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PASTOR,
    UserRole.LEADERSHIP,
    UserRole.FOLLOW_UP_TEAM,
    UserRole.GROUP_LEADER,
  )
  @ApiOperation({ summary: 'Update member' })
  @ApiParam({ name: 'id', description: 'Member ID' })
  async update(
    @Param('id') id: string,
    @Body() updateMemberDto: UpdateMemberDto,
    @CurrentUser() user: any,
  ) {
    // Check access for group leaders
    if (user.role === UserRole.GROUP_LEADER) {
      const hasAccess = await this.checkMemberAccess(user.email, id);
      if (!hasAccess) {
        throw new ForbiddenException(
          'You can only update members under your authority',
        );
      }
    }

    const member = await this.membersService.update(id, updateMemberDto);
    return ResponseUtil.success(member, 'Member updated successfully');
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete member (super admin only)' })
  @ApiParam({ name: 'id', description: 'Member ID' })
  async remove(@Param('id') id: string) {
    await this.membersService.remove(id);
    return ResponseUtil.success(null, 'Member deleted successfully');
  }

  // Helper methods for access control
  private async applyUserFilters(
    searchDto: MemberSearchDto,
    user: any,
  ): Promise<MemberSearchDto> {
    if (
      [
        UserRole.SUPER_ADMIN,
        UserRole.PASTOR,
        UserRole.LEADERSHIP,
        UserRole.FOLLOW_UP_TEAM,
      ].includes(user.role)
    ) {
      return searchDto; // No restrictions for senior roles
    }

    if (user.role === UserRole.GROUP_LEADER) {
      const member = await this.membersService.findByEmail(user.email);
      if (member?.leadershipRoles) {
        // Restrict to their district or unit
        if (
          member.leadershipRoles.isDistrictPastor ||
          member.leadershipRoles.isChamp
        ) {
          const districtId =
            member.leadershipRoles.pastorsDistrict ||
            member.leadershipRoles.champForDistrict;
          if (districtId) searchDto.districtId = districtId.toString();
        }
        if (member.leadershipRoles.isUnitHead) {
          const unitId = member.leadershipRoles.leadsUnit;
          if (unitId) searchDto.unitId = unitId.toString();
        }
      }
    }

    return searchDto;
  }

  private async checkDistrictAccess(
    userEmail: string,
    districtId: string,
  ): Promise<boolean> {
    const member = await this.membersService.findByEmail(userEmail);
    if (!member?.leadershipRoles) return false;

    const { leadershipRoles } = member;

    // District pastor can access their district
    if (leadershipRoles.isDistrictPastor && leadershipRoles.pastorsDistrict) {
      return leadershipRoles.pastorsDistrict.toString() === districtId;
    }

    // Champ can access their assigned district
    if (leadershipRoles.isChamp && leadershipRoles.champForDistrict) {
      return leadershipRoles.champForDistrict.toString() === districtId;
    }

    return false;
  }

  private async checkUnitAccess(
    userEmail: string,
    unitId: string,
  ): Promise<boolean> {
    const member = await this.membersService.findByEmail(userEmail);
    if (!member?.leadershipRoles) return false;

    // Unit head can access their unit
    if (member.leadershipRoles.isUnitHead && member.leadershipRoles.leadsUnit) {
      return member.leadershipRoles.leadsUnit.toString() === unitId;
    }

    return false;
  }

  private async checkMemberAccess(
    userEmail: string,
    memberId: string,
  ): Promise<boolean> {
    return this.membersService.canAccessMember(userEmail, memberId);
  }
}
