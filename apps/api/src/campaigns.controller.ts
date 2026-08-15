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

  @Get('recommendations')
  recommendations(@Query('storeId') storeId: string) {
    return this.campaigns.recommendations(storeId);
  }

  @Get('audience')
  audience(
    @Query('storeId') storeId: string,
    @Query('objective') objective: ObjectiveKind = 'reactivate',
    @Query('cartillaId') cartillaId?: string
  ) {
    return this.campaigns.audience(storeId, objective, cartillaId);
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

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.campaigns.cancel(id);
  }

  @Get('store/:storeId')
  byStore(@Param('storeId') storeId: string) {
    return this.campaigns.list(storeId);
  }
}
