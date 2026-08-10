import { nearestColorPreset, normalizeHexColor } from '../colors';
import { ensureNotificationAnchor } from '../notifications';
import type { PassSpec } from '../types';
import type { PassDesignInput, PassScenarioBuilder } from './types';

/** Cupón / promo de un solo uso (extensible). */
export type CouponPassContext = {
  barcodeSerial: string;
  title: string;
  valueLabel: string;
  holderName?: string;
  organizationName?: string;
  design?: Partial<PassDesignInput>;
  expirationDays?: number;
};

export function buildCouponPassSpec(
  ctx: CouponPassContext,
  opts?: { proFeatures?: boolean }
): PassSpec {
  const proFeatures = opts?.proFeatures ?? false;
  const bg = ctx.design?.backgroundColor ?? '#2BB673';
  const hex = normalizeHexColor(bg);

  const base: PassSpec = {
    barcodeValue: ctx.barcodeSerial,
    barcodeFormat: 'QR',
    logoText: ctx.organizationName || 'Onda',
    description: ctx.title,
    organizationName: (ctx.organizationName || 'Onda').slice(0, 64),
    sharingProhibited: true,
    primaryFields: [{ label: 'CUPÓN', value: ctx.title }],
    secondaryFields: [{ label: 'VALOR', value: ctx.valueLabel }],
    headerFields: ctx.holderName
      ? [{ label: 'PARA', value: ctx.holderName }]
      : undefined,
    backFields: [{ label: 'Código', value: ctx.barcodeSerial }],
    ...(ctx.expirationDays ? { expirationDays: ctx.expirationDays } : {}),
    ...(proFeatures && hex ? { color: hex } : { colorPreset: nearestColorPreset(bg, 'green') }),
  };

  if (proFeatures && ctx.design?.logoUrl?.startsWith('https://')) {
    base.logoURL = ctx.design.logoUrl;
  }

  return ensureNotificationAnchor(base);
}

export const couponPassBuilder: PassScenarioBuilder<CouponPassContext> = {
  id: 'coupon',
  build(ctx) {
    return buildCouponPassSpec(ctx);
  },
};
