import {
  BRAND,
  escapeHtml,
  landingBaseUrl,
  merchantBaseUrl,
  wordmarkUrl,
} from './brand';

export type StoreCreatedEmailInput = {
  ownerName: string;
  storeName: string;
  referralCode?: string;
  logoUrl?: string;
};

export function storeCreatedEmailHtml(input: StoreCreatedEmailInput): string {
  const ownerName = escapeHtml(input.ownerName);
  const storeName = escapeHtml(input.storeName);
  const logo = escapeHtml(input.logoUrl || wordmarkUrl());
  const dashboardUrl = escapeHtml(merchantBaseUrl());
  const home = escapeHtml(landingBaseUrl());
  const year = new Date().getFullYear();
  const referralBlock = input.referralCode
    ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.55;color:${BRAND.ink};">
         Tu código de referido es <strong style="color:${BRAND.primary};">${escapeHtml(input.referralCode)}</strong>.
         Compártelo con otros negocios y gana meses gratis.
       </p>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tu negocio ya está en Onda</title>
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
                ¡Tu negocio ya está en Onda!
              </h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
                Hola ${ownerName}, confirmamos que <strong style="color:${BRAND.ink};">${storeName}</strong>
                quedó registrado en Onda. Ya puedes configurar tu programa de lealtad, promociones y cartilla digital.
              </p>
              ${referralBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;" align="center">
              <a href="${dashboardUrl}"
                 style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:999px;">
                Ir a mi panel
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:${BRAND.muted};">
                Si tienes dudas, responde a este correo o escríbenos a hola@entraenlaonda.com.
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

export function storeCreatedEmailText(input: StoreCreatedEmailInput): string {
  const lines = [
    `¡Tu negocio ya está en Onda!`,
    '',
    `Hola ${input.ownerName},`,
    '',
    `Confirmamos que ${input.storeName} quedó registrado en Onda.`,
    'Ya puedes configurar tu programa de lealtad, promociones y cartilla digital.',
  ];
  if (input.referralCode) {
    lines.push('', `Tu código de referido: ${input.referralCode}`);
  }
  lines.push('', `Ir a mi panel: ${merchantBaseUrl()}`, '', '— Equipo Onda');
  return lines.join('\n');
}
