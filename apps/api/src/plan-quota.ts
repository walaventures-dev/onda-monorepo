import { BadRequestException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  CAMPAIGN_FREE_REACH_MONTHLY,
  CAMPAIGN_REACH_PRICE_COP,
} from '@onda/shared-types';
import { campaignReachQuote } from '@onda/shared-utils';
import { campaignReachPricing } from './campaign-pricing';

export { PLAN_ONDA_MONTHLY_LIMIT } from '@onda/shared-types';
export { CAMPAIGN_FREE_REACH_MONTHLY, CAMPAIGN_REACH_PRICE_COP };

const BILLING_TZ = 'America/Bogota';

type QuotaDb = PrismaClient | Prisma.TransactionClient;

export function startOfCurrentMonth(now = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: BILLING_TZ,
      year: 'numeric',
      month: '2-digit',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return new Date(`${parts.year}-${parts.month}-01T05:00:00.000Z`);
}

export async function monthlyOndasUsed(
  db: QuotaDb,
  storeId: string,
  now = new Date()
): Promise<number> {
  const agg = await db.transaction.aggregate({
    where: {
      storeId,
      type: 'ACCUMULATE',
      createdAt: { gte: startOfCurrentMonth(now) },
    },
    _sum: { points: true },
  });
  return agg._sum.points ?? 0;
}

export async function remainingOndas(
  db: QuotaDb,
  storeId: string,
  now = new Date()
): Promise<number> {
  const used = await monthlyOndasUsed(db, storeId, now);
  const { PLAN_ONDA_MONTHLY_LIMIT } = await import('@onda/shared-types');
  return Math.max(0, PLAN_ONDA_MONTHLY_LIMIT - used);
}

export async function assertCanAccumulate(
  db: QuotaDb,
  storeId: string,
  points: number,
  now = new Date()
): Promise<number> {
  const remaining = await remainingOndas(db, storeId, now);
  const { PLAN_ONDA_MONTHLY_LIMIT } = await import('@onda/shared-types');
  if (remaining <= 0) {
    throw new BadRequestException(
      `Este mes ya usaste las ${PLAN_ONDA_MONTHLY_LIMIT} ondas incluidas en tu suscripción.`
    );
  }
  return Math.min(Math.max(0, points), remaining);
}

/** Personas alcanzadas (reachCount) en campañas enviadas este mes. */
export async function monthlyReachUsed(
  db: QuotaDb,
  storeId: string,
  now = new Date()
): Promise<number> {
  const monthStart = startOfCurrentMonth(now);
  const agg = await db.campaign.aggregate({
    where: {
      storeId,
      status: 'SENT',
      sentAt: { gte: monthStart },
    },
    _sum: { reachCount: true },
  });
  return agg._sum.reachCount ?? 0;
}

export function quoteReachCost(
  reachUsedThisMonth: number,
  projectedReach: number,
  opts?: { unitCop?: number; freeMonthly?: number }
) {
  const pricing = campaignReachPricing(opts);
  return campaignReachQuote({
    audienceCount: projectedReach,
    reachUsedThisMonth,
    unitCop: pricing.unitCop,
    freeMonthly: pricing.freeMonthly,
  });
}

export async function assertCanLaunchReach(
  db: QuotaDb,
  storeId: string,
  projectedReach: number,
  now = new Date()
) {
  const used = await monthlyReachUsed(db, storeId, now);
  const quote = quoteReachCost(used, projectedReach);
  if (quote.paidCount <= 0) return quote;

  const store = await db.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { wompiPaymentSourceId: true },
  });
  if (!store.wompiPaymentSourceId) {
    throw new BadRequestException({
      code: 'PAYMENT_METHOD_REQUIRED',
      message:
        'Para alcanzar más de 30 personas al mes necesitas tarjeta en Configuración.',
      hasPaymentMethod: false,
      quote,
    });
  }
  return quote;
}

/** @deprecated Legacy slot billing — use monthlyReachUsed */
export async function monthlySmsCampaignsUsed(
  db: QuotaDb,
  storeId: string,
  now = new Date()
): Promise<number> {
  return monthlyReachUsed(db, storeId, now);
}

/** @deprecated Legacy — use assertCanLaunchReach */
export async function consumeCampaignSlot(
  db: QuotaDb,
  storeId: string,
  now = new Date()
): Promise<'FREE' | 'CREDIT'> {
  await assertCanLaunchReach(db, storeId, 0, now);
  return 'FREE';
}

/** @deprecated Legacy */
export async function assertCanLaunchSmsCampaign(
  db: QuotaDb,
  storeId: string,
  now = new Date()
): Promise<void> {
  await assertCanLaunchReach(db, storeId, 0, now);
}
