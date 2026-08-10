import { nearestColorPreset, normalizeHexColor } from '../colors';
import { ensureNotificationAnchor } from '../notifications';
import type { PassSpec } from '../types';
import type { BaseLoyaltyContext, PassScenarioBuilder } from './types';

export type LoyaltyPassContext = BaseLoyaltyContext & {
  kind?: 'store' | 'event';
};

const DEFAULT_POINTS_LABEL = 'ONDAS';
const DEFAULT_POINTS_CHANGE = 'Ahora tienes %@ ondas';

function applyVisuals(
  spec: PassSpec,
  design: LoyaltyPassContext['design'],
  proFeatures: boolean
): PassSpec {
  const hex = normalizeHexColor(design.backgroundColor);
  const next: PassSpec = { ...spec };

  if (proFeatures && hex) {
    next.color = hex;
  } else {
    next.colorPreset = nearestColorPreset(design.backgroundColor || '#052DDE');
  }

  if (proFeatures) {
    if (design.logoUrl?.startsWith('https://') || design.logoUrl?.startsWith('data:image/')) {
      next.logoURL = design.logoUrl;
    }
    if (
      design.stripImageUrl?.startsWith('https://') ||
      design.stripImageUrl?.startsWith('data:image/')
    ) {
      next.stripURL = design.stripImageUrl;
    }
  }

  return next;
}

/**
 * Tarjeta de fidelización por comercio o evento.
 * Escalable: mismos campos, distinto `organizationName` / design.
 */
export function buildLoyaltyPassSpec(
  ctx: LoyaltyPassContext,
  opts?: { proFeatures?: boolean }
): PassSpec {
  const proFeatures = opts?.proFeatures ?? false;
  const pointsLabel = ctx.pointsLabel ?? DEFAULT_POINTS_LABEL;
  const pointsChange = ctx.pointsChangeMessage ?? DEFAULT_POINTS_CHANGE;
  const subtitle = ctx.design.subtitle?.trim() || (ctx.kind === 'event' ? 'Evento' : 'Fidelización');

  const backFields = [
    { label: 'Titular', value: ctx.holderName },
    { label: 'Código', value: ctx.barcodeSerial },
    ...(ctx.design.description?.trim()
      ? [{ label: 'Info', value: ctx.design.description.trim() }]
      : []),
    ...(ctx.maxStamps != null
      ? [{ label: 'Meta', value: `${ctx.points} / ${ctx.maxStamps}` }]
      : []),
  ];

  const base: PassSpec = {
    barcodeValue: ctx.barcodeSerial,
    barcodeFormat: 'QR',
    logoText: ctx.design.title,
    description: ctx.design.description?.trim() || ctx.design.title,
    organizationName: (ctx.organizationName || ctx.design.title).slice(0, 64),
    sharingProhibited: true,
    primaryFields: [{ label: 'TARJETA', value: ctx.design.title }],
    secondaryFields: [
      {
        label: pointsLabel,
        value: String(ctx.points),
        changeMessage: pointsChange,
      },
    ],
    headerFields: [{ label: 'TIPO', value: subtitle }],
    backFields,
  };

  return ensureNotificationAnchor(applyVisuals(base, ctx.design, proFeatures));
}

export const loyaltyPassBuilder: PassScenarioBuilder<LoyaltyPassContext> = {
  id: 'loyalty',
  build(ctx) {
    return buildLoyaltyPassSpec(ctx);
  },
};
