'use client';

import { useEffect, useRef, useState } from 'react';
import { PassPreview } from '@onda/shared-ui';

export type PassSwipeCard = {
  key: string;
  badge: string;
  design: {
    backgroundColor?: string;
    foregroundColor?: string;
    labelColor?: string;
    title?: string;
    subtitle?: string | null;
    description?: string | null;
    logoUrl?: string | null;
  };
  points: number;
  maxStamps: number;
  milestoneStamps: number[];
};

export function PassSwipe({
  cards,
  memberName,
  compact = true,
  onAddToWallet,
  walletBusy,
  walletLabel,
}: {
  cards: PassSwipeCard[];
  memberName?: string;
  compact?: boolean;
  onAddToWallet?: () => void;
  walletBusy?: boolean;
  walletLabel?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function onScroll() {
      if (!el) return;
      const slide = el.querySelector<HTMLElement>('[data-pass-slide]');
      const width = slide?.offsetWidth || el.clientWidth;
      const gap = 12;
      const next = Math.round(el.scrollLeft / (width + gap));
      setIndex(Math.max(0, Math.min(cards.length - 1, next)));
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [cards.length]);

  function goTo(i: number) {
    const el = scrollerRef.current;
    const slide = el?.querySelectorAll<HTMLElement>('[data-pass-slide]')[i];
    slide?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  if (cards.length <= 1) {
    const only = cards[0];
    if (!only) return null;
    return (
      <div className="onda-pwa-pass-stage">
        {only.badge ? <p className="onda-pwa-pass-badge">{only.badge}</p> : null}
        <PassPreview
          compact={compact}
          {...only.design}
          points={only.points}
          maxStamps={only.maxStamps}
          milestoneStamps={only.milestoneStamps}
          memberName={memberName}
          onAddToWallet={onAddToWallet}
          walletBusy={walletBusy}
          walletLabel={walletLabel}
        />
      </div>
    );
  }

  return (
    <div className="onda-pwa-swipe">
      <div ref={scrollerRef} className="onda-pwa-swipe-track">
        {cards.map((card) => (
          <div key={card.key} data-pass-slide className="onda-pwa-swipe-slide">
            <p className="onda-pwa-pass-badge">{card.badge}</p>
            <PassPreview
              compact={compact}
              {...card.design}
              points={card.points}
              maxStamps={card.maxStamps}
              milestoneStamps={card.milestoneStamps}
              memberName={memberName}
              onAddToWallet={onAddToWallet}
              walletBusy={walletBusy}
              walletLabel={walletLabel}
            />
          </div>
        ))}
      </div>
      <div className="onda-pwa-swipe-meta">
        <div className="onda-pwa-swipe-dots" role="tablist" aria-label="Pases">
          {cards.map((card, i) => (
            <button
              key={card.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={card.badge}
              className={`onda-pwa-swipe-dot${i === index ? ' is-active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <p className="onda-pwa-swipe-hint">Desliza · negocio y evento</p>
      </div>
    </div>
  );
}
