'use client';

const POS_SESSION_KEY = 'onda-pos-session';

/** Token JWT de la sesión de usuario de caja (login usuario+PIN). */
export function readPosToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(POS_SESSION_KEY) || '';
}

export function writePosToken(token: string) {
  localStorage.setItem(POS_SESSION_KEY, token);
}

export function clearPosToken() {
  localStorage.removeItem(POS_SESSION_KEY);
}
