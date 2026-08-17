import type { PassLocation } from './types';
import { loyaltyProgressCopy, type LoyaltyRewardHint } from '@onda/shared-utils';

/** Recorta el texto de lock-screen al límite de WalletWallet (128). */
export function clampRelevantText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 128) return trimmed;
  return `${trimmed.slice(0, 127).trimEnd()}…`;
}

export function nearbyRelevantText(
  storeName: string,
  points: number,
  maxStamps: number,
  reward?: LoyaltyRewardHint | null
): string {
  const name = storeName.trim() || 'tu comercio';
  const suffix = loyaltyProgressCopy(points, maxStamps, reward, {
    clipTitle: 36,
  }).value;
  return clampRelevantText(`Estás cerca de ${name}. ${suffix}`);
}

export function toPassLocation(
  lat: number | null | undefined,
  lng: number | null | undefined,
  relevantText: string
): PassLocation | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    latitude: lat,
    longitude: lng,
    relevantText: clampRelevantText(relevantText),
  };
}

export function storeLockScreenLocations(
  store: { name?: string | null; lat?: number | null; lng?: number | null } | null | undefined,
  points: number,
  maxStamps: number,
  reward?: LoyaltyRewardHint | null
): PassLocation[] {
  const loc = toPassLocation(
    store?.lat,
    store?.lng,
    nearbyRelevantText(store?.name || 'tu comercio', points, maxStamps, reward)
  );
  return loc ? [loc] : [];
}
