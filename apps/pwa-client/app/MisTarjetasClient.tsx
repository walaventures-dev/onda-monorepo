'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, PassPreview } from '@onda/shared-ui';
import { loadSession, clearSession, type CustomerSession } from '../lib/session';

export function MisTarjetasClient() {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const existing = loadSession();
    setSession(existing);
    if (!existing) {
      setLoading(false);
      return;
    }
    api<any[]>(`/passes?userId=${existing.user.id}`)
      .then(setPasses)
      .finally(() => setLoading(false));
  }, []);

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
