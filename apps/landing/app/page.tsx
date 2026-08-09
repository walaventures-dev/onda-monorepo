'use client';

import { OndaLogo, GradientButton } from '@onda/shared-ui';
import { useState } from 'react';

const plans = [
  {
    id: 'BASIC' as const,
    name: 'Básico Lite',
    price: '$49.900',
    features: [
      'Pases ilimitados Apple/Google',
      'Acumulación y redención',
      'Hasta 150 msgs WhatsApp/mes',
    ],
  },
  {
    id: 'PRO' as const,
    name: 'PRO Crecimiento',
    price: '$79.900',
    features: [
      'Todo lo de Básico',
      'Hasta 350 msgs WhatsApp/mes',
      'Review gating Google Maps',
      'NPS y alertas de insatisfacción',
      'Proximidad GPS',
    ],
  },
];

const MERCHANT_ONBOARDING_BASE =
  process.env.NEXT_PUBLIC_MERCHANT_URL
    ? `${process.env.NEXT_PUBLIC_MERCHANT_URL.replace(/\/$/, '')}/onboarding`
    : 'http://localhost:4202/onboarding';

function onboardingUrl(plan?: 'BASIC' | 'PRO') {
  if (!plan) return MERCHANT_ONBOARDING_BASE;
  return `${MERCHANT_ONBOARDING_BASE}?plan=${plan}`;
}

export default function LandingPage() {
  const [roiVisits, setRoiVisits] = useState(200);
  const [menuOpen, setMenuOpen] = useState(false);

  const roi = Math.round(roiVisits * 0.18 * 25000);

  const navLinks = [
    { href: '#features', label: 'Producto' },
    { href: '#pricing', label: 'Planes' },
    { href: '#roi', label: 'ROI' },
    { href: '/festival-neiva', label: 'Eventos' },
  ];

  return (
    <div className="min-h-screen">
      <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-6">
        <OndaLogo />
        <nav className="hidden gap-6 text-sm text-[var(--onda-muted)] md:flex">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <a href={MERCHANT_ONBOARDING_BASE}>
              <GradientButton type="button">Empieza gratis</GradientButton>
            </a>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--onda-border)] bg-white text-[var(--onda-ink)] md:hidden"
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
          <div className="absolute inset-x-4 top-full z-50 rounded-2xl border border-[var(--onda-border)] bg-white p-4 shadow-lg md:hidden">
            <nav className="flex flex-col gap-1 text-sm">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="rounded-xl px-3 py-2.5 text-[var(--onda-ink)] hover:bg-[var(--onda-sky-soft)]"
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <a href={MERCHANT_ONBOARDING_BASE} className="mt-3 block">
              <GradientButton type="button" className="w-full">
                Empieza gratis
              </GradientButton>
            </a>
          </div>
        ) : null}
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 onda-gradient opacity-90" />
        <div className="relative mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-center px-6 py-20 text-white">
          <p className="font-display text-5xl font-bold tracking-tight md:text-7xl">Onda</p>
          <h1 className="mt-4 max-w-2xl font-display text-2xl font-medium md:text-4xl">
            Lealtad digital en Wallet. Sin apps. Sin fricción.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            NFC o QR → enrolamiento en segundos → puntos en Apple y Google Wallet, con WhatsApp
            desde Onda.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={MERCHANT_ONBOARDING_BASE}
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--onda-violet)]"
            >
              Empieza gratis
            </a>
            <a
              href="#pricing"
              className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold"
            >
              Ver planes
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl font-semibold">Hecho para hostelería y eventos</h2>
        <p className="mt-2 max-w-2xl text-[var(--onda-muted)]">
          Un pase, muchas visitas. Dashboards para comercios y organizadores.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            ['Wallet nativo', 'Emisión Apple + Google con branding de tu local.'],
            ['WhatsApp Onda', 'Notificaciones desde el número de plataforma Kapso.'],
            ['Eventos masivos', 'Circuitos, invitaciones, heatmaps y sorteos en vivo.'],
          ].map(([t, d]) => (
            <div key={t} className="onda-card p-6">
              <h3 className="font-display text-xl font-semibold">{t}</h3>
              <p className="mt-2 text-[var(--onda-muted)]">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl font-semibold">Planes</h2>
          <p className="mt-2 text-[var(--onda-muted)]">
            El primer mes es gratis. Empieza en minutos.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {plans.map((p) => (
              <div key={p.name} className="onda-card flex flex-col p-8">
                <h3 className="font-display text-2xl font-semibold">{p.name}</h3>
                <p className="mt-2 text-3xl font-bold text-[var(--onda-violet)]">
                  {p.price}
                  <span className="text-base font-normal text-[var(--onda-muted)]"> /mes</span>
                </p>
                <ul className="mt-6 space-y-2 text-[var(--onda-muted)]">
                  {p.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <a href={onboardingUrl(p.id)} className="mt-8 block">
                  <GradientButton type="button" className="w-full">
                    Empezar con {p.name}
                  </GradientButton>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roi" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl font-semibold">Calculadora de ROI</h2>
        <div className="onda-card mt-8 max-w-xl p-6">
          <label className="text-sm text-[var(--onda-muted)]">Visitas mensuales</label>
          <input
            type="range"
            min={50}
            max={2000}
            value={roiVisits}
            onChange={(e) => setRoiVisits(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--onda-violet)]"
          />
          <p className="mt-4 text-sm text-[var(--onda-muted)]">{roiVisits} visitas</p>
          <p className="mt-2 font-display text-3xl font-semibold text-[var(--onda-sky)]">
            ~${roi.toLocaleString('es-CO')} COP
          </p>
          <p className="text-sm text-[var(--onda-muted)]">
            Estimado de ticket incremental por retención (18%).
          </p>
          <a href={MERCHANT_ONBOARDING_BASE} className="mt-6 inline-block">
            <GradientButton type="button">Registrar mi comercio</GradientButton>
          </a>
        </div>
      </section>

      <section id="signup" className="bg-white py-20">
        <div className="mx-auto max-w-xl px-6 text-center">
          <h2 className="font-display text-3xl font-semibold">Registra tu comercio</h2>
          <p className="mt-3 text-[var(--onda-muted)]">
            Alta en minutos: datos del negocio, diseño de tu tarjeta wallet y primera
            recompensa. Empiezas con 1 mes gratis.
          </p>
          <a href={MERCHANT_ONBOARDING_BASE} className="mt-8 inline-block">
            <GradientButton type="button" className="px-8">
              Darme de alta
            </GradientButton>
          </a>
        </div>
      </section>

      <footer className="border-t border-[var(--onda-border)] py-10 text-center text-sm text-[var(--onda-muted)]">
        <div className="mb-3 flex justify-center gap-4">
          <a href="/privacidad" className="text-[var(--onda-violet)] hover:underline">
            Privacidad
          </a>
          <a href="/terminos" className="text-[var(--onda-violet)] hover:underline">
            Términos
          </a>
        </div>
        © {new Date().getFullYear()} Onda · onda.lat
      </footer>
    </div>
  );
}
