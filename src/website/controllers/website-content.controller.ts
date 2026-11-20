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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AuditAction, AuditEntity } from '../../common/enums/audit-action.enum';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { ResponseUtil } from '../../common/utils/response.util';
import { RequirePermission } from '../../roles/decorators/require-permission.decorator';
import { PermissionGuard } from '../../roles/guards/permission.guard';
import {
  ContentListQueryDto,
  CreateWebDevotionalDto,
  CreateWebFaqDto,
  CreateWebPastorDto,
  CreateWebSeriesDto,
  CreateWebSermonDto,
  CreateWebSnippetDto,
  CreateWebTestimonyDto,
  UpdateWebDevotionalDto,
  UpdateWebFaqDto,
  UpdateWebPastorDto,
  UpdateWebSeriesDto,
  UpdateWebSermonDto,
  UpdateWebSnippetDto,
  UpdateWebTestimonyDto,
} from '../dto/content.dto';
import { WebsitePermission as P } from '../permissions';
import { WebContentService } from '../services/web-content.service';
import { WebsiteAccessService } from '../services/website-access.service';
import { WebSermonsService } from '../services/sermons.service';

/*
 * Staff CRUD for website content. Every route needs a staff JWT plus the
 * route's permission. Changing `status`/`publishAt` also needs
 * website:publish-content (WebsiteAccessService.assertCanPublish).
 */

type StaffRequest = {
  user: { _id: Types.ObjectId; role?: unknown; membershipStatus?: string };
};

const idOf = (result: { data?: { _id?: { toString(): string } } }) =>
  result?.data?._id?.toString() ?? '';
const paramId = (_r: unknown, req: { params: { id: string } }) => req.params.id;

const statusFilter = (q: ContentListQueryDto) =>
  q.status ? { status: q.status } : {};
const branchFilter = (q: ContentListQueryDto) => ({
  ...statusFilter(q),
  ...(q.branch
    ? { branch: q.branch === 'none' ? null : new Types.ObjectId(q.branch) }
    : {}),
});
const sermonFilter = (q: ContentListQueryDto) => ({
  ...branchFilter(q),
  ...(q.service ? { service: q.service } : {}),
  ...(q.series ? { series: new Types.ObjectId(q.series) } : {}),
});

@ApiTags('Website (staff)')
@ApiBearerAuth()
@Controller('website/sermons')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class WebsiteSermonsController {
  constructor(
    private readonly sermons: WebSermonsService,
    private readonly content: WebContentService,
    private readonly access: WebsiteAccessService,
  ) {}

  @Get()
  @RequirePermission(P.VIEW_CONTENT)
  @ApiOperation({ summary: 'List website sermons (staff)' })
  async list(@Query() q: ContentListQueryDto) {
    const data = await this.sermons.sermons.list(q, sermonFilter(q), [
      'branch',
      'series',
    ]);
    return ResponseUtil.success(data, 'Sermon list retrieved');
  }

  @Get(':id')
  @RequirePermission(P.VIEW_CONTENT)
  async get(@Param('id') id: string) {
    return ResponseUtil.success(
      await this.sermons.sermons.findById(id),
      'Sermon retrieved',
    );
  }

  @Post()
  @RequirePermission(P.CREATE_CONTENT)
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Created website sermon',
    getEntityId: idOf,
  })
  async create(@Body() dto: CreateWebSermonDto, @Request() req: StaffRequest) {
    await this.access.assertCanPublish(req.user, dto, 'create');
    const doc = await this.sermons.sermons.create(dto as never, req.user._id);
    return ResponseUtil.success(doc, 'Sermon created');
  }

  @Patch(':id')
  @RequirePermission(P.UPDATE_CONTENT)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Updated website sermon',
    getEntityId: paramId,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebSermonDto,
    @Request() req: StaffRequest,
  ) {
    await this.access.assertCanPublish(req.user, dto, 'update');
    const doc = await this.sermons.sermons.update(
      id,
      dto as never,
      req.user._id,
    );
    return ResponseUtil.success(doc, 'Sermon updated');
  }

  @Delete(':id')
  @RequirePermission(P.DELETE_CONTENT)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Deleted website sermon',
    getEntityId: paramId,
  })
  async remove(@Param('id') id: string) {
    await this.sermons.sermons.remove(id);
    return ResponseUtil.success(null, 'Sermon deleted');
  }
}

@ApiTags('Website (staff)')
@ApiBearerAuth()
@Controller('website/series')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class WebsiteSeriesController {
  constructor(
    private readonly sermons: WebSermonsService,
    private readonly content: WebContentService,
    private readonly access: WebsiteAccessService,
  ) {}

  @Get()
  @RequirePermission(P.VIEW_CONTENT)
  @ApiOperation({ summary: 'List website series (staff)' })
  async list(@Query() q: ContentListQueryDto) {
    const data = await this.sermons.series.list(q, statusFilter(q), []);
    return ResponseUtil.success(data, 'Series list retrieved');
  }

  @Get(':id')
  @RequirePermission(P.VIEW_CONTENT)
  async get(@Param('id') id: string) {
    return ResponseUtil.success(
      await this.sermons.series.findById(id),
      'Series retrieved',
    );
  }

  @Post()
  @RequirePermission(P.CREATE_CONTENT)
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Created website series',
    getEntityId: idOf,
  })
  async create(@Body() dto: CreateWebSeriesDto, @Request() req: StaffRequest) {
    await this.access.assertCanPublish(req.user, dto, 'create');
    const doc = await this.sermons.series.create(dto as never, req.user._id);
    return ResponseUtil.success(doc, 'Series created');
  }

  @Patch(':id')
  @RequirePermission(P.UPDATE_CONTENT)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Updated website series',
    getEntityId: paramId,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebSeriesDto,
    @Request() req: StaffRequest,
  ) {
    await this.access.assertCanPublish(req.user, dto, 'update');
    const doc = await this.sermons.series.update(
      id,
      dto as never,
      req.user._id,
    );
    return ResponseUtil.success(doc, 'Series updated');
  }

  @Delete(':id')
  @RequirePermission(P.DELETE_CONTENT)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Deleted website series',
    getEntityId: paramId,
  })
  async remove(@Param('id') id: string) {
    await this.sermons.series.remove(id);
    return ResponseUtil.success(null, 'Series deleted');
  }
}

@ApiTags('Website (staff)')
@ApiBearerAuth()
@Controller('website/devotionals')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class WebsiteDevotionalsController {
  constructor(
    private readonly sermons: WebSermonsService,
    private readonly content: WebContentService,
    private readonly access: WebsiteAccessService,
  ) {}

  @Get()
  @RequirePermission(P.VIEW_CONTENT)
  @ApiOperation({ summary: 'List website devotionals (staff)' })
  async list(@Query() q: ContentListQueryDto) {
    const data = await this.content.devotionals.list(q, statusFilter(q), []);
    return ResponseUtil.success(data, 'Devotional list retrieved');
  }

  @Get(':id')
  @RequirePermission(P.VIEW_CONTENT)
  async get(@Param('id') id: string) {
    return ResponseUtil.success(
      await this.content.devotionals.findById(id),
      'Devotional retrieved',
    );
  }

  @Post()
  @RequirePermission(P.CREATE_CONTENT)
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Created website devotional',
    getEntityId: idOf,
  })
  async create(
    @Body() dto: CreateWebDevotionalDto,
    @Request() req: StaffRequest,
  ) {
    await this.access.assertCanPublish(req.user, dto, 'create');
    const doc = await this.content.devotionals.create(
      dto as never,
      req.user._id,
    );
    return ResponseUtil.success(doc, 'Devotional created');
  }

  @Patch(':id')
  @RequirePermission(P.UPDATE_CONTENT)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Updated website devotional',
    getEntityId: paramId,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebDevotionalDto,
    @Request() req: StaffRequest,
  ) {
    await this.access.assertCanPublish(req.user, dto, 'update');
    const doc = await this.content.devotionals.update(
      id,
      dto as never,
      req.user._id,
    );
    return ResponseUtil.success(doc, 'Devotional updated');
  }

  @Delete(':id')
  @RequirePermission(P.DELETE_CONTENT)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Deleted website devotional',
    getEntityId: paramId,
  })
  async remove(@Param('id') id: string) {
    await this.content.devotionals.remove(id);
    return ResponseUtil.success(null, 'Devotional deleted');
  }
}

@ApiTags('Website (staff)')
@ApiBearerAuth()
@Controller('website/pastors')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class WebsitePastorsController {
  constructor(
    private readonly sermons: WebSermonsService,
    private readonly content: WebContentService,
    private readonly access: WebsiteAccessService,
  ) {}

  @Get()
  @RequirePermission(P.VIEW_CONTENT)
  @ApiOperation({ summary: 'List website pastors (staff)' })
  async list(@Query() q: ContentListQueryDto) {
    const data = await this.content.pastors.list(q, branchFilter(q), [
      'branch',
    ]);
    return ResponseUtil.success(data, 'Pastor list retrieved');
  }

  @Get(':id')
  @RequirePermission(P.VIEW_CONTENT)
  async get(@Param('id') id: string) {
    return ResponseUtil.success(
      await this.content.pastors.findById(id),
      'Pastor retrieved',
    );
  }

  @Post()
  @RequirePermission(P.CREATE_CONTENT)
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Created website pastor',
    getEntityId: idOf,
  })
  async create(@Body() dto: CreateWebPastorDto, @Request() req: StaffRequest) {
    await this.access.assertCanPublish(req.user, dto, 'create');
    const doc = await this.content.pastors.create(dto as never, req.user._id);
    return ResponseUtil.success(doc, 'Pastor created');
  }

  @Patch(':id')
  @RequirePermission(P.UPDATE_CONTENT)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Updated website pastor',
    getEntityId: paramId,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebPastorDto,
    @Request() req: StaffRequest,
  ) {
    await this.access.assertCanPublish(req.user, dto, 'update');
    const doc = await this.content.pastors.update(
      id,
      dto as never,
      req.user._id,
    );
    return ResponseUtil.success(doc, 'Pastor updated');
  }

  @Delete(':id')
  @RequirePermission(P.DELETE_CONTENT)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Deleted website pastor',
    getEntityId: paramId,
  })
  async remove(@Param('id') id: string) {
    await this.content.pastors.remove(id);
    return ResponseUtil.success(null, 'Pastor deleted');
  }
}

@ApiTags('Website (staff)')
@ApiBearerAuth()
@Controller('website/testimonies')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class WebsiteTestimoniesController {
  constructor(
    private readonly sermons: WebSermonsService,
    private readonly content: WebContentService,
    private readonly access: WebsiteAccessService,
  ) {}

  @Get()
  @RequirePermission(P.VIEW_CONTENT)
  @ApiOperation({ summary: 'List website testimonies (staff)' })
  async list(@Query() q: ContentListQueryDto) {
    const data = await this.content.testimonies.list(q, branchFilter(q), [
      'branch',
    ]);
    return ResponseUtil.success(data, 'Testimony list retrieved');
  }

  @Get(':id')
  @RequirePermission(P.VIEW_CONTENT)
  async get(@Param('id') id: string) {
    return ResponseUtil.success(
      await this.content.testimonies.findById(id),
      'Testimony retrieved',
    );
  }

  @Post()
  @RequirePermission(P.CREATE_CONTENT)
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Created website testimony',
    getEntityId: idOf,
  })
  async create(
    @Body() dto: CreateWebTestimonyDto,
    @Request() req: StaffRequest,
  ) {
    await this.access.assertCanPublish(req.user, dto, 'create');
    const doc = await this.content.testimonies.create(
      dto as never,
      req.user._id,
    );
    return ResponseUtil.success(doc, 'Testimony created');
  }

  @Patch(':id')
  @RequirePermission(P.UPDATE_CONTENT)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Updated website testimony',
    getEntityId: paramId,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebTestimonyDto,
    @Request() req: StaffRequest,
  ) {
    await this.access.assertCanPublish(req.user, dto, 'update');
    const doc = await this.content.testimonies.update(
      id,
      dto as never,
      req.user._id,
    );
    return ResponseUtil.success(doc, 'Testimony updated');
  }

  @Delete(':id')
  @RequirePermission(P.DELETE_CONTENT)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Deleted website testimony',
    getEntityId: paramId,
  })
  async remove(@Param('id') id: string) {
    await this.content.testimonies.remove(id);
    return ResponseUtil.success(null, 'Testimony deleted');
  }
}

@ApiTags('Website (staff)')
@ApiBearerAuth()
@Controller('website/snippets')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class WebsiteSnippetsController {
  constructor(
    private readonly sermons: WebSermonsService,
    private readonly content: WebContentService,
    private readonly access: WebsiteAccessService,
  ) {}

  @Get()
  @RequirePermission(P.VIEW_CONTENT)
  @ApiOperation({ summary: 'List website snippets (staff)' })
  async list(@Query() q: ContentListQueryDto) {
    const data = await this.content.snippets.list(
      q,
      { ...statusFilter(q), ...(q.kind ? { kind: q.kind } : {}) },
      [],
    );
    return ResponseUtil.success(data, 'Snippet list retrieved');
  }

  @Get(':id')
  @RequirePermission(P.VIEW_CONTENT)
  async get(@Param('id') id: string) {
    return ResponseUtil.success(
      await this.content.snippets.findById(id),
      'Snippet retrieved',
    );
  }

  @Post()
  @RequirePermission(P.CREATE_CONTENT)
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Created website snippet',
    getEntityId: idOf,
  })
  async create(@Body() dto: CreateWebSnippetDto, @Request() req: StaffRequest) {
    await this.access.assertCanPublish(req.user, dto, 'create');
    const doc = await this.content.snippets.create(dto as never, req.user._id);
    return ResponseUtil.success(doc, 'Snippet created');
  }

  @Patch(':id')
  @RequirePermission(P.UPDATE_CONTENT)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Updated website snippet',
    getEntityId: paramId,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebSnippetDto,
    @Request() req: StaffRequest,
  ) {
    await this.access.assertCanPublish(req.user, dto, 'update');
    const doc = await this.content.snippets.update(
      id,
      dto as never,
      req.user._id,
    );
    return ResponseUtil.success(doc, 'Snippet updated');
  }

  @Delete(':id')
  @RequirePermission(P.DELETE_CONTENT)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Deleted website snippet',
    getEntityId: paramId,
  })
  async remove(@Param('id') id: string) {
    await this.content.snippets.remove(id);
    return ResponseUtil.success(null, 'Snippet deleted');
  }
}

@ApiTags('Website (staff)')
@ApiBearerAuth()
@Controller('website/faqs')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class WebsiteFaqsController {
  constructor(
    private readonly sermons: WebSermonsService,
    private readonly content: WebContentService,
    private readonly access: WebsiteAccessService,
  ) {}

  @Get()
  @RequirePermission(P.VIEW_CONTENT)
  @ApiOperation({ summary: 'List website faqs (staff)' })
  async list(@Query() q: ContentListQueryDto) {
    const data = await this.content.faqs.list(
      q,
      { ...statusFilter(q), ...(q.faqPage ? { page: q.faqPage } : {}) },
      [],
    );
    return ResponseUtil.success(data, 'FAQ list retrieved');
  }

  @Get(':id')
  @RequirePermission(P.VIEW_CONTENT)
  async get(@Param('id') id: string) {
    return ResponseUtil.success(
      await this.content.faqs.findById(id),
      'FAQ retrieved',
    );
  }

  @Post()
  @RequirePermission(P.CREATE_CONTENT)
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Created website faq',
    getEntityId: idOf,
  })
  async create(@Body() dto: CreateWebFaqDto, @Request() req: StaffRequest) {
    await this.access.assertCanPublish(req.user, dto, 'create');
    const doc = await this.content.faqs.create(dto as never, req.user._id);
    return ResponseUtil.success(doc, 'FAQ created');
  }

  @Patch(':id')
  @RequirePermission(P.UPDATE_CONTENT)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Updated website faq',
    getEntityId: paramId,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebFaqDto,
    @Request() req: StaffRequest,
  ) {
    await this.access.assertCanPublish(req.user, dto, 'update');
    const doc = await this.content.faqs.update(id, dto as never, req.user._id);
    return ResponseUtil.success(doc, 'FAQ updated');
  }

  @Delete(':id')
  @RequirePermission(P.DELETE_CONTENT)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.WEBSITE_CONTENT,
    description: 'Deleted website faq',
    getEntityId: paramId,
  })
  async remove(@Param('id') id: string) {
    await this.content.faqs.remove(id);
    return ResponseUtil.success(null, 'FAQ deleted');
  }
}

export const WEBSITE_CONTENT_CONTROLLERS = [
  WebsiteSermonsController,
  WebsiteSeriesController,
  WebsiteDevotionalsController,
  WebsitePastorsController,
  WebsiteTestimoniesController,
  WebsiteSnippetsController,
  WebsiteFaqsController,
];
