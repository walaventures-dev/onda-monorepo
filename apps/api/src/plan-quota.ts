import { BadRequestException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PLAN_ONDA_MONTHLY_LIMIT } from '@onda/shared-types';
import { campaignPricing } from './campaign-pricing';

export { PLAN_ONDA_MONTHLY_LIMIT };
export { PLAN_SMS_CAMPAIGNS_MONTHLY } from '@onda/shared-types';

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
  // Bogotá es UTC-5 todo el año: el 1° a las 00:00 local = 05:00 UTC.
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
  return Math.max(0, PLAN_ONDA_MONTHLY_LIMIT - used);
}

export async function assertCanAccumulate(
  db: QuotaDb,
  storeId: string,
  points: number,
  now = new Date()
): Promise<number> {
  const remaining = await remainingOndas(db, storeId, now);
  if (remaining <= 0) {
    throw new BadRequestException(
      `Este mes ya usaste las ${PLAN_ONDA_MONTHLY_LIMIT} ondas incluidas en tu suscripción.`
    );
  }
  return Math.min(Math.max(0, points), remaining);
}

export async function monthlySmsCampaignsUsed(
  db: QuotaDb,
  storeId: string,
  now = new Date()
): Promise<number> {
  const monthStart = startOfCurrentMonth(now);
  return db.campaign.count({
    where: {
      storeId,
      sendSms: true,
      billingKind: 'FREE',
      status: { in: ['SCHEDULED', 'SENT'] },
      OR: [
        { scheduledAt: { gte: monthStart } },
        { scheduledAt: null, createdAt: { gte: monthStart } },
      ],
    },
  });
}

export async function consumeCampaignSlot(
  db: QuotaDb,
  storeId: string,
  now = new Date()
): Promise<'FREE' | 'CREDIT'> {
  const pricing = campaignPricing();
  const used = await monthlySmsCampaignsUsed(db, storeId, now);
  if (used < pricing.freeMonthly) return 'FREE';

  const store = await db.store.findUniqueOrThrow({
    where: { id: storeId },
    select: {
      campaignCredits: true,
      wompiPaymentSourceId: true,
      campaignPackSubscribed: true,
    },
  });
  if (store.campaignCredits > 0) {
    await db.store.update({
      where: { id: storeId },
      data: { campaignCredits: { decrement: 1 } },
    });
    return 'CREDIT';
  }

  throw new BadRequestException({
    code: 'CAMPAIGN_QUOTA',
    message: `Ya usaste tu${pricing.freeMonthly === 1 ? '' : 's'} ${pricing.freeMonthly} campaña${pricing.freeMonthly === 1 ? '' : 's'} gratis de este mes. Compra créditos extra o el paquete de ${pricing.packSize}.`,
    hasPaymentMethod: Boolean(store.wompiPaymentSourceId),
    packSubscribed: store.campaignPackSubscribed,
    pricing,
  });
}

export async function assertCanLaunchSmsCampaign(
  db: QuotaDb,
  storeId: string,
  now = new Date()
): Promise<void> {
  await consumeCampaignSlot(db, storeId, now);
}
