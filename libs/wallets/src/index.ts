/**
 * @onda/wallets — integración con WalletWallet (Apple + Google).
 *
 * Capas:
 * 1. `WalletWalletClient` — HTTP 1:1 con la API
 * 2. `scenarios/*` — builders de PassSpec por caso de uso
 * 3. `WalletPassService` — fachada de dominio (issue / update / notify / revoke)
 *
 * Docs: https://www.walletwallet.dev/docs/
 */

export * from './types';
export * from './errors';
export {
  WALLET_DEFAULT_BASE_URL,
  WALLET_DEV_STUB_KEY,
  resolveWalletConfig,
  isStubWalletRef,
} from './config';
export { WalletWalletClient, getWalletClient, resetWalletClient } from './client';
export { nearestColorPreset, normalizeHexColor } from './colors';
export {
  clampRelevantText,
  nearbyRelevantText,
  toPassLocation,
  storeLockScreenLocations,
} from './locations';
export {
  NOTIFICATION_ANCHOR_LABEL,
  NOTIFICATION_SEED_VALUE,
  NOTIFICATION_CHANGE_MESSAGE,
  createNotificationAnchor,
  ensureNotificationAnchor,
  withNotificationMessage,
  patchFieldValue,
} from './notifications';
export {
  buildPassSpec,
  getScenarioBuilder,
  buildLoyaltyPassSpec,
  loyaltyPassBuilder,
  buildOndaCardPassSpec,
  ondaCardPassBuilder,
  buildCouponPassSpec,
  couponPassBuilder,
  buildEventTicketPassSpec,
  eventTicketPassBuilder,
} from './scenarios';
export type {
  PassDesignInput,
  BaseLoyaltyContext,
  PassScenarioBuilder,
  LoyaltyPassContext,
  OndaCardPassContext,
  CouponPassContext,
  EventTicketPassContext,
  ScenarioContextMap,
} from './scenarios';
export {
  WalletPassService,
  getWalletPassService,
  resetWalletPassService,
} from './service';
export type { IssueScenarioInput } from './service';
export { roundLogoPng, roundLogoDataUri } from './round-logo';

// ---------------------------------------------------------------------------
// Compatibilidad con el API anterior (issueWalletPass / updateWalletPoints)
// ---------------------------------------------------------------------------

import { getWalletPassService } from './service';
import type { IssuedPassLinks, PassLocation } from './types';
import type { LoyaltyPassContext, PassDesignInput } from './scenarios';

/** @deprecated Preferir `LoyaltyPassContext` + `WalletPassService.issueLoyalty`. */
export type IssuePassInput = {
  serialNumber: string;
  points: number;
  design: PassDesignInput;
  holderName: string;
  organizationName?: string;
  maxStamps?: number;
  kind?: 'store' | 'event';
  locations?: PassLocation[];
};

/** @deprecated Preferir `IssuedPassLinks`. */
export type IssuePassResult = IssuedPassLinks;

function toLoyaltyContext(input: IssuePassInput): LoyaltyPassContext {
  return {
    barcodeSerial: input.serialNumber,
    points: input.points,
    holderName: input.holderName,
    organizationName: input.organizationName,
    design: input.design,
    maxStamps: input.maxStamps,
    kind: input.kind,
    locations: input.locations,
  };
}

/** Emite pass de fidelización (compat). */
export async function issueWalletPass(input: IssuePassInput): Promise<IssuePassResult> {
  return getWalletPassService().issueLoyalty(toLoyaltyContext(input));
}

/**
 * @deprecated WalletWallet no soporta PATCH solo de puntos: hace falta el spec completo.
 * Usa `WalletPassService.updateLoyalty(walletRef, ctx)` reconstruyendo el contexto.
 * Esta función no-op conserva firmas viejas para no romper imports.
 */
export async function updateWalletPoints(walletRef: string, points: number) {
  void walletRef;
  void points;
  console.warn(
    '[@onda/wallets] updateWalletPoints está deprecado: usa WalletPassService.updateLoyalty con el PassSpec completo.'
  );
  return { ok: true as const, deprecated: true as const };
}
