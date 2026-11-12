'use client';

const CAJA_TOKEN_KEY = 'onda-caja-token';

/** Token del enlace de caja (kiosk), guardado en el dispositivo. */
export function readCajaToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(CAJA_TOKEN_KEY) || '';
}

export function writeCajaToken(token: string) {
  localStorage.setItem(CAJA_TOKEN_KEY, token);
}

export function clearCajaToken() {
  localStorage.removeItem(CAJA_TOKEN_KEY);
}
