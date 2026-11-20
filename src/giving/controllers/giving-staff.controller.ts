import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AuditAction, AuditEntity } from '../../common/enums/audit-action.enum';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { ResponseUtil } from '../../common/utils/response.util';
import {
  RequireAnyPermission,
  RequirePermission,
} from '../../roles/decorators/require-permission.decorator';
import { PermissionGuard } from '../../roles/guards/permission.guard';
import {
  CreateGivingAccountDto,
  DonationQueryDto,
  DonationRangeDto,
  GivingAccountQueryDto,
  UpdateGivingAccountDto,
} from '../dto/giving.dto';
import { GivingPermission as P } from '../permissions';
import { DonationsService } from '../services/donations.service';
import { GivingAccountsService } from '../services/giving-accounts.service';

type StaffRequest = { user: { _id: Types.ObjectId } };
const paramId = (_r: unknown, req: { params: { id: string } }) => req.params.id;
const idOf = (result: { data?: { _id?: { toString(): string } } }) =>
  result?.data?._id?.toString() ?? '';

@ApiTags('Giving (staff)')
@ApiBearerAuth()
@Controller('giving/accounts')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class GivingAccountsController {
  constructor(private readonly accounts: GivingAccountsService) {}

  @Get()
  @RequirePermission(P.VIEW_ACCOUNTS)
  @ApiOperation({
    summary: 'All giving accounts, incl. drafts and pending changes',
  })
  async list(@Query() q: GivingAccountQueryDto) {
    return ResponseUtil.success(
      await this.accounts.list(q),
      'Giving accounts retrieved',
    );
  }

  @Get(':id')
  @RequirePermission(P.VIEW_ACCOUNTS)
  async get(@Param('id') id: string) {
    return ResponseUtil.success(
      await this.accounts.findById(id),
      'Giving account retrieved',
    );
  }

  @Post()
  @RequirePermission(P.MANAGE_ACCOUNTS)
  @ApiOperation({
    summary: 'Create a draft (not public until someone else approves it)',
  })
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.GIVING_ACCOUNT,
    description: 'Drafted giving account',
    severity: 'high',
    getEntityId: idOf,
  })
  async create(
    @Body() dto: CreateGivingAccountDto,
    @Request() req: StaffRequest,
  ) {
    return ResponseUtil.success(
      await this.accounts.create(dto, req.user._id),
      'Giving account drafted',
    );
  }

  @Patch(':id')
  @RequirePermission(P.MANAGE_ACCOUNTS)
  @ApiOperation({
    summary:
      'Edit a draft, or request a change to an approved account (needs approval)',
  })
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.GIVING_ACCOUNT,
    description: 'Edited giving account / requested change',
    severity: 'high',
    getEntityId: paramId,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGivingAccountDto,
    @Request() req: StaffRequest,
  ) {
    return ResponseUtil.success(
      await this.accounts.update(id, dto, req.user._id),
      'Giving account updated',
    );
  }

  @Post(':id/approve')
  @RequirePermission(P.APPROVE_ACCOUNTS)
  @ApiOperation({ summary: 'Approve a draft or pending change (not your own)' })
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.GIVING_ACCOUNT,
    description: 'Approved giving account',
    severity: 'critical',
    getEntityId: paramId,
  })
  async approve(@Param('id') id: string, @Request() req: StaffRequest) {
    return ResponseUtil.success(
      await this.accounts.approve(id, req.user._id),
      'Giving account approved',
    );
  }

  @Post(':id/reject')
  @RequirePermission(P.APPROVE_ACCOUNTS)
  @ApiOperation({ summary: 'Drop the pending change on an approved account' })
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.GIVING_ACCOUNT,
    description: 'Rejected giving account change',
    getEntityId: paramId,
  })
  async reject(@Param('id') id: string, @Request() req: StaffRequest) {
    return ResponseUtil.success(
      await this.accounts.reject(id, req.user._id),
      'Giving account change rejected',
    );
  }

  @Delete(':id')
  @RequirePermission(P.MANAGE_ACCOUNTS)
  @ApiOperation({
    summary: 'Delete a draft (approved accounts cannot be deleted)',
  })
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.GIVING_ACCOUNT,
    description: 'Deleted giving account draft',
    getEntityId: paramId,
  })
  async remove(@Param('id') id: string) {
    await this.accounts.remove(id);
    return ResponseUtil.success(null, 'Giving account draft deleted');
  }
}

@ApiTags('Giving (staff)')
@ApiBearerAuth()
@Controller('giving/donations')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class DonationsController {
  constructor(private readonly donations: DonationsService) {}

  @Get()
  @RequirePermission(P.VIEW_DONATIONS)
  @ApiOperation({ summary: 'Online donations with donor details' })
  async list(@Query() q: DonationQueryDto) {
    return ResponseUtil.success(
      await this.donations.list(q),
      'Donations retrieved',
    );
  }

  @Get('totals')
  @RequireAnyPermission(P.VIEW_DONATION_TOTALS, P.VIEW_DONATIONS)
  @ApiOperation({
    summary: 'Successful donation totals by currency and fund (no donor data)',
  })
  async totals(@Query() q: DonationRangeDto) {
    return ResponseUtil.success(
      await this.donations.totals(q),
      'Donation totals retrieved',
    );
  }

  @Get('export')
  @RequirePermission(P.EXPORT_DONATIONS)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="donations.csv"')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Donations CSV (max 50,000 rows)' })
  @AuditLog({
    action: AuditAction.EXPORT,
    entityType: AuditEntity.DONATION,
    description: 'Exported donations CSV',
    severity: 'high',
    getEntityId: () => 'donations-export',
  })
  async export(@Query() q: DonationQueryDto) {
    const { csv } = await this.donations.exportCsv(q);
    return csv;
  }
}
