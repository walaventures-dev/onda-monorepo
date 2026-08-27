import {
  PLAN_ONDA_MONTHLY_LIMIT,
  PLAN_SMS_CAMPAIGNS_MONTHLY,
  CAMPAIGN_PRICE_COP,
  CAMPAIGN_PACK_SIZE,
  CAMPAIGN_PACK_DISCOUNT,
  CAMPAIGN_FREE_REACH_MONTHLY,
  CAMPAIGN_REACH_PRICE_COP,
} from '@onda/shared-types';

export type PlanId = 'BASIC' | 'PRO';
export type BillingPeriod = 'monthly' | '6' | '12';

export const PLAN_MONTHLY: Record<PlanId, number> = {
  BASIC: 49_900,
  PRO: 69_900,
};

/** Precio / mes efectivo según la propuesta de marketing. */
export const PLAN_EFFECTIVE: Record<PlanId, Record<BillingPeriod, number>> = {
  BASIC: {
    monthly: 49_900,
    '6': 43_900,
    '12': 41_400,
  },
  PRO: {
    monthly: 69_900,
    '6': 61_500,
    '12': 59_900,
  },
};

export const BILLING_MONTHS: Record<BillingPeriod, number> = {
  monthly: 1,
  '6': 6,
  '12': 12,
};

/** Días del periodo de facturación (renovaciones). */
export const BILLING_PERIOD_DAYS: Record<BillingPeriod, number> = {
  monthly: 30,
  '6': 180,
  '12': 365,
};

/** Días extra del primer ciclo (segundo cobro = period + bonus). */
export const FIRST_CYCLE_BONUS_DAYS = 30;

/** Días que mueve el referido/referidor al pagar. */
export const REFERRAL_BONUS_DAYS = 30;

export function addBillingDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Primer intervalo hasta el segundo cobro: periodDays + 30 (+ 30 si referido). */
export function initialBillingIntervalDays(
  billing: BillingPeriod,
  opts?: { referred?: boolean }
): number {
  const periodDays = BILLING_PERIOD_DAYS[billing];
  const bonus = FIRST_CYCLE_BONUS_DAYS + (opts?.referred ? REFERRAL_BONUS_DAYS : 0);
  return periodDays + bonus;
}

export function initialNextBillingAt(
  billing: BillingPeriod,
  from = new Date(),
  opts?: { referred?: boolean }
): Date {
  return addBillingDays(from, initialBillingIntervalDays(billing, opts));
}

export function advanceNextBillingAt(
  billing: BillingPeriod,
  from = new Date()
): Date {
  return addBillingDays(from, BILLING_PERIOD_DAYS[billing]);
}

export const PLAN_META: Record<
  PlanId,
  { name: string; shortName: string; features: string[] }
> = {
  BASIC: {
    name: 'Onda',
    shortName: 'Onda',
    features: [
      'Tarjeta en Apple y Google Wallet',
      'Punto de venta (POS) incluido',
      '1 admin + 1 caja',
      `Hasta ${PLAN_ONDA_MONTHLY_LIMIT} ondas al mes`,
      `${CAMPAIGN_FREE_REACH_MONTHLY} personas alcanzadas gratis al mes`,
      'Recompensas que tú defines',
      'Tu propia base de clientes',
      'Avisos push desde el Wallet',
    ],
  },
  PRO: {
    name: 'Onda Pro',
    shortName: 'Onda Pro',
    features: [
      'Todo lo de Onda',
      'Punto de venta (POS) incluido',
      '1 admin + hasta 3 cajas',
      `Hasta ${PLAN_ONDA_MONTHLY_LIMIT} ondas al mes`,
      `${CAMPAIGN_FREE_REACH_MONTHLY} personas alcanzadas gratis al mes`,
      'Campañas para llenar el local',
      'Pide reseñas en Google al canjear',
      'Aviso cuando el cliente está cerca',
      'Analítica para ver qué sí funciona',
    ],
  },
};

export function campaignReachQuote(opts: {
  audienceCount: number;
  reachUsedThisMonth: number;
  unitCop?: number;
  freeMonthly?: number;
}) {
  const unitCop = opts.unitCop ?? CAMPAIGN_REACH_PRICE_COP;
  const freeMonthly = opts.freeMonthly ?? CAMPAIGN_FREE_REACH_MONTHLY;
  const remainingFree = Math.max(0, freeMonthly - opts.reachUsedThisMonth);
  const freeApplied = Math.min(opts.audienceCount, remainingFree);
  const paidCount = Math.max(0, opts.audienceCount - freeApplied);
  const costCop = paidCount * unitCop;
  return {
    freeMonthly,
    reachUsedThisMonth: opts.reachUsedThisMonth,
    reachRemainingThisMonth: remainingFree,
    freeApplied,
    paidCount,
    costCop,
    unitCop,
    reachUsedAfter: opts.reachUsedThisMonth + opts.audienceCount,
  };
}

export function formatCampaignRoi(ratio: number | null | undefined): string {
  if (ratio == null) return '—';
  if (!Number.isFinite(ratio) || ratio <= 0) return '0×';
  if (ratio >= 10) return `${Math.round(ratio)}×`;
  return `${ratio.toLocaleString('es-CO', { maximumFractionDigits: 1 })}×`;
}

export function campaignPackPriceCop(
  unitCop = CAMPAIGN_PRICE_COP,
  packSize = CAMPAIGN_PACK_SIZE,
  discount = CAMPAIGN_PACK_DISCOUNT
) {
  return Math.round(unitCop * packSize * (1 - discount));
}

export function campaignCatalogPricing(opts?: {
  freeMonthly?: number;
  unitCop?: number;
  packSize?: number;
  packDiscount?: number;
}) {
  const freeMonthly = opts?.freeMonthly ?? PLAN_SMS_CAMPAIGNS_MONTHLY;
  const unitCop = opts?.unitCop ?? CAMPAIGN_PRICE_COP;
  const packSize = opts?.packSize ?? CAMPAIGN_PACK_SIZE;
  const packDiscount = opts?.packDiscount ?? CAMPAIGN_PACK_DISCOUNT;
  return {
    freeMonthly,
    unitCop,
    packSize,
    packDiscount,
    packCop: campaignPackPriceCop(unitCop, packSize, packDiscount),
  };
}

export function formatCop(amount: number) {
  return `$${Math.round(amount).toLocaleString('es-CO')}`;
}

export function formatMoneyInput(raw: string) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('es-CO');
}

export function parseMoneyInput(raw: string) {
  return String(raw || '').replace(/\D/g, '');
}

export function parsePlanId(raw: string | null | undefined): PlanId | null {
  const v = (raw || '').trim().toUpperCase();
  return v === 'PRO' || v === 'BASIC' ? v : null;
}

export function parseBillingPeriod(
  raw: string | null | undefined
): BillingPeriod | null {
  const v = (raw || '').trim();
  return v === 'monthly' || v === '6' || v === '12' ? v : null;
}

export function quotePlan(plan: PlanId, billing: BillingPeriod) {
  const monthlyList = PLAN_MONTHLY[plan];
  const paidMonths = BILLING_MONTHS[billing];
  const monthlyEffective = PLAN_EFFECTIVE[plan][billing];
  const total = monthlyEffective * paidMonths;
  const fullTotal = monthlyList * paidMonths;
  const discountSavings = fullTotal - total;
  const periodDays = BILLING_PERIOD_DAYS[billing];
  const firstIntervalDays = initialBillingIntervalDays(billing);
  const referredFirstIntervalDays = initialBillingIntervalDays(billing, {
    referred: true,
  });
  /** @deprecated marketing calendar; prefer firstIntervalDays */
  const freeMonths = 0;
  const serviceMonths = paidMonths;
  const freeMonthValue = 0;
  const savings = discountSavings;
  const includesKit = billing !== 'monthly';
  const noCardRequired = false;
  const discount = discountSavings > 0 ? discountSavings / fullTotal : 0;

  return {
    monthlyList,
    monthlyEffective,
    paidMonths,
    /** @deprecated use paidMonths */
    months: paidMonths,
    serviceMonths,
    freeMonths,
    periodDays,
    firstIntervalDays,
    referredFirstIntervalDays,
    firstCycleBonusDays: FIRST_CYCLE_BONUS_DAYS,
    total,
    discountSavings,
    freeMonthValue,
    savings,
    discount,
    includesKit,
    noCardRequired,
    periodLabel:
      billing === 'monthly'
        ? 'mensual'
        : billing === '6'
          ? 'semestral'
          : 'anual',
  };
}

export type TimelineMonthKind = 'free' | 'paid' | 'renewal';

export type SubscriptionMonth = {
  key: string;
  label: string;
  year: number;
  kind: TimelineMonthKind;
};

export function formatChargeDate(date: Date) {
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Meses visibles: cubiertos por el prepago + el mes del segundo cobro. */
export function subscriptionCalendar(
  billing: BillingPeriod,
  from = new Date(),
  opts?: { referred?: boolean }
): SubscriptionMonth[] {
  const { paidMonths } = quotePlan('BASIC', billing);
  const nextCharge = initialNextBillingAt(billing, from, opts);
  const total = paidMonths + 1;
  const months: SubscriptionMonth[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const kind: TimelineMonthKind =
      i < paidMonths ? 'paid' : 'renewal';
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', ''),
      year: d.getFullYear(),
      kind,
    });
  }
  // Ensure renewal month matches nextCharge month if calendar length is short
  const renew = months[months.length - 1];
  if (renew) {
    renew.key = `${nextCharge.getFullYear()}-${nextCharge.getMonth()}`;
    renew.label = nextCharge
      .toLocaleDateString('es-CO', { month: 'short' })
      .replace('.', '');
    renew.year = nextCharge.getFullYear();
  }
  return months;
}

export function subscriptionChargeDates(
  billing: BillingPeriod,
  from = new Date(),
  opts?: { referred?: boolean }
) {
  return {
    firstCharge: from,
    nextCharge: initialNextBillingAt(billing, from, opts),
    renewIntervalDays: BILLING_PERIOD_DAYS[billing],
    firstIntervalDays: initialBillingIntervalDays(billing, opts),
  };
}
