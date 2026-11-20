import {
  Body,
  Controller,
  Get,
  Patch,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AuditAction, AuditEntity } from '../../common/enums/audit-action.enum';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { ResponseUtil } from '../../common/utils/response.util';
import { RequirePermission } from '../../roles/decorators/require-permission.decorator';
import { PermissionGuard } from '../../roles/guards/permission.guard';
import { UpdateWebsiteSettingsDto } from '../dto/settings.dto';
import { WebsitePermission as P } from '../permissions';
import { WebsiteSettingsService } from '../services/website-settings.service';

@ApiTags('Website (staff)')
@ApiBearerAuth()
@Controller('website/settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class WebsiteSettingsController {
  constructor(private readonly settings: WebsiteSettingsService) {}

  @Get()
  @RequirePermission(P.VIEW_CONTENT)
  async get() {
    return ResponseUtil.success(
      await this.settings.get(),
      'Website settings retrieved',
    );
  }

  @Patch()
  @RequirePermission(P.MANAGE_SETTINGS)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.WEBSITE_SETTINGS,
    description: 'Updated website settings',
    getEntityId: () => 'site',
  })
  async update(
    @Body() dto: UpdateWebsiteSettingsDto,
    @Request() req: { user: { _id: Types.ObjectId } },
  ) {
    const doc = await this.settings.update(dto, req.user._id);
    return ResponseUtil.success(doc, 'Website settings updated');
  }
}
