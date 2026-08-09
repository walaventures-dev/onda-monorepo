import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('referrals')
export class ReferralsController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Get('resolve/:code')
  async resolve(@Param('code') code: string) {
    const store = await this.prisma.store.findUnique({
      where: { referralCode: code.trim().toUpperCase() },
      select: { name: true, referralCode: true },
    });
    if (!store) {
      throw new NotFoundException('Código de referido no encontrado');
    }
    return { code: store.referralCode, storeName: store.name };
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
      },
    });

    const referredStores = await this.prisma.store.findMany({
      where: { referredByStoreId: storeId },
      select: { id: true, name: true, createdAt: true, slug: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      storeId: store.id,
      storeName: store.name,
      referralCode: store.referralCode,
      freeMonthsBalance: store.freeMonthsBalance,
      referredStores,
    };
  }
}
