import { BadRequestException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  PLAN_SMS_REACH_MONTHLY,
  SMS_OVERAGE_COP,
} from '@onda/shared-types';
import {
  campaignReachQuote,
  parsePlanId,
  planNewCustomersLimit,
  planSmsReachLimit,
  usagePeriodFor,
  type PlanId,
} from '@onda/shared-utils';
import { campaignReachPricing } from './campaign-pricing';

export { PLAN_ONDA_MONTHLY_LIMIT } from '@onda/shared-types';
export { PLAN_SMS_REACH_MONTHLY, SMS_OVERAGE_COP };

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

export function usageWindow(
  nextUsageBillingAt: Date | null | undefined,
  now = new Date()
): { start: Date; end: Date } {
  if (nextUsageBillingAt) {
    return usagePeriodFor(nextUsageBillingAt);
  }
  return { start: startOfCurrentMonth(now), end: now };
}

/** @deprecated Ondas ya no tienen tope comercial. */
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

/** @deprecated Siempre ilimitado. */
export async function remainingOndas(
  _db: QuotaDb,
  _storeId: string,
  _now = new Date()
): Promise<number> {
  return Number.MAX_SAFE_INTEGER;
}

/** Ya no pausa acumulación; el excedente de clientes nuevos se factura. */
export async function assertCanAccumulate(
  _db: QuotaDb,
  _storeId: string,
  points: number,
  _now = new Date()
): Promise<number> {
  return Math.max(0, points);
}

export async function monthlyNewCustomersUsed(
  db: QuotaDb,
  storeId: string,
  from: Date,
  to: Date
): Promise<number> {
  return db.pass.count({
    where: {
      storeId,
      user: { createdAt: { gte: from, lt: to } },
    },
  });
}

/** SMS enviados (no cuenta push de Wallet). */
export async function monthlyReachUsed(
  db: QuotaDb,
  storeId: string,
  from?: Date,
  to?: Date
): Promise<number> {
  const start = from ?? startOfCurrentMonth();
  const end = to;
  const agg = await db.campaign.aggregate({
    where: {
      storeId,
      status: 'SENT',
      sendSms: true,
      sentAt: end ? { gte: start, lt: end } : { gte: start },
    },
    _sum: { smsReachCount: true, reachCount: true },
  });
  return agg._sum.smsReachCount ?? agg._sum.reachCount ?? 0;
}

export async function monthlyCampaignsSent(
  db: QuotaDb,
  storeId: string,
  from: Date,
  to: Date
): Promise<number> {
  return db.campaign.count({
    where: {
      storeId,
      status: 'SENT',
      sentAt: { gte: from, lt: to },
    },
  });
}

export function quoteReachCost(
  reachUsedThisMonth: number,
  projectedReach: number,
  opts?: { unitCop?: number; freeMonthly?: number; planType?: PlanId | string | null }
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
  const store = await db.store.findUniqueOrThrow({
    where: { id: storeId },
    select: {
      wompiPaymentSourceId: true,
      planType: true,
      nextUsageBillingAt: true,
    },
  });
  const plan = parsePlanId(store.planType) || 'BASIC';
  const window = usageWindow(store.nextUsageBillingAt, now);
  const used = await monthlyReachUsed(db, storeId, window.start, window.end);
  const quote = quoteReachCost(used, projectedReach, { planType: plan });
  if (quote.paidCount <= 0) return quote;

  if (!store.wompiPaymentSourceId) {
    throw new BadRequestException({
      code: 'PAYMENT_METHOD_REQUIRED',
      message:
        'Para superar el cupo de SMS del plan necesitas tarjeta. El extra se cobra en la próxima factura de consumos.',
      hasPaymentMethod: false,
      quote,
    });
  }
  return quote;
}

export function planLimitsFor(planType: string | null | undefined) {
  const plan = parsePlanId(planType) || 'BASIC';
  return {
    plan,
    newCustomersLimit: planNewCustomersLimit(plan),
    smsLimit: planSmsReachLimit(plan),
  };
}

/** @deprecated Legacy slot billing — use monthlyReachUsed */
export async function monthlySmsCampaignsUsed(
  db: QuotaDb,
  storeId: string,
  now = new Date()
): Promise<number> {
  return monthlyReachUsed(db, storeId, startOfCurrentMonth(now));
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
