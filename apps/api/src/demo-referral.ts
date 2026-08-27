import { sanitizeReferralCode } from '@onda/shared-utils';

/** Código interno de demos (`ONDA_DEMO_REFERRAL_CODE`). Activa PRO mensual sin referidor. */

export function getDemoReferralCode(): string | null {
  const normalized = sanitizeReferralCode(process.env.ONDA_DEMO_REFERRAL_CODE);
  return normalized || null;
}

export function isDemoReferralCode(code?: string | null): boolean {
  const demo = getDemoReferralCode();
  const normalized = sanitizeReferralCode(code);
  if (!demo || !normalized) return false;
  return normalized === demo;
}

export { sanitizeReferralCode as normalizeReferralCode };
