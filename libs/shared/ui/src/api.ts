const FALLBACK = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

/** En móvil/LAN usa el mismo host que la PWA (evita Failed to fetch por localhost). */
export function getApiUrl(): string {
  if (typeof window === 'undefined') return FALLBACK;
  const { protocol, hostname } = window.location;
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}:3333`;
  }
  return FALLBACK;
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
