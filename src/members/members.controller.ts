import {
  Controller,
  Get,
  Post,
  Put,
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
import { BulkImportMasterDto, BulkImportMasterResultDto } from './dto/bulk-import-master.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
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
    const initiatedByUserId = req.user?._id?.toString();
    // Auto-assign branch from logged-in user if not provided
    if (!createMemberDto.branch && req.user?.branch) {
      createMemberDto.branch = (req.user.branch._id || req.user.branch).toString();
    }
    return this.membersService.create(createMemberDto, initiatedByUserId);
  }

  /**
   * Master Bulk Import - Creates members, districts, units, and assigns leadership
   * This endpoint creates the entire church structure from a single import
   */
  @Post('bulk-import/master')
  @RequirePermission(MembersPermission.CREATE_MEMBER)
  @AuditLog({
    action: AuditAction.MEMBER_CREATED,
    entityType: AuditEntity.MEMBER,
    description: 'Master bulk import - created members with districts, units, and leadership',
    severity: 'high',
  })
  async bulkImportMaster(
    @Body() bulkImportDto: BulkImportMasterDto,
    @Request() req,
  ): Promise<BulkImportMasterResultDto> {
    // Branch is now required in each member row (branchName field)
    // Branches will be created automatically if they don't exist
    return this.membersService.bulkImportMaster(bulkImportDto);
  }

  /**
   * Get CSV template for master bulk import
   */
  @Get('bulk-import/master/template')
  @RequirePermission(MembersPermission.VIEW_MEMBERS)
  async getMasterImportTemplate(): Promise<{ template: string; headers: string[] }> {
    const template = this.membersService.generateMasterImportTemplate();
    const headers = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'dateOfBirth',
      'gender',
      'maritalStatus',
      'branchName',
      'districtName',
      'isDistrictPastor',
      'unitName',
      'isUnitHead',
      'isAssistantUnitHead',
      'membershipStatus',
      'street',
      'city',
      'state',
      'occupation',
      'dateJoined',
      'notes',
    ];
    return { template, headers };
  }

  @Get()
  @RequirePermission(MembersPermission.VIEW_MEMBERS)
  async findAll(@Query() query: MemberSearchDto, @Request() req) {
    try {
      const { user: currentMember } = req;

      // Build merged permissions from primary + additional roles
      let userPermissions: string[] = [];

      if (currentMember.role) {
        const permResult =
          await this.userPermissionsService.getUserPermissions(
            currentMember.role._id || currentMember.role,
          );
        userPermissions = permResult.permissions;
      }

      // Merge additional role permissions
      if (currentMember.additionalRoles?.length > 0) {
        for (const addRole of currentMember.additionalRoles) {
          try {
            const addRoleId = addRole._id || addRole;
            const addPerms =
              await this.userPermissionsService.getUserPermissions(addRoleId);
            userPermissions.push(...addPerms.permissions);
          } catch {
            // Skip inactive/deleted roles
          }
        }
        userPermissions = [...new Set(userPermissions)];
      }

      // Build branch filter context
      const branchFilterContext: BranchFilterContext = {
        userPermissions,
        userBranchId: currentMember.branch?._id || currentMember.branch,
        selectedBranchId: query.branchId,
      };

      // Determine if user should bypass leadership scope filtering
      // Bypass = see all members (subject to branch filter only)
      const isSystemRole = currentMember.role?.isSystemRole === true;
      const canViewAllMembers = userPermissions.includes(
        MembersPermission.VIEW_ALL_MEMBERS,
      );
      const hasBranchViewAll = userPermissions.includes('branches:view-all');
      const isSeniorPastor =
        currentMember.membershipStatus === 'SENIOR_PASTOR';
      const isCampusPastor =
        currentMember.membershipStatus === 'CAMPUS_PASTOR';

      let leadershipScopeFilter: any = undefined;

      if (
        isSystemRole ||
        canViewAllMembers ||
        hasBranchViewAll ||
        isSeniorPastor
      ) {
        // Full bypass — see everybody (branch filter still applies via branchFilterContext)
        leadershipScopeFilter = undefined;
      } else if (isCampusPastor) {
        // Campus Pastor sees all members in their branch — no leadership scope needed
        // Branch filtering is already handled by branchFilterContext
        leadershipScopeFilter = undefined;
      } else {
        // Scoped by leadership: unit head → unit, district pastor → district, etc.
        leadershipScopeFilter =
          await this.membersService.buildLeadershipScopeFilter(
            currentMember._id,
            currentMember.district?._id || currentMember.district,
            currentMember.unit?._id || currentMember.unit,
          );
      }

      const data = await this.membersService.findAll(
        query,
        branchFilterContext,
        leadershipScopeFilter,
      );

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
    const member = await this.membersService.findById(req.user._id.toString());
    if (!member) {
      throw new NotFoundException('Member profile not found');
    }

    // Resolve permissions like the login flow does
    const memberObj = member.toObject ? member.toObject() : member;
    const roleId = memberObj.role?._id || memberObj.role;
    let permissions: string[] = [];
    if (roleId) {
      const permResult =
        await this.userPermissionsService.getUserPermissions(roleId);
      permissions = permResult.permissions;
    }

    // Merge permissions from additional roles
    if (memberObj.additionalRoles?.length > 0) {
      for (const addRole of memberObj.additionalRoles) {
        try {
          const addRoleId = addRole._id || addRole;
          const addPerms =
            await this.userPermissionsService.getUserPermissions(addRoleId);
          permissions.push(...addPerms.permissions);
        } catch {
          // Skip inactive/deleted roles
        }
      }
      permissions = [...new Set(permissions)];
    }

    return {
      ...memberObj,
      permissions,
    };
  }

  @Get('my-preferences')
  @RequirePermission(MembersPermission.VIEW_OWN_PROFILE)
  async getMyPreferences(@Request() req) {
    const member = await this.membersService.findById(req.user._id.toString());
    return member?.preferences || {
      theme: 'system',
      language: 'en',
      notifications: {
        email: true,
        sms: false,
        push: true,
        followUpReminders: true,
        weeklyReports: false,
      },
      display: {
        compactMode: false,
        showWelcomeMessage: true,
      },
    };
  }

  @Patch('my-preferences')
  @RequirePermission(MembersPermission.VIEW_OWN_PROFILE)
  async updateMyPreferences(@Request() req, @Body() preferences: any) {
    return this.membersService.updatePreferences(req.user._id.toString(), preferences);
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

    const initiatedByUserId = req.user?._id?.toString();
    return this.membersService.update(id, updateMemberDto, initiatedByUserId);
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

  @Post('bulk-delete')
  @RequirePermission(MembersPermission.DELETE_MEMBER)
  @AuditLog({
    action: AuditAction.MEMBER_DELETED,
    entityType: AuditEntity.MEMBER,
    description: 'Bulk deleted members',
    severity: 'high',
  })
  async bulkRemove(@Body() bulkDeleteDto: BulkDeleteDto, @Request() req) {
    // Guard against self-deletion in a bulk action.
    const currentUserId = req.user?._id?.toString();
    const ids = bulkDeleteDto.ids.filter((id) => id !== currentUserId);
    return this.membersService.bulkRemove(ids);
  }

  @Patch(':id/assign-role')
  @RequirePermission(MembersPermission.UPDATE_MEMBER_ROLES)
  async assignRole(
    @Param('id') id: string,
    @Body() assignRoleDto: AssignRoleDto,
  ) {
    return this.membersService.assignRole(id, assignRoleDto.roleId);
  }

  @Post(':id/roles')
  @RequirePermission(MembersPermission.UPDATE_MEMBER_ROLES)
  async addRole(
    @Param('id') id: string,
    @Body() body: { roleId: string },
  ) {
    return this.membersService.addRole(id, body.roleId);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermission(MembersPermission.UPDATE_MEMBER_ROLES)
  async removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    return this.membersService.removeRole(id, roleId);
  }

  @Get(':id/scoped-events')
  @RequirePermission(MembersPermission.UPDATE_MEMBER_ROLES)
  async getScopedEvents(@Param('id') id: string) {
    return this.membersService.getScopedEvents(id);
  }

  @Put(':id/scoped-events')
  @RequirePermission(MembersPermission.UPDATE_MEMBER_ROLES)
  async setScopedEvents(
    @Param('id') id: string,
    @Body() body: { eventIds: string[] },
  ) {
    return this.membersService.setScopedEvents(id, body.eventIds);
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
