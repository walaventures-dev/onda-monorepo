import {
  Inject,
  Body,
  Controller,
  Get,
  BadRequestException,
  ForbiddenException,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { PlanType, PromotionType, Prisma } from '@prisma/client';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from './prisma.service';
import { WompiService } from './wompi.service';
import { JobsService } from './jobs.service';
import { WhatsappService } from './whatsapp.service';
import {
  PLAN_ONDA_MONTHLY_LIMIT,
  PLAN_SMS_CAMPAIGNS_MONTHLY,
  monthlyOndasUsed,
  monthlySmsCampaignsUsed,
} from './plan-quota';

const COMPARE_MAX_STORES = 20;

type CompareTone = 'success' | 'warning' | 'danger' | 'accent';

type LeaderRef = { storeId: string; storeName: string; value: number } | null;

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

function rewardsFromAssignments(
  assignments?: Array<{
    pointsRequired: number;
    promotion: { id: string; title: string; type: string; isActive: boolean };
  }>
) {
  return (assignments || [])
    .filter((a) => a.promotion?.isActive)
    .map((a) => ({
      id: a.promotion.id,
      title: a.promotion.title,
      type: a.promotion.type,
      pointsRequired: a.pointsRequired,
    }));
}

function nearestReward<T extends { pointsRequired: number }>(
  points: number,
  rewards: T[]
) {
  return rewards
    .filter((r) => points < r.pointsRequired)
    .sort((a, b) => a.pointsRequired - b.pointsRequired)[0];
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
          promoAssignments: { include: { promotion: true } },
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

    // Heatmap: weekday (Mon=0) × hour across the full range
    const heatmapCells = Array.from({ length: 7 * 24 }, (_, i) => ({
      dow: Math.floor(i / 24),
      hour: i % 24,
      ondas: 0,
      canjes: 0,
      freq: 0,
    }));
    for (const tx of txs) {
      const jsDay = tx.createdAt.getDay();
      const dow = jsDay === 0 ? 6 : jsDay - 1;
      const hour = tx.createdAt.getHours();
      const cell = heatmapCells[dow * 24 + hour];
      if (tx.type === 'ACCUMULATE') {
        cell.ondas += 1; // acumulaciones (movimientos)
        cell.freq += 1;
      } else {
        cell.canjes += 1; // redenciones
        cell.freq += 1;
      }
    }
    const heatmap = {
      days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      cells: heatmapCells,
    };

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
      const rewards = rewardsFromAssignments(p.promoAssignments);
      const nearPromo = nearestReward(p.points, rewards);
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

    const eligible = passes.filter((p) =>
      rewardsFromAssignments(p.promoAssignments).some(
        (r) => p.points >= r.pointsRequired
      )
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
      stat?: string;
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
          p.maxRedemptions != null
            ? Math.max(0, p.maxRedemptions - canjesAllTime)
            : null;
        const daysLeft = null;
        return {
          ...p,
          canjesInRange: canjes,
          canjesAllTime,
          remaining,
          daysLeft,
          elegibles: passes.filter((pass) =>
            pass.promoAssignments.some(
              (a) => a.promotionId === p.id && pass.points >= a.pointsRequired
            )
          ).length,
          locked: canjesAllTime > 0,
        };
      })
    );

    // Priorizar stock / caducidad de promos activas
    for (const p of promoStats.filter((x) => x.isActive)) {
      if (
        p.maxRedemptions != null &&
        p.remaining != null &&
        (p.remaining <= 3 || p.remaining / p.maxRedemptions <= 0.2)
      ) {
        insights.push({
          id: `promo-low-${p.id}`,
          tone: p.remaining === 0 ? 'danger' : 'warning',
          title:
            p.remaining === 0
              ? `Se agotó “${p.title}” (onda ${p.pointsRequired})`
              : `Se está por agotar “${p.title}”`,
          message:
            p.remaining === 0
              ? 'Actualiza o crea otra promo para esa onda. Las tarjetas nuevas no verán recompensa ahí.'
              : `Queda ${p.remaining} de ${p.maxRedemptions} canjes. Crea otra promo para esa onda antes de que se agote.`,
          action: 'Ver promo',
          promoId: p.id,
          stat: String(p.remaining ?? 0),
        });
      }
      if (p.expiryMode === 'TIME' && p.daysLeft != null && p.daysLeft <= 3) {
        insights.push({
          id: `promo-expiring-${p.id}`,
          tone: p.daysLeft <= 0 ? 'danger' : 'warning',
          title:
            p.daysLeft <= 0
              ? `Caducó “${p.title}”`
              : `“${p.title}” vence en ${p.daysLeft} día${p.daysLeft === 1 ? '' : 's'}`,
          message:
            p.daysLeft <= 0
              ? 'Ya no está disponible para tus clientes. Duplícala para reactivarla.'
              : 'Duplícala para tenerla lista antes de que expire.',
          action: 'Duplicar promo',
          promoId: p.id,
          stat: p.daysLeft <= 0 ? '0d' : `${p.daysLeft}d`,
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
        stat: `${redeemDelta}%`,
      });
    }
    if (segments.cercaCanje >= 3) {
      insights.push({
        id: 'near-redeem',
        tone: 'accent',
        title: `${segments.cercaCanje} clientes a punto de canjear`,
        message: 'Les faltan 2 ondas o menos para alcanzar una promo activa.',
        action: 'Ver segmento',
        stat: String(segments.cercaCanje),
      });
    }
    if (segments.enRiesgo >= 3) {
      insights.push({
        id: 'at-risk',
        tone: 'danger',
        title: 'Clientes en riesgo',
        message: `${segments.enRiesgo} no vuelven hace 21–45 días. Oportunidad de win-back.`,
        action: 'Ver en riesgo',
        stat: String(segments.enRiesgo),
      });
    }
    const ondasMonthUsed = await monthlyOndasUsed(this.prisma, storeId);
    const ondasPct = Math.round((ondasMonthUsed / PLAN_ONDA_MONTHLY_LIMIT) * 100);
    if (ondasPct >= 80) {
      insights.push({
        id: 'onda-limit',
        tone: 'warning',
        title: 'Cupo de ondas alto',
        message: `Usaste ${ondasPct}% de las ${PLAN_ONDA_MONTHLY_LIMIT} ondas incluidas este mes (${ondasMonthUsed}/${PLAN_ONDA_MONTHLY_LIMIT}).`,
        action: 'Ver plan',
        stat: `${ondasPct}%`,
      });
    }
    if (activePromos.length <= 1) {
      insights.push({
        id: 'few-promos',
        tone: 'accent',
        title: 'Poca variedad de promos',
        message: 'Solo hay pocas promos activas. Un gancho de 3–5 ondas suele subir canjes.',
        action: 'Crear promo',
        stat: String(activePromos.length),
      });
    }
    if (!insights.length) {
      insights.push({
        id: 'healthy',
        tone: 'success',
        title: 'Programa estable',
        message: `En el rango: ${ondasVal} ondas, ${redenciones} canjes, tasa ${redeemRate}%.`,
        stat: `${redeemRate}%`,
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
        ondasMonthUsed,
        ondasMonthLimit: PLAN_ONDA_MONTHLY_LIMIT,
        whatsappUsed: store.whatsappUsed,
        whatsappLimit: PLAN_ONDA_MONTHLY_LIMIT,
        planType: store.planType,
        coberturaCatalogo: coverage,
        promosActivas: activePromos.length,
      },
      series,
      hourly,
      heatmap,
      redemptionsByType,
      segments,
      customers,
      insights: insights.slice(0, 8),
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

  @Get('store/:storeId/customers/:passId')
  async customerDetail(
    @Param('storeId') storeId: string,
    @Param('passId') passId: string,
    @Query('from') fromQ?: string,
    @Query('to') toQ?: string,
  ) {
    const pass = await this.prisma.pass.findFirst({
      where: { id: passId, storeId },
      include: { user: true },
    });
    if (!pass) throw new NotFoundException('Cliente no encontrado');

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

    const [txs, prevTxs, lastTx, allTimeAgg, assignments] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { passId, storeId, createdAt: { gte: from, lte: to } },
        include: { promotion: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.findMany({
        where: { passId, storeId, createdAt: { gte: prevFrom, lte: prevTo } },
        select: { type: true, points: true },
      }),
      this.prisma.transaction.findFirst({
        where: { passId, storeId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { passId, storeId },
        _count: { _all: true },
        _sum: { points: true },
      }),
      this.prisma.passPromoAssignment.findMany({
        where: { passId },
        include: { promotion: true },
        orderBy: { pointsRequired: 'asc' },
      }),
    ]);

    const sumAccumulate = (rows: { type: string; points: number }[]) =>
      rows
        .filter((t) => t.type === 'ACCUMULATE')
        .reduce((s, t) => s + t.points, 0);
    const countRedeem = (rows: { type: string }[]) =>
      rows.filter((t) => t.type === 'REDEEM').length;

    const ondas = sumAccumulate(txs);
    const canjes = countRedeem(txs);
    const visitas = txs.length;
    const prevOndas = sumAccumulate(prevTxs);
    const prevCanjes = countRedeem(prevTxs);
    const prevVisitas = prevTxs.length;

    const daysSinceVisit = lastTx
      ? Math.floor((Date.now() - lastTx.createdAt.getTime()) / 86400000)
      : null;

    const accumulateTxs = txs.filter((t) => t.type === 'ACCUMULATE');
    const ticketMedioOndas =
      accumulateTxs.length > 0
        ? Math.round(ondas / accumulateTxs.length)
        : 0;

    const seriesMap = new Map<
      string,
      { date: string; ondas: number; canjes: number }
    >();
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

    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      ondas: 0,
      canjes: 0,
    }));
    for (const tx of txs) {
      const h = tx.createdAt.getHours();
      if (tx.type === 'ACCUMULATE') hourly[h].ondas += tx.points;
      else hourly[h].canjes += 1;
    }

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

    const rewards = rewardsFromAssignments(assignments);
    const nearPromo = nearestReward(pass.points, rewards);
    const gap = nearPromo ? nearPromo.pointsRequired - pass.points : null;

    let badge: string | null = null;
    if (pass.user.createdAt >= from && pass.user.createdAt <= to) badge = 'Nuevo';
    if (gap != null && gap <= 2 && gap >= 0) badge = badge || 'Cerca';
    if (daysSinceVisit != null && daysSinceVisit >= 21 && daysSinceVisit <= 45) {
      badge = 'En riesgo';
    }
    if (daysSinceVisit != null && daysSinceVisit > 45) {
      badge = badge || 'Dormido';
    }

    const eligiblePromos = rewards.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      pointsRequired: p.pointsRequired,
      gap: p.pointsRequired - pass.points,
      ready: pass.points >= p.pointsRequired,
    }));

    const allTimeOndas =
      allTimeAgg.find((g) => g.type === 'ACCUMULATE')?._sum.points ?? 0;
    const allTimeCanjes =
      allTimeAgg.find((g) => g.type === 'REDEEM')?._count._all ?? 0;
    const allTimeVisitas = allTimeAgg.reduce(
      (s, g) => s + (g._count._all ?? 0),
      0,
    );

    return {
      pass: {
        id: pass.id,
        points: pass.points,
        serialNumber: pass.serialNumber,
        createdAt: pass.user.createdAt,
      },
      user: {
        id: pass.user.id,
        name: pass.user.name,
        phone: pass.user.phone,
        createdAt: pass.user.createdAt,
      },
      badge,
      nearPromo: nearPromo
        ? {
            id: nearPromo.id,
            title: nearPromo.title,
            type: nearPromo.type,
            gap,
            pointsRequired: nearPromo.pointsRequired,
          }
        : null,
      range: { from: from.toISOString(), to: to.toISOString() },
      previousRange: {
        from: prevFrom.toISOString(),
        to: prevTo.toISOString(),
      },
      kpis: {
        ondas,
        ondasDelta: pctDelta(ondas, prevOndas),
        canjes,
        canjesDelta: pctDelta(canjes, prevCanjes),
        visitas,
        visitasDelta: pctDelta(visitas, prevVisitas),
        puntosActuales: pass.points,
        diasDesdeVisita: daysSinceVisit,
        ticketMedioOndas,
        ondasAllTime: allTimeOndas,
        canjesAllTime: allTimeCanjes,
        visitasAllTime: allTimeVisitas,
      },
      series,
      hourly,
      redemptionsByType,
      eligiblePromos,
      recent: txs.map((t) => ({
        id: t.id,
        type: t.type,
        points: t.points,
        createdAt: t.createdAt,
        promotion: t.promotion
          ? {
              id: t.promotion.id,
              title: t.promotion.title,
              type: t.promotion.type,
            }
          : null,
      })),
      lastVisit: lastTx?.createdAt || null,
    };
  }

  @Get('stores/compare')
  async storesCompare(
    @Query('storeIds') storeIdsRaw?: string,
    @Query('from') fromQ?: string,
    @Query('to') toQ?: string,
    @Query('normalize') normalizeQ?: string,
  ) {
    const requestedIds = (storeIdsRaw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!requestedIds.length) {
      throw new BadRequestException('storeIds es requerido');
    }
    if (requestedIds.length > COMPARE_MAX_STORES) {
      throw new BadRequestException(
        `Máximo ${COMPARE_MAX_STORES} sedes por comparación`,
      );
    }

    const normalize =
      normalizeQ === 'perActive' ? ('perActive' as const) : ('raw' as const);

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

    const foundStores = await this.prisma.store.findMany({
      where: { id: { in: requestedIds } },
    });
    const foundIds = new Set(foundStores.map((s) => s.id));
    const missingStoreIds = requestedIds.filter((id) => !foundIds.has(id));
    const stores = requestedIds
      .filter((id) => foundIds.has(id))
      .map((id) => foundStores.find((s) => s.id === id)!)
      .filter(Boolean);

    if (!stores.length) {
      throw new NotFoundException('Ninguna sede válida');
    }

    const storeIds = stores.map((s) => s.id);
    const storeMap = Object.fromEntries(stores.map((s) => [s.id, s]));

    const txWhere = (start: Date, end: Date): Prisma.TransactionWhereInput => ({
      storeId: { in: storeIds },
      createdAt: { gte: start, lte: end },
    });

    const [
      ondasByStore,
      redeemByStore,
      accumulateByStore,
      prevOndasByStore,
      prevRedeemByStore,
      prevAccumulateByStore,
      txs,
      passes,
      promos,
    ] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['storeId'],
        where: { ...txWhere(from, to), type: 'ACCUMULATE' },
        _sum: { points: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['storeId'],
        where: { ...txWhere(from, to), type: 'REDEEM' },
        _count: { _all: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['storeId'],
        where: { ...txWhere(from, to), type: 'ACCUMULATE' },
        _count: { _all: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['storeId'],
        where: { ...txWhere(prevFrom, prevTo), type: 'ACCUMULATE' },
        _sum: { points: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['storeId'],
        where: { ...txWhere(prevFrom, prevTo), type: 'REDEEM' },
        _count: { _all: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['storeId'],
        where: { ...txWhere(prevFrom, prevTo), type: 'ACCUMULATE' },
        _count: { _all: true },
      }),
      this.prisma.transaction.findMany({
        where: txWhere(from, to),
        select: {
          storeId: true,
          type: true,
          points: true,
          createdAt: true,
          promotionId: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.pass.findMany({
        where: { storeId: { in: storeIds } },
        include: {
          user: true,
          promoAssignments: { include: { promotion: true } },
          transactions: {
            where: { storeId: { in: storeIds } },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.promotion.findMany({
        where: { storeId: { in: storeIds } },
      }),
    ]);

    const mapSum = (rows: { storeId: string; _sum: { points: number | null } }[]) =>
      Object.fromEntries(rows.map((r) => [r.storeId, r._sum.points ?? 0]));
    const mapCount = (
      rows: { storeId: string; _count: { _all: number } }[],
    ) => Object.fromEntries(rows.map((r) => [r.storeId, r._count._all]));

    const ondasMap = mapSum(ondasByStore);
    const redeemMap = mapCount(redeemByStore);
    const accumulateMap = mapCount(accumulateByStore);
    const prevOndasMap = mapSum(prevOndasByStore);
    const prevRedeemMap = mapCount(prevRedeemByStore);
    const prevAccumulateMap = mapCount(prevAccumulateByStore);

    // Redeem counts per promo in range + all-time for stock
    const redeemInRangeByPromo = new Map<string, number>();
    for (const tx of txs) {
      if (tx.type !== 'REDEEM' || !tx.promotionId) continue;
      const key = `${tx.storeId}:${tx.promotionId}`;
      redeemInRangeByPromo.set(key, (redeemInRangeByPromo.get(key) || 0) + 1);
    }
    const allTimeRedeemByPromo = await this.prisma.transaction.groupBy({
      by: ['storeId', 'promotionId'],
      where: {
        storeId: { in: storeIds },
        type: 'REDEEM',
        promotionId: { not: null },
      },
      _count: { _all: true },
    });
    const allTimeMap = new Map<string, number>();
    for (const r of allTimeRedeemByPromo) {
      if (!r.promotionId) continue;
      allTimeMap.set(`${r.storeId}:${r.promotionId}`, r._count._all);
    }

    const now = Date.now();
    const passesByStore = new Map<string, typeof passes>();
    for (const p of passes) {
      if (!p.storeId) continue;
      const list = passesByStore.get(p.storeId) || [];
      list.push(p);
      passesByStore.set(p.storeId, list);
    }
    const promosByStore = new Map<string, typeof promos>();
    for (const pr of promos) {
      if (!pr.storeId) continue;
      const list = promosByStore.get(pr.storeId) || [];
      list.push(pr);
      promosByStore.set(pr.storeId, list);
    }

    type StoreRow = {
      storeId: string;
      storeName: string;
      planType: PlanType;
      kpis: {
        ondas: number;
        ondasDelta: number;
        redenciones: number;
        redencionesDelta: number;
        clientesNuevos: number;
        clientesNuevosDelta: number;
        tasaRedencion: number;
        tasaRedencionDelta: number;
        clientesActivos: number;
        ondasPorActivo: number;
        canjesPorActivo: number;
        coberturaCatalogo: number;
        promosActivas: number;
        whatsappUsed: number;
        whatsappLimit: number;
        rankOndas: number;
        rankRedenciones: number;
        rankTasa: number;
      };
      segments: {
        nuevos: number;
        activos: number;
        cercaCanje: number;
        enRiesgo: number;
        vip: number;
        dormidos: number;
        total: number;
      };
      vsSet: {
        ondasPctVsAvg: number;
        redencionesPctVsAvg: number;
        tasaPpVsAvg: number;
      };
      flags: { lowStockPromos: number; zeroRedeemPromos: number };
    };

    const storeRows: StoreRow[] = storeIds.map((id) => {
      const store = storeMap[id];
      const storePasses = passesByStore.get(id) || [];
      const storePromos = promosByStore.get(id) || [];
      const activePromos = storePromos.filter((p) => p.isActive);

      const ondas = ondasMap[id] ?? 0;
      const redenciones = redeemMap[id] ?? 0;
      const accumulateCount = accumulateMap[id] ?? 0;
      const prevOndas = prevOndasMap[id] ?? 0;
      const prevRedenciones = prevRedeemMap[id] ?? 0;
      const prevAccumulate = prevAccumulateMap[id] ?? 0;
      const tasa =
        accumulateCount > 0
          ? Math.round((redenciones / accumulateCount) * 100)
          : 0;
      const prevTasa =
        prevAccumulate > 0
          ? Math.round((prevRedenciones / prevAccumulate) * 100)
          : 0;

      const segments = {
        nuevos: 0,
        activos: 0,
        cercaCanje: 0,
        enRiesgo: 0,
        vip: 0,
        dormidos: 0,
        total: storePasses.length,
      };

      const pointSorted = [...storePasses].sort((a, b) => b.points - a.points);
      const vipCount = Math.max(1, Math.ceil(pointSorted.length * 0.1));
      const vipIds = new Set(
        pointSorted.slice(0, storePasses.length ? vipCount : 0).map((p) => p.id),
      );

      let clientesNuevos = 0;
      let prevClientesNuevos = 0;
      for (const p of storePasses) {
        const txsOfPass = p.transactions.filter((t) => t.storeId === id);
        const lastTx = txsOfPass[0];
        const visitsInRange = txsOfPass.filter(
          (t) => t.createdAt >= from && t.createdAt <= to,
        ).length;
        const daysSince = lastTx
          ? (now - lastTx.createdAt.getTime()) / 86400000
          : 999;
        const rewards = rewardsFromAssignments(
          (p as { promoAssignments?: any[] }).promoAssignments
        );
        const nearPromo = nearestReward(p.points, rewards);
        const gap = nearPromo ? nearPromo.pointsRequired - p.points : null;

        if (p.user.createdAt >= from && p.user.createdAt <= to) {
          segments.nuevos += 1;
          clientesNuevos += 1;
        }
        if (p.user.createdAt >= prevFrom && p.user.createdAt <= prevTo) {
          prevClientesNuevos += 1;
        }
        if (visitsInRange > 0) segments.activos += 1;
        if (gap != null && gap <= 2 && gap >= 0) segments.cercaCanje += 1;
        if (daysSince >= 21 && daysSince <= 45 && txsOfPass.length > 0) {
          segments.enRiesgo += 1;
        }
        if (daysSince > 45) segments.dormidos += 1;
        if (vipIds.has(p.id)) segments.vip += 1;
      }

      const eligible = storePasses.filter((c) =>
        rewardsFromAssignments(
          (c as { promoAssignments?: any[] }).promoAssignments
        ).some((r) => c.points >= r.pointsRequired)
      ).length;
      const coverage =
        storePasses.length > 0
          ? Math.round((eligible / storePasses.length) * 100)
          : 0;

      let lowStockPromos = 0;
      let zeroRedeemPromos = 0;
      for (const pr of activePromos) {
        const inRange =
          redeemInRangeByPromo.get(`${id}:${pr.id}`) || 0;
        if (inRange === 0) zeroRedeemPromos += 1;
        if (pr.expiryMode === 'QUANTITY' && pr.maxRedemptions != null) {
          const allTime = allTimeMap.get(`${id}:${pr.id}`) || 0;
          const remaining = Math.max(0, pr.maxRedemptions - allTime);
          if (
            remaining <= 3 ||
            remaining / pr.maxRedemptions <= 0.2
          ) {
            lowStockPromos += 1;
          }
        }
      }

      const clientesActivos = segments.activos;
      const ondasPorActivo =
        clientesActivos > 0
          ? Math.round((ondas / clientesActivos) * 10) / 10
          : 0;
      const canjesPorActivo =
        clientesActivos > 0
          ? Math.round((redenciones / clientesActivos) * 10) / 10
          : 0;

      return {
        storeId: id,
        storeName: store.name,
        planType: store.planType,
        kpis: {
          ondas,
          ondasDelta: pctDelta(ondas, prevOndas),
          redenciones,
          redencionesDelta: pctDelta(redenciones, prevRedenciones),
          clientesNuevos,
          clientesNuevosDelta: pctDelta(clientesNuevos, prevClientesNuevos),
          tasaRedencion: tasa,
          tasaRedencionDelta: tasa - prevTasa,
          clientesActivos,
          ondasPorActivo,
          canjesPorActivo,
          coberturaCatalogo: coverage,
          promosActivas: activePromos.length,
          whatsappUsed: store.whatsappUsed,
          whatsappLimit: PLAN_ONDA_MONTHLY_LIMIT,
          rankOndas: 0,
          rankRedenciones: 0,
          rankTasa: 0,
        },
        segments,
        vsSet: { ondasPctVsAvg: 0, redencionesPctVsAvg: 0, tasaPpVsAvg: 0 },
        flags: { lowStockPromos, zeroRedeemPromos },
      };
    });

    const n = storeRows.length;
    const avgOndas =
      n > 0 ? storeRows.reduce((s, r) => s + r.kpis.ondas, 0) / n : 0;
    const avgRedeem =
      n > 0 ? storeRows.reduce((s, r) => s + r.kpis.redenciones, 0) / n : 0;
    const avgTasa =
      n > 0
        ? storeRows.reduce((s, r) => s + r.kpis.tasaRedencion, 0) / n
        : 0;
    const avgCanjesPorActivo =
      n > 0
        ? storeRows.reduce((s, r) => s + r.kpis.canjesPorActivo, 0) / n
        : 0;
    const avgCercaPct =
      n > 0
        ? storeRows.reduce((s, r) => {
            const tot = r.segments.total || 1;
            return s + (r.segments.cercaCanje / tot) * 100;
          }, 0) / n
        : 0;
    const avgRiesgo =
      n > 0
        ? storeRows.reduce((s, r) => s + r.segments.enRiesgo, 0) / n
        : 0;

    const rankBy = (
      pick: (r: StoreRow) => number,
      key: 'rankOndas' | 'rankRedenciones' | 'rankTasa',
    ) => {
      [...storeRows]
        .sort((a, b) => pick(b) - pick(a))
        .forEach((r, i) => {
          r.kpis[key] = i + 1;
        });
    };
    rankBy((r) => r.kpis.ondas, 'rankOndas');
    rankBy((r) => r.kpis.redenciones, 'rankRedenciones');
    rankBy((r) => r.kpis.tasaRedencion, 'rankTasa');

    for (const r of storeRows) {
      r.vsSet = {
        ondasPctVsAvg:
          avgOndas > 0
            ? Math.round(((r.kpis.ondas - avgOndas) / avgOndas) * 100)
            : r.kpis.ondas > 0
              ? 100
              : 0,
        redencionesPctVsAvg:
          avgRedeem > 0
            ? Math.round(((r.kpis.redenciones - avgRedeem) / avgRedeem) * 100)
            : r.kpis.redenciones > 0
              ? 100
              : 0,
        tasaPpVsAvg: Math.round(r.kpis.tasaRedencion - avgTasa),
      };
    }

    const sumOndas = storeRows.reduce((s, r) => s + r.kpis.ondas, 0);
    const sumRedeem = storeRows.reduce((s, r) => s + r.kpis.redenciones, 0);
    const sumAccumulate = storeIds.reduce(
      (s, id) => s + (accumulateMap[id] ?? 0),
      0,
    );
    const sumPrevOndas = storeIds.reduce(
      (s, id) => s + (prevOndasMap[id] ?? 0),
      0,
    );
    const sumPrevRedeem = storeIds.reduce(
      (s, id) => s + (prevRedeemMap[id] ?? 0),
      0,
    );
    const sumPrevAccumulate = storeIds.reduce(
      (s, id) => s + (prevAccumulateMap[id] ?? 0),
      0,
    );
    const sumNuevos = storeRows.reduce(
      (s, r) => s + r.kpis.clientesNuevos,
      0,
    );
    let sumPrevClientesNuevos = 0;
    for (const id of storeIds) {
      const storePasses = passesByStore.get(id) || [];
      for (const p of storePasses) {
        if (p.user.createdAt >= prevFrom && p.user.createdAt <= prevTo) {
          sumPrevClientesNuevos += 1;
        }
      }
    }

    const setTasa =
      sumAccumulate > 0 ? Math.round((sumRedeem / sumAccumulate) * 100) : 0;
    const setPrevTasa =
      sumPrevAccumulate > 0
        ? Math.round((sumPrevRedeem / sumPrevAccumulate) * 100)
        : 0;
    const setActivos = storeRows.reduce(
      (s, r) => s + r.kpis.clientesActivos,
      0,
    );

    const pickLeader = (
      pick: (r: StoreRow) => number,
      higher = true,
    ): LeaderRef => {
      if (!storeRows.length) return null;
      const sorted = [...storeRows].sort((a, b) =>
        higher ? pick(b) - pick(a) : pick(a) - pick(b),
      );
      const top = sorted[0];
      return {
        storeId: top.storeId,
        storeName: top.storeName,
        value: pick(top),
      };
    };

    // Series by day × store
    const seriesMap = new Map<
      string,
      { date: string; byStore: Record<string, { ondas: number; canjes: number }> }
    >();
    for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
      const key = dayKey(new Date(t));
      const byStore: Record<string, { ondas: number; canjes: number }> = {};
      for (const id of storeIds) byStore[id] = { ondas: 0, canjes: 0 };
      seriesMap.set(key, { date: key, byStore });
    }
    for (const tx of txs) {
      const key = dayKey(tx.createdAt);
      const row = seriesMap.get(key);
      if (!row) continue;
      const cell = row.byStore[tx.storeId] || { ondas: 0, canjes: 0 };
      if (tx.type === 'ACCUMULATE') cell.ondas += tx.points;
      else cell.canjes += 1;
      row.byStore[tx.storeId] = cell;
    }
    const series = [...seriesMap.values()];

    // Insights
    const insights: Array<{
      id: string;
      tone: CompareTone;
      title: string;
      message: string;
      action?: string;
      storeIds?: string[];
      metric?: string;
      stat?: string;
    }> = [];

    if (n >= 2) {
      const byOndasVsAvg = [...storeRows].sort(
        (a, b) => a.vsSet.ondasPctVsAvg - b.vsSet.ondasPctVsAvg,
      );
      const laggard = byOndasVsAvg[0];
      if (laggard && laggard.vsSet.ondasPctVsAvg <= -25) {
        insights.push({
          id: 'laggard-ondas',
          tone: 'danger',
          title: `${laggard.storeName} rezagada en ondas`,
          message: `${laggard.storeName} está ${laggard.vsSet.ondasPctVsAvg}% vs el promedio del grupo. Revisa QR y caja.`,
          action: 'Ver sede',
          storeIds: [laggard.storeId],
          metric: 'ondas',
          stat: `${laggard.vsSet.ondasPctVsAvg}%`,
        });
      }

      const topOndas = [...storeRows].sort(
        (a, b) => b.kpis.ondas - a.kpis.ondas,
      )[0];
      if (
        topOndas &&
        topOndas.vsSet.tasaPpVsAvg <= -8 &&
        topOndas.kpis.ondas > 0
      ) {
        insights.push({
          id: 'volume-low-rate',
          tone: 'warning',
          title: 'Muchas ondas, poca conversión',
          message: `${topOndas.storeName} lidera ondas pero su tasa está ${Math.abs(topOndas.vsSet.tasaPpVsAvg)} pp bajo el promedio.`,
          action: 'Ver sede',
          storeIds: [topOndas.storeId],
          metric: 'tasa',
          stat: `−${Math.abs(topOndas.vsSet.tasaPpVsAvg)} pp`,
        });
      }

      const star = [...storeRows].sort(
        (a, b) => b.kpis.canjesPorActivo - a.kpis.canjesPorActivo,
      )[0];
      if (
        star &&
        avgCanjesPorActivo > 0 &&
        star.kpis.canjesPorActivo >= avgCanjesPorActivo * 1.5
      ) {
        const mult = (star.kpis.canjesPorActivo / avgCanjesPorActivo).toFixed(1);
        insights.push({
          id: 'conversion-star',
          tone: 'success',
          title: `${star.storeName} convierte mejor`,
          message: `Canjea ${mult}× más por cliente activo que el promedio. Vale copiar su mix de promos.`,
          action: 'Ver sede',
          storeIds: [star.storeId],
          metric: 'canjes',
          stat: `${mult}×`,
        });
      }

      for (const r of storeRows) {
        const cercaPct =
          r.segments.total > 0
            ? (r.segments.cercaCanje / r.segments.total) * 100
            : 0;
        if (
          r.segments.cercaCanje >= 3 &&
          cercaPct >= avgCercaPct + 10
        ) {
          insights.push({
            id: `near-redeem-hot-${r.storeId}`,
            tone: 'accent',
            title: `Pipeline listo en ${r.storeName}`,
            message: `${Math.round(cercaPct)}% de clientes cerca de canje (${r.segments.cercaCanje}). Empuja en caja o WhatsApp.`,
            action: 'Ver sede',
            storeIds: [r.storeId],
            metric: 'cercaCanje',
            stat: `${Math.round(cercaPct)}%`,
          });
          break;
        }
      }

      for (const r of storeRows) {
        if (
          r.segments.enRiesgo >= 3 &&
          avgRiesgo > 0 &&
          r.segments.enRiesgo >= avgRiesgo * 1.8
        ) {
          insights.push({
            id: `at-risk-hot-${r.storeId}`,
            tone: 'danger',
            title: `Más riesgo en ${r.storeName}`,
            message: `${r.segments.enRiesgo} clientes en riesgo — ${(r.segments.enRiesgo / avgRiesgo).toFixed(1)}× el promedio del grupo.`,
            action: 'Ver sede',
            storeIds: [r.storeId],
            metric: 'enRiesgo',
            stat: String(r.segments.enRiesgo),
          });
          break;
        }
      }

      for (const r of storeRows) {
        if (r.flags.zeroRedeemPromos >= 2) {
          insights.push({
            id: `promo-orphan-${r.storeId}`,
            tone: 'warning',
            title: `Promos sin tracción en ${r.storeName}`,
            message: `${r.flags.zeroRedeemPromos} promos activas sin canjes en el periodo.`,
            action: 'Ver sede',
            storeIds: [r.storeId],
            metric: 'promos',
            stat: String(r.flags.zeroRedeemPromos),
          });
          break;
        }
      }

      for (const r of storeRows) {
        if (
          r.flags.lowStockPromos >= 1 &&
          r.vsSet.tasaPpVsAvg < 0
        ) {
          insights.push({
            id: `stock-block-${r.storeId}`,
            tone: 'warning',
            title: `Posible bloqueo de stock en ${r.storeName}`,
            message: `${r.flags.lowStockPromos} promo(s) con stock bajo y tasa bajo el promedio.`,
            action: 'Ver sede',
            storeIds: [r.storeId],
            metric: 'stock',
            stat: String(r.flags.lowStockPromos),
          });
          break;
        }
      }

      if (n >= 3 && sumRedeem > 0) {
        const topRedeem = [...storeRows].sort(
          (a, b) => b.kpis.redenciones - a.kpis.redenciones,
        )[0];
        const share = Math.round(
          (topRedeem.kpis.redenciones / sumRedeem) * 100,
        );
        if (share >= 45) {
          insights.push({
            id: 'concentration',
            tone: 'accent',
            title: 'Canjes muy concentrados',
            message: `${topRedeem.storeName} concentra el ${share}% de los canjes del grupo.`,
            action: 'Ver sede',
            storeIds: [topRedeem.storeId],
            metric: 'redenciones',
            stat: `${share}%`,
          });
        }
      }

      const up = storeRows.filter((r) => r.kpis.ondasDelta >= 15);
      const down = storeRows.filter((r) => r.kpis.ondasDelta <= -15);
      if (up.length && down.length) {
        insights.push({
          id: 'divergent-trend',
          tone: 'warning',
          title: 'Tendencias opuestas',
          message: `${up[0].storeName} ${up[0].kpis.ondasDelta > 0 ? '+' : ''}${up[0].kpis.ondasDelta}% ondas vs ${down[0].storeName} ${down[0].kpis.ondasDelta}%.`,
          action: 'Ver sede',
          storeIds: [up[0].storeId, down[0].storeId],
          metric: 'ondas',
          stat: `${up[0].kpis.ondasDelta > 0 ? '+' : ''}${up[0].kpis.ondasDelta}%`,
        });
      }
    }

    if (!insights.length) {
      insights.push({
        id: 'healthy-set',
        tone: 'success',
        title: 'Grupo estable',
        message: `En el rango: ${sumOndas} ondas, ${sumRedeem} canjes, tasa ${setTasa}% entre ${n} sede${n === 1 ? '' : 's'}.`,
        stat: `${setTasa}%`,
      });
    }

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      previousRange: {
        from: prevFrom.toISOString(),
        to: prevTo.toISOString(),
      },
      meta: {
        storeIds,
        missingStoreIds,
        normalize,
      },
      set: {
        kpis: {
          ondas: sumOndas,
          ondasDelta: pctDelta(sumOndas, sumPrevOndas),
          redenciones: sumRedeem,
          redencionesDelta: pctDelta(sumRedeem, sumPrevRedeem),
          clientesNuevos: sumNuevos,
          clientesNuevosDelta: pctDelta(sumNuevos, sumPrevClientesNuevos),
          tasaRedencion: setTasa,
          tasaRedencionDelta: setTasa - setPrevTasa,
          clientesActivos: setActivos,
          ondasPorActivo:
            setActivos > 0
              ? Math.round((sumOndas / setActivos) * 10) / 10
              : 0,
          canjesPorActivo:
            setActivos > 0
              ? Math.round((sumRedeem / setActivos) * 10) / 10
              : 0,
        },
        leaders: {
          ondas: pickLeader((r) => r.kpis.ondas),
          redenciones: pickLeader((r) => r.kpis.redenciones),
          tasaRedencion: pickLeader((r) => r.kpis.tasaRedencion),
          clientesNuevos: pickLeader((r) => r.kpis.clientesNuevos),
        },
        laggards: {
          ondas: pickLeader((r) => r.kpis.ondas, false),
          redenciones: pickLeader((r) => r.kpis.redenciones, false),
          tasaRedencion: pickLeader((r) => r.kpis.tasaRedencion, false),
          clientesNuevos: pickLeader((r) => r.kpis.clientesNuevos, false),
        },
      },
      stores: storeRows,
      series,
      insights: insights.slice(0, 8),
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
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(JobsService) private jobs: JobsService
  ) {}

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      email: string;
      phone?: string;
      businessName?: string;
      message?: string;
    }
  ) {
    const lead = await this.prisma.lead.create({ data: body });
    if (body.email) {
      await this.jobs.enqueue('brevo-email', {
        to: body.email,
        toName: body.name,
        subject: 'Recibimos tu mensaje — Onda',
        html: `<p>Hola ${body.name || ''},</p><p>Gracias por escribirnos. El equipo de Onda te contactará pronto.</p>`,
        text: `Hola ${body.name || ''}, gracias por escribirnos. El equipo de Onda te contactará pronto.`,
      });
    }
    return lead;
  }

  @Get()
  list() {
    return this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
  }
}

@Controller('billing')
export class BillingController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WompiService) private wompi: WompiService,
    @Inject(JobsService) private jobs: JobsService
  ) {}

  @Get('store/:storeId')
  async summary(@Param('storeId') storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    const [ondasUsed, smsCampaignsUsed] = await Promise.all([
      monthlyOndasUsed(this.prisma, storeId),
      monthlySmsCampaignsUsed(this.prisma, storeId),
    ]);
    return {
      planType: store.planType,
      billingStatus: store.billingStatus,
      ondasUsed,
      ondasLimit: PLAN_ONDA_MONTHLY_LIMIT,
      smsCampaignsUsed,
      smsCampaignsLimit: PLAN_SMS_CAMPAIGNS_MONTHLY,
      planPriceCop: store.planType === 'PRO' ? 69_900 : 49_900,
      freeMonthsBalance: store.freeMonthsBalance,
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
    await this.prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    if (!this.wompi.isConfigured) {
      const store = await this.prisma.store.update({
        where: { id: storeId },
        data: { planType: 'PRO', billingStatus: 'ACTIVE' },
      });
      return { store, stub: true as const, checkout: null };
    }

    const checkout = this.wompi.createCheckout(storeId);
    await this.prisma.store.update({
      where: { id: storeId },
      data: { wompiTransactionId: checkout.reference },
    });
    return { stub: false as const, checkout };
  }

  @Post('wompi/webhook')
  async wompiWebhook(@Body() body: Record<string, unknown>) {
    if (!this.wompi.verifyEventChecksum(body)) {
      throw new ForbiddenException('Firma Wompi inválida');
    }
    const tx = this.wompi.transactionFromEvent(body);
    if (!tx?.reference || tx.status !== 'APPROVED') {
      return { received: true, ignored: true };
    }
    const store = await this.prisma.store.findFirst({
      where: { wompiTransactionId: tx.reference },
    });
    if (!store) {
      return { received: true, store: null };
    }
    const paymentSourceId =
      tx.paymentSourceId != null ? String(tx.paymentSourceId) : store.wompiPaymentSourceId;
    await this.prisma.store.update({
      where: { id: store.id },
      data: {
        planType: 'PRO',
        billingStatus: 'ACTIVE',
        wompiPaymentSourceId: paymentSourceId,
      },
    });
    if (paymentSourceId) {
      await this.jobs.scheduleWompiRenew(store.id);
    }
    return { received: true, storeId: store.id, status: 'PRO' };
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
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WhatsappService) private whatsapp: WhatsappService
  ) {}

  @Post('kapso')
  async kapso(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-kapso-signature') kapsoSig: string | undefined,
    @Headers('x-webhook-signature') webhookSig: string | undefined,
    @Body() body: Record<string, unknown>
  ) {
    const raw =
      req.rawBody?.toString('utf8') ||
      (typeof body === 'object' ? JSON.stringify(body) : '');
    const signature = kapsoSig || webhookSig;
    if (!this.whatsapp.verifyWebhookSignature(raw, signature)) {
      throw new ForbiddenException('Firma Kapso inválida');
    }
    return { ok: true, event: body['event'] ?? body['type'] ?? 'unknown' };
  }
}
