import { BILLING_ISSUER, formatChargeDate, formatCop, PLAN_META } from '@onda/shared-utils';
import { BRAND, escapeHtml, merchantBaseUrl, wordmarkUrl } from './brand';

export function billingInvoiceEmailHtml(input: {
  storeName: string;
  ownerName?: string | null;
  invoiceNumber: string;
  kindLabel: string;
  periodLabel: string;
  totalCop: number;
  planName: string;
  lines: Array<{ label: string; amountCop: number }>;
  nextPlanAt?: Date | null;
  nextUsageAt?: Date | null;
  logoUrl?: string;
}): string {
  const greeting = input.ownerName
    ? `Hola ${escapeHtml(input.ownerName)}`
    : 'Hola';
  const rows = input.lines
    .map(
      (l) =>
        `<tr>
          <td style="padding:8px 0;color:${BRAND.ink};font-size:14px">${escapeHtml(l.label)}</td>
          <td style="padding:8px 0;text-align:right;color:${BRAND.ink};font-size:14px">${formatCop(l.amountCop)}</td>
        </tr>`
    )
    .join('');
  const facturacionUrl = `${merchantBaseUrl()}/facturacion`;
  return `<!doctype html>
<html><body style="margin:0;background:${BRAND.bg};font-family:Inter,system-ui,sans-serif;color:${BRAND.ink}">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:${BRAND.card};border-radius:24px;padding:32px;border:1px solid ${BRAND.border}">
        <tr><td>
          <img src="${escapeHtml(input.logoUrl || wordmarkUrl())}" alt="Onda" height="28" />
          <p style="margin:24px 0 8px;font-size:13px;color:${BRAND.muted}">${escapeHtml(input.kindLabel)} · ${escapeHtml(input.invoiceNumber)}</p>
          <h1 style="margin:0 0 12px;font-size:22px">Resumen de cobro</h1>
          <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px">${greeting}, este es el recibo de ${escapeHtml(input.storeName)} (${escapeHtml(input.planName)}) para ${escapeHtml(input.periodLabel)}.</p>
          <table width="100%" cellpadding="0" cellspacing="0">${rows}
            <tr>
              <td style="padding:12px 0 0;border-top:1px solid ${BRAND.border};font-weight:700">Total</td>
              <td style="padding:12px 0 0;border-top:1px solid ${BRAND.border};text-align:right;font-weight:700;color:${BRAND.primary}">${formatCop(input.totalCop)}</td>
            </tr>
          </table>
          <p style="margin:20px 0 0;font-size:13px;color:${BRAND.muted}">
            ${input.nextPlanAt ? `Próximo corte del plan: ${formatChargeDate(input.nextPlanAt)}.<br/>` : ''}
            ${input.nextUsageAt ? `Próximo corte de consumos: ${formatChargeDate(input.nextUsageAt)}.` : ''}
          </p>
          <p style="margin:20px 0 0">
            <a href="${facturacionUrl}" style="display:inline-block;background:${BRAND.primary};color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;font-size:14px">Ver facturación</a>
          </p>
          <p style="margin:24px 0 0;font-size:11px;color:${BRAND.muted}">
            ${escapeHtml(BILLING_ISSUER.legalName)} · NIT ${escapeHtml(BILLING_ISSUER.nit)} · ${escapeHtml(BILLING_ISSUER.website)}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function billingInvoiceEmailText(input: {
  storeName: string;
  invoiceNumber: string;
  periodLabel: string;
  totalCop: number;
  planName: string;
}): string {
  return `Recibo ${input.invoiceNumber} — ${input.storeName} (${input.planName})
Periodo: ${input.periodLabel}
Total: ${formatCop(input.totalCop)}

Adjuntamos el PDF. También lo encuentras en ${merchantBaseUrl()}/facturacion

${BILLING_ISSUER.legalName} · NIT ${BILLING_ISSUER.nit}`;
}
