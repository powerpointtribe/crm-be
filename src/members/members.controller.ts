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
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembersService } from './members.service';
import { AccessControlService } from '../common/services/access-control.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { Member, MemberDocument } from './schemas/member.schema';
import { UserRole } from '../common/enums/user-roles.enums';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { MembersPermission } from './permissions';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { BranchFilterContext } from '../common/services/branch-access.service';
import { MemberSearchDto } from './dto/member-search.dto';

@Controller('members')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly accessControlService: AccessControlService,
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  @Post()
  @RequirePermission(MembersPermission.CREATE_MEMBER)
  @AuditLog({
    action: AuditAction.MEMBER_CREATED,
    entityType: AuditEntity.MEMBER,
    description: 'Created a new member',
    getEntityId: (result) => result._id.toString(),
  })
  async create(@Body() createMemberDto: CreateMemberDto, @Request() req) {
    return this.membersService.create(createMemberDto);
  }

  @Get()
  @RequirePermission(MembersPermission.VIEW_MEMBERS)
  async findAll(@Query() query: MemberSearchDto, @Request() req) {
    try {
      const { user: currentMember } = req;

      // Build branch filter context based on user's permissions
      let branchFilterContext: BranchFilterContext | undefined;

      if (currentMember.role) {
        const userPermissions = await this.userPermissionsService.getUserPermissions(
          currentMember.role._id || currentMember.role,
        );

        branchFilterContext = {
          userPermissions: userPermissions.permissions,
          userBranchId: currentMember.branch?._id || currentMember.branch,
          selectedBranchId: query.branchId, // From query param
        };
      } else {
        // No role - filter by user's branch only
        branchFilterContext = {
          userPermissions: [],
          userBranchId: currentMember.branch?._id || currentMember.branch,
        };
      }

      // Get members with branch filtering applied
      const data = await this.membersService.findAll(query, branchFilterContext);

      return data;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Failed to fetch members');
    }
  }

  @Get('stats')
  @RequirePermission(MembersPermission.VIEW_MEMBER_STATS)
  async getMemberStats(
    @Query('branchId') branchId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req,
  ) {
    const { user: currentMember } = req;

    // Build branch filter context based on user's permissions
    let branchFilterContext: BranchFilterContext | undefined;

    if (currentMember.role) {
      const userPermissions = await this.userPermissionsService.getUserPermissions(
        currentMember.role._id || currentMember.role,
      );

      branchFilterContext = {
        userPermissions: userPermissions.permissions,
        userBranchId: currentMember.branch?._id || currentMember.branch,
        selectedBranchId: branchId,
      };
    } else {
      branchFilterContext = {
        userPermissions: [],
        userBranchId: currentMember.branch?._id || currentMember.branch,
      };
    }

    return this.membersService.getMemberStats(branchFilterContext, dateFrom, dateTo);
  }

  @Get('my-profile')
  @RequirePermission(MembersPermission.VIEW_OWN_PROFILE)
  async getMyProfile(@Request() req) {
    return this.membersService.findById(req.user.sub);
  }

  @Get('my-district')
  @RequirePermission(MembersPermission.VIEW_DISTRICT_MEMBERS)
  async getMyDistrictMembers(@Request() req, @Query() query: any) {
    const { user: currentMember } = req;

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
  @RequirePermission(MembersPermission.VIEW_MEMBER_DETAILS)
  async findOne(@Param('id') id: string, @Request() req) {
    const member = await this.membersService.findById(id);
    if (!member) {
      throw new NotFoundException(`Member with ID ${id} not found`);
    }

    return member;
  }

  @Patch(':id')
  @RequirePermission(MembersPermission.UPDATE_MEMBER)
  @AuditLog({
    action: AuditAction.MEMBER_UPDATED,
    entityType: AuditEntity.MEMBER,
    description: 'Updated member information',
    getEntityId: (result, request) => request.params.id,
  })
  async update(
    @Param('id') id: string,
    @Body() updateMemberDto: UpdateMemberDto,
    @Request() req,
  ) {
    const member = await this.membersService.findById(id);

    if (!member) {
      throw new NotFoundException(`Member with ID ${id} not found`);
    }

    return this.membersService.update(id, updateMemberDto);
  }

  @Delete(':id')
  @RequirePermission(MembersPermission.DELETE_MEMBER)
  @AuditLog({
    action: AuditAction.MEMBER_DELETED,
    entityType: AuditEntity.MEMBER,
    description: 'Deleted a member',
    severity: 'high',
    getEntityId: (result, request) => request.params.id,
  })
  async remove(@Param('id') id: string, @Request() req) {
    return this.membersService.remove(id);
  }

  @Patch(':id/assign-role')
  @RequirePermission(MembersPermission.UPDATE_MEMBER_ROLES)
  async assignRole(
    @Param('id') id: string,
    @Body() assignRoleDto: AssignRoleDto,
  ) {
    return this.membersService.assignRole(id, assignRoleDto.roleId);
  }

  @Patch(':id/assign-unit')
  @RequirePermission(MembersPermission.ASSIGN_UNIT)
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
    // Return all members - access control is handled by permissions
    return members;
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
