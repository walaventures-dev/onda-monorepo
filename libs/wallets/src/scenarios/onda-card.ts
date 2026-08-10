import { nearestColorPreset } from '../colors';
import { ensureNotificationAnchor } from '../notifications';
import type { PassSpec } from '../types';
import type { PassScenarioBuilder } from './types';

/**
 * Tarjeta universal Onda (suscripción multi-comercio).
 * Branding genérico Onda; el total de ondas es la suma de Pass.points del usuario.
 * Listo para cuando se active OndaCard en el dominio.
 */
export type OndaCardPassContext = {
  barcodeSerial: string;
  totalPoints: number;
  holderName: string;
  pointsChangeMessage?: string;
};

const ONDA_BLUE = '#052DDE';

export function buildOndaCardPassSpec(
  ctx: OndaCardPassContext,
  opts?: { proFeatures?: boolean }
): PassSpec {
  const proFeatures = opts?.proFeatures ?? false;

  const base: PassSpec = {
    barcodeValue: ctx.barcodeSerial,
    barcodeFormat: 'QR',
    logoText: 'Onda',
    description: 'Tu tarjeta Onda',
    organizationName: 'Onda',
    sharingProhibited: true,
    primaryFields: [{ label: 'CLIENTE', value: ctx.holderName }],
    secondaryFields: [
      {
        label: 'ONDAS',
        value: String(ctx.totalPoints),
        changeMessage: ctx.pointsChangeMessage ?? 'Ahora tienes %@ ondas',
      },
    ],
    headerFields: [{ label: 'PLAN', value: 'Miembro' }],
    backFields: [
      { label: 'Titular', value: ctx.holderName },
      { label: 'Código', value: ctx.barcodeSerial },
    ],
    ...(proFeatures
      ? { color: ONDA_BLUE }
      : { colorPreset: nearestColorPreset(ONDA_BLUE) }),
  };

  return ensureNotificationAnchor(base);
}

export const ondaCardPassBuilder: PassScenarioBuilder<OndaCardPassContext> = {
  id: 'onda-card',
  build(ctx) {
    return buildOndaCardPassSpec(ctx);
  },
};
