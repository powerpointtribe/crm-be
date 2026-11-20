import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseUtil } from '../../common/utils/response.util';
import {
  PublicDevotionalQueryDto,
  PublicFaqQueryDto,
  PublicPageDto,
  PublicSeriesPartsQueryDto,
  PublicSermonQueryDto,
  PublicSnippetQueryDto,
} from '../dto/public-query.dto';
import { WebContentService } from '../services/web-content.service';
import { WebsiteSettingsService } from '../services/website-settings.service';
import { WebSermonsService } from '../services/sermons.service';

/**
 * Public reads for the website. No auth. Throttling is skipped because the
 * website server makes these calls for every visitor from one IP (decision
 * Q14); they are cheap, read-only and cached by the website.
 */
@ApiTags('Website (public)')
@Public()
@SkipThrottle()
@Controller('website/public')
export class WebsitePublicController {
  constructor(
    private readonly sermons: WebSermonsService,
    private readonly content: WebContentService,
    private readonly settings: WebsiteSettingsService,
  ) {}

  @Get('settings')
  @ApiOperation({
    summary: 'Service strip, socials, hero video, contact emails',
  })
  async getSettings() {
    return ResponseUtil.success(
      await this.settings.getPublic(),
      'Website settings retrieved',
    );
  }

  @Get('sermons')
  @ApiOperation({
    summary: 'Published sermons: filter by service and campus, search, sort',
  })
  async sermonList(@Query() q: PublicSermonQueryDto) {
    return ResponseUtil.success(
      await this.sermons.publicList(q),
      'Sermons retrieved',
    );
  }

  @Get('sermons/latest')
  @ApiOperation({
    summary: 'Latest published sermon (live is always false for now)',
  })
  async latestSermon() {
    return ResponseUtil.success(
      await this.sermons.publicLatest(),
      'Latest sermon retrieved',
    );
  }

  @Get('series')
  @ApiOperation({ summary: 'Published series, newest first, with partsCount' })
  async seriesList(@Query() q: PublicPageDto) {
    return ResponseUtil.success(
      await this.sermons.publicSeriesList(q.page, q.limit),
      'Series retrieved',
    );
  }

  @Get('series/:slug')
  @ApiOperation({ summary: 'One published series and its parts (paginated)' })
  async series(
    @Param('slug') slug: string,
    @Query() q: PublicSeriesPartsQueryDto,
  ) {
    return ResponseUtil.success(
      await this.sermons.publicSeries(slug, q),
      'Series retrieved',
    );
  }

  @Get('devotionals')
  @ApiOperation({ summary: 'Latest "Push Buttons" devotionals' })
  async devotionals(@Query() q: PublicDevotionalQueryDto) {
    return ResponseUtil.success(
      await this.content.publicDevotionals(q.limit),
      'Devotionals retrieved',
    );
  }

  @Get('pastors')
  async pastors() {
    return ResponseUtil.success(
      await this.content.publicPastors(),
      'Pastors retrieved',
    );
  }

  @Get('testimonies')
  @ApiOperation({ summary: 'Approved, published testimonies' })
  async testimonies() {
    return ResponseUtil.success(
      await this.content.publicTestimonies(),
      'Testimonies retrieved',
    );
  }

  @Get('snippets')
  @ApiOperation({
    summary: 'Units to serve in (kind=unit) or tribe groups (kind=tribe_group)',
  })
  async snippets(@Query() q: PublicSnippetQueryDto) {
    return ResponseUtil.success(
      await this.content.publicSnippets(q.kind),
      'Snippets retrieved',
    );
  }

  @Get('faqs')
  @ApiOperation({ summary: 'FAQs for the give or visit page' })
  async faqs(@Query() q: PublicFaqQueryDto) {
    return ResponseUtil.success(
      await this.content.publicFaqs(q.page),
      'FAQs retrieved',
    );
  }
}
