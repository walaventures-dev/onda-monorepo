import { merchantBaseUrl } from './mail-templates/brand';

export function inviteAcceptUrl(token: string) {
  return `${merchantBaseUrl()}/login/invitacion?token=${encodeURIComponent(token)}`;
}

export function cajaBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_CAJA_URL || 'http://localhost:4204'
  ).replace(/\/$/, '');
}
