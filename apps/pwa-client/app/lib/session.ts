import type { EnrollResponse } from '@onda/shared-types';

const SESSION_KEY = 'onda_pwa_session';

export function getSession(): EnrollResponse | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EnrollResponse;
  } catch {
    return null;
  }
}
