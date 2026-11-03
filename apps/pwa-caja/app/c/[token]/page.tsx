'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@onda/shared-ui';
import { writeCajaToken } from '../../../lib/caja-token';

type CajaSessionInfo = {
  storeSlug: string;
  storeName: string;
};

/**
 * Enlace kiosk (/c/[token]): resuelve la tienda del enlace y entra a la app
 * rutada por negocio (/[store]/?token=...).
 */
export default function CajaTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api<CajaSessionInfo>(
      `/caja/session?token=${encodeURIComponent(token)}`,
    )
      .then((s) => {
        if (cancelled) return;
        writeCajaToken(token);
        router.replace(`/${s.storeSlug}/?token=${encodeURIComponent(token)}`);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, router]);

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

  return null;
}
