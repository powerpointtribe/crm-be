import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { LmsService } from './lms.service';
import { ZoomService } from '../zoom/zoom.service';

/**
 * Public Zoom event-webhook receiver. Handles the endpoint URL-validation (CRC)
 * challenge and `meeting.ended` — when a host ends a meeting, the matching live
 * session is auto-ended for students (no manual "End live session" needed).
 *
 * Configure in the Zoom app: Event Subscription → endpoint
 *   POST {API}/lms/zoom/webhook  · event: "End Meeting"
 * and set ZOOM_WEBHOOK_SECRET_TOKEN to the app's Secret Token.
 */
@ApiTags('Zoom webhooks')
@Controller('lms/zoom')
export class LmsZoomWebhookController {
  constructor(
    private readonly lms: LmsService,
    private readonly zoom: ZoomService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: any,
    @Headers('x-zm-signature') signature?: string,
    @Headers('x-zm-request-timestamp') timestamp?: string,
  ) {
    // Zoom endpoint URL validation — echo the token, HMAC'd with the secret.
    if (body?.event === 'endpoint.url_validation') {
      return this.zoom.webhookCrcResponse(body?.payload?.plainToken);
    }

    // Verify the request really came from Zoom.
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(body ?? {});
    if (!this.zoom.verifyWebhookSignature(signature, timestamp, rawBody)) {
      throw new UnauthorizedException('Invalid Zoom webhook signature');
    }

    if (body?.event === 'meeting.ended') {
      const meetingId = body?.payload?.object?.id;
      await this.lms.handleZoomMeetingEnded(String(meetingId ?? ''));
    }

    return { received: true };
  }
}
