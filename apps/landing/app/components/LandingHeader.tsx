'use client';

import { useEffect, useState } from 'react';
import { OndaLogo } from '@onda/shared-ui';
import { onboardingUrl } from '../lib/pricing';

const NAV = [
  { href: '#demo', label: 'Pruébalo' },
  { href: '#pricing', label: 'Planes' },
  { href: '#campanas', label: 'Campañas' },
];

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-[background,box-shadow,backdrop-filter] ${
        scrolled
          ? 'border-b border-[var(--onda-border)] bg-[color-mix(in_srgb,var(--onda-bg)_88%,white)] shadow-[0_8px_24px_rgba(26,27,46,0.06)] backdrop-blur-md'
          : 'bg-transparent'
      }`}
    >
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
        <a href="/" className="shrink-0" aria-label="Onda inicio">
          <OndaLogo />
        </a>

        <nav className="hidden items-center gap-7 text-sm text-[var(--onda-muted)] md:flex">
          {NAV.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-[var(--onda-ink)]">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={onboardingUrl()}
            className="hidden rounded-full bg-[var(--onda-primary-500)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(5,45,222,0.28)] transition hover:bg-[var(--onda-primary-600)] active:scale-[0.98] sm:inline-flex"
          >
            Poner mi negocio en la Onda →
          </a>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-ink)] md:hidden"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              {menuOpen ? (
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>

        {menuOpen ? (
          <div className="absolute inset-x-4 top-full z-50 rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-4 shadow-lg md:hidden">
            <nav className="flex flex-col gap-1 text-sm">
              {NAV.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="rounded-xl px-3 py-2.5 text-[var(--onda-ink)] hover:bg-[var(--onda-primary-50)]"
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <a
              href={onboardingUrl()}
              className="mt-3 flex w-full items-center justify-center rounded-full bg-[var(--onda-primary-500)] px-4 py-3 text-sm font-semibold text-white"
              onClick={() => setMenuOpen(false)}
            >
              Poner mi negocio en la Onda →
            </a>
          </div>
        ) : null}
      </div>
    </header>
  );
}
