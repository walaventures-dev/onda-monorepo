import { nearestColorPreset, normalizeHexColor } from '../colors';
import { ensureNotificationAnchor } from '../notifications';
import type { PassSpec } from '../types';
import type { PassDesignInput, PassScenarioBuilder } from './types';

/** Entrada / ticket de evento (campos de asiento, fecha, etc.). */
export type EventTicketPassContext = {
  barcodeSerial: string;
  eventName: string;
  holderName: string;
  seat?: string;
  whenLabel?: string;
  organizationName?: string;
  design?: Partial<PassDesignInput>;
  expirationDays?: number;
  locations?: PassSpec['locations'];
};

export function buildEventTicketPassSpec(
  ctx: EventTicketPassContext,
  opts?: { proFeatures?: boolean }
): PassSpec {
  const proFeatures = opts?.proFeatures ?? false;
  const bg = ctx.design?.backgroundColor ?? '#6E5AE6';
  const hex = normalizeHexColor(bg);

  const secondary = [
    ...(ctx.seat ? [{ label: 'ASIENTO', value: ctx.seat }] : []),
    ...(ctx.whenLabel ? [{ label: 'CUÁNDO', value: ctx.whenLabel }] : []),
  ];

  const base: PassSpec = {
    barcodeValue: ctx.barcodeSerial,
    barcodeFormat: 'QR',
    logoText: ctx.organizationName || ctx.eventName,
    description: ctx.eventName,
    organizationName: (ctx.organizationName || ctx.eventName).slice(0, 64),
    sharingProhibited: false,
    primaryFields: [{ label: 'EVENTO', value: ctx.eventName }],
    secondaryFields: secondary.length
      ? secondary
      : [{ label: 'TITULAR', value: ctx.holderName }],
    headerFields: [{ label: 'PASE', value: 'Entrada' }],
    backFields: [
      { label: 'Titular', value: ctx.holderName },
      { label: 'Código', value: ctx.barcodeSerial },
    ],
    ...(ctx.expirationDays ? { expirationDays: ctx.expirationDays } : {}),
    ...(ctx.locations?.length ? { locations: ctx.locations } : {}),
    ...(proFeatures && hex ? { color: hex } : { colorPreset: nearestColorPreset(bg, 'purple') }),
  };

  if (proFeatures && ctx.design?.logoUrl?.startsWith('https://')) {
    base.logoURL = ctx.design.logoUrl;
  }

  return ensureNotificationAnchor(base);
}

export const eventTicketPassBuilder: PassScenarioBuilder<EventTicketPassContext> = {
  id: 'event-ticket',
  build(ctx) {
    return buildEventTicketPassSpec(ctx);
  },
};
