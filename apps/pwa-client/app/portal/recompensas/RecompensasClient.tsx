'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SkeletonList } from '@onda/shared-ui';
import { getRewardsCatalog, type CatalogReward } from '../lib/mockData';

export default function RecompensasClient() {
  const [rewards, setRewards] = useState<CatalogReward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getRewardsCatalog().then((data) => {
      if (cancelled) return;
      setRewards(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="onda-pwa-shell">
      <header className="onda-pwa-hero">
        <div className="onda-pwa-hero-copy">
          <p className="onda-pwa-eyebrow">
            <img src="/brand/onda-wordmark.png" alt="Onda" className="h-4 w-auto" />
          </p>
          <h1 className="onda-pwa-title">Recompensas</h1>
          <p className="onda-pwa-sub">Disponibles en los restaurantes Onda</p>
        </div>
      </header>

      <div className="onda-pwa-body onda-pwa-fade flex flex-col gap-3">
        <Link
          href="/portal"
          className="self-start text-sm font-medium text-[var(--onda-violet)]"
        >
          ← Volver a mi tarjeta
        </Link>

        {loading ? (
          <SkeletonList rows={4} />
        ) : (
          <div className="flex flex-col gap-3 pb-6">
            {rewards.map((r) => (
              <div key={r.id} className="overflow-hidden rounded-2xl bg-[var(--onda-card)] shadow-sm">
                <div className="p-4">
                  <p className="text-xs font-medium text-[var(--onda-violet)]">{r.storeName}</p>
                  <p className="mt-0.5 font-semibold">{r.title}</p>
                  {r.description ? (
                    <p className="mt-1 text-sm text-[var(--onda-muted)]">{r.description}</p>
                  ) : null}
                  <p className="mt-2 text-sm font-semibold text-[var(--onda-violet)]">
                    {r.pointsRequired} ondas
                  </p>
                </div>
              </div>
            ))}
            {!rewards.length ? (
              <p className="text-[var(--onda-muted)]">Pronto habrá recompensas aquí.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
