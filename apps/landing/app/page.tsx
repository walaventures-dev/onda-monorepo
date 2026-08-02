'use client';

import { useState } from 'react';
import { OndaLogo, GradientButton, PhoneInput, api } from '@onda/shared-ui';
import { toE164Colombia, isCompletePhoneMask } from '@onda/shared-utils';

const plans = [
  {
    name: 'Básico Lite',
    price: '$49.900',
    features: [
      'Pases ilimitados Apple/Google',
      'Acumulación y redención',
      'Hasta 150 msgs WhatsApp/mes',
    ],
  },
  {
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

export default function LandingPage() {
  const [roiVisits, setRoiVisits] = useState(200);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lead, setLead] = useState({
    name: '',
    email: '',
    businessName: '',
    phone: '',
    message: '',
  });
  const [sent, setSent] = useState(false);
  const [leadError, setLeadError] = useState('');

  const roi = Math.round(roiVisits * 0.18 * 25000);

  const navLinks = [
    { href: '#features', label: 'Producto' },
    { href: '#pricing', label: 'Planes' },
    { href: '#roi', label: 'ROI' },
    { href: '/festival-neiva', label: 'Eventos' },
    { href: '#contact', label: 'Contacto' },
  ];

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    setLeadError('');
    if (lead.phone && !isCompletePhoneMask(lead.phone)) {
      setLeadError('Teléfono inválido. Usa el formato (300) 000 - 0000');
      return;
    }
    await api('/leads', {
      method: 'POST',
      body: JSON.stringify({
        name: lead.name,
        email: lead.email,
        businessName: lead.businessName,
        message: lead.message,
        phone: lead.phone ? toE164Colombia(lead.phone) : undefined,
      }),
    });
    setSent(true);
  }

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
            <GradientButton
              type="button"
              onClick={() => (window.location.href = '#contact')}
            >
              Hablar con ventas
            </GradientButton>
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
            <GradientButton
              type="button"
              className="mt-3 w-full"
              onClick={() => {
                setMenuOpen(false);
                window.location.href = '#contact';
              }}
            >
              Hablar con ventas
            </GradientButton>
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
              href="#pricing"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--onda-violet)]"
            >
              Ver planes
            </a>
            <a
              href="/festival-neiva"
              className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold"
            >
              Festival Neiva
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
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {plans.map((p) => (
              <div key={p.name} className="onda-card p-8">
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
        </div>
      </section>

      <section id="contact" className="bg-white py-20">
        <div className="mx-auto max-w-xl px-6">
          <h2 className="font-display text-3xl font-semibold">Registra tu comercio</h2>
          {sent ? (
            <p className="mt-6 text-[var(--onda-success)]">¡Recibimos tu solicitud!</p>
          ) : (
            <form onSubmit={submitLead} className="mt-6 space-y-4">
              {(['name', 'email', 'businessName'] as const).map((k) => (
                <input
                  key={k}
                  required={k !== 'businessName'}
                  placeholder={
                    k === 'name' ? 'Nombre' : k === 'email' ? 'Email' : 'Negocio'
                  }
                  className="w-full rounded-xl border border-[var(--onda-border)] px-4 py-3"
                  value={lead[k]}
                  onChange={(e) => setLead({ ...lead, [k]: e.target.value })}
                />
              ))}
              <PhoneInput
                placeholder="WhatsApp (300) 000 - 0000"
                value={lead.phone}
                onChange={(phone) => setLead({ ...lead, phone })}
              />
              <textarea
                placeholder="Mensaje"
                className="w-full rounded-xl border border-[var(--onda-border)] px-4 py-3"
                value={lead.message}
                onChange={(e) => setLead({ ...lead, message: e.target.value })}
              />
              {leadError ? (
                <p className="text-sm text-[var(--onda-danger)]">{leadError}</p>
              ) : null}
              <GradientButton type="submit" className="w-full">
                Enviar
              </GradientButton>
            </form>
          )}
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
