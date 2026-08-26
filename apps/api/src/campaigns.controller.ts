import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import type { ObjectiveKind } from '@onda/shared-utils';

@Controller('campaigns')
export class CampaignsController {
  constructor(@Inject(CampaignsService) private campaigns: CampaignsService) {}

  @Get()
  list(@Query('storeId') storeId: string) {
    return this.campaigns.list(storeId);
  }

  @Get('quota')
  quota(@Query('storeId') storeId: string) {
    return this.campaigns.quota(storeId);
  }

  @Get('analytics')
  analytics(
    @Query('storeId') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.campaigns.analytics(storeId, from, to);
  }

  @Get('recommendations')
  recommendations(@Query('storeId') storeId: string) {
    return this.campaigns.recommendations(storeId);
  }

  @Get('audience')
  audience(
    @Query('storeId') storeId: string,
    @Query('objective') objective: ObjectiveKind = 'reactivate',
    @Query('cartillaId') cartillaId?: string,
    @Query('inactiveDays') inactiveDays?: string,
    @Query('minVisits') minVisits?: string,
    @Query('slowWindow') slowWindow?: string,
    @Query('maxPointsGap') maxPointsGap?: string,
    @Query('activeWithinDays') activeWithinDays?: string,
    @Query('redeemWithinDays') redeemWithinDays?: string,
    @Query('requireWallet') requireWallet?: string
  ) {
    return this.campaigns.audience(storeId, objective, cartillaId, {
      inactiveDays: parseOptionalInt(inactiveDays),
      minVisits: parseOptionalInt(minVisits),
      slowWindow,
      maxPointsGap: parseOptionalInt(maxPointsGap),
      activeWithinDays: parseOptionalInt(activeWithinDays),
      redeemWithinDays: parseOptionalInt(redeemWithinDays),
      requireWallet: requireWallet === '1' || requireWallet === 'true',
    });
  }

  @Post()
  create(@Body() body: Parameters<CampaignsService['create']>[0]) {
    return this.campaigns.create(body);
  }

  @Post('purchase')
  purchase(
    @Body() body: { storeId: string; sku: 'single' | 'pack' | 'subscribe' }
  ) {
    return this.campaigns.purchase(body.storeId, body.sku);
  }

  @Post('subscription/cancel')
  cancelSub(@Body() body: { storeId: string }) {
    return this.campaigns.cancelPackSubscription(body.storeId);
  }

  @Get(':id/results')
  results(@Param('id') id: string) {
    return this.campaigns.results(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.campaigns.cancel(id);
  }

  @Get('store/:storeId')
  byStore(@Param('storeId') storeId: string) {
    return this.campaigns.list(storeId);
  }
}

function parseOptionalInt(raw?: string) {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}
