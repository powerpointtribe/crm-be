import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ResponseUtil } from '../common/utils/response.util';
import { CreateClaimDto, PublicLostItemsQueryDto } from './dto/lost-found.dto';
import { LostFoundService } from './lost-found.service';

/** Care Closet lost-and-found on the public website. No auth. */
@ApiTags('Lost & Found (public)')
@Public()
@Controller('lost-found/public')
export class LostFoundPublicController {
  constructor(private readonly lostFound: LostFoundService) {}

  @Get('items')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Items waiting for their owner (listed or claim pending)',
  })
  async items(@Query() q: PublicLostItemsQueryDto) {
    return ResponseUtil.success(
      await this.lostFound.publicList(q),
      'Lost items retrieved',
    );
  }

  @Post('items/:id/claims')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: '"This is mine": claim a listed item' })
  @ApiResponse({
    status: 201,
    description: 'Claim received, with collection instructions',
  })
  @ApiResponse({ status: 404, description: 'Item not found or not claimable' })
  @ApiResponse({ status: 409, description: 'Someone has already claimed it' })
  @ApiResponse({ status: 429, description: 'Too many claims from this IP' })
  async claim(@Param('id') id: string, @Body() dto: CreateClaimDto) {
    return ResponseUtil.success(
      await this.lostFound.claim(id, dto),
      'Claim received',
    );
  }
}
