import { Inject, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PlanType, PromotionType, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

const LIMITS: Record<PlanType, number> = { BASIC: 150, PRO: 350 };

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

@Controller('analytics')
export class AnalyticsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService
  ) {}

  @Get('store/:storeId/kpis')
  async storeKpis(
    @Param('storeId') storeId: string,
    @Query('eventId') eventId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const overview = await this.storeOverview(storeId, {
      eventId,
      from,
      to,
    });
    return {
      ondasHoy: overview.kpis.ondas,
      ...overview.kpis,
    };
  }

  @Get('store/:storeId/overview')
  async storeOverview(
    @Param('storeId') storeId: string,
    @Query()
    query: {
      eventId?: string;
      from?: string;
      to?: string;
      promoTypes?: string;
    }
  ) {
    const store = await this.prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    const to = parseDateEnd(query.to) || (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d;
    })();
    const from =
      parseDateStart(query.from) ||
      (() => {
        const d = new Date(to);
        d.setDate(d.getDate() - 13);
        d.setHours(0, 0, 0, 0);
        return d;
      })();
    const { prevFrom, prevTo } = previousPeriod(from, to);
    const promoTypes = query.promoTypes
      ? (query.promoTypes.split(',').filter(Boolean) as PromotionType[])
      : undefined;
    const eventId = query.eventId;

    const baseTx = (start: Date, end: Date): Prisma.TransactionWhereInput => ({
      storeId,
      createdAt: { gte: start, lte: end },
      ...(eventId ? { pass: { eventId } } : {}),
      ...(promoTypes?.length
        ? {
            OR: [
              { type: 'ACCUMULATE' },
              { type: 'REDEEM', promotion: { type: { in: promoTypes } } },
            ],
          }
        : {}),
    });

    const [
      ondas,
      redenciones,
      accumulateCount,
      prevOndas,
      prevRedenciones,
      prevAccumulateCount,
      clientesNuevos,
      prevClientesNuevos,
      txs,
      promos,
      passes,
      event,
      memberships,
    ] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...baseTx(from, to), type: 'ACCUMULATE' },
        _sum: { points: true },
      }),
      this.prisma.transaction.count({
        where: {
          ...baseTx(from, to),
          type: 'REDEEM',
          ...(promoTypes?.length ? { promotion: { type: { in: promoTypes } } } : {}),
        },
      }),
      this.prisma.transaction.count({
        where: { ...baseTx(from, to), type: 'ACCUMULATE' },
      }),
      this.prisma.transaction.aggregate({
        where: { ...baseTx(prevFrom, prevTo), type: 'ACCUMULATE' },
        _sum: { points: true },
      }),
      this.prisma.transaction.count({
        where: {
          ...baseTx(prevFrom, prevTo),
          type: 'REDEEM',
          ...(promoTypes?.length ? { promotion: { type: { in: promoTypes } } } : {}),
        },
      }),
      this.prisma.transaction.count({
        where: { ...baseTx(prevFrom, prevTo), type: 'ACCUMULATE' },
      }),
      this.prisma.pass.count({
        where: {
          storeId,
          user: { createdAt: { gte: from, lte: to } },
          ...(eventId ? { eventId } : {}),
        },
      }),
      this.prisma.pass.count({
        where: {
          storeId,
          user: { createdAt: { gte: prevFrom, lte: prevTo } },
          ...(eventId ? { eventId } : {}),
        },
      }),
      this.prisma.transaction.findMany({
        where: baseTx(from, to),
        include: { promotion: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.promotion.findMany({
        where: {
          storeId,
          ...(promoTypes?.length ? { type: { in: promoTypes } } : {}),
        },
      }),
      this.prisma.pass.findMany({
        where: { storeId, ...(eventId ? { eventId } : {}) },
        include: {
          user: true,
          transactions: {
            where: { storeId },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      eventId
        ? this.prisma.event.findUnique({ where: { id: eventId } })
        : Promise.resolve(null),
      eventId
        ? this.prisma.storeEventMembership.findMany({
            where: { eventId, status: 'ACCEPTED' },
            include: { store: true },
          })
        : Promise.resolve([]),
    ]);

    const ondasVal = ondas._sum.points ?? 0;
    const prevOndasVal = prevOndas._sum.points ?? 0;
    const redeemRate =
      accumulateCount > 0 ? Math.round((redenciones / accumulateCount) * 100) : 0;
    const prevRedeemRate =
      prevAccumulateCount > 0
        ? Math.round((prevRedenciones / prevAccumulateCount) * 100)
        : 0;

    // Series by day
    const seriesMap = new Map<string, { date: string; ondas: number; canjes: number }>();
    for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
      const key = dayKey(new Date(t));
      seriesMap.set(key, { date: key, ondas: 0, canjes: 0 });
    }
    for (const tx of txs) {
      const key = dayKey(tx.createdAt);
      const row = seriesMap.get(key) || { date: key, ondas: 0, canjes: 0 };
      if (tx.type === 'ACCUMULATE') row.ondas += tx.points;
      else row.canjes += 1;
      seriesMap.set(key, row);
    }
    const series = [...seriesMap.values()];

    // Hourly for last day of range (or today slice)
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, ondas: 0, canjes: 0 }));
    const lastDayStart = new Date(to);
    lastDayStart.setHours(0, 0, 0, 0);
    for (const tx of txs) {
      if (tx.createdAt < lastDayStart) continue;
      const h = tx.createdAt.getHours();
      if (tx.type === 'ACCUMULATE') hourly[h].ondas += tx.points;
      else hourly[h].canjes += 1;
    }

    // Redeem by promo type
    const byType: Record<string, number> = {};
    for (const tx of txs) {
      if (tx.type !== 'REDEEM') continue;
      const t = tx.promotion?.type || 'OTHER';
      byType[t] = (byType[t] || 0) + 1;
    }
    const redemptionsByType = Object.entries(byType).map(([type, count]) => ({
      type,
      count,
    }));

    // Customer segments
    const now = Date.now();
    const activePromos = promos.filter((p) => p.isActive);

    const segments = {
      nuevos: 0,
      activos: 0,
      cercaCanje: 0,
      enRiesgo: 0,
      vip: 0,
      dormidos: 0,
    };

    const customers = passes.map((p) => {
      const lastTx = p.transactions[0];
      const visitsInRange = p.transactions.filter(
        (t) => t.createdAt >= from && t.createdAt <= to
      ).length;
      const daysSince = lastTx
        ? (now - lastTx.createdAt.getTime()) / 86400000
        : 999;
      const nearPromo = activePromos
        .filter((pr) => p.points < pr.pointsRequired)
        .sort((a, b) => a.pointsRequired - b.pointsRequired)[0];
      const gap = nearPromo ? nearPromo.pointsRequired - p.points : null;

      let badge: string | null = null;
      if (p.user.createdAt >= from && p.user.createdAt <= to) {
        segments.nuevos += 1;
        badge = 'Nuevo';
      }
      if (visitsInRange > 0) segments.activos += 1;
      if (gap != null && gap <= 2 && gap >= 0) {
        segments.cercaCanje += 1;
        badge = badge || 'Cerca';
      }
      if (daysSince >= 21 && daysSince <= 45 && p.transactions.length > 0) {
        segments.enRiesgo += 1;
        badge = 'En riesgo';
      }
      if (daysSince > 45) {
        segments.dormidos += 1;
        badge = badge || 'Dormido';
      }

      return {
        passId: p.id,
        points: p.points,
        serialNumber: p.serialNumber,
        user: p.user,
        lastVisit: lastTx?.createdAt || null,
        visitsInRange,
        badge,
        nearPromo: nearPromo
          ? {
              id: nearPromo.id,
              title: nearPromo.title,
              type: nearPromo.type,
              gap,
            }
          : null,
      };
    });

    const sortedByPoints = [...customers].sort((a, b) => b.points - a.points);
    const vipCount = Math.max(1, Math.ceil(sortedByPoints.length * 0.1));
    sortedByPoints.slice(0, vipCount).forEach((c) => {
      segments.vip += 1;
      const target = customers.find((x) => x.passId === c.passId);
      if (target && !target.badge) target.badge = 'VIP';
    });

    const eligible = customers.filter((c) =>
      activePromos.some((p) => c.points >= p.pointsRequired)
    ).length;
    const coverage =
      customers.length > 0 ? Math.round((eligible / customers.length) * 100) : 0;

    // Insights
    const insights: Array<{
      id: string;
      tone: 'success' | 'warning' | 'danger' | 'accent';
      title: string;
      message: string;
      action?: string;
      promoId?: string;
    }> = [];

    const ondasDelta = pctDelta(ondasVal, prevOndasVal);
    const redeemDelta = pctDelta(redenciones, prevRedenciones);

    // Ops: last tx + promo stats (needed for stock insights)
    const lastTx = await this.prisma.transaction.findFirst({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
    const hourAgo = new Date(Date.now() - 3600000);
    const ondasLastHour = await this.prisma.transaction.aggregate({
      where: {
        storeId,
        type: 'ACCUMULATE',
        createdAt: { gte: hourAgo },
      },
      _sum: { points: true },
    });

    const promoStats = await Promise.all(
      promos.map(async (p) => {
        const [canjes, canjesAllTime] = await Promise.all([
          this.prisma.transaction.count({
            where: {
              storeId,
              type: 'REDEEM',
              promotionId: p.id,
              createdAt: { gte: from, lte: to },
            },
          }),
          this.prisma.transaction.count({
            where: { storeId, type: 'REDEEM', promotionId: p.id },
          }),
        ]);
        const remaining =
          p.expiryMode === 'QUANTITY' && p.maxRedemptions != null
            ? Math.max(0, p.maxRedemptions - canjesAllTime)
            : null;
        const daysLeft =
          p.expiryMode === 'TIME' && p.endsAt
            ? Math.ceil((p.endsAt.getTime() - Date.now()) / 86400000)
            : null;
        return {
          ...p,
          canjesInRange: canjes,
          canjesAllTime,
          remaining,
          daysLeft,
          elegibles: customers.filter((c) => c.points >= p.pointsRequired).length,
          locked: canjesAllTime > 0,
        };
      })
    );

    // Priorizar stock / caducidad de promos activas
    for (const p of promoStats.filter((x) => x.isActive)) {
      if (
        p.expiryMode === 'QUANTITY' &&
        p.maxRedemptions != null &&
        p.remaining != null &&
        (p.remaining <= 3 || p.remaining / p.maxRedemptions <= 0.2)
      ) {
        insights.push({
          id: `promo-low-${p.id}`,
          tone: p.remaining === 0 ? 'danger' : 'warning',
          title:
            p.remaining === 0
              ? `Se agotó la promo de ${p.pointsRequired} ondas`
              : `Ya casi se acaban las promos de ${p.pointsRequired} ondas`,
          message:
            p.remaining === 0
              ? `“${p.title}” no tiene redenciones restantes. Duplica o crea una nueva.`
              : `“${p.title}” tiene ${p.remaining} de ${p.maxRedemptions} canjes. Conviene duplicar o crear otra.`,
          action: 'Duplicar promo',
          promoId: p.id,
        });
      }
      if (p.expiryMode === 'TIME' && p.daysLeft != null && p.daysLeft <= 3) {
        insights.push({
          id: `promo-expiring-${p.id}`,
          tone: p.daysLeft <= 0 ? 'danger' : 'warning',
          title:
            p.daysLeft <= 0
              ? `Caducó la promo de ${p.pointsRequired} ondas`
              : `La promo de ${p.pointsRequired} ondas caduca pronto`,
          message:
            p.daysLeft <= 0
              ? `“${p.title}” ya no está disponible. Duplica para renovarla.`
              : `“${p.title}” vence en ${p.daysLeft} día${p.daysLeft === 1 ? '' : 's'}.`,
          action: 'Duplicar promo',
          promoId: p.id,
        });
      }
    }

    if (redeemDelta <= -25 && ondasDelta >= -10) {
      insights.push({
        id: 'redeem-drop',
        tone: 'warning',
        title: 'Redenciones a la baja',
        message: `Canjes ${redeemDelta}% vs periodo anterior con ondas estables. El catálogo puede no motivar.`,
        action: 'Revisar promos',
      });
    }
    if (segments.cercaCanje >= 3) {
      insights.push({
        id: 'near-redeem',
        tone: 'accent',
        title: 'Clientes cerca de canje',
        message: `${segments.cercaCanje} clientes están a ≤2 ondas de una promo activa.`,
        action: 'Ver segmento',
      });
    }
    if (segments.enRiesgo >= 3) {
      insights.push({
        id: 'at-risk',
        tone: 'danger',
        title: 'Clientes en riesgo',
        message: `${segments.enRiesgo} no vuelven hace 21–45 días. Oportunidad de win-back.`,
        action: 'Ver en riesgo',
      });
    }
    const waPct = Math.round((store.whatsappUsed / LIMITS[store.planType]) * 100);
    if (waPct >= 80) {
      insights.push({
        id: 'wa-limit',
        tone: 'warning',
        title: 'Cupo WhatsApp alto',
        message: `Usaste ${waPct}% del cupo (${store.whatsappUsed}/${LIMITS[store.planType]}).`,
        action: 'Ver plan',
      });
    }
    if (activePromos.length <= 1) {
      insights.push({
        id: 'few-promos',
        tone: 'accent',
        title: 'Poca variedad de promos',
        message: 'Solo hay pocas promos activas. Un gancho de 3–5 ondas suele subir canjes.',
        action: 'Crear promo',
      });
    }
    if (!insights.length) {
      insights.push({
        id: 'healthy',
        tone: 'success',
        title: 'Programa estable',
        message: `En el rango: ${ondasVal} ondas, ${redenciones} canjes, tasa ${redeemRate}%.`,
      });
    }

    // Event rank
    let eventMeta: null | {
      globalTarget: number;
      progress: number;
      rank: number | null;
      totalStores: number;
      yourOndas: number;
    } = null;
    if (event && memberships.length) {
      const storeIds = memberships.map((m) => m.storeId);
      const ranking = await this.prisma.transaction.groupBy({
        by: ['storeId'],
        where: {
          storeId: { in: storeIds },
          type: 'ACCUMULATE',
          createdAt: { gte: from, lte: to },
          pass: { eventId: event.id },
        },
        _sum: { points: true },
        orderBy: { _sum: { points: 'desc' } },
      });
      const yourOndas =
        ranking.find((r) => r.storeId === storeId)?._sum.points ?? ondasVal;
      const rankIdx = ranking.findIndex((r) => r.storeId === storeId);
      eventMeta = {
        globalTarget: event.globalTarget,
        progress: Math.min(
          100,
          Math.round((yourOndas / Math.max(1, event.globalTarget)) * 100)
        ),
        rank: rankIdx >= 0 ? rankIdx + 1 : null,
        totalStores: memberships.length,
        yourOndas,
      };
    }

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      previousRange: {
        from: prevFrom.toISOString(),
        to: prevTo.toISOString(),
      },
      kpis: {
        ondas: ondasVal,
        ondasDelta: pctDelta(ondasVal, prevOndasVal),
        redenciones,
        redencionesDelta: pctDelta(redenciones, prevRedenciones),
        clientesNuevos,
        clientesNuevosDelta: pctDelta(clientesNuevos, prevClientesNuevos),
        tasaRedencion: redeemRate,
        tasaRedencionDelta: redeemRate - prevRedeemRate,
        whatsappUsed: store.whatsappUsed,
        whatsappLimit: LIMITS[store.planType],
        planType: store.planType,
        coberturaCatalogo: coverage,
        promosActivas: activePromos.length,
      },
      series,
      hourly,
      redemptionsByType,
      segments,
      customers,
      insights: insights.slice(0, 3),
      eventMeta,
      ops: {
        ondasLastHour: ondasLastHour._sum.points ?? 0,
        minutesSinceLastTx: lastTx
          ? Math.round((Date.now() - lastTx.createdAt.getTime()) / 60000)
          : null,
        accumulateInRange: accumulateCount,
        redeemInRange: redenciones,
      },
      promoStats,
      recent: txs
        .slice()
        .reverse()
        .slice(0, 8)
        .map((t) => ({
          id: t.id,
          type: t.type,
          points: t.points,
          createdAt: t.createdAt,
          promotion: t.promotion,
        })),
    };
  }

  @Get('event/:eventId/macro')
  async eventMacro(@Param('eventId') eventId: string) {
    const memberships = await this.prisma.storeEventMembership.findMany({
      where: { eventId, status: 'ACCEPTED' },
      include: { store: true },
    });
    const storeIds = memberships.map((m) => m.storeId);

    const [totalOndas, ranking, passes] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          storeId: { in: storeIds },
          type: 'ACCUMULATE',
          pass: { eventId },
        },
        _sum: { points: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['storeId'],
        where: {
          storeId: { in: storeIds },
          type: 'ACCUMULATE',
          pass: { eventId },
        },
        _sum: { points: true },
        _count: true,
        orderBy: { _sum: { points: 'desc' } },
        take: 10,
      }),
      this.prisma.pass.findMany({
        where: { eventId },
        include: { user: true, transactions: true },
      }),
    ]);

    const storeMap = Object.fromEntries(memberships.map((m) => [m.storeId, m.store]));

    return {
      totalOndas: totalOndas._sum.points ?? 0,
      acceptedStores: memberships.length,
      ranking: ranking.map((r) => ({
        storeId: r.storeId,
        storeName: storeMap[r.storeId]?.name,
        ondas: r._sum.points ?? 0,
        visits: r._count,
        lat: storeMap[r.storeId]?.lat,
        lng: storeMap[r.storeId]?.lng,
      })),
      topVisitor: passes
        .map((p) => ({
          user: p.user,
          visits: p.transactions.length,
          points: p.points,
        }))
        .sort((a, b) => b.visits - a.visits)[0],
      heatmap: memberships
        .filter((m) => m.store.lat != null && m.store.lng != null)
        .map((m) => ({
          lat: m.store.lat,
          lng: m.store.lng,
          name: m.store.name,
          weight: ranking.find((r) => r.storeId === m.storeId)?._sum.points ?? 1,
        })),
    };
  }
}

@Controller('draws')
export class DrawsController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Post()
  async run(@Body() body: { eventId: string; note?: string }) {
    const passes = await this.prisma.pass.findMany({
      where: { eventId: body.eventId },
      include: { user: true, transactions: true },
    });
    if (!passes.length) {
      return { winner: null, message: 'Sin asistentes' };
    }
    const winner = passes[Math.floor(Math.random() * passes.length)];
    const draw = await this.prisma.draw.create({
      data: {
        eventId: body.eventId,
        winnerId: winner.userId,
        note: body.note,
      },
    });
    const topVisitor = [...passes]
      .map((p) => ({ user: p.user, visits: p.transactions.length, points: p.points }))
      .sort((a, b) => b.visits - a.visits)[0];

    return {
      draw,
      winner: winner.user,
      topVisitor,
      exportCsv: passes
        .map(
          (p) =>
            `${p.user.name},${p.user.phone},${p.points},${p.transactions.length}`
        )
        .join('\n'),
    };
  }

  @Get('event/:eventId')
  list(@Param('eventId') eventId: string) {
    return this.prisma.draw.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

@Controller('leads')
export class LeadsController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Post()
  create(
    @Body()
    body: {
      name: string;
      email: string;
      phone?: string;
      businessName?: string;
      message?: string;
    }
  ) {
    return this.prisma.lead.create({ data: body });
  }

  @Get()
  list() {
    return this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
  }
}

@Controller('billing')
export class BillingController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Get('store/:storeId')
  async summary(@Param('storeId') storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    const limit = store.planType === 'PRO' ? 350 : 150;
    const overage = Math.max(0, store.whatsappUsed - limit);
    return {
      planType: store.planType,
      billingStatus: store.billingStatus,
      whatsappUsed: store.whatsappUsed,
      whatsappLimit: limit,
      overageMessages: overage,
      overageCop: overage * 150,
      planPriceCop: store.planType === 'PRO' ? 79900 : 49900,
      wompiPublicKey: process.env.WOMPI_PUBLIC_KEY || null,
      features: {
        gpsProximity: store.planType === 'PRO',
        npsSurveys: store.planType === 'PRO',
        reviewGating: store.planType === 'PRO',
        dissatisfactionAlerts: store.planType === 'PRO',
      },
    };
  }

  @Post('store/:storeId/upgrade')
  async upgrade(@Param('storeId') storeId: string) {
    return this.prisma.store.update({
      where: { id: storeId },
      data: { planType: 'PRO', billingStatus: 'ACTIVE' },
    });
  }

  @Post('wompi/webhook')
  wompiWebhook(@Body() body: Record<string, unknown>) {
    return { received: true, body };
  }
}

@Controller('feedback')
export class FeedbackController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Post()
  async create(
    @Body()
    body: {
      userId: string;
      storeId: string;
      rating: number;
      comment?: string;
    }
  ) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: body.storeId },
    });
    const reviewGating = store.planType === 'PRO';
    const redirectedToGoogle = reviewGating && body.rating >= 4;

    const feedback = await this.prisma.feedback.create({
      data: {
        userId: body.userId,
        storeId: body.storeId,
        rating: body.rating,
        comment: body.comment,
        redirectedToGoogle,
      },
    });

    return {
      feedback,
      redirectToGoogle: redirectedToGoogle,
      googleMapsUrl: store.googlePlaceId
        ? `https://search.google.com/local/writereview?placeid=${store.googlePlaceId}`
        : null,
      alertMerchant: reviewGating && body.rating < 4,
    };
  }

  @Get('store/:storeId')
  list(@Param('storeId') storeId: string) {
    return this.prisma.feedback.findMany({
      where: { storeId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}

@Controller('webhooks')
export class WebhooksController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Post('kapso')
  async kapso(@Body() body: Record<string, unknown>) {
    return { ok: true, event: body['event'] ?? body['type'] ?? 'unknown' };
  }
}
