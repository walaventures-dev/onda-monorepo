import { BRAND, escapeHtml, landingBaseUrl, wordmarkUrl } from './brand';

const MONTHS_BOGOTA = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

export type LeadNotifyInput = {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  city: string;
  role: string;
  source: string;
};

export function leadNotifySubject(businessName: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(now);
  const monthNum = Number(parts.find((p) => p.type === 'month')?.value);
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const abbr = MONTHS_BOGOTA[monthNum - 1] || 'Ene';
  const name = businessName.trim() || 'Sin negocio';
  return `[LEAD] ${abbr} ${year} — ${name}`;
}

function row(label: string, value: string, href?: string) {
  const safeLabel = escapeHtml(label);
  const safeValue = escapeHtml(value);
  const inner = href
    ? `<a href="${escapeHtml(href)}" style="color:${BRAND.primary};text-decoration:none;font-weight:600;">${safeValue}</a>`
    : `<span style="color:${BRAND.ink};font-weight:600;">${safeValue}</span>`;
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.muted};width:38%;vertical-align:top;">${safeLabel}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:15px;vertical-align:top;">${inner}</td>
  </tr>`;
}

export function leadNotifyEmailHtml(input: LeadNotifyInput): string {
  const logo = escapeHtml(wordmarkUrl());
  const home = escapeHtml(landingBaseUrl());
  const year = new Date().getFullYear();
  const telHref = input.phone.startsWith('+')
    ? `tel:${input.phone}`
    : `tel:+57${input.phone.replace(/\D/g, '')}`;
  const mailHref = `mailto:${input.email}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nuevo lead — demo</title>
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
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.primary};">Funnel /demo</p>
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND.ink};font-weight:700;">
                Nuevo lead para demo
              </h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
                <strong style="color:${BRAND.ink};">${escapeHtml(input.businessName)}</strong>
                pidió una llamada. Contáctalos para agendar el demo.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${row('Nombre', input.name)}
                ${row('Negocio', input.businessName)}
                ${row('WhatsApp', input.phone, telHref)}
                ${row('Correo', input.email, mailHref)}
                ${row('Ciudad', input.city)}
                ${row('Cargo', input.role)}
                ${row('Cómo nos conoció', input.source)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;" align="center">
              <a href="${escapeHtml(telHref)}"
                 style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:999px;">
                Llamar ahora
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid ${BRAND.border};text-align:center;">
              <p style="margin:0;font-size:12px;color:${BRAND.muted};">
                © ${year} <a href="${home}" style="color:${BRAND.primary};text-decoration:none;">Onda</a>
                · Lead desde entraenlaonda.com/demo
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

export function leadNotifyEmailText(input: LeadNotifyInput): string {
  return [
    'Nuevo lead para demo',
    '',
    `Nombre: ${input.name}`,
    `Negocio: ${input.businessName}`,
    `WhatsApp: ${input.phone}`,
    `Correo: ${input.email}`,
    `Ciudad: ${input.city}`,
    `Cargo: ${input.role}`,
    `Cómo nos conoció: ${input.source}`,
    '',
    '— Funnel /demo',
  ].join('\n');
}
