type GsiTokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
};

type GsiTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GsiError = {
  type?: string;
  message?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: GsiTokenResponse) => void;
            error_callback?: (err: GsiError) => void;
          }) => GsiTokenClient;
        };
      };
    };
  }
}

let gsiPromise: Promise<void> | null = null;
let cachedClientId: string | null = null;

function loadGsi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google solo funciona en el navegador'));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const src = 'https://accounts.google.com/gsi/client';
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => {
        gsiPromise = null;
        reject(new Error('No se pudo cargar Google'));
      });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiPromise = null;
      reject(new Error('No se pudo cargar Google'));
    };
    document.head.appendChild(script);
  });
  return gsiPromise;
}

async function googleWebClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;
  const fromEnv = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (fromEnv) {
    cachedClientId = fromEnv;
    return fromEnv;
  }
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('Firebase no está configurado');
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: 'google.com',
        continueUri: window.location.origin,
      }),
    }
  );
  const data = (await res.json()) as { authUri?: string; error?: { message?: string } };
  if (!res.ok || !data.authUri) {
    throw new Error(data.error?.message || 'Google no está habilitado');
  }
  const clientId = new URL(data.authUri).searchParams.get('client_id');
  if (!clientId) throw new Error('Google no está habilitado');
  cachedClientId = clientId;
  return clientId;
}

function gsiError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

/** Token de acceso de Google en el origen de la app (sin el handler de Firebase). */
export async function requestGoogleAccessToken(): Promise<string> {
  const clientId = await googleWebClientId();
  await loadGsi();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('No se pudo cargar Google');
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          const closed = /popup_closed|access_denied/i.test(
            `${resp.error} ${resp.error_description}`
          );
          reject(
            gsiError(
              closed ? 'auth/popup-closed-by-user' : `auth/${resp.error || 'internal-error'}`,
              resp.error_description || resp.error || 'No se pudo continuar con Google'
            )
          );
          return;
        }
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        const hay = `${err?.type || ''} ${err?.message || ''}`;
        if (/popup_closed|closed/i.test(hay)) {
          reject(gsiError('auth/popup-closed-by-user', err.message || 'Cancelado'));
          return;
        }
        if (/popup_failed|blocked/i.test(hay)) {
          reject(gsiError('auth/popup-blocked', err.message || 'Popup bloqueado'));
          return;
        }
        if (/origin|client_id|idpiframe/i.test(hay)) {
          reject(
            gsiError(
              'auth/unauthorized-domain',
              err.message || 'Este dominio no está autorizado para Google'
            )
          );
          return;
        }
        reject(gsiError('auth/internal-error', err.message || 'No se pudo continuar con Google'));
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}

export function isGoogleTokenUnavailable(err: unknown): boolean {
  const hay =
    typeof err === 'object' && err && 'code' in err
      ? `${String((err as { code: unknown }).code)} ${err instanceof Error ? err.message : ''}`
      : err instanceof Error
        ? err.message
        : String(err ?? '');
  return /popup-blocked|unauthorized-domain|No se pudo cargar Google|Google no está habilitado/i.test(
    hay
  );
}
