'use client';

import { useEffect, useRef, useState } from 'react';
import { OndaIcons } from '@onda/shared-ui';
import { BUSINESS_TYPES, useBusinessType, type BusinessType } from '../lib/businessType';

/**
 * Selector de tipo de negocio (MOCK). Cambia el contexto local
 * (BusinessTypeProvider); no llama al backend.
 */
export function BusinessTypeSwitcher() {
  const [open, setOpen] = useState(false);
  const { businessType, setBusinessType } = useBusinessType();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function select(next: BusinessType) {
    setBusinessType(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex w-full items-center justify-between gap-1 rounded-lg border border-[var(--onda-border)] bg-[var(--onda-bg)] px-2 py-1 text-xs font-medium text-[var(--onda-muted)] transition hover:border-[var(--onda-bridge)]/60 hover:text-[var(--onda-ink)]"
      >
        <span className="truncate">{businessType}</span>
        {OndaIcons.chevronDown}
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Tipo de negocio"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[var(--onda-border)] bg-[var(--onda-card)] shadow-lg"
        >
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
            Tipo de negocio · demo
          </p>
          <ul className="pb-1">
            {BUSINESS_TYPES.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  role="option"
                  aria-selected={t === businessType}
                  onClick={() => select(t)}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition hover:bg-[var(--onda-bg)] ${
                    t === businessType
                      ? 'font-semibold text-[var(--onda-primary-700)]'
                      : 'text-[var(--onda-ink)]'
                  }`}
                >
                  {t}
                  {t === businessType ? <span aria-hidden>✓</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
