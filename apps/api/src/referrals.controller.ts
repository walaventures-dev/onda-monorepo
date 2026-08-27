import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { getDemoReferralCode, isDemoReferralCode, normalizeReferralCode } from './demo-referral';

@Controller('referrals')
export class ReferralsController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Get('resolve/:code')
  async resolve(@Param('code') code: string) {
    const normalized = normalizeReferralCode(code);
    if (!normalized) {
      throw new NotFoundException('Código de referido no encontrado');
    }
    if (isDemoReferralCode(normalized)) {
      return {
        code: getDemoReferralCode(),
        storeName: 'Onda (demo)',
        demo: true,
      };
    }
    const store = await this.prisma.store.findUnique({
      where: { referralCode: normalized },
      select: { name: true, referralCode: true },
    });
    if (!store) {
      throw new NotFoundException('Código de referido no encontrado');
    }
    return { code: store.referralCode, storeName: store.name, demo: false };
  }

  @Get('store/:storeId')
  async summary(@Param('storeId') storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        referralCode: true,
        freeMonthsBalance: true,
        createdAt: true,
      },
    });

    const referredStores = await this.prisma.store.findMany({
      where: { referredByStoreId: storeId },
      select: { id: true, name: true, createdAt: true, slug: true },
      orderBy: { createdAt: 'asc' },
    });

    const fromReferrals = referredStores.length;
    const welcomeMonths = Math.max(0, store.freeMonthsBalance - fromReferrals);

    const freeMonthCredits: Array<{
      id: string;
      type: 'WELCOME' | 'REFERRAL';
      label: string;
      months: number;
      earnedAt: string;
      storeId?: string;
      slug?: string;
    }> = [];

    if (welcomeMonths > 0) {
      freeMonthCredits.push({
        id: `welcome-${store.id}`,
        type: 'WELCOME',
        label: 'Mes de bienvenida',
        months: welcomeMonths,
        earnedAt: store.createdAt.toISOString(),
      });
    }

    for (const s of referredStores) {
      freeMonthCredits.push({
        id: `referral-${s.id}`,
        type: 'REFERRAL',
        label: s.name,
        months: 1,
        earnedAt: s.createdAt.toISOString(),
        storeId: s.id,
        slug: s.slug,
      });
    }

    return {
      storeId: store.id,
      storeName: store.name,
      storeCreatedAt: store.createdAt.toISOString(),
      referralCode: store.referralCode,
      freeMonthsBalance: store.freeMonthsBalance,
      freeMonthsBreakdown: {
        welcome: welcomeMonths,
        fromReferrals,
        total: store.freeMonthsBalance,
      },
      freeMonthCredits,
      referredStores: [...referredStores].reverse(),
    };
  }
}
