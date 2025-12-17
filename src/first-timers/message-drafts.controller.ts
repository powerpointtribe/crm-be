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

  @Post()
  @RequirePermission(FirstTimersPermission.CREATE_FIRST_TIMER)
  @ApiOperation({ summary: 'Create a new message draft' })
  @ApiResponse({
    status: 201,
    description: 'Message draft created successfully',
  })
  async create(
    @Body() createDto: CreateMessageDraftDto,
    @CurrentUser() user: any,
  ) {
    const draft = await this.messageDraftsService.create(
      createDto,
      user?.id,
    );
    return ResponseUtil.success(draft, 'Message draft created successfully');
  }

  @Get()
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMERS)
  @ApiOperation({ summary: 'Get all message drafts with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Message drafts retrieved successfully',
  })
  async findAll(@Query() query: MessageDraftQueryDto) {
    const result = await this.messageDraftsService.findAll(query);
    return ResponseUtil.success(
      result,
      'Message drafts retrieved successfully',
    );
  }

  @Get(':id')
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMERS)
  @ApiOperation({ summary: 'Get a single message draft by ID' })
  @ApiParam({ name: 'id', description: 'Message draft ID' })
  @ApiResponse({
    status: 200,
    description: 'Message draft retrieved successfully',
  })
  async findOne(@Param('id') id: string) {
    const draft = await this.messageDraftsService.findOne(id);
    return ResponseUtil.success(draft, 'Message draft retrieved successfully');
  }

  @Patch(':id')
  @RequirePermission(FirstTimersPermission.UPDATE_FIRST_TIMER)
  @ApiOperation({ summary: 'Update a message draft' })
  @ApiParam({ name: 'id', description: 'Message draft ID' })
  @ApiResponse({
    status: 200,
    description: 'Message draft updated successfully',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateMessageDraftDto,
    @CurrentUser() user: any,
  ) {
    const draft = await this.messageDraftsService.update(
      id,
      updateDto,
      user?.id,
    );
    return ResponseUtil.success(draft, 'Message draft updated successfully');
  }

  @Delete(':id')
  @RequirePermission(FirstTimersPermission.DELETE_FIRST_TIMER)
  @ApiOperation({ summary: 'Delete a message draft' })
  @ApiParam({ name: 'id', description: 'Message draft ID' })
  @ApiResponse({
    status: 200,
    description: 'Message draft deleted successfully',
  })
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    await this.messageDraftsService.delete(id);
    return ResponseUtil.success(null, 'Message draft deleted successfully');
  }

  @Post('preview')
  @RequirePermission(FirstTimersPermission.VIEW_FIRST_TIMERS)
  @ApiOperation({ summary: 'Preview a message with sample data' })
  @ApiResponse({
    status: 200,
    description: 'Message preview generated successfully',
  })
  async preview(@Body() previewDto: PreviewMessageDto) {
    const result = await this.messageDraftsService.preview(
      previewDto.message,
    );
    return ResponseUtil.success(result, 'Preview generated successfully');
  }

  @Post(':id/send-now')
  @RequirePermission(FirstTimersPermission.UPDATE_FIRST_TIMER)
  @ApiOperation({ summary: 'Send a message draft immediately' })
  @ApiParam({ name: 'id', description: 'Message draft ID' })
  @ApiResponse({
    status: 200,
    description: 'Message draft sent successfully',
  })
  async sendNow(@Param('id') id: string) {
    await this.messageDraftsService.sendNow(id);
    return ResponseUtil.success(null, 'Message draft sent successfully');
  }
}
