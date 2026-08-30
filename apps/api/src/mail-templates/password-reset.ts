/** Plantillas HTML de correo — sin dependencia de proveedor. */

import { BRAND, escapeHtml, landingBaseUrl, wordmarkUrl } from './brand';

export type PasswordResetEmailInput = {
  resetUrl: string;
  logoUrl?: string;
};

export function passwordResetEmailHtml(input: PasswordResetEmailInput): string {
  const resetUrl = escapeHtml(input.resetUrl);
  const logo = escapeHtml(input.logoUrl || wordmarkUrl());
  const year = new Date().getFullYear();
  const home = escapeHtml(landingBaseUrl());

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cambia tu contraseña — Onda</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:${BRAND.card};border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;text-align:center;">
              <img src="${logo}" alt="Onda" width="120" height="auto" style="display:inline-block;max-width:140px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:${BRAND.primary};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND.ink};font-weight:700;">
                Cambia tu contraseña
              </h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
                Recibimos una solicitud para cambiar la contraseña de tu cuenta en Onda.
                El enlace es válido por un tiempo limitado.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;" align="center">
              <a href="${resetUrl}"
                 style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:999px;">
                Elegir nueva contraseña
              </a>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${BRAND.muted};word-break:break-all;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
                <a href="${resetUrl}" style="color:${BRAND.sky};">${resetUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:${BRAND.muted};">
                Si no pediste este cambio, puedes ignorar este correo. Tu contraseña no se modificará.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid ${BRAND.border};text-align:center;">
              <p style="margin:0;font-size:12px;color:${BRAND.muted};">
                © ${year} <a href="${home}" style="color:${BRAND.primary};text-decoration:none;">Onda</a>
                · Fidelización para tu negocio
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function passwordResetEmailText(input: PasswordResetEmailInput): string {
  return `Cambia tu contraseña — Onda

Recibimos una solicitud para cambiar la contraseña de tu cuenta en Onda.

Elegir nueva contraseña:
${input.resetUrl}

Si no pediste este cambio, ignora este correo.

— Equipo Onda`;
}

/** Extrae el oobCode del enlace que genera Firebase Admin. */
export function extractOobCodeFromFirebaseLink(link: string): string | null {
  try {
    const url = new URL(link);
    return url.searchParams.get('oobCode');
  } catch {
    return null;
  }
}
