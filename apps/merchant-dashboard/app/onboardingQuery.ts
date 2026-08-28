import {
  parseBillingPeriod,
  parsePlanId,
  formatReferralCodeInput,
  sanitizeReferralCode,
  type BillingPeriod,
  type PlanId,
} from '@onda/shared-utils';

const PLAN_KEY = 'onda-onboarding-plan';
const BILLING_KEY = 'onda-onboarding-billing';
const REF_KEY = 'onda-onboarding-ref';
const NAME_KEY = 'onda-onboarding-owner-name';

export { sanitizeReferralCode, formatReferralCodeInput };

export function persistOnboardingQuery(searchParams: {
  get(name: string): string | null;
}) {
  try {
    const plan = parsePlanId(searchParams.get('plan'));
    const billing = parseBillingPeriod(searchParams.get('billing'));
    const ref = sanitizeReferralCode(searchParams.get('ref'));
    if (plan) sessionStorage.setItem(PLAN_KEY, plan);
    if (billing) sessionStorage.setItem(BILLING_KEY, billing);
    if (ref) sessionStorage.setItem(REF_KEY, ref);
  } catch {
    /* ignore */
  }
}

export function readStoredPlan(): PlanId {
  try {
    return parsePlanId(sessionStorage.getItem(PLAN_KEY)) ?? 'BASIC';
  } catch {
    return 'BASIC';
  }
}

export function readStoredBilling(): BillingPeriod {
  try {
    return parseBillingPeriod(sessionStorage.getItem(BILLING_KEY)) ?? '12';
  } catch {
    return '12';
  }
}

export function readStoredReferral(): string {
  try {
    return sanitizeReferralCode(sessionStorage.getItem(REF_KEY));
  } catch {
    return '';
  }
}

export function rememberPlanChoice(plan: PlanId, billing: BillingPeriod) {
  try {
    sessionStorage.setItem(PLAN_KEY, plan);
    sessionStorage.setItem(BILLING_KEY, billing);
  } catch {
    /* ignore */
  }
}

export function rememberOwnerName(name: string) {
  try {
    const v = name.trim();
    if (v) sessionStorage.setItem(NAME_KEY, v);
  } catch {
    /* ignore */
  }
}

export function readStoredOwnerName(): string {
  try {
    return sessionStorage.getItem(NAME_KEY)?.trim() || '';
  } catch {
    return '';
  }
}
