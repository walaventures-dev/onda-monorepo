/** Helpers de acumulación por valor de onda y ROI monetario. */

export function parsePositiveInt(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n =
    typeof raw === 'number'
      ? raw
      : Number(String(raw).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

/** Ondas manuales si el negocio no tiene precio de onda. Vacío o inválido → 1. */
export function manualOndasOrDefault(raw: unknown, fallback = 1): number {
  return parsePositiveInt(raw) ?? fallback;
}

/**
 * Ondas a otorgar a partir del pago y el valor de una onda.
 * `floor(pago / ondaValue)`; puede ser 0 (venta registrada sin ondas).
 */
export function ondasFromPayment(
  paymentAmount: number,
  ondaValue: number
): number {
  if (!(paymentAmount > 0) || !(ondaValue > 0)) return 0;
  return Math.floor(paymentAmount / ondaValue);
}

/** ROI = ventas / beneficio. Sin beneficio → null. */
export function computeRoi(
  ventas: number,
  beneficioOtorgado: number
): number | null {
  if (!(beneficioOtorgado > 0)) return null;
  return ventas / beneficioOtorgado;
}

export type PromoBenefitInput = {
  type: string;
  value?: number | null;
  getQuantity?: number | null;
};

/**
 * Beneficio COP de un canje.
 * - AMOUNT_OFF / PRODUCT: value
 * - BUY_GET: getQuantity × value (precio unitario del regalo)
 * - PERCENT_OFF: floor(ticket × value / 100) — requiere paymentAmount
 * - OTHER: value o benefitOverride
 */
export function computeBenefitAmount(
  promo: PromoBenefitInput,
  opts?: { paymentAmount?: number; benefitOverride?: number }
): number | null {
  const type = promo.type || 'OTHER';
  const value = promo.value != null ? Number(promo.value) : null;

  if (type === 'AMOUNT_OFF' || type === 'PRODUCT') {
    if (value == null || !(value > 0)) return null;
    return Math.round(value);
  }

  if (type === 'BUY_GET') {
    const qty = Math.max(1, Number(promo.getQuantity) || 1);
    if (value == null || !(value > 0)) return null;
    return Math.round(qty * value);
  }

  if (type === 'PERCENT_OFF') {
    const ticket = opts?.paymentAmount;
    const pct = value;
    if (ticket == null || !(ticket > 0) || pct == null || !(pct > 0)) {
      return null;
    }
    return Math.floor((ticket * pct) / 100);
  }

  if (opts?.benefitOverride != null && opts.benefitOverride > 0) {
    return Math.round(opts.benefitOverride);
  }
  if (value != null && value > 0) return Math.round(value);
  return null;
}

export function needsClaimPaymentAmount(promoType: string): boolean {
  return promoType === 'PERCENT_OFF';
}

export function needsClaimBenefitInput(
  promoType: string,
  promoValue?: number | null
): boolean {
  return promoType === 'OTHER' && !(promoValue != null && promoValue > 0);
}
