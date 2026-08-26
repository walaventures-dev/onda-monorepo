import type { ObjectiveKind } from './campaign-copy';

/** Días post-envío para medir éxito y atribuir ventas. */
export const SUCCESS_WINDOW_DAYS: Record<ObjectiveKind, number> = {
  reactivate: 14,
  slow_hours: 7,
  new_reward: 14,
  reviews: 14,
};

/** Tasa mínima de conversión para marcar la campaña como exitosa. */
export const SUCCESS_RATE_THRESHOLD: Record<ObjectiveKind, number> = {
  reactivate: 0.15,
  slow_hours: 0.1,
  new_reward: 0.15,
  reviews: 0.2,
};

export function successWindowDays(kind: ObjectiveKind): number {
  return SUCCESS_WINDOW_DAYS[kind];
}

export function campaignWorked(
  kind: ObjectiveKind,
  successCount: number,
  reachCount: number
): boolean {
  if (reachCount <= 0) return false;
  return successCount / reachCount >= SUCCESS_RATE_THRESHOLD[kind];
}

export function successLabel(kind: ObjectiveKind): string {
  switch (kind) {
    case 'reactivate':
      return 'Volvieron a visitar';
    case 'slow_hours':
      return 'Visitas en el periodo';
    case 'new_reward':
      return 'Activaron o canjearon';
    case 'reviews':
      return 'Dejaron reseña';
  }
}

export function computeRoiRatio(
  attributedSalesCop: number,
  costCop: number
): number | null {
  if (costCop <= 0) return null;
  if (attributedSalesCop <= 0) return 0;
  return attributedSalesCop / costCop;
}
