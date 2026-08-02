import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Readable } from 'stream';
import { Public } from '../common/decorators/public.decorator';

/**
 * Public media proxy. The module "Messages to listen to" audio lives on R2
 * (media.powerpointtribe.org), which is cross-origin and has no CORS/attachment
 * support — so the browser's `download` attribute is ignored and the file just
 * plays. This endpoint streams the file back with `Content-Disposition:
 * attachment`, forcing a real download. Host is allow-listed (no SSRF).
 */
@ApiTags('LMS media')
@Controller('lms')
export class LmsMediaController {
  @Public()
  @Get('audio-download')
  async audioDownload(@Query('u') u: string, @Res() res: Response) {
    let url: URL;
    try {
      url = new URL(u || '');
    } catch {
      throw new BadRequestException('Invalid file URL');
    }
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'media.powerpointtribe.org'
    ) {
      throw new BadRequestException('Only media.powerpointtribe.org files allowed');
    }

    const upstream = await fetch(url.toString()).catch(() => null);
    if (!upstream || !upstream.ok || !upstream.body) {
      throw new NotFoundException('File not found');
    }

    // Derive a friendly filename: strip the "<ts>-<hash>-" upload prefix.
    const raw = decodeURIComponent(url.pathname.split('/').pop() || 'audio.mp3');
    const name = (raw.replace(/^\d+-[a-f0-9]+-/i, '') || raw).replace(/["\r\n]/g, '');

    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'application/octet-stream',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    const len = upstream.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    Readable.fromWeb(upstream.body as any).pipe(res);
  }
}
