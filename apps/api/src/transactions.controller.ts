import { Inject, BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query, } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WalletService } from './wallet.service';
import { WhatsappService } from './whatsapp.service';
import { assertCanAccumulate } from './plan-quota';

@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WalletService) private wallet: WalletService,
    @Inject(WhatsappService) private whatsapp: WhatsappService
  ) {}

  @Get()
  list(
    @Query('storeId') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('eventId') eventId?: string,
    @Query('promoTypes') promoTypes?: string
  ) {
    const types = type ? type.split(',').filter(Boolean) : undefined;
    const pTypes = promoTypes
      ? (promoTypes.split(',').filter(Boolean) as import('@prisma/client').PromotionType[])
      : undefined;
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    return this.prisma.transaction.findMany({
      where: {
        storeId,
        ...(fromDate || toDate
          ? {
              createdAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
        ...(types?.length ? { type: { in: types as any } } : {}),
        ...(eventId ? { pass: { eventId } } : {}),
        ...(pTypes?.length ? { promotion: { type: { in: pTypes } } } : {}),
      },
      include: {
        pass: { include: { user: true } },
        promotion: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @Post('accumulate')
  async accumulate(
    @Body() body: { passId: string; storeId: string; pinCode: string; points?: number }
  ) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: body.storeId },
    });
    if (store.pinCode !== body.pinCode) {
      throw new ForbiddenException('PIN inválido');
    }
    const requestedPoints = body.points ?? 1;
    const { pass, tx } = await this.prisma.$transaction(async (trx) => {
      const allowed = await assertCanAccumulate(trx, store.id, requestedPoints);
      const current = await trx.pass.findUniqueOrThrow({ where: { id: body.passId } });
      const delta = Math.max(0, Math.min(allowed, store.maxStamps - current.points));
      const updated = await trx.pass.update({
        where: { id: body.passId },
        data: { points: { increment: delta } },
        include: { user: true },
      });
      const created = await trx.transaction.create({
        data: {
          passId: updated.id,
          storeId: store.id,
          type: 'ACCUMULATE',
          points: delta,
        },
      });
      return { pass: updated, tx: created };
    });
    if (pass.walletRef) {
      await this.wallet.updatePoints(pass.walletRef, pass.points);
    }
    await this.whatsapp.enqueue({
      to: pass.user.phone,
      template: 'onda_puntos',
      variables: {
        name: pass.user.name,
        points: String(pass.points),
        store: store.name,
      },
      storeId: store.id,
    });
    await this.prisma.store.update({
      where: { id: store.id },
      data: { whatsappUsed: { increment: 1 } },
    });
    return { transaction: tx, pass };
  }

  @Post('redeem')
  async redeem(
    @Body()
    body: {
      passId: string;
      storeId: string;
      pinCode: string;
      promotionId: string;
    }
  ) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: body.storeId },
    });
    if (store.pinCode !== body.pinCode) {
      throw new ForbiddenException('PIN inválido');
    }
    const promo = await this.prisma.promotion.findUniqueOrThrow({
      where: { id: body.promotionId },
    });
    if (!promo.isActive) {
      throw new BadRequestException('Promoción inactiva');
    }
    if (promo.expiryMode === 'TIME' && promo.endsAt && promo.endsAt < new Date()) {
      throw new BadRequestException('Esta promoción ya caducó');
    }
    if (promo.expiryMode === 'QUANTITY' && promo.maxRedemptions != null) {
      const used = await this.prisma.transaction.count({
        where: { promotionId: promo.id, type: 'REDEEM' },
      });
      if (used >= promo.maxRedemptions) {
        throw new BadRequestException('Se agotaron las redenciones de esta promo');
      }
    }
    const current = await this.prisma.pass.findUniqueOrThrow({
      where: { id: body.passId },
      include: { user: true },
    });
    if (current.points < promo.pointsRequired) {
      throw new BadRequestException('Puntos insuficientes');
    }
    const pass = await this.prisma.pass.update({
      where: { id: body.passId },
      data: { points: { decrement: promo.pointsRequired } },
      include: { user: true },
    });
    const tx = await this.prisma.transaction.create({
      data: {
        passId: pass.id,
        storeId: store.id,
        type: 'REDEEM',
        points: promo.pointsRequired,
        promotionId: promo.id,
      },
    });
    if (pass.walletRef) {
      await this.wallet.updatePoints(pass.walletRef, pass.points);
    }
    return { transaction: tx, pass, promotion: promo };
  }

  @Get('store/:storeId')
  byStore(@Param('storeId') storeId: string) {
    return this.list(storeId);
  }
}
