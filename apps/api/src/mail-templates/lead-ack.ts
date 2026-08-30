import {
  BRAND,
  escapeHtml,
  funnelHeroImageUrl,
  landingBaseUrl,
  wordmarkUrl,
} from './brand';

export type LeadAckInput = {
  name: string;
  businessName: string;
  imageUrl?: string;
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name.trim() || 'hola';
}

export function leadAckSubject(): string {
  return 'Te llamamos para el demo — Onda';
}

export function leadAckSms(name: string, businessName: string): string {
  const who = firstName(name);
  const biz = businessName.trim().slice(0, 42) || 'tu negocio';
  const msg = `Hola ${who}, recibimos tu solicitud de demo para ${biz}. Te llamamos pronto, saludos. Onda`;
  return msg.slice(0, 160);
}

export function leadAckEmailHtml(input: LeadAckInput): string {
  const who = escapeHtml(firstName(input.name));
  const biz = escapeHtml(input.businessName);
  const logo = escapeHtml(wordmarkUrl());
  const photo = escapeHtml(input.imageUrl || funnelHeroImageUrl());
  const home = escapeHtml(landingBaseUrl());
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Te llamamos para el demo</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:${BRAND.card};border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden;">
          <tr>
            <td style="padding:24px 32px 12px;text-align:center;">
              <img src="${logo}" alt="Onda" width="120" height="auto" style="display:inline-block;max-width:140px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0;line-height:0;">
              <img src="${photo}" alt="Equipo Onda" width="520" style="display:block;width:100%;max-width:520px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND.ink};font-weight:700;">
                Hola ${who}, te llamamos
              </h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
                Recibimos tu solicitud de demo para <strong style="color:${BRAND.ink};">${biz}</strong>.
                En breve te contactamos para mostrarte Onda: lealtad con pase en Wallet, sin app que descargar.
              </p>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
                Si quieres otro horario, responde este correo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;" align="center">
              <a href="${home}"
                 style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:999px;">
                Conocer Onda
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid ${BRAND.border};text-align:center;">
              <p style="margin:0;font-size:12px;color:${BRAND.muted};">
                © ${year} <a href="${home}" style="color:${BRAND.primary};text-decoration:none;">Onda</a>
                · Te llamamos para agendar el demo
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

export function leadAckEmailText(input: LeadAckInput): string {
  const who = firstName(input.name);
  return [
    `Hola ${who}, te llamamos`,
    '',
    `Recibimos tu solicitud de demo para ${input.businessName}.`,
    'En breve te contactamos para mostrarte Onda: lealtad con pase en Wallet, sin app que descargar.',
    '',
    'Si quieres otro horario, responde este correo.',
    '',
    landingBaseUrl(),
    '',
    '— Equipo Onda',
  ].join('\n');
}
