'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, PassPreview } from '@onda/shared-ui';
import { loadSession, clearSession, type CustomerSession } from '../lib/session';

type Step = 'loading' | 'cards';

const SIMULATE_QR_SCAN = process.env.NODE_ENV !== 'production';
const PREFERRED_STORE_NAME = 'Café del Río';

async function simulateQrScan(router: ReturnType<typeof useRouter>): Promise<boolean> {
  try {
    const stores = await api<{ id: string; name: string }[]>('/stores');
    const target = stores.find((s) => s.name === PREFERRED_STORE_NAME) || stores[0];
    if (target) {
      router.replace(`/r/${target.id}`);
      return true;
    }
  } catch {
    // sin negocios disponibles o falló la red: se cae al mensaje vacío normal
  }
  return false;
}

export function MisTarjetasClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('loading');
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [passes, setPasses] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const existing = loadSession();
      if (cancelled) return;

      if (!existing) {
        if (SIMULATE_QR_SCAN && (await simulateQrScan(router))) return;
        if (!cancelled) setStep('cards');
        return;
      }

      setSession(existing);
      let userPasses: any[] = [];
      try {
        userPasses = await api<any[]>(`/passes?userId=${existing.user.id}`);
      } catch {
        userPasses = [];
      }
      if (cancelled) return;

      if (userPasses.length === 0 && SIMULATE_QR_SCAN && (await simulateQrScan(router))) return;

      if (userPasses.length === 1) {
        if (!cancelled) router.replace(`/r/${userPasses[0].storeId}`);
        return;
      }

      if (!cancelled) {
        setPasses(userPasses);
        setStep('cards');
      }
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
      if (SIMULATE_QR_SCAN) {
        await simulateQrScan(router);
      } else {
        setStep('cards');
      }
    }
  }

  if (step === 'loading') {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3">
        <div className="onda-pwa-avatar onda-pwa-avatar--pulse" aria-hidden />
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
                memberName={session?.user.name ?? ''}
              />
            </Link>
          ))}
          {!passes.length ? (
            <p className="text-center text-sm text-[var(--onda-muted)]">
              Aún no tienes tarjetas. Escanea el QR de un negocio para empezar.
            </p>
          ) : null}
          {session ? (
            <button type="button" className="onda-pwa-secondary" onClick={logout}>
              Cerrar sesión
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
