import { BadRequestException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  PLAN_ONDA_MONTHLY_LIMIT,
  PLAN_SMS_CAMPAIGNS_MONTHLY,
} from '@onda/shared-types';

export { PLAN_ONDA_MONTHLY_LIMIT, PLAN_SMS_CAMPAIGNS_MONTHLY };

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
  return db.campaign.count({
    where: {
      storeId,
      channel: 'SMS',
      createdAt: { gte: startOfCurrentMonth(now) },
    },
  });
}

export async function assertCanLaunchSmsCampaign(
  db: QuotaDb,
  storeId: string,
  now = new Date()
): Promise<void> {
  const used = await monthlySmsCampaignsUsed(db, storeId, now);
  if (used >= PLAN_SMS_CAMPAIGNS_MONTHLY) {
    throw new BadRequestException(
      `Este mes ya usaste las ${PLAN_SMS_CAMPAIGNS_MONTHLY} campañas SMS incluidas en tu suscripción.`
    );
  }
}
