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
import { EmailTemplateService } from './email-template.service';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from './dto/create-email-template.dto';
import { TemplateQueryDto } from './dto/campaign-query.dto';
import { BulkEmailPermission } from './permissions';

@Controller('bulk-email/templates')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class EmailTemplateController {
  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  @Post()
  @RequirePermission(BulkEmailPermission.CREATE_TEMPLATE)
  @AuditLog({
    action: AuditAction.EMAIL_TEMPLATE_CREATED,
    entityType: AuditEntity.EMAIL_TEMPLATE,
    description: 'Created a new email template',
    getEntityId: (result) => result._id.toString(),
  })
  async create(@Body() createTemplateDto: CreateEmailTemplateDto, @Request() req) {
    const createdBy = req.user?._id?.toString();
    if (!createTemplateDto.branch) {
      createTemplateDto.branch = (req.user?.branch?._id || req.user?.branch)?.toString();
    }
    return this.emailTemplateService.create(createTemplateDto, createdBy);
  }

  @Get()
  @RequirePermission(BulkEmailPermission.VIEW_TEMPLATES)
  async findAll(@Query() query: TemplateQueryDto, @Request() req) {
    const branchId = req.user?.branch?._id || req.user?.branch;
    return this.emailTemplateService.findAll(query, branchId?.toString());
  }

  @Get('active')
  @RequirePermission(BulkEmailPermission.VIEW_TEMPLATES)
  async getActiveTemplates(@Query('branchId') branchId: string, @Request() req) {
    const effectiveBranchId = branchId || req.user?.branch?._id || req.user?.branch;
    return this.emailTemplateService.getActiveTemplates(effectiveBranchId?.toString());
  }

  @Get('variables')
  @RequirePermission(BulkEmailPermission.VIEW_TEMPLATES)
  async getAvailableVariables() {
    return this.emailTemplateService.getAvailableVariables();
  }

  @Get('modules')
  @RequirePermission(BulkEmailPermission.VIEW_TEMPLATES)
  async getModuleCounts() {
    return this.emailTemplateService.getModuleCounts();
  }

  @Get('by-slug/:slug')
  @RequirePermission(BulkEmailPermission.VIEW_TEMPLATES)
  async findBySlug(@Param('slug') slug: string) {
    const template = await this.emailTemplateService.findBySlug(slug);
    if (!template) {
      throw new NotFoundException(`Template with slug "${slug}" not found`);
    }
    return template;
  }

  @Get(':id')
  @RequirePermission(BulkEmailPermission.VIEW_TEMPLATES)
  async findOne(@Param('id') id: string) {
    const template = await this.emailTemplateService.findById(id);
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }
    return template;
  }

  @Get(':id/preview')
  @RequirePermission(BulkEmailPermission.VIEW_TEMPLATES)
  async previewTemplate(@Param('id') id: string, @Body() sampleData?: Record<string, string>) {
    return this.emailTemplateService.previewTemplate(id, sampleData);
  }

  @Patch(':id')
  @RequirePermission(BulkEmailPermission.UPDATE_TEMPLATE)
  @AuditLog({
    action: AuditAction.EMAIL_TEMPLATE_UPDATED,
    entityType: AuditEntity.EMAIL_TEMPLATE,
    description: 'Updated email template',
    getEntityId: (result, request) => request.params.id,
  })
  async update(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateEmailTemplateDto,
    @Request() req,
  ) {
    const updatedBy = req.user?._id?.toString();
    return this.emailTemplateService.update(id, updateTemplateDto, updatedBy);
  }

  @Delete(':id')
  @RequirePermission(BulkEmailPermission.DELETE_TEMPLATE)
  @AuditLog({
    action: AuditAction.EMAIL_TEMPLATE_DELETED,
    entityType: AuditEntity.EMAIL_TEMPLATE,
    description: 'Deleted email template',
    severity: 'high',
    getEntityId: (result, request) => request.params.id,
  })
  async remove(@Param('id') id: string) {
    await this.emailTemplateService.remove(id);
    return { message: 'Template deleted successfully' };
  }
}
