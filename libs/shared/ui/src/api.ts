const FALLBACK = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

let authTokenGetter: (() => Promise<string | null>) | null = null;

/** Permite que un frontend (p.ej. merchant-dashboard) inyecte el ID token. */
export function setApiAuthTokenGetter(
  getter: (() => Promise<string | null>) | null
) {
  authTokenGetter = getter;
}

export async function getApiAuthToken(): Promise<string | null> {
  return authTokenGetter ? authTokenGetter() : null;
}

/**
 * En el navegador siempre pega al mismo origen que sirvió la PWA; next.config.js
 * reescribe /api/* hacia el backend en :3333 del lado del servidor. Esto evita
 * depender del host/puerto del cliente (falla en LAN, dev tunnels, etc).
 */
export function getApiUrl(): string {
  if (typeof window === 'undefined') return FALLBACK;
  return '';
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getApiUrl();
  const token = authTokenGetter ? await authTokenGetter() : null;
  let res: Response;
  try {
    res = await fetch(`${base}/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new Error('Sin conexión con Onda. Revisa tu red e intenta de nuevo.');
  }
  if (!res.ok) {
    const text = await res.text();
    let message = text || `Error ${res.status}`;
    try {
      const j = JSON.parse(text);
      message = j.message || j.error || message;
      if (Array.isArray(message)) message = message.join(', ');
    } catch {
      /* raw text */
    }
    throw new Error(typeof message === 'string' ? message : 'Algo salió mal');
  }
  return res.json() as Promise<T>;
}

export const API_URL = FALLBACK;
