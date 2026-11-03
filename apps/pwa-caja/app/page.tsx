'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, Button } from '@onda/shared-ui';
import { StorefrontIcon as Storefront } from '@phosphor-icons/react/dist/csr/Storefront';
import { readCajaToken, writeCajaToken } from '../lib/caja-token';
import { readPosToken } from '../lib/pos-session';

type SessionInfo = { storeSlug: string };

/**
 * Entrada de la PWA caja sin tienda en la URL: resuelve la sesión guardada
 * (enlace kiosk o usuario+PIN) y redirige a la app rutada /[store]/....
 * Sin sesión, pide el nombre del negocio para armar el enlace de login.
 */
function CajaEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token');
  const [storeInput, setStoreInput] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function enterWithToken(token: string) {
      try {
        const s = await api<SessionInfo>(
          `/caja/session?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        writeCajaToken(token);
        router.replace(`/${s.storeSlug}/?token=${encodeURIComponent(token)}`);
      } catch {
        if (cancelled) return;
        tryPosSession();
      }
    }

    async function tryPosSession() {
      const token = readPosToken();
      if (!token) return;
      try {
        const s = await api<{ store: { slug: string } }>('/pos/users/session', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        router.replace(`/${s.store.slug}/`);
      } catch {
        /* sin sesión: se queda en la pantalla de entrada */
      }
    }

    const storedLink = readCajaToken();
    if (tokenParam) void enterWithToken(tokenParam);
    else if (storedLink) void enterWithToken(storedLink);
    else void tryPosSession();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenParam]);

  function openStore(e: React.FormEvent) {
    e.preventDefault();
    const slug = storeInput.trim().toLowerCase();
    if (!slug) return;
    setNotFound(false);
    void api(`/stores/${encodeURIComponent(slug)}`)
      .then(() => router.push(`/${slug}/login`))
      .catch(() => setNotFound(true));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col p-6">
      <div className="flex flex-1 flex-col justify-center gap-4">
        <span className="mx-auto rounded-2xl bg-[var(--onda-primary-50)] p-3 text-[var(--onda-primary-700)]">
          <Storefront className="h-7 w-7" weight="duotone" aria-hidden />
        </span>
        <h1 className="font-display text-center text-2xl font-semibold text-[var(--onda-ink)]">
          Caja
        </h1>
        <p className="text-center text-sm text-[var(--onda-muted)]">
          Ingresa el enlace de tu negocio o escribe su nombre para iniciar
          sesión.
        </p>
        <form onSubmit={openStore} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--onda-muted)]">Tu negocio</span>
            <input
              className="onda-input w-full rounded-xl px-3 py-2 text-[var(--onda-ink)]"
              value={storeInput}
              onChange={(e) => setStoreInput(e.target.value)}
              placeholder="Ej. asados-la-8"
              autoComplete="off"
            />
          </label>
          {notFound ? (
            <p className="text-sm text-red-600">
              No encontramos ese negocio. Revisa el nombre o usa el enlace que
              te compartieron.
            </p>
          ) : null}
          <Button type="submit" size="lg" fullWidth>
            Ir al login de mi negocio
          </Button>
        </form>
      </div>
      <footer className="flex justify-center pt-6">
        <img
          src="/brand/onda-wordmark.png"
          alt="Onda"
          className="h-6 opacity-60"
        />
      </footer>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <CajaEntry />
    </Suspense>
  );
}
