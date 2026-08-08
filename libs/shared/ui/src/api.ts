const FALLBACK = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

/**
 * En el navegador siempre pega al mismo origen que sirvió la PWA; next.config.js
 * reescribe /api/* hacia el backend en :3333 del lado del servidor. Esto evita
 * depender del host/puerto del cliente (falla en LAN, dev tunnels, etc).
 */
export function getApiUrl(): string {
  if (typeof window === 'undefined') return FALLBACK;
  return '';
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getApiUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
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
