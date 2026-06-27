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
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
import { Public } from '../auth/decorators/public.decorator';
import { FormTemplateService } from './form-template.service';
import { CreateFormTemplateDto, UpdateFormTemplateDto } from './dto/create-form-template.dto';
import { BulkEmailPermission } from './permissions';

@Controller('bulk-email/forms')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class FormTemplateController {
  constructor(private readonly formTemplateService: FormTemplateService) {}

  @Post()
  @RequirePermission(BulkEmailPermission.CREATE_FORM)
  @AuditLog({
    action: AuditAction.FORM_TEMPLATE_CREATED,
    entityType: AuditEntity.FORM_TEMPLATE,
    description: 'Created a new form template',
    getEntityId: (result) => result._id.toString(),
  })
  async create(@Body() dto: CreateFormTemplateDto, @Request() req) {
    const createdBy = req.user?._id?.toString();
    if (!dto.branch) {
      dto.branch = (req.user?.branch?._id || req.user?.branch)?.toString();
    }
    return this.formTemplateService.create(dto, createdBy);
  }

  @Get()
  @RequirePermission(BulkEmailPermission.VIEW_FORMS)
  async findAll(
    @Query('search') search?: string,
    @Query('module') module?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Request() req?,
  ) {
    const branchId = (req?.user?.branch?._id || req?.user?.branch)?.toString();
    return this.formTemplateService.findAll(
      {
        search,
        module,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        sortBy,
        sortOrder: sortOrder as 'asc' | 'desc',
      },
      branchId,
    );
  }

  @Get('active')
  @RequirePermission(BulkEmailPermission.VIEW_FORMS)
  async getActiveForms(@Request() req) {
    const branchId = (req.user?.branch?._id || req.user?.branch)?.toString();
    return this.formTemplateService.getActiveForms(branchId);
  }

  @Get('modules')
  @RequirePermission(BulkEmailPermission.VIEW_FORMS)
  async getModuleCounts() {
    return this.formTemplateService.getModuleCounts();
  }

  @Get('public/:id')
  @Public()
  async getPublicFormConfig(@Param('id') id: string) {
    return this.formTemplateService.getPublicFormConfig(id);
  }

  @Get('by-slug/:slug')
  @RequirePermission(BulkEmailPermission.VIEW_FORMS)
  async findBySlug(@Param('slug') slug: string) {
    const form = await this.formTemplateService.findBySlug(slug);
    if (!form) {
      throw new Error(`Form with slug "${slug}" not found`);
    }
    return form;
  }

  @Get(':id')
  @RequirePermission(BulkEmailPermission.VIEW_FORMS)
  async findOne(@Param('id') id: string) {
    return this.formTemplateService.findById(id);
  }

  @Patch(':id')
  @RequirePermission(BulkEmailPermission.UPDATE_FORM)
  @AuditLog({
    action: AuditAction.FORM_TEMPLATE_UPDATED,
    entityType: AuditEntity.FORM_TEMPLATE,
    description: 'Updated form template',
    getEntityId: (result, request) => request.params.id,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFormTemplateDto,
    @Request() req,
  ) {
    const updatedBy = req.user?._id?.toString();
    return this.formTemplateService.update(id, dto, updatedBy);
  }

  @Delete(':id')
  @RequirePermission(BulkEmailPermission.DELETE_FORM)
  @AuditLog({
    action: AuditAction.FORM_TEMPLATE_DELETED,
    entityType: AuditEntity.FORM_TEMPLATE,
    description: 'Deleted form template',
    severity: 'high',
    getEntityId: (result, request) => request.params.id,
  })
  async remove(@Param('id') id: string) {
    await this.formTemplateService.remove(id);
    return { message: 'Form template deleted successfully' };
  }
}
