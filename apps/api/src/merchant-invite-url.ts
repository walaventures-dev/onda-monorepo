import { merchantBaseUrl } from './mail-templates/brand';

export function inviteAcceptUrl(token: string) {
  return `${merchantBaseUrl()}/login/invitacion?token=${encodeURIComponent(token)}`;
}

export function storeClaimUrl(token: string, promoCode?: string | null) {
  const base = `${merchantBaseUrl()}/onboarding/asociar?token=${encodeURIComponent(token)}`;
  const code = promoCode?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) return base;
  return `${base}&ref=${encodeURIComponent(code)}`;
}

export function cajaBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_CAJA_URL || 'http://localhost:4204'
  ).replace(/\/$/, '');
}
