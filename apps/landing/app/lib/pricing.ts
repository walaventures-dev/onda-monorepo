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

export const MERCHANT_ONBOARDING_BASE = process.env.NEXT_PUBLIC_MERCHANT_URL
  ? `${process.env.NEXT_PUBLIC_MERCHANT_URL.replace(/\/$/, '')}/onboarding`
  : 'http://localhost:4202/onboarding';

export function onboardingUrl(plan?: PlanId, billing?: BillingPeriod) {
  if (!plan) return MERCHANT_ONBOARDING_BASE;
  const params = new URLSearchParams({ plan });
  if (billing) params.set('billing', billing);
  return `${MERCHANT_ONBOARDING_BASE}?${params.toString()}`;
}
