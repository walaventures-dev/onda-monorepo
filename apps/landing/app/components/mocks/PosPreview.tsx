'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OndaHandMark } from '@onda/shared-ui';
import { crossfade } from '../../lib/motion';

const LINE_ITEMS = [
  { name: 'Café latte', qty: 2, price: '$18.000' },
  { name: 'Croissant', qty: 1, price: '$8.500' },
  { name: 'Jugo natural', qty: 1, price: '$9.000' },
] as const;

const INVENTORY = [
  { name: 'Café latte', stock: 42 },
  { name: 'Croissant', stock: 18 },
  { name: 'Jugo natural', stock: 7 },
] as const;

const SLIDES = [
  { id: 'vender', label: 'Vender' },
  { id: 'inventario', label: 'Inventario' },
  { id: 'ondas', label: 'Ondas' },
] as const;

function SlideVender() {
  return (
    <>
      <div className="flex items-center justify-between border-b border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
            Cuenta abierta
          </p>
          <p className="mt-0.5 font-display text-sm font-semibold text-[var(--onda-ink)]">
            Mesa 4 · Anónima
          </p>
        </div>
        <span className="rounded-full bg-[var(--onda-sky-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--onda-sky)]">
          En curso
        </span>
      </div>

      <ul className="divide-y divide-[var(--onda-border)] px-4">
        {LINE_ITEMS.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--onda-ink)]">
                {item.name}
              </p>
              <p className="text-xs text-[var(--onda-muted)]">×{item.qty}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--onda-ink)]">
              {item.price}
            </p>
          </li>
        ))}
      </ul>

      <div className="border-t border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Total
            </p>
            <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-[var(--onda-ink)]">
              $35.500
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-[var(--onda-primary-100)] px-3 py-1.5 text-xs font-semibold text-[var(--onda-primary-500)]">
            +3 Ondas
          </span>
        </div>
        <div className="mt-4 flex h-11 items-center justify-center rounded-full bg-[var(--onda-primary-500)] text-sm font-semibold text-white">
          Cobrar
        </div>
      </div>
    </>
  );
}

function SlideInventario() {
  return (
    <>
      <div className="border-b border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
          Catálogo
        </p>
        <p className="mt-0.5 font-display text-sm font-semibold text-[var(--onda-ink)]">
          Inventario
        </p>
      </div>
      <ul className="divide-y divide-[var(--onda-border)] px-4">
        {INVENTORY.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-3 py-3.5">
            <p className="text-sm font-medium text-[var(--onda-ink)]">{item.name}</p>
            <span className="rounded-full bg-[var(--onda-bg)] px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--onda-muted)] ring-1 ring-[var(--onda-border)]">
              {item.stock} uds
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-4">
        <p className="text-center text-xs text-[var(--onda-muted)]">
          Stock opcional — sin Excel eterno
        </p>
      </div>
    </>
  );
}

function SlideOndas() {
  return (
    <>
      <div className="border-b border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
          Checkout
        </p>
        <p className="mt-0.5 font-display text-sm font-semibold text-[var(--onda-ink)]">
          Cliente asociado
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 px-4 py-8">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--onda-primary-100)]">
          <OndaHandMark className="!h-7 w-auto" />
        </span>
        <p className="font-display text-base font-semibold text-[var(--onda-ink)]">
          María · ****2233
        </p>
        <p className="text-center text-sm text-[var(--onda-muted)]">
          Al cobrar suma <span className="font-semibold text-[var(--onda-primary-500)]">+3 Ondas</span> a
          su pase en Wallet
        </p>
      </div>
      <div className="border-t border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-4">
        <div className="flex h-11 items-center justify-center rounded-full bg-[var(--onda-primary-500)] text-sm font-semibold text-white">
          Cobrar y dar Ondas
        </div>
      </div>
    </>
  );
}

const SLIDE_BODY = [SlideVender, SlideInventario, SlideOndas] as const;

/** Mismo patrón que año prev/next en CartillaCalendar (promos). */
const NAV_BTN =
  'cursor-pointer rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-1.5 text-sm text-[var(--onda-ink)] transition hover:border-[var(--onda-primary-500)]/35 hover:bg-[var(--onda-primary-50)] active:scale-[0.98]';

export function PosPreview({
  index = 0,
  onIndexChange,
}: {
  index?: number;
  onIndexChange?: (i: number) => void;
}) {
  const [internal, setInternal] = useState(0);
  const active = onIndexChange ? index : internal;
  const setActive = (i: number) => {
    const next = ((i % SLIDES.length) + SLIDES.length) % SLIDES.length;
    if (onIndexChange) onIndexChange(next);
    else setInternal(next);
  };

  const Body = SLIDE_BODY[active] ?? SlideVender;

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--onda-border)] bg-[var(--onda-card)] shadow-[0_24px_56px_rgba(26,27,46,0.12)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={SLIDES[active]?.id ?? active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={crossfade}
          >
            <Body />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          type="button"
          className={NAV_BTN}
          aria-label="Anterior"
          onClick={() => setActive(active - 1)}
        >
          ←
        </button>
        <p className="min-w-[6.5rem] text-center text-xs font-medium text-[var(--onda-muted)]">
          {SLIDES[active]?.label}
        </p>
        <button
          type="button"
          className={NAV_BTN}
          aria-label="Siguiente"
          onClick={() => setActive(active + 1)}
        >
          →
        </button>
      </div>
    </div>
  );
}

export const POS_PREVIEW_SLIDE_COUNT = SLIDES.length;
