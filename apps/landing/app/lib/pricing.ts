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
      'Wallet Apple y Google',
      'Recompensas a tu manera',
      'NFC + QR incluidos',
      'Base de clientes',
      'Hasta 150 msgs WhatsApp/mes',
    ],
  },
  PRO: {
    name: 'Onda Pro',
    shortName: 'Onda Pro',
    features: [
      'Todo lo de Onda',
      'Google Reviews',
      'Proximidad inteligente',
      'Campañas push segmentadas',
      'WhatsApp + SMS',
      'Analítica avanzada',
      'Hasta 350 msgs WhatsApp/mes',
    ],
  },
};

export function formatCop(amount: number) {
  return `$${Math.round(amount).toLocaleString('es-CO')}`;
}

export function quotePlan(plan: PlanId, billing: BillingPeriod) {
  const monthlyList = PLAN_MONTHLY[plan];
  const months = BILLING_MONTHS[billing];
  const monthlyEffective = PLAN_EFFECTIVE[plan][billing];
  const total = monthlyEffective * months;
  const fullTotal = monthlyList * months;
  const savings = fullTotal - total;
  const includesKit = billing !== 'monthly';
  const discount = savings > 0 ? savings / fullTotal : 0;

  return {
    monthlyList,
    monthlyEffective,
    months,
    total,
    savings,
    discount,
    includesKit,
    periodLabel:
      billing === 'monthly' ? 'mensual' : billing === '6' ? 'semestral' : 'anual',
  };
}
