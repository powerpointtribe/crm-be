import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseUtil } from '../../common/utils/response.util';
import { CreateDonationDto, PublicAccountsQueryDto } from '../dto/giving.dto';
import { DonationsService } from '../services/donations.service';
import { GivingAccountsService } from '../services/giving-accounts.service';

/** Public giving endpoints for the website /give page. No auth. */
@ApiTags('Giving (public)')
@Public()
@Controller('giving/public')
export class GivingPublicController {
  constructor(
    private readonly accounts: GivingAccountsService,
    private readonly donations: DonationsService,
  ) {}

  @Get('accounts')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Approved giving accounts (campus accounts + shared accounts)',
  })
  async listAccounts(@Query() q: PublicAccountsQueryDto) {
    return ResponseUtil.success(
      await this.accounts.publicList(q.branch),
      'Giving accounts retrieved',
    );
  }

  @Get('providers')
  @SkipThrottle()
  @ApiOperation({
    summary:
      'Online payment providers that are configured ([] = online giving off)',
  })
  providers() {
    return ResponseUtil.success(
      this.donations.providers(),
      'Payment providers retrieved',
    );
  }

  @Post('donations')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Start an online gift; redirect the giver to paymentLink',
  })
  @ApiResponse({ status: 201, description: '{ reference, paymentLink }' })
  @ApiResponse({ status: 400, description: 'Invalid body or honeypot filled' })
  @ApiResponse({ status: 502, description: 'Flutterwave error' })
  @ApiResponse({ status: 503, description: 'Online giving not configured' })
  async createDonation(@Body() dto: CreateDonationDto) {
    return ResponseUtil.success(
      await this.donations.create(dto),
      'Payment started',
    );
  }

  @Get('donations/:reference/status')
  @SkipThrottle()
  @ApiOperation({
    summary:
      'Status of a gift (thank-you page polls this; settles with Flutterwave at most every 10 s)',
  })
  @ApiResponse({ status: 400, description: 'Not a PPTG- reference' })
  @ApiResponse({ status: 404, description: 'Unknown reference' })
  async donationStatus(@Param('reference') reference: string) {
    return ResponseUtil.success(
      await this.donations.status(reference),
      'Donation status retrieved',
    );
  }
}
