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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MessageDraftsService } from './message-drafts.service';
import {
  CreateMessageDraftDto,
  UpdateMessageDraftDto,
  MessageDraftQueryDto,
  PreviewMessageDto,
  SendTestEmailDto,
} from './dto/message-draft.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { FirstTimersPermission } from './permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';

@ApiTags('Message Drafts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('first-timers/message-drafts')
export class MessageDraftsController {
  constructor(private readonly messageDraftsService: MessageDraftsService) {}

  // ── Static routes MUST be above /:id routes ──

  @Get('templates')
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMERS)
  @ApiOperation({ summary: 'Get available email templates with previews' })
  async getTemplates() {
    const templates = this.messageDraftsService.getTemplates();
    return ResponseUtil.success(templates, 'Templates retrieved successfully');
  }

  @Post('preview')
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMERS)
  @ApiOperation({ summary: 'Preview a message with sample data and template' })
  async preview(@Body() previewDto: PreviewMessageDto) {
    const result = await this.messageDraftsService.preview(
      previewDto.message,
      previewDto.templateId,
      previewDto.subject,
    );
    return ResponseUtil.success(result, 'Preview generated successfully');
  }

  @Post('send-test')
  @RequirePermission(FirstTimersPermission.CREATE_FIRST_TIMER)
  @ApiOperation({ summary: 'Send a test email to any address' })
  async sendTestEmail(@Body() dto: SendTestEmailDto) {
    await this.messageDraftsService.sendTestEmail(dto);
    return ResponseUtil.success(null, 'Test email sent successfully');
  }

  // ── CRUD routes ──

  @Post()
  @RequirePermission(FirstTimersPermission.CREATE_FIRST_TIMER)
  @ApiOperation({ summary: 'Create a new message draft' })
  @ApiResponse({ status: 201, description: 'Message draft created successfully' })
  async create(
    @Body() createDto: CreateMessageDraftDto,
    @CurrentUser() user: any,
  ) {
    const draft = await this.messageDraftsService.create(createDto, user?.id);
    return ResponseUtil.success(draft, 'Message draft created successfully');
  }

  @Get()
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMERS)
  @ApiOperation({ summary: 'Get all message drafts with pagination' })
  async findAll(@Query() query: MessageDraftQueryDto) {
    const result = await this.messageDraftsService.findAll(query);
    return ResponseUtil.success(result, 'Message drafts retrieved successfully');
  }

  @Get(':id')
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMERS)
  @ApiOperation({ summary: 'Get a single message draft by ID' })
  @ApiParam({ name: 'id', description: 'Message draft ID' })
  async findOne(@Param('id') id: string) {
    const draft = await this.messageDraftsService.findOne(id);
    return ResponseUtil.success(draft, 'Message draft retrieved successfully');
  }

  @Patch(':id')
  @RequirePermission(FirstTimersPermission.UPDATE_FIRST_TIMER)
  @ApiOperation({ summary: 'Update a message draft' })
  @ApiParam({ name: 'id', description: 'Message draft ID' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateMessageDraftDto,
    @CurrentUser() user: any,
  ) {
    const draft = await this.messageDraftsService.update(id, updateDto, user?.id);
    return ResponseUtil.success(draft, 'Message draft updated successfully');
  }

  @Delete(':id')
  @RequirePermission(FirstTimersPermission.DELETE_FIRST_TIMER)
  @ApiOperation({ summary: 'Delete a message draft' })
  @ApiParam({ name: 'id', description: 'Message draft ID' })
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    await this.messageDraftsService.delete(id);
    return ResponseUtil.success(null, 'Message draft deleted successfully');
  }

  @Post(':id/send-now')
  @RequirePermission(FirstTimersPermission.UPDATE_FIRST_TIMER)
  @ApiOperation({ summary: 'Send a message draft immediately' })
  @ApiParam({ name: 'id', description: 'Message draft ID' })
  async sendNow(@Param('id') id: string) {
    await this.messageDraftsService.sendNow(id);
    return ResponseUtil.success(null, 'Message draft sent successfully');
  }
}
