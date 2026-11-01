'use client';

import { useEffect, useState } from 'react';
import {
  api,
  CajaIdentityBar,
  KitchenDisplay,
  setApiAuthTokenGetter,
  SkeletonScreen,
} from '@onda/shared-ui';
import { clearCajaToken } from './CajaApp';

type CocinaSession = {
  storeId: string;
  storeName: string;
};

/** Pantalla de cocina (KDS) autenticada con el token del enlace de caja. */
export function CocinaClient({ token }: { token: string }) {
  const [session, setSession] = useState<CocinaSession | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setApiAuthTokenGetter(async () => token);
    let cancelled = false;
    void api<CocinaSession>(`/caja/session?token=${encodeURIComponent(token)}`)
      .then((s) => {
        if (!cancelled) setSession(s);
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
  }, [token]);

  function handleLogout() {
    clearCajaToken();
    setApiAuthTokenGetter(null);
    window.location.href = '/';
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
