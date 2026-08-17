import { nearestColorPreset, normalizeHexColor } from '../colors';
import { ensureNotificationAnchor } from '../notifications';
import { buildPunchCardStripDataUri } from '../punch-card-strip';
import type { PassSpec } from '../types';
import type { BaseLoyaltyContext, PassScenarioBuilder } from './types';

export type LoyaltyPassContext = BaseLoyaltyContext & {
  kind?: 'store' | 'event';
};

const DEFAULT_POINTS_LABEL = 'ONDAS';
const DEFAULT_POINTS_CHANGE = 'Ahora tienes %@ ondas';

function remainingCopy(points: number, maxStamps: number) {
  const remaining = Math.max(0, maxStamps - points);
  if (remaining === 0) return '¡Listo para canjear!';
  if (remaining === 1) return 'Te falta 1 onda';
  return `Te faltan ${remaining} ondas`;
}

async function applyVisuals(spec: PassSpec, ctx: LoyaltyPassContext): Promise<PassSpec> {
  const design = ctx.design;
  const hex = normalizeHexColor(design.backgroundColor);
  const next: PassSpec = { ...spec };

  next.colorPreset = nearestColorPreset(design.backgroundColor || '#052DDE');
  if (hex) {
    next.color = hex;
  }

  const strip = await buildPunchCardStripDataUri({
    points: ctx.points,
    maxStamps: ctx.maxStamps ?? 12,
    backgroundColor: design.backgroundColor,
    foregroundColor: design.foregroundColor,
  });

  if (design.logoUrl?.startsWith('https://') || design.logoUrl?.startsWith('data:image/')) {
    next.logoURL = design.logoUrl;
  }
  if (strip) {
    next.stripURL = strip;
  } else if (
    design.stripImageUrl?.startsWith('https://') ||
    design.stripImageUrl?.startsWith('data:image/')
  ) {
    next.stripURL = design.stripImageUrl;
  }

  return next;
}

/**
 * Cartilla de fidelización (punch card) por comercio o evento.
 * El strip es la grilla de ondas; el header muestra el progreso al apilar el pase.
 */
export async function buildLoyaltyPassSpec(
  ctx: LoyaltyPassContext,
  _opts?: { proFeatures?: boolean }
): Promise<PassSpec> {
  const pointsLabel = ctx.pointsLabel ?? DEFAULT_POINTS_LABEL;
  const pointsChange = ctx.pointsChangeMessage ?? DEFAULT_POINTS_CHANGE;
  const maxStamps = Math.max(1, Math.min(12, Math.round(ctx.maxStamps || 12)));
  const points = Math.max(0, Math.floor(ctx.points));
  const progress = `${Math.min(points, maxStamps)} / ${maxStamps}`;
  const remaining = remainingCopy(points, maxStamps);
  const subtitle = ctx.design.subtitle?.trim();

  const backFields = [
    { label: 'Titular', value: ctx.holderName },
    { label: 'Código', value: ctx.barcodeSerial },
    ...(subtitle ? [{ label: 'Tipo', value: subtitle }] : []),
    ...(ctx.design.description?.trim()
      ? [{ label: 'Info', value: ctx.design.description.trim() }]
      : []),
    { label: 'Cartilla', value: `${points} / ${maxStamps}` },
  ];

  const base: PassSpec = {
    barcodeValue: ctx.barcodeSerial,
    barcodeFormat: 'QR',
    logoText: ctx.design.title,
    description: ctx.design.description?.trim() || `${ctx.design.title}: ${progress} ondas`,
    organizationName: (ctx.organizationName || ctx.design.title).slice(0, 64),
    sharingProhibited: true,
    headerFields: [
      {
        label: pointsLabel,
        value: progress,
        changeMessage: pointsChange,
      },
    ],
    secondaryFields: [
      {
        label: points >= maxStamps ? 'PREMIO' : 'SIGUIENTE',
        value: remaining,
      },
      { label: 'TITULAR', value: ctx.holderName },
    ],
    backFields,
    ...(ctx.locations?.length ? { locations: ctx.locations.slice(0, 10) } : {}),
  };

  return ensureNotificationAnchor(await applyVisuals(base, ctx));
}

export const loyaltyPassBuilder: PassScenarioBuilder<LoyaltyPassContext> = {
  id: 'loyalty',
  build(ctx) {
    return buildLoyaltyPassSpec(ctx);
  },
};
