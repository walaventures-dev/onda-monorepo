'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, PassPreview } from '@onda/shared-ui';
import { loadSession, clearSession, type CustomerSession } from '../lib/session';

const SIMULATE_QR_SCAN = process.env.NODE_ENV !== 'production';

async function simulateQrScan(router: ReturnType<typeof useRouter>): Promise<boolean> {
  try {
    const stores = await api<{ id: string }[]>('/stores');
    if (stores[0]) {
      router.replace(`/r/${stores[0].id}`);
      return true;
    }
  } catch {
    // No hay negocios disponibles o falló la red: se cae al mensaje vacío normal.
  }
  return false;
}

export function MisTarjetasClient() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const existing = loadSession();
      if (cancelled) return;
      setSession(existing);

      let userPasses: any[] = [];
      if (existing) {
        try {
          userPasses = await api<any[]>(`/passes?userId=${existing.user.id}`);
        } catch {
          userPasses = [];
        }
        if (cancelled) return;
        setPasses(userPasses);
      }

      if ((!existing || !userPasses.length) && SIMULATE_QR_SCAN) {
        const redirected = await simulateQrScan(router);
        if (redirected || cancelled) return;
      }

      if (!cancelled) setLoading(false);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    if (!session) return;
    try {
      await api('/customer-auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
    } finally {
      clearSession();
      setSession(null);
      setPasses([]);
    }
  }

  if (loading) {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3">
        <div className="onda-pwa-avatar onda-pwa-avatar--pulse" aria-hidden />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3 px-6 text-center">
        <p className="onda-pwa-title">Mis tarjetas</p>
        <p className="text-sm text-[var(--onda-muted)]">
          Aún no tienes tarjetas. Escanea el QR de un negocio para empezar.
        </p>
      </div>
    );
  }

  return (
    <div className="onda-pwa-shell">
      <header className="onda-pwa-hero">
        <div className="onda-pwa-hero-copy">
          <p className="onda-pwa-eyebrow">Onda</p>
          <h1 className="onda-pwa-title">Mis tarjetas</h1>
        </div>
      </header>
      <div className="onda-pwa-body onda-pwa-fade">
        <div className="flex flex-1 flex-col gap-4 pb-6">
          {passes.map((p) => (
            <Link key={p.id} href={`/r/${p.storeId}`} className="block">
              <PassPreview
                compact
                {...(p.store?.passDesign || {})}
                points={p.points}
                maxStamps={p.store?.maxStamps ?? 12}
                memberName={session.user.name}
              />
            </Link>
          ))}
          {!passes.length ? (
            <p className="text-center text-sm text-[var(--onda-muted)]">
              Aún no tienes tarjetas. Escanea el QR de un negocio para empezar.
            </p>
          ) : null}
          <button type="button" className="onda-pwa-secondary" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
