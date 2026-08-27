import { redirect } from 'next/navigation';

const MERCHANT_ONBOARDING_BASE =
  process.env.NEXT_PUBLIC_MERCHANT_URL
    ? `${process.env.NEXT_PUBLIC_MERCHANT_URL.replace(/\/$/, '')}/onboarding`
    : 'http://localhost:4202/onboarding';

import { sanitizeReferralCode } from '@onda/shared-utils';

/** Solo letras/números del código de referido (evita URLs contaminadas por share). */
function normalizeReferralCode(raw: string): string {
  return sanitizeReferralCode(raw);
}

/** Entrada pública de referidos: /unirse/CODIGO → merchant /onboarding?ref=CODIGO */
export default async function UnirsePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = normalizeReferralCode(code);
  if (!normalized) {
    redirect(MERCHANT_ONBOARDING_BASE);
  }
  redirect(`${MERCHANT_ONBOARDING_BASE}?ref=${encodeURIComponent(normalized)}`);
}
