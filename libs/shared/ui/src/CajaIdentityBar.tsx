'use client';

import { OndaWordmark } from './brand';
import { OndaIcons } from './icons';

/** Barra superior de identidad de la caja: logo Onda + negocio + usuario + salir. */
export function CajaIdentityBar({
  storeName,
  userName,
  onLogout,
  logoutBusy,
}: {
  storeName?: string;
  /** Nombre del usuario de caja con sesión iniciada (opcional). */
  userName?: string;
  onLogout?: () => void;
  logoutBusy?: boolean;
}) {
  const name = storeName?.trim() || 'tu comercio';
  return (
    <header className="flex items-center justify-between gap-3">
      <OndaWordmark className="h-4 w-auto shrink-0" />
      <p className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-[var(--onda-ink)]">
        {userName?.trim() ? (
          <>
            <span className="text-[var(--onda-muted)]">{name} · </span>
            {userName.trim()}
          </>
        ) : (
          name
        )}
      </p>
      {onLogout ? (
        <button
          type="button"
          onClick={onLogout}
          disabled={logoutBusy}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)] disabled:opacity-50"
          aria-label="Cerrar sesión"
        >
          {OndaIcons.logout}
          <span className="hidden sm:inline">Salir</span>
        </button>
      ) : null}
    </header>
  );
}
