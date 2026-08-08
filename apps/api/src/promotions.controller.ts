import {
  Inject,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Delete,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PromotionType, PromotionExpiryMode } from '@prisma/client';
import { PrismaService } from './prisma.service';

function parseDateStart(value?: string) {
  if (!value) return undefined;
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateEnd(value?: string) {
  if (!value) return undefined;
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

function previousPeriod(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - ms);
  return { prevFrom, prevTo };
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function pctDelta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function assertExpiryBody(body: {
  expiryMode?: PromotionExpiryMode;
  endsAt?: string | Date | null;
  maxRedemptions?: number | null;
}) {
  const mode = body.expiryMode;
  if (!mode) {
    throw new BadRequestException('Debes indicar si caduca por tiempo o por cantidad');
  }
  if (mode === 'TIME') {
    if (!body.endsAt) {
      throw new BadRequestException('Indica hasta cuándo estará disponible');
    }
    const ends = new Date(body.endsAt);
    if (Number.isNaN(ends.getTime())) {
      throw new BadRequestException('Fecha de caducidad inválida');
    }
  }
  if (mode === 'QUANTITY') {
    const max = Number(body.maxRedemptions);
    if (!max || max < 1) {
      throw new BadRequestException('Indica cuántas redenciones máximas');
    }
  }
}

@Controller('promotions')
export class PromotionsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService
  ) {}

  @Get()
  list(
    @Query('storeId') storeId?: string,
    @Query('eventId') eventId?: string,
    @Query('type') type?: string,
    @Query('isActive') isActive?: string
  ) {
    const types = type
      ? (type.split(',').filter(Boolean) as PromotionType[])
      : undefined;
    return this.prisma.promotion.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        ...(eventId ? { eventId } : {}),
        ...(types?.length ? { type: { in: types } } : {}),
        ...(isActive === 'true' ? { isActive: true } : {}),
        ...(isActive === 'false' ? { isActive: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id/analytics')
  async analytics(
    @Param('id') id: string,
    @Query('from') fromQ?: string,
    @Query('to') toQ?: string
  ) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promoción no encontrada');

    const to =
      parseDateEnd(toQ) ||
      (() => {
        const d = new Date();
        d.setHours(23, 59, 59, 999);
        return d;
      })();
    const from =
      parseDateStart(fromQ) ||
      (() => {
        const d = new Date(to);
        d.setDate(d.getDate() - 13);
        d.setHours(0, 0, 0, 0);
        return d;
      })();
    const { prevFrom, prevTo } = previousPeriod(from, to);

    const redeemWhere = {
      promotionId: id,
      type: 'REDEEM' as const,
    };

    const [txs, prevCount, allTimeCount, storePasses] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          ...redeemWhere,
          createdAt: { gte: from, lte: to },
        },
        include: {
          pass: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({
        where: {
          ...redeemWhere,
          createdAt: { gte: prevFrom, lte: prevTo },
        },
      }),
      this.prisma.transaction.count({ where: redeemWhere }),
      promo.storeId
        ? this.prisma.pass.findMany({
            where: { storeId: promo.storeId },
            select: { id: true, points: true, userId: true },
          })
        : Promise.resolve([]),
    ]);

    const seriesMap = new Map<
      string,
      { date: string; canjes: number; ondasCost: number }
    >();
    for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
      const key = dayKey(new Date(t));
      seriesMap.set(key, { date: key, canjes: 0, ondasCost: 0 });
    }
    for (const tx of txs) {
      const key = dayKey(tx.createdAt);
      const row = seriesMap.get(key) || { date: key, canjes: 0, ondasCost: 0 };
      row.canjes += 1;
      row.ondasCost += tx.points;
      seriesMap.set(key, row);
    }
    const series = [...seriesMap.values()];

    const byUser = new Map<
      string,
      {
        userId: string;
        name: string;
        phone: string;
        redemptions: number;
        lastRedeemAt: Date;
        passId: string;
        currentPoints: number;
      }
    >();
    for (const tx of txs) {
      const u = tx.pass.user;
      const existing = byUser.get(u.id);
      if (existing) {
        existing.redemptions += 1;
        if (tx.createdAt > existing.lastRedeemAt) {
          existing.lastRedeemAt = tx.createdAt;
        }
      } else {
        byUser.set(u.id, {
          userId: u.id,
          name: u.name,
          phone: u.phone,
          redemptions: 1,
          lastRedeemAt: tx.createdAt,
          passId: tx.passId,
          currentPoints: tx.pass.points,
        });
      }
    }
    const redeemers = [...byUser.values()].sort(
      (a, b) =>
        b.redemptions - a.redemptions ||
        b.lastRedeemAt.getTime() - a.lastRedeemAt.getTime()
    );

    const elegibles = storePasses.filter(
      (p) => p.points >= promo.pointsRequired
    ).length;
    const uniqueRedeemers = redeemers.length;
    const ondasCost = txs.reduce((s, t) => s + t.points, 0);
    const canjes = txs.length;
    const repeatRedeemers = redeemers.filter((r) => r.redemptions > 1).length;

    const remaining =
      promo.expiryMode === 'QUANTITY' && promo.maxRedemptions != null
        ? Math.max(0, promo.maxRedemptions - allTimeCount)
        : null;
    const daysLeft =
      promo.expiryMode === 'TIME' && promo.endsAt
        ? Math.ceil((promo.endsAt.getTime() - Date.now()) / 86400000)
        : null;

    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, canjes: 0 }));
    for (const tx of txs) {
      hourly[tx.createdAt.getHours()].canjes += 1;
    }

    return {
      promotion: promo,
      locked: allTimeCount > 0,
      redemptionCount: allTimeCount,
      remaining,
      daysLeft,
      range: { from: from.toISOString(), to: to.toISOString() },
      previousRange: {
        from: prevFrom.toISOString(),
        to: prevTo.toISOString(),
      },
      kpis: {
        canjes,
        canjesDelta: pctDelta(canjes, prevCount),
        canjesAllTime: allTimeCount,
        clientesUnicos: uniqueRedeemers,
        clientesRepetidores: repeatRedeemers,
        ondasGastadas: ondasCost,
        elegibles,
        conversionElegibles:
          elegibles > 0 ? Math.round((uniqueRedeemers / elegibles) * 100) : 0,
        costeMedioOndas:
          canjes > 0 ? Math.round(ondasCost / canjes) : promo.pointsRequired,
        remaining,
        daysLeft,
        maxRedemptions: promo.maxRedemptions,
      },
      series,
      hourly,
      redeemers,
      history: txs.map((tx) => ({
        id: tx.id,
        points: tx.points,
        createdAt: tx.createdAt,
        passId: tx.passId,
        user: {
          id: tx.pass.user.id,
          name: tx.pass.user.name,
          phone: tx.pass.user.phone,
        },
      })),
    };
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promoción no encontrada');
    const redemptionCount = await this.prisma.transaction.count({
      where: { promotionId: id, type: 'REDEEM' },
    });
    return { ...promo, redemptionCount, locked: redemptionCount > 0 };
  }

  @Post()
  async create(
    @Body()
    body: {
      title: string;
      pointsRequired: number;
      storeId?: string;
      eventId?: string;
      description?: string;
      imageUrl?: string;
      isActive?: boolean;
      type?: PromotionType;
      value?: number;
      buyQuantity?: number;
      getQuantity?: number;
      productName?: string;
      expiryMode: PromotionExpiryMode;
      endsAt?: string;
      maxRedemptions?: number;
    }
  ) {
    assertExpiryBody(body);
    if (body.storeId) {
      const store = await this.prisma.store.findUniqueOrThrow({ where: { id: body.storeId } });
      if (Number(body.pointsRequired) > store.maxStamps) {
        throw new BadRequestException(
          `El sello no puede superar el tope de ${store.maxStamps} de esta tienda`
        );
      }
    }
    return this.prisma.promotion.create({
      data: {
        title: body.title,
        pointsRequired: Number(body.pointsRequired),
        storeId: body.storeId,
        eventId: body.eventId,
        description: body.description,
        imageUrl: body.imageUrl,
        isActive: body.isActive ?? true,
        type: body.type || 'OTHER',
        value: body.value != null ? Number(body.value) : undefined,
        buyQuantity: body.buyQuantity != null ? Number(body.buyQuantity) : undefined,
        getQuantity: body.getQuantity != null ? Number(body.getQuantity) : undefined,
        productName: body.productName,
        expiryMode: body.expiryMode,
        endsAt:
          body.expiryMode === 'TIME' && body.endsAt
            ? new Date(body.endsAt)
            : null,
        maxRedemptions:
          body.expiryMode === 'QUANTITY'
            ? Number(body.maxRedemptions)
            : null,
      },
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      title: string;
      pointsRequired: number;
      description: string;
      imageUrl: string | null;
      isActive: boolean;
      type: PromotionType;
      value: number | null;
      buyQuantity: number | null;
      getQuantity: number | null;
      productName: string | null;
      expiryMode: PromotionExpiryMode;
      endsAt: string | null;
      maxRedemptions: number | null;
    }>
  ) {
    if (body.pointsRequired != null) {
      const existing = await this.prisma.promotion.findUniqueOrThrow({ where: { id } });
      if (existing.storeId) {
        const store = await this.prisma.store.findUniqueOrThrow({ where: { id: existing.storeId } });
        if (Number(body.pointsRequired) > store.maxStamps) {
          throw new BadRequestException(
            `El sello no puede superar el tope de ${store.maxStamps} de esta tienda`
          );
        }
      }
    }

    const redemptionCount = await this.prisma.transaction.count({
      where: { promotionId: id, type: 'REDEEM' },
    });

    if (redemptionCount > 0) {
      // Solo foto (e isActive es operativo, permitido)
      const allowed: Record<string, unknown> = {};
      if ('imageUrl' in body) allowed.imageUrl = body.imageUrl;
      if ('isActive' in body) allowed.isActive = body.isActive;
      if (Object.keys(allowed).length === 0) {
        throw new BadRequestException(
          'Esta promo ya fue redimida: solo puedes cambiar la foto'
        );
      }
      return this.prisma.promotion.update({ where: { id }, data: allowed });
    }

    if (body.expiryMode) {
      assertExpiryBody({
        expiryMode: body.expiryMode,
        endsAt: body.endsAt,
        maxRedemptions: body.maxRedemptions ?? undefined,
      });
    }

    return this.prisma.promotion.update({
      where: { id },
      data: {
        ...('title' in body ? { title: body.title } : {}),
        ...('description' in body ? { description: body.description } : {}),
        ...('imageUrl' in body ? { imageUrl: body.imageUrl } : {}),
        ...('isActive' in body ? { isActive: body.isActive } : {}),
        ...('type' in body ? { type: body.type } : {}),
        ...('productName' in body ? { productName: body.productName } : {}),
        pointsRequired:
          body.pointsRequired != null ? Number(body.pointsRequired) : undefined,
        value: body.value != null ? Number(body.value) : body.value,
        buyQuantity:
          body.buyQuantity != null ? Number(body.buyQuantity) : body.buyQuantity,
        getQuantity:
          body.getQuantity != null ? Number(body.getQuantity) : body.getQuantity,
        ...(body.expiryMode
          ? {
              expiryMode: body.expiryMode,
              endsAt:
                body.expiryMode === 'TIME' && body.endsAt
                  ? new Date(body.endsAt)
                  : null,
              maxRedemptions:
                body.expiryMode === 'QUANTITY' && body.maxRedemptions != null
                  ? Number(body.maxRedemptions)
                  : null,
            }
          : {}),
      },
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.promotion.delete({ where: { id } });
  }
}
