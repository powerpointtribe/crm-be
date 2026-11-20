import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Query,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AuditAction, AuditEntity } from '../../common/enums/audit-action.enum';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { ResponseUtil } from '../../common/utils/response.util';
import { RequirePermission } from '../../roles/decorators/require-permission.decorator';
import { PermissionGuard } from '../../roles/guards/permission.guard';
import {
  SubmissionQueryDto,
  SubscriptionQueryDto,
  UpdateSubmissionDto,
} from '../dto/inbox.dto';
import { WebsitePermission as P } from '../permissions';
import { WebsiteInboxService } from '../services/website-inbox.service';

const paramId = (_r: unknown, req: { params: { id: string } }) => req.params.id;

@ApiTags('Website (staff)')
@ApiBearerAuth()
@Controller('website')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class WebsiteInboxController {
  constructor(private readonly inbox: WebsiteInboxService) {}

  @Get('submissions')
  @RequirePermission(P.VIEW_SUBMISSIONS)
  @ApiOperation({ summary: 'Website inbox: form submissions, newest first' })
  async list(@Query() q: SubmissionQueryDto) {
    return ResponseUtil.success(
      await this.inbox.list(q),
      'Submissions retrieved',
    );
  }

  @Get('submissions/summary')
  @RequirePermission(P.VIEW_SUBMISSIONS)
  @ApiOperation({ summary: 'Counts per form type and status' })
  async summary() {
    return ResponseUtil.success(
      await this.inbox.summary(),
      'Summary retrieved',
    );
  }

  @Get('submissions/:id')
  @RequirePermission(P.VIEW_SUBMISSIONS)
  async get(@Param('id') id: string) {
    return ResponseUtil.success(
      await this.inbox.get(id),
      'Submission retrieved',
    );
  }

  @Patch('submissions/:id')
  @RequirePermission(P.MANAGE_SUBMISSIONS)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.WEBSITE_SUBMISSION,
    description: 'Updated website submission',
    getEntityId: paramId,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionDto,
    @Request() req: { user: { _id: Types.ObjectId } },
  ) {
    return ResponseUtil.success(
      await this.inbox.update(id, dto, req.user._id),
      'Submission updated',
    );
  }

  @Delete('submissions/:id')
  @RequirePermission(P.MANAGE_SUBMISSIONS)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.WEBSITE_SUBMISSION,
    description: 'Deleted website submission',
    getEntityId: paramId,
  })
  async remove(@Param('id') id: string) {
    await this.inbox.remove(id);
    return ResponseUtil.success(null, 'Submission deleted');
  }

  @Get('subscriptions')
  @RequirePermission(P.EXPORT_SUBSCRIPTIONS)
  @ApiOperation({ summary: 'Merch drop / newsletter sign-ups' })
  async subscriptions(@Query() q: SubscriptionQueryDto) {
    return ResponseUtil.success(
      await this.inbox.listSubscriptions(q),
      'Subscriptions retrieved',
    );
  }

  @Get('subscriptions/export')
  @RequirePermission(P.EXPORT_SUBSCRIPTIONS)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'CSV of sign-ups (formula-safe, max 50,000 rows)' })
  async exportSubscriptions(
    @Query() q: SubscriptionQueryDto,
    @Res() res: Response,
  ) {
    const { csv } = await this.inbox.exportSubscriptionsCsv(q);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        'attachment; filename="subscriptions.csv"',
      )
      .send(csv);
  }
}
