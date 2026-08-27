/** Código interno de demos (`ONDA_DEMO_REFERRAL_CODE`). Activa PRO mensual sin referidor. */

export function getDemoReferralCode(): string | null {
  const raw = process.env.ONDA_DEMO_REFERRAL_CODE?.trim();
  return raw ? raw.toUpperCase() : null;
}

export function isDemoReferralCode(code?: string | null): boolean {
  const demo = getDemoReferralCode();
  if (!demo || !code?.trim()) return false;
  return code.trim().toUpperCase() === demo;
}
