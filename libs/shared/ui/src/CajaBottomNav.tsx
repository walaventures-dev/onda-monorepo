'use client';

import type { ReactNode } from 'react';

export type CajaBottomNavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  /** Navegación externa (p. ej. la pantalla de cocina). */
  href?: string;
  onSelect?: () => void;
};

/**
 * Barra de navegación inferior estilo app nativa: fija, respeta el área
 * segura del dispositivo (notch/home indicator), icono + etiqueta corta y
 * estado activo visible. Mantener máximo 5 destinos (ergonomía de pulgar).
 */
export function CajaBottomNav({ items }: { items: CajaBottomNavItem[] }) {
  return (
    <nav
      aria-label="Navegación de caja"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--onda-border)] bg-[var(--onda-card)]/95 pb-[max(0rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(26,27,46,0.08)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl">
        {items.map((item) => {
          const inner = (
            <>
              <span
                className={`flex h-7 w-11 items-center justify-center rounded-full transition ${
                  item.active ? 'bg-[var(--onda-primary-50)]' : ''
                }`}
              >
                {item.icon}
              </span>
              <span
                className={`max-w-full truncate text-[11px] leading-none ${
                  item.active
                    ? 'font-bold text-[var(--onda-primary-600)]'
                    : 'font-medium text-[var(--onda-muted)]'
                }`}
              >
                {item.label}
              </span>
            </>
          );
          const cls = `flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 transition active:scale-[0.96] ${
            item.active ? '' : 'hover:opacity-80'
          }`;
          if (item.href) {
            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={cls}
              >
                {inner}
              </a>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onSelect}
              aria-current={item.active ? 'page' : undefined}
              className={cls}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
