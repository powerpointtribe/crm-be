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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberSearchDto } from './dto/member-search.dto';
import { AssignLeadershipDto } from './dto/leadership-assignment.dto';
import {
  BulkMemberOperationDto,
  BulkMemberResultDto,
} from './dto/bulk-member.dto';
import { BulkOperationType } from '../common/interfaces/bulk-operation.interface';
import { CSVParserUtil } from '../common/utils/csv-parser.util';
import { QueueService } from '../queue/queue.service';
import { JobType } from '../common/interfaces/queue-job.interface';
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
  constructor(
    private readonly membersService: MembersService,
    private readonly queueService: QueueService,
  ) {}

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

  @Post('bulk-operation')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Queue bulk create or update members from CSV file',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'CSV file with member data and operation parameters',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        operationType: {
          type: 'string',
          enum: Object.values(BulkOperationType),
          description: 'Type of operation to perform',
        },
        skipErrors: {
          type: 'boolean',
          description:
            'Whether to skip validation errors and continue with valid records',
          default: false,
        },
        identifierField: {
          type: 'string',
          description: 'Field to use as identifier for update operations',
          default: 'email',
        },
        defaultDistrict: {
          type: 'string',
          description: 'Default district assignment for all members',
        },
        defaultUnit: {
          type: 'string',
          description: 'Default unit assignment for all members',
        },
        dryRun: {
          type: 'boolean',
          description: 'Preview changes without applying them',
          default: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Bulk operation job queued successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            status: { type: 'string' },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file format or content',
  })
  async bulkOperation(
    @UploadedFile() file: any,
    @Body('operationType') operationType: string,
    @Body('skipErrors') skipErrors: string = 'false',
    @Body('identifierField') identifierField: string = 'email',
    @Body('defaultDistrict') defaultDistrict: string = '',
    @Body('defaultUnit') defaultUnit: string = '',
    @Body('dryRun') dryRun: string = 'false',
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (
      !operationType ||
      !Object.values(BulkOperationType).includes(
        operationType as BulkOperationType,
      )
    ) {
      throw new BadRequestException(
        'Valid operationType is required (create or update)',
      );
    }

    // Validate file type
    if (!CSVParserUtil.validateFileType(file.originalname)) {
      throw new BadRequestException(
        'Invalid file type. Only CSV files are allowed',
      );
    }

    // Validate file size (limit to 10MB for members)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        'File size too large. Maximum allowed size is 10MB',
      );
    }

    const csvContent = file.buffer.toString('utf-8');

    // Parse CSV to get row count for metadata
    let totalRows = 0;
    try {
      const csvData = CSVParserUtil.parseCSV(csvContent, {
        headerRow: true,
        skipEmptyLines: true,
      });
      totalRows = csvData.length;
    } catch (error) {
      throw new BadRequestException(`CSV parsing failed: ${error.message}`);
    }

    const options: BulkMemberOperationDto = {
      operationType: operationType as BulkOperationType,
      skipErrors: skipErrors === 'true',
      identifierField: identifierField || 'email',
      defaultDistrict,
      defaultUnit,
      dryRun: dryRun === 'true',
    };

    // Determine job type based on operation
    const jobType =
      operationType === BulkOperationType.CREATE
        ? JobType.BULK_MEMBER_CREATE
        : JobType.BULK_MEMBER_UPDATE;

    // Queue the job
    const job = await this.queueService.addBulkOperationJob(
      jobType,
      csvContent,
      options,
      user.sub,
      {
        filename: file.originalname,
        totalRows,
      },
    );

    return ResponseUtil.success(
      {
        jobId: job.id,
        status: 'queued',
        estimatedRows: totalRows,
      },
      'Bulk operation job queued successfully. Use the job ID to check progress.',
    );
  }

  @Get('csv-templates/:operationType')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @ApiOperation({ summary: 'Download CSV template for bulk operations' })
  @ApiParam({
    name: 'operationType',
    enum: ['create', 'update'],
    description: 'Type of operation template to download',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV template downloaded successfully',
  })
  getMemberCSVTemplate(
    @Param('operationType') operationType: 'create' | 'update',
  ) {
    if (!['create', 'update'].includes(operationType)) {
      throw new BadRequestException(
        'Operation type must be either "create" or "update"',
      );
    }

    const csvContent =
      this.membersService.generateMemberCSVTemplate(operationType);

    return {
      success: true,
      data: {
        content: csvContent,
        filename: `members-${operationType}-template.csv`,
        contentType: 'text/csv',
      },
      message: `Member ${operationType} CSV template generated successfully`,
    };
  }
}
