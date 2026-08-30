import { BRAND, escapeHtml, merchantBaseUrl, wordmarkUrl } from './brand';

export type TeamInviteEmailInput = {
  inviteeName: string;
  storeName: string;
  roleLabel: string;
  inviteUrl: string;
  logoUrl?: string;
};

export function teamInviteEmailHtml(input: TeamInviteEmailInput): string {
  const name = escapeHtml(input.inviteeName);
  const store = escapeHtml(input.storeName);
  const role = escapeHtml(input.roleLabel);
  const url = escapeHtml(input.inviteUrl);
  const logo = escapeHtml(input.logoUrl || wordmarkUrl());

  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:32px 16px;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table width="100%" style="max-width:520px;background:${BRAND.card};border-radius:16px;border:1px solid ${BRAND.border};padding:32px 24px;">
      <tr><td align="center"><img src="${logo}" alt="Onda" width="120" style="margin-bottom:24px;" /></td></tr>
      <tr><td>
        <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">Te invitaron a ${store}</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
          Hola ${name}, te dieron acceso como <strong style="color:${BRAND.ink};">${role}</strong> en Onda.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
          Crea tu contraseña para entrar a la caja y empezar a vender.
        </p>
        <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600;font-size:15px;">Aceptar invitación</a>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

export function teamInviteEmailText(input: TeamInviteEmailInput): string {
  return `Hola ${input.inviteeName},

Te invitaron como ${input.roleLabel} en ${input.storeName}.

Acepta la invitación y crea tu contraseña:
${input.inviteUrl}
`;
}
