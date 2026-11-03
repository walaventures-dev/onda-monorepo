'use client';

import { useEffect, useState } from 'react';
import {
  api,
  CajaIdentityBar,
  KitchenDisplay,
  setApiAuthTokenGetter,
  SkeletonScreen,
} from '@onda/shared-ui';
import { clearCajaToken } from '../lib/caja-token';
import { clearPosToken } from '../lib/pos-session';

type CocinaSession = {
  storeId: string;
  storeSlug?: string;
  storeName: string;
};

/** Pantalla de cocina (KDS) autenticada con enlace de caja o usuario+PIN. */
export function CocinaClient({
  store,
  token,
}: {
  /** Segmento [store] de la URL, para redirigir al login correcto. */
  store: string;
  token: string;
}) {
  const [session, setSession] = useState<CocinaSession | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      window.location.href = `/${store}/login`;
      return;
    }
    setApiAuthTokenGetter(async () => token);
    let cancelled = false;
    void api<CocinaSession>(`/caja/session?token=${encodeURIComponent(token)}`)
      .then((s) => {
        if (cancelled) return;
        if (s.storeSlug && s.storeSlug !== store) {
          // El token es de otra tienda: abrir la cocina de esa tienda.
          window.location.href = `/${s.storeSlug}/cocina?token=${encodeURIComponent(token)}`;
          return;
        }
        setSession(s);
      })
      .catch(() => {
        if (cancelled) return;
        setApiAuthTokenGetter(null);
        setError(true);
      });
    return () => {
      cancelled = true;
      setApiAuthTokenGetter(null);
    };
  }, [token, store]);

  function handleLogout() {
    clearCajaToken();
    clearPosToken();
    setApiAuthTokenGetter(null);
    window.location.href = `/${store}/login`;
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-display text-lg font-semibold text-[var(--onda-ink)]">
          Enlace de caja inválido
        </p>
        <p className="text-sm text-[var(--onda-muted)]">
          El enlace está revocado o caducó. Pide al comercio que genere uno
          nuevo e intenta de nuevo.
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto min-h-dvh max-w-7xl p-4">
        <SkeletonScreen label="Abriendo cocina" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[1400px] flex-col gap-3 overflow-hidden p-3">
      {/* Header compartido: logo Onda + negocio + salir (igual que el resto de la app). */}
      <CajaIdentityBar storeName={session.storeName} onLogout={handleLogout} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <KitchenDisplay
          storeId={session.storeId}
          token={token}
          storeName={session.storeName}
        />
      </div>
    </main>
  );
}
