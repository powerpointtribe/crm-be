import {
  Body,
  Controller,
  Delete,
  Get,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { ResponseUtil } from '../common/utils/response.util';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { WebsiteAccessService } from '../website/services/website-access.service';
import {
  ClaimsQueryDto,
  CreateLostItemDto,
  LostItemsQueryDto,
  ReviewClaimDto,
  UpdateLostItemDto,
} from './dto/lost-found.dto';
import { LostFoundService } from './lost-found.service';
import { LostFoundPermission as P } from './permissions';

type StaffRequest = {
  user: { _id: Types.ObjectId; role?: unknown; membershipStatus?: string };
};

const idOf = (result: { data?: { _id?: { toString(): string } } }) =>
  result?.data?._id?.toString() ?? '';
const paramId = (_r: unknown, req: { params: { id: string } }) => req.params.id;

@ApiTags('Lost & Found (staff)')
@ApiBearerAuth()
@Controller('lost-found')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class LostFoundController {
  constructor(
    private readonly lostFound: LostFoundService,
    private readonly access: WebsiteAccessService,
  ) {}

  // ─── Items ───────────────────────────────────────────────────────────

  @Post('items')
  @RequirePermission(P.CREATE_ITEM)
  @ApiOperation({
    summary: 'Post a found item (pending review unless you may manage items)',
  })
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.LOST_ITEM,
    description: 'Posted a found item',
    getEntityId: idOf,
  })
  async create(@Body() dto: CreateLostItemDto, @Request() req: StaffRequest) {
    const canManage = await this.access.has(req.user, P.MANAGE_ITEMS);
    return ResponseUtil.success(
      await this.lostFound.create(dto, req.user._id, canManage),
      'Item posted',
    );
  }

  /** Must stay above items/:id. */
  @Get('items/mine')
  @RequirePermission(P.CREATE_ITEM)
  @ApiOperation({ summary: 'The last 50 items you posted' })
  async mine(@Request() req: StaffRequest) {
    return ResponseUtil.success(
      await this.lostFound.mine(req.user._id),
      'Your items retrieved',
    );
  }

  @Get('items')
  @RequirePermission(P.VIEW_ITEMS)
  @ApiOperation({ summary: 'All items, any status' })
  async list(@Query() q: LostItemsQueryDto) {
    return ResponseUtil.success(
      await this.lostFound.list(q),
      'Items retrieved',
    );
  }

  @Get('items/:id')
  @RequirePermission(P.VIEW_ITEMS)
  async get(@Param('id') id: string) {
    return ResponseUtil.success(
      await this.lostFound.findOne(id),
      'Item retrieved',
    );
  }

  @Patch('items/:id')
  @RequirePermission(P.MANAGE_ITEMS)
  @ApiOperation({
    summary: 'Edit or review an item (status moves are validated)',
  })
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.LOST_ITEM,
    description: 'Updated a lost item',
    getEntityId: paramId,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLostItemDto,
    @Request() req: StaffRequest,
  ) {
    return ResponseUtil.success(
      await this.lostFound.update(id, dto, req.user._id),
      'Item updated',
    );
  }

  @Delete('items/:id')
  @RequirePermission(P.MANAGE_ITEMS)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.LOST_ITEM,
    description: 'Deleted a lost item',
    getEntityId: paramId,
  })
  async remove(@Param('id') id: string) {
    await this.lostFound.remove(id);
    return ResponseUtil.success(null, 'Item deleted');
  }

  // ─── Claims ──────────────────────────────────────────────────────────

  @Get('claims')
  @RequirePermission(P.VIEW_CLAIMS)
  @ApiOperation({
    summary: 'Claims; phone numbers masked unless you may manage claims',
  })
  async claims(@Query() q: ClaimsQueryDto, @Request() req: StaffRequest) {
    const showPhone = await this.access.has(req.user, P.MANAGE_CLAIMS);
    return ResponseUtil.success(
      await this.lostFound.listClaims(q, showPhone),
      'Claims retrieved',
    );
  }

  @Patch('claims/:id')
  @RequirePermission(P.MANAGE_CLAIMS)
  @ApiOperation({
    summary:
      'Approve (item collected) or reject (item listed again) a pending claim',
  })
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.LOST_ITEM_CLAIM,
    description: 'Reviewed a lost item claim',
    getEntityId: paramId,
  })
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewClaimDto,
    @Request() req: StaffRequest,
  ) {
    return ResponseUtil.success(
      await this.lostFound.reviewClaim(id, dto.status, req.user._id),
      'Claim reviewed',
    );
  }
}
