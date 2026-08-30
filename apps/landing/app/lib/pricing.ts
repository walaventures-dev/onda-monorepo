import type { BillingPeriod, PlanId } from '@onda/shared-utils';

export type { PlanId, BillingPeriod } from '@onda/shared-utils';
export {
  PLAN_MONTHLY,
  PLAN_EFFECTIVE,
  BILLING_MONTHS,
  PLAN_META,
  formatCop,
  quotePlan,
} from '@onda/shared-utils';

/** Temporal: ocultar marketing de POS en la landing hasta el lanzamiento. */
export const SHOW_POS_LANDING = false;

const MERCHANT_BASE = process.env.NEXT_PUBLIC_MERCHANT_URL
  ? process.env.NEXT_PUBLIC_MERCHANT_URL.replace(/\/$/, '')
  : 'http://localhost:4202';

export const MERCHANT_ONBOARDING_BASE = `${MERCHANT_BASE}/onboarding`;

export function onboardingUrl(plan?: PlanId, billing?: BillingPeriod) {
  if (!plan) return MERCHANT_ONBOARDING_BASE;
  const params = new URLSearchParams({ plan });
  if (billing) params.set('billing', billing);
  return `${MERCHANT_ONBOARDING_BASE}?${params.toString()}`;
}

export function loginUrl() {
  return `${MERCHANT_BASE}/login`;
}

/** Funnel de ventas: pedir que te llamen para un demo. */
export const DEMO_FUNNEL_PATH = '/demo';

export function demoUrl() {
  return DEMO_FUNNEL_PATH;
}
