import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JobsService } from './jobs.service';
import {
  PLAN_SMS_CAMPAIGNS_MONTHLY,
  assertCanLaunchSmsCampaign,
  monthlySmsCampaignsUsed,
} from './plan-quota';

@Controller('campaigns')
export class CampaignsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(JobsService) private jobs: JobsService
  ) {}

  @Get()
  async list(@Query('storeId') storeId: string) {
    const [campaigns, smsUsed] = await Promise.all([
      this.prisma.campaign.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      monthlySmsCampaignsUsed(this.prisma, storeId),
    ]);
    return {
      campaigns,
      smsCampaignsUsed: smsUsed,
      smsCampaignsLimit: PLAN_SMS_CAMPAIGNS_MONTHLY,
    };
  }

  @Post()
  async create(
    @Body()
    body: {
      storeId: string;
      title: string;
      channel?: 'SMS' | 'WALLET';
    }
  ) {
    const channel = body.channel === 'WALLET' ? 'WALLET' : 'SMS';
    const title = (body.title || '').trim() || 'Campaña SMS';
    const campaign = await this.prisma.$transaction(async (tx) => {
      if (channel === 'SMS') {
        await assertCanLaunchSmsCampaign(tx, body.storeId);
      }
      return tx.campaign.create({
        data: {
          storeId: body.storeId,
          channel,
          title,
        },
      });
    });

    if (channel === 'SMS') {
      await this.jobs.enqueue('brevo-sms', {
        storeId: body.storeId,
        title,
        campaignId: campaign.id,
      });
    } else {
      const passes = await this.prisma.pass.findMany({
        where: { storeId: body.storeId, walletRef: { not: null } },
        select: { walletRef: true },
      });
      for (const pass of passes) {
        if (!pass.walletRef) continue;
        await this.jobs.enqueue('wallet-notify', {
          walletRef: pass.walletRef,
          message: title,
        });
      }
    }

    return campaign;
  }

  @Get('store/:storeId')
  byStore(@Param('storeId') storeId: string) {
    return this.list(storeId);
  }
}
