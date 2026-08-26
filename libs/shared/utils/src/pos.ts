export function calcChange(cashReceived: number, total: number): number {
  if (!Number.isFinite(cashReceived) || !Number.isFinite(total)) return 0;
  return Math.max(0, Math.round(cashReceived - total));
}

export function posLineSubtotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice);
}

export const TEAM_LIMITS = {
  BASIC: { admin: 1, caja: 1 },
  PRO: { admin: 1, caja: 3 },
} as const;

export function maxCajaSeats(planType: 'BASIC' | 'PRO'): number {
  return TEAM_LIMITS[planType]?.caja ?? 1;
}

export const DEFAULT_PAYMENT_METHODS = [
  { key: 'cash', label: 'Efectivo', sortOrder: 0 },
  { key: 'card', label: 'Tarjeta', sortOrder: 1 },
  { key: 'transfer', label: 'Transferencia', sortOrder: 2 },
] as const;
