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

  @Get('propose')
  propose(
    @Query('storeId') storeId: string,
    @Query('objective') objective: ObjectiveKind = 'reactivate'
  ) {
    return this.campaigns.propose(storeId, objective);
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
    @Query('negativeWithinDays') negativeWithinDays?: string,
    @Query('slowDows') slowDows?: string,
    @Query('slowStartHour') slowStartHour?: string,
    @Query('slowEndHour') slowEndHour?: string,
    @Query('requireWallet') requireWallet?: string
  ) {
    return this.campaigns.audience(storeId, objective, cartillaId, {
      inactiveDays: parseOptionalInt(inactiveDays),
      minVisits: parseOptionalInt(minVisits),
      slowWindow,
      maxPointsGap: parseOptionalInt(maxPointsGap),
      activeWithinDays: parseOptionalInt(activeWithinDays),
      redeemWithinDays: parseOptionalInt(redeemWithinDays),
      negativeWithinDays: parseOptionalInt(negativeWithinDays),
      slowDows: parseDows(slowDows),
      slowStartHour: parseOptionalInt(slowStartHour),
      slowEndHour: parseOptionalInt(slowEndHour),
      requireWallet: requireWallet === '1' || requireWallet === 'true',
    });
  }

  @Get('audience/browse')
  browseAudience(
    @Query('storeId') storeId: string,
    @Query('search') search?: string,
    @Query('inactiveFrom') inactiveFrom?: string,
    @Query('inactiveTo') inactiveTo?: string,
    @Query('ondasGap') ondasGap?: string,
    @Query('requireWallet') requireWallet?: string
  ) {
    return this.campaigns.browseAudience(storeId, {
      search,
      inactiveFrom: parseOptionalInt(inactiveFrom),
      inactiveTo: parseOptionalInt(inactiveTo),
      ondasGap: parseOptionalInt(ondasGap),
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

  @Post(':id/relaunch')
  relaunch(@Param('id') id: string) {
    return this.campaigns.relaunch(id);
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

/** "2,3" → [2, 3] (lunes=1 … domingo=7). */
function parseDows(raw?: string) {
  if (!raw) return undefined;
  const list = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  return list.length ? [...new Set(list)].sort((a, b) => a - b) : undefined;
}
