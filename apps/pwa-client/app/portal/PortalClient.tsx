'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOndaCard, getRestaurantCards } from './lib/mockData';
import { getPortalSession, clearPortalSession } from './lib/mockAuth';
import { OndaCardView } from './OndaCardView';
import { RestaurantCardList } from './RestaurantCardList';
import { PortalLoginView } from './PortalLoginView';
import { SkeletonPwa } from '@onda/shared-ui';
import type { OndaCardDto, RestaurantCardDto } from '@onda/shared-types';

export default function PortalClient() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [ondaCard, setOndaCard] = useState<OndaCardDto | null>(null);
  const [restaurantCards, setRestaurantCards] = useState<RestaurantCardDto[]>([]);

  useEffect(() => {
    setAuthed(!!getPortalSession());
  }, []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;

    async function load() {
      const [card, cards] = await Promise.all([getOndaCard(), getRestaurantCards()]);
      if (cancelled) return;
      setOndaCard(card);
      setRestaurantCards(cards);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authed]);

  function handleLogout() {
    clearPortalSession();
    setOndaCard(null);
    setRestaurantCards([]);
    setLoading(true);
    setAuthed(false);
  }

  if (authed === null) {
    return (
      <div className="onda-pwa-shell items-center justify-center">
        <SkeletonPwa />
      </div>
    );
  }

  if (!authed) {
    return <PortalLoginView onSuccess={() => setAuthed(true)} />;
  }

  if (loading || !ondaCard) {
    return (
      <div className="onda-pwa-shell items-center justify-center">
        <SkeletonPwa />
      </div>
    );
  }

  return (
    <div className="onda-pwa-shell">
      <header className="onda-pwa-hero">
        <div className="onda-pwa-hero-copy">
          <p className="onda-pwa-eyebrow">
            <img src="/brand/onda-wordmark.png" alt="Onda" className="h-4 w-auto" />
          </p>
          <h1 className="onda-pwa-title">Mi tarjeta Onda</h1>
          <p className="onda-pwa-sub">{ondaCard.totalPoints} ondas acumuladas en total</p>
        </div>
      </header>

      <div className="onda-pwa-body onda-pwa-fade flex flex-col gap-5">
        <OndaCardView card={ondaCard} />

        <div>
          <h2 className="mb-2 text-sm font-semibold text-[var(--onda-ink)]">Mis restaurantes</h2>
          <RestaurantCardList cards={restaurantCards} />
        </div>

        <Link href="/portal/recompensas" className="onda-pwa-secondary block text-center">
          Explorar recompensas
        </Link>

        <button type="button" className="onda-pwa-secondary" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
