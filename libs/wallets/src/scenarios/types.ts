import type { PassSpec, PassScenarioId } from '../types';

/**
 * Contrato de un escenario de pass.
 * Cada escenario sabe construir el PassSpec completo a partir de su contexto de dominio.
 * Los updates siempre reconstruyen el spec (WalletWallet exige body completo en PUT).
 */
export interface PassScenarioBuilder<TContext> {
  readonly id: PassScenarioId;
  build(ctx: TContext): PassSpec;
}

export type PassDesignInput = {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  backgroundColor: string;
  foregroundColor?: string;
  labelColor?: string | null;
  logoUrl?: string | null;
  stripImageUrl?: string | null;
};

export type BaseLoyaltyContext = {
  /** Serial interno Onda — va en el barcode (escaneo en caja). */
  barcodeSerial: string;
  points: number;
  holderName: string;
  /** Nombre del comercio / evento (notification title). */
  organizationName?: string;
  design: PassDesignInput;
  /** Si hay tope de sellos, se muestra en back/secondary. */
  maxStamps?: number;
  pointsLabel?: string;
  pointsChangeMessage?: string;
};
