/** Utilidades compartidas para plantillas de correo Onda. */

export const BRAND = {
  primary: '#052DDE',
  primaryHover: '#041DB2',
  ink: '#1A1B2E',
  muted: '#6B7289',
  bg: '#F2F2F2',
  card: '#FFFFFF',
  border: '#E4E4E4',
  sky: '#3DB9E8',
} as const;

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function landingBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_LANDING_URL ||
    process.env.NEXT_PUBLIC_MERCHANT_URL ||
    'https://entraenlaonda.com'
  ).replace(/\/$/, '');
}

export function merchantBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MERCHANT_URL || 'http://localhost:4202'
  ).replace(/\/$/, '');
}

export function wordmarkUrl(): string {
  const merchant = (
    process.env.NEXT_PUBLIC_MERCHANT_URL ||
    process.env.NEXT_PUBLIC_LANDING_URL ||
    'https://admin.entraenlaonda.com'
  ).replace(/\/$/, '');
  return `${merchant}/brand/onda-wordmark.png`;
}
