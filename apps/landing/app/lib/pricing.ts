export type PlanId = 'BASIC' | 'PRO';
export type BillingPeriod = 'monthly' | '6' | '12';

export const MERCHANT_ONBOARDING_BASE =
  process.env.NEXT_PUBLIC_MERCHANT_URL
    ? `${process.env.NEXT_PUBLIC_MERCHANT_URL.replace(/\/$/, '')}/onboarding`
    : 'http://localhost:4202/onboarding';

export function onboardingUrl(plan?: PlanId) {
  if (!plan) return MERCHANT_ONBOARDING_BASE;
  return `${MERCHANT_ONBOARDING_BASE}?plan=${plan}`;
}

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

export const PLAN_META: Record<
  PlanId,
  { name: string; shortName: string; features: string[] }
> = {
  BASIC: {
    name: 'Onda',
    shortName: 'Onda',
    features: [
      'Pase en Apple y Google Wallet',
      'Recompensas a tu medida',
      'Base de clientes propia',
      'Avisos push desde el Wallet',
    ],
  },
  PRO: {
    name: 'Onda Pro',
    shortName: 'Onda Pro',
    features: [
      'Todo lo de Onda',
      '2 campañas para traer clientes de vuelta',
      'WhatsApp y SMS (hasta 350 msgs/mes)',
      'Más reseñas en Google',
      'Avisos al cliente cuando está cerca del negocio',
      'Analítica para ver qué funciona',
    ],
  },
};

export function formatCop(amount: number) {
  return `$${Math.round(amount).toLocaleString('es-CO')}`;
}

export function quotePlan(plan: PlanId, billing: BillingPeriod) {
  const monthlyList = PLAN_MONTHLY[plan];
  const paidMonths = BILLING_MONTHS[billing];
  const monthlyEffective = PLAN_EFFECTIVE[plan][billing];
  const total = monthlyEffective * paidMonths;
  const fullTotal = monthlyList * paidMonths;
  const discountSavings = fullTotal - total;
  /** Primer mes gratis en todos; en 6/12 es adicional al descuento del prepago. */
  const freeMonths = 1;
  const serviceMonths = billing === 'monthly' ? freeMonths : paidMonths + freeMonths;
  const freeMonthValue = monthlyList * freeMonths;
  const savings = discountSavings + (billing === 'monthly' ? 0 : freeMonthValue);
  const includesKit = billing !== 'monthly';
  /** Ningún plan pide tarjeta para iniciar. */
  const noCardRequired = true;
  const discount = discountSavings > 0 ? discountSavings / fullTotal : 0;

  return {
    monthlyList,
    monthlyEffective,
    paidMonths,
    /** @deprecated use paidMonths */
    months: paidMonths,
    serviceMonths,
    freeMonths,
    total,
    discountSavings,
    freeMonthValue,
    savings,
    discount,
    includesKit,
    noCardRequired,
    periodLabel:
      billing === 'monthly' ? 'mensual' : billing === '6' ? 'semestral' : 'anual',
  };
}
