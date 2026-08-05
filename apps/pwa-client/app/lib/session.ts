import type { EnrollResponse } from '@onda/shared-types';

export const SESSION_KEY = 'onda_pwa_session';

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

export function setSession(session: EnrollResponse): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
