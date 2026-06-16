import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PortalService } from './portal.service';
import {
  PortalLoginDto,
  RequestSetupDto,
  SetPasswordDto,
} from './dto/portal-auth.dto';
import { PortalJwtGuard } from './guards/portal-jwt.guard';
import { CurrentPortalAccount } from './decorators/current-portal-account.decorator';
import { PortalAccountDocument } from './schemas/portal-account.schema';

/**
 * Learner (LMS) portal — attendee-facing auth + profile. Path kept as
 * `/trainee/*` to match the existing cmit portal client; it is event-agnostic.
 */
@ApiTags('Portal')
@Controller('trainee')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Public()
  @Post('auth/request-setup')
  async requestSetup(@Body() dto: RequestSetupDto) {
    return this.portalService.requestSetup(dto.email, dto.eventSlug);
  }

  @Public()
  @Post('auth/set-password')
  async setPassword(@Body() dto: SetPasswordDto) {
    return this.portalService.setPassword(dto.token, dto.password);
  }

  @Public()
  @Post('auth/login')
  async login(@Body() dto: PortalLoginDto) {
    return this.portalService.login(dto.email, dto.password);
  }

  @UseGuards(PortalJwtGuard)
  @Get('me')
  async me(@CurrentPortalAccount() account: PortalAccountDocument) {
    return this.portalService.me(account);
  }

  @UseGuards(PortalJwtGuard)
  @Get('me/events')
  async myEvents(@CurrentPortalAccount() account: PortalAccountDocument) {
    return this.portalService.myEvents(account);
  }
}
