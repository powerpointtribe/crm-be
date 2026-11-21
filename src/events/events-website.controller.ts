import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { ResponseUtil } from '../common/utils/response.util';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { PermissionGuard } from '../roles/guards/permission.guard';
import {
  UpdateEventWebsiteDto,
  WebsiteEventsQueryDto,
} from './dto/event-website.dto';
import { EventsWebsiteService } from './events-website.service';
import { EventsPermission } from './permissions';

/**
 * Website listing of events. Registered BEFORE EventsController so
 * /events/website isn't captured by its GET /events/:id route.
 */
@ApiTags('Events (website)')
@Controller('events')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class EventsWebsiteController {
  constructor(private readonly website: EventsWebsiteService) {}

  @Get('website')
  @Public()
  @SkipThrottle()
  @ApiOperation({
    summary: 'Upcoming events shown on the public website (public)',
    description:
      'Published events with website.showOnWebsite. kind=one_off (default) lists only events that have not ended. A branch filter also includes all-campus events. `empty` is true when nothing is upcoming at any campus.',
  })
  async list(@Query() q: WebsiteEventsQueryDto) {
    return ResponseUtil.success(
      await this.website.list(q),
      'Events retrieved successfully',
    );
  }

  @Get('website/next')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Next website event for the countdown (public)' })
  async next() {
    return ResponseUtil.success(
      await this.website.next(),
      'Next event retrieved successfully',
    );
  }

  @Patch(':id/website')
  @ApiBearerAuth()
  @RequirePermission(EventsPermission.UPDATE_EVENT)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.EVENT,
    description: 'Updated event website settings',
    getEntityId: (_r: unknown, req: { params: { id: string } }) =>
      req.params.id,
  })
  @ApiOperation({ summary: 'Update how an event appears on the website' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async updateWebsite(
    @Param('id') id: string,
    @Body() dto: UpdateEventWebsiteDto,
  ) {
    const event = await this.website.updateWebsite(id, dto);
    if (!event) throw new NotFoundException('Event not found');
    return ResponseUtil.success(event, 'Event updated successfully');
  }
}
