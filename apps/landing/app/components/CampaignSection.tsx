'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { fadeUp } from '../lib/motion';
import { onboardingUrl } from '../lib/pricing';

const STEPS = [
  { id: 0, label: '1. Objetivo' },
  { id: 1, label: '2. Audiencia' },
  { id: 2, label: '3. Mensaje' },
  { id: 3, label: '4. Revisión' },
] as const;

const OBJECTIVES = [
  'Traer clientes que dejaron de venir',
  'Vender más en horarios flojos',
  'Lanzar una recompensa nueva',
  'Pedir reseñas en Google',
];

const OFFER_TEXT = 'Café gratis si vuelves esta semana';

export function CampaignSection() {
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState(OBJECTIVES[0]);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (step !== 2) return;
    setTyped('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(OFFER_TEXT.slice(0, i));
      if (i >= OFFER_TEXT.length) window.clearInterval(id);
    }, 28);
    return () => window.clearInterval(id);
  }, [step]);

  return (
    <section id="campanas" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <motion.div {...fadeUp} className="max-w-2xl">
        <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-[var(--onda-ink)]">
          Cuando tú quieres vender, activa una campaña.
        </h2>
        <p className="mt-3 text-lg text-[var(--onda-muted)]">
          Segmenta, elige canal y lanza en minutos — sin Excel ni agencia.
        </p>
      </motion.div>

      <motion.div
        {...fadeUp}
        className="mt-12 overflow-hidden rounded-[1.5rem] border border-[var(--onda-border)] bg-[var(--onda-card)] shadow-[0_20px_50px_rgba(26,27,46,0.08)]"
      >
        <div className="grid lg:grid-cols-[200px_1fr_220px]">
          <aside className="border-b border-[var(--onda-border)] bg-[var(--onda-bg)] p-4 lg:border-b-0 lg:border-r">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Nueva campaña
            </p>
            <nav className="mt-3 flex gap-2 overflow-x-auto lg:flex-col">
              {STEPS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={`whitespace-nowrap rounded-full px-3 py-2 text-left text-sm font-medium transition ${
                    step === s.id
                      ? 'bg-[var(--onda-primary-500)] text-white'
                      : 'text-[var(--onda-muted)] hover:bg-[var(--onda-primary-50)] hover:text-[var(--onda-ink)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="min-h-[280px] p-6 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {step === 0 ? (
                  <div>
                    <h3 className="font-display text-xl font-semibold">¿Qué quieres lograr?</h3>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {OBJECTIVES.map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => setObjective(o)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            objective === o
                              ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-50)] text-[var(--onda-ink)]'
                              : 'border-[var(--onda-border)] text-[var(--onda-muted)] hover:border-[var(--onda-bridge)]'
                          }`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {step === 1 ? (
                  <div>
                    <h3 className="font-display text-xl font-semibold">Audiencia encontrada</h3>
                    <p className="mt-3 rounded-2xl bg-[var(--onda-sky-soft)] px-4 py-3 text-sm text-[var(--onda-ink)]">
                      Encontramos <strong>104 clientes</strong> que no regresan hace más de 30
                      días.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {['Inactivos 30d', 'Wallet activo', 'Visitaron 2+ veces'].map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-[var(--onda-primary-100)] px-3 py-1 text-xs font-medium text-[var(--onda-primary-700)]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div>
                    <h3 className="font-display text-xl font-semibold">Mensaje de la oferta</h3>
                    <label className="mt-4 block text-sm text-[var(--onda-muted)]">
                      Texto que verá el cliente
                    </label>
                    <div className="mt-2 min-h-[52px] rounded-2xl border border-[var(--onda-border)] bg-white px-4 py-3 font-medium text-[var(--onda-ink)]">
                      {typed}
                      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[var(--onda-primary-500)] align-middle" />
                    </div>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div>
                    <h3 className="font-display text-xl font-semibold">Listo para lanzar</h3>
                    <ul className="mt-4 space-y-2 text-sm text-[var(--onda-muted)]">
                      <li>
                        Objetivo: <strong className="text-[var(--onda-ink)]">{objective}</strong>
                      </li>
                      <li>
                        Audiencia: <strong className="text-[var(--onda-ink)]">184 clientes</strong>
                      </li>
                      <li>
                        Oferta:{' '}
                        <strong className="text-[var(--onda-ink)]">{OFFER_TEXT}</strong>
                      </li>
                    </ul>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          <aside className="border-t border-[var(--onda-border)] bg-[var(--onda-bg)] p-6 lg:border-l lg:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Resumen
            </p>
            <p className="mt-3 font-display text-3xl font-bold text-[var(--onda-ink)]">184</p>
            <p className="text-sm text-[var(--onda-muted)]">clientes</p>
            <div className="mt-5 space-y-2 text-sm">
              {['Wallet', 'WhatsApp', 'SMS'].map((c) => (
                <div key={c} className="flex items-center gap-2 text-[var(--onda-ink)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--onda-success)]" />
                  {c}
                </div>
              ))}
            </div>
            <a
              href={onboardingUrl('PRO')}
              className="mt-6 flex w-full items-center justify-center rounded-full bg-[var(--onda-primary-500)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--onda-primary-600)] active:scale-[0.98]"
            >
              Lanzar mi Onda →
            </a>
          </aside>
        </div>
      </motion.div>
    </section>
  );
}
