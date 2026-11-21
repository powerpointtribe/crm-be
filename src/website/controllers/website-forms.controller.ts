import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseUtil } from '../../common/utils/response.util';
import {
  CareDropoffFormDto,
  DcInterestFormDto,
  EventNotifyFormDto,
  PartnerFormDto,
  SubscribeDto,
  VisitFormDto,
} from '../dto/forms.dto';
import { WebsiteFormsService } from '../services/website-forms.service';

/** 5 per minute per IP (browsers post these directly, so req.ip is the visitor). */
const FORM_LIMIT = { default: { limit: 5, ttl: 60_000 } };
const MESSAGE = 'Thanks! We received your details.';

/**
 * Public website forms. All reply 201 `{ status: 'received' }`. A filled
 * `website` honeypot gets the same reply and nothing is stored.
 */
@ApiTags('Website (public)')
@Public()
@Throttle(FORM_LIMIT)
@Controller('website/public')
export class WebsiteFormsController {
  constructor(private readonly forms: WebsiteFormsService) {}

  @Post('forms/visit')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Plan a visit',
    description:
      'Saves an inbox submission, creates (or links) a CRM first-timer with the planned visit date, and emails a confirmation when an email is given.',
  })
  @ApiResponse({ status: 201, description: 'Received' })
  @ApiResponse({ status: 400, description: 'Invalid input or unknown campus' })
  @ApiResponse({ status: 429, description: 'Too many submissions' })
  async visit(@Body() dto: VisitFormDto) {
    return ResponseUtil.success(await this.forms.visit(dto), MESSAGE);
  }

  @Post('forms/partner')
  @HttpCode(201)
  @ApiOperation({ summary: 'Kingdom partner registration' })
  async partner(@Body() dto: PartnerFormDto) {
    return ResponseUtil.success(await this.forms.partner(dto), MESSAGE);
  }

  @Post('forms/care-dropoff')
  @HttpCode(201)
  @ApiOperation({ summary: 'Care Closet drop-off booking' })
  async careDropoff(@Body() dto: CareDropoffFormDto) {
    return ResponseUtil.success(await this.forms.careDropoff(dto), MESSAGE);
  }

  @Post('forms/dc-interest')
  @HttpCode(201)
  @ApiOperation({ summary: "David's Company (workforce) interest" })
  async dcInterest(@Body() dto: DcInterestFormDto) {
    return ResponseUtil.success(await this.forms.dcInterest(dto), MESSAGE);
  }

  @Post('forms/event-notify')
  @HttpCode(201)
  @ApiOperation({ summary: 'Tell me when events are announced' })
  async eventNotify(@Body() dto: EventNotifyFormDto) {
    return ResponseUtil.success(await this.forms.eventNotify(dto), MESSAGE);
  }

  @Post('subscriptions')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Merch drop / newsletter sign-up (email or WhatsApp number)',
  })
  async subscribe(@Body() dto: SubscribeDto) {
    return ResponseUtil.success(await this.forms.subscribe(dto), MESSAGE);
  }
}
