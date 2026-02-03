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
  NotFoundException,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
import { EmailCampaignService } from './email-campaign.service';
import { BulkEmailSenderService } from './bulk-email-sender.service';
import {
  CreateEmailCampaignDto,
  UpdateEmailCampaignDto,
  ScheduleCampaignDto,
  SendCampaignDto,
} from './dto/create-email-campaign.dto';
import { CampaignQueryDto, SendLogQueryDto } from './dto/campaign-query.dto';
import { BulkEmailPermission } from './permissions';

@Controller('bulk-email/campaigns')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class EmailCampaignController {
  constructor(
    private readonly emailCampaignService: EmailCampaignService,
    private readonly bulkEmailSenderService: BulkEmailSenderService,
  ) {}

  @Post()
  @RequirePermission(BulkEmailPermission.CREATE_CAMPAIGN)
  @AuditLog({
    action: AuditAction.EMAIL_CAMPAIGN_CREATED,
    entityType: AuditEntity.EMAIL_CAMPAIGN,
    description: 'Created a new email campaign',
    getEntityId: (result) => result._id.toString(),
  })
  async create(@Body() createCampaignDto: CreateEmailCampaignDto, @Request() req) {
    const createdBy = req.user?._id?.toString();
    return this.emailCampaignService.create(createCampaignDto, createdBy);
  }

  @Get()
  @RequirePermission(BulkEmailPermission.VIEW_CAMPAIGNS)
  async findAll(@Query() query: CampaignQueryDto, @Request() req) {
    const branchId = req.user?.branch?._id || req.user?.branch;
    return this.emailCampaignService.findAll(query, branchId?.toString());
  }

  @Get('statistics')
  @RequirePermission(BulkEmailPermission.VIEW_STATS)
  async getStatistics(@Query('branchId') branchId: string, @Request() req) {
    const effectiveBranchId = branchId || req.user?.branch?._id || req.user?.branch;
    return this.emailCampaignService.getStatistics(effectiveBranchId?.toString());
  }

  @Get(':id')
  @RequirePermission(BulkEmailPermission.VIEW_CAMPAIGNS)
  async findOne(@Param('id') id: string) {
    const campaign = await this.emailCampaignService.findById(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }
    return campaign;
  }

  @Get(':id/details')
  @RequirePermission(BulkEmailPermission.VIEW_CAMPAIGNS)
  async findOneWithStats(@Param('id') id: string) {
    const campaign = await this.emailCampaignService.findByIdWithStats(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }
    return campaign;
  }

  @Get(':id/logs')
  @RequirePermission(BulkEmailPermission.VIEW_SEND_LOGS)
  async getSendLogs(@Param('id') id: string, @Query() query: SendLogQueryDto) {
    return this.emailCampaignService.getSendLogs(id, query);
  }

  @Post(':id/preview')
  @RequirePermission(BulkEmailPermission.PREVIEW_RECIPIENTS)
  async previewRecipients(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.emailCampaignService.previewRecipients(id, limit || 10);
  }

  @Patch(':id')
  @RequirePermission(BulkEmailPermission.UPDATE_CAMPAIGN)
  @AuditLog({
    action: AuditAction.EMAIL_CAMPAIGN_UPDATED,
    entityType: AuditEntity.EMAIL_CAMPAIGN,
    description: 'Updated email campaign',
    getEntityId: (result, request) => request.params.id,
  })
  async update(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateEmailCampaignDto,
    @Request() req,
  ) {
    const updatedBy = req.user?._id?.toString();
    return this.emailCampaignService.update(id, updateCampaignDto, updatedBy);
  }

  @Delete(':id')
  @RequirePermission(BulkEmailPermission.DELETE_CAMPAIGN)
  @AuditLog({
    action: AuditAction.EMAIL_CAMPAIGN_DELETED,
    entityType: AuditEntity.EMAIL_CAMPAIGN,
    description: 'Deleted email campaign',
    severity: 'high',
    getEntityId: (result, request) => request.params.id,
  })
  async remove(@Param('id') id: string) {
    await this.emailCampaignService.remove(id);
    return { message: 'Campaign deleted successfully' };
  }

  @Post(':id/send')
  @RequirePermission(BulkEmailPermission.SEND_CAMPAIGN)
  @AuditLog({
    action: AuditAction.EMAIL_CAMPAIGN_SENT,
    entityType: AuditEntity.EMAIL_CAMPAIGN,
    description: 'Sent email campaign',
    severity: 'high',
    getEntityId: (result, request) => request.params.id,
  })
  async sendCampaign(@Param('id') id: string, @Body() sendDto: SendCampaignDto) {
    return this.bulkEmailSenderService.sendCampaign(id, sendDto.testEmail);
  }

  @Post(':id/schedule')
  @RequirePermission(BulkEmailPermission.SCHEDULE_CAMPAIGN)
  @AuditLog({
    action: AuditAction.EMAIL_CAMPAIGN_SCHEDULED,
    entityType: AuditEntity.EMAIL_CAMPAIGN,
    description: 'Scheduled email campaign',
    getEntityId: (result, request) => request.params.id,
  })
  async scheduleCampaign(
    @Param('id') id: string,
    @Body() scheduleDto: ScheduleCampaignDto,
    @Request() req,
  ) {
    const updatedBy = req.user?._id?.toString();
    return this.emailCampaignService.scheduleCampaign(id, scheduleDto, updatedBy);
  }

  @Post(':id/cancel')
  @RequirePermission(BulkEmailPermission.CANCEL_CAMPAIGN)
  @AuditLog({
    action: AuditAction.EMAIL_CAMPAIGN_CANCELLED,
    entityType: AuditEntity.EMAIL_CAMPAIGN,
    description: 'Cancelled scheduled campaign',
    getEntityId: (result, request) => request.params.id,
  })
  async cancelCampaign(@Param('id') id: string, @Request() req) {
    const updatedBy = req.user?._id?.toString();
    return this.emailCampaignService.cancelCampaign(id, updatedBy);
  }
}
