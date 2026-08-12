'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AUDIENCE_BY_OBJECTIVE,
  CHANNELS,
  OBJECTIVES,
  type Channel,
  type Objective,
} from '../lib/campaign-demo';
import { fadeUp } from '../lib/motion';
import { onboardingUrl } from '../lib/pricing';
import { IPhonePreview, LockScreen } from './mocks/IPhonePreview';

const STEPS = [
  { id: 0, label: '1. Objetivo' },
  { id: 1, label: '2. Audiencia' },
  { id: 2, label: '3. Mensaje' },
  { id: 3, label: '4. Revisión' },
] as const;

const NOTIF_DELAYS_MS = [900, 2600, 4300] as const;

export function CampaignSection() {
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState<Objective>(OBJECTIVES[0]);
  const [message, setMessage] = useState('');
  const [typing, setTyping] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [visibleChannels, setVisibleChannels] = useState<Channel[]>([]);
  const typeIntervalRef = useRef<number | null>(null);
  const launchTimersRef = useRef<number[]>([]);
  const seededObjectiveRef = useRef<Objective | null>(null);

  const audience = AUDIENCE_BY_OBJECTIVE[objective];

  const clearLaunchTimers = () => {
    launchTimersRef.current.forEach((id) => window.clearTimeout(id));
    launchTimersRef.current = [];
  };

  const clearTypeInterval = () => {
    if (typeIntervalRef.current != null) {
      window.clearInterval(typeIntervalRef.current);
      typeIntervalRef.current = null;
    }
  };

  const resetLaunch = () => {
    clearLaunchTimers();
    setLaunched(false);
    setVisibleChannels([]);
  };

  const goToStep = (next: number) => {
    if (launched) resetLaunch();
    setStep(next);
  };

  useEffect(() => {
    if (step !== 2) {
      clearTypeInterval();
      setTyping(false);
      return;
    }
    if (seededObjectiveRef.current === objective) return;

    clearTypeInterval();
    const target = AUDIENCE_BY_OBJECTIVE[objective].defaultMessage;
    seededObjectiveRef.current = objective;
    setMessage('');
    setTyping(true);
    let i = 0;
    typeIntervalRef.current = window.setInterval(() => {
      i += 1;
      setMessage(target.slice(0, i));
      if (i >= target.length) {
        clearTypeInterval();
        setTyping(false);
      }
    }, 28);

    return () => clearTypeInterval();
  }, [step, objective]);

  useEffect(() => () => clearLaunchTimers(), []);

  const handleMessageChange = (value: string) => {
    clearTypeInterval();
    setTyping(false);
    setMessage(value);
  };

  const handleCta = () => {
    if (launched) return;
    if (step < 3) {
      goToStep(step + 1);
      return;
    }

    setLaunched(true);
    setVisibleChannels([]);
    clearLaunchTimers();
    NOTIF_DELAYS_MS.forEach((delay, index) => {
      const id = window.setTimeout(() => {
        setVisibleChannels((prev) => {
          const next = CHANNELS[index];
          if (prev.includes(next)) return prev;
          return [...prev, next];
        });
      }, delay);
      launchTimersRef.current.push(id);
    });
  };

  const ctaLabel =
    step < 3 ? 'Siguiente' : launched ? null : 'Lanzar campaña';

  return (
    <section id="campanas" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <motion.div {...fadeUp} className="max-w-2xl">
        <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-[var(--onda-ink)]">
          Lanza una campaña en minutos.
        </h2>
        <p className="mt-3 text-lg text-[var(--onda-muted)]">
          Prueba este demo: elige objetivo, audiencia y mensaje. En cuatro pasos
          ves cómo Onda llega a tus clientes por Wallet, WhatsApp y SMS — sin Excel
          ni agencia.
        </p>
      </motion.div>

      <motion.div
        {...fadeUp}
        className="mt-12 overflow-hidden rounded-[1.5rem] border border-[var(--onda-border)] bg-[var(--onda-card)] shadow-[0_20px_50px_rgba(26,27,46,0.08)]"
      >
        <div className="grid lg:grid-cols-[180px_1fr_minmax(260px,300px)]">
          <aside className="border-b border-[var(--onda-border)] bg-[var(--onda-bg)] p-4 lg:border-b-0 lg:border-r">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Nueva campaña
            </p>
            <nav className="mt-3 flex gap-2 overflow-x-auto lg:flex-col">
              {STEPS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToStep(s.id)}
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

          <div className="min-h-[520px] p-6 md:p-8">
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
                          onClick={() => {
                            setObjective(o);
                            if (seededObjectiveRef.current !== o) {
                              seededObjectiveRef.current = null;
                              setMessage('');
                            }
                            resetLaunch();
                          }}
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
                      {audience.headline}
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {audience.kpis.map((kpi) => (
                        <div
                          key={kpi.label}
                          className="rounded-2xl border border-[var(--onda-border)] bg-white px-3 py-3 text-center"
                        >
                          <p className="font-display text-xl font-bold text-[var(--onda-ink)]">
                            {kpi.value}
                          </p>
                          <p className="mt-0.5 text-[10px] font-medium text-[var(--onda-muted)]">
                            {kpi.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--onda-border)] bg-white p-4">
                        <p className="text-xs font-semibold text-[var(--onda-ink)]">
                          Frecuencia de visitas
                        </p>
                        <div className="mt-2 h-36">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={audience.visitFrequency}
                              margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                            >
                              <XAxis dataKey="bucket" fontSize={10} tickLine={false} />
                              <YAxis fontSize={10} allowDecimals={false} width={28} tickLine={false} />
                              <Tooltip
                                cursor={{ fill: 'rgba(5,45,222,0.06)' }}
                                contentStyle={{
                                  borderRadius: 12,
                                  border: '1px solid var(--onda-border)',
                                  fontSize: 12,
                                }}
                              />
                              <Bar
                                dataKey="count"
                                name="Clientes"
                                fill="var(--onda-sky)"
                                radius={[6, 6, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[var(--onda-border)] bg-white p-4">
                        <p className="text-xs font-semibold text-[var(--onda-ink)]">
                          Personas en el segmento
                        </p>
                        <ul className="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1">
                          {audience.people.map((person) => (
                            <li key={person.name} className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--onda-primary-100)] text-[10px] font-bold text-[var(--onda-primary-700)]">
                                {person.initials}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[var(--onda-ink)]">
                                  {person.name}
                                </p>
                                <p className="text-[11px] text-[var(--onda-muted)]">{person.meta}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {audience.chips.map((t) => (
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
                    <label className="mt-4 block text-sm text-[var(--onda-muted)]" htmlFor="campaign-message">
                      Texto que verá el cliente
                    </label>
                    {typing ? (
                      <button
                        type="button"
                        onClick={() => handleMessageChange(message || audience.defaultMessage)}
                        className="mt-2 min-h-[88px] w-full rounded-2xl border border-[var(--onda-border)] bg-white px-4 py-3 text-left font-medium text-[var(--onda-ink)]"
                      >
                        {message}
                        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[var(--onda-primary-500)] align-middle" />
                      </button>
                    ) : (
                      <textarea
                        id="campaign-message"
                        value={message}
                        onChange={(e) => handleMessageChange(e.target.value)}
                        rows={3}
                        className="mt-2 w-full resize-none rounded-2xl border border-[var(--onda-border)] bg-white px-4 py-3 font-medium text-[var(--onda-ink)] outline-none transition focus:border-[var(--onda-bridge)]"
                        placeholder="Escribe el mensaje de tu campaña"
                      />
                    )}
                  </div>
                ) : null}

                {step === 3 ? (
                  <div>
                    <h3 className="font-display text-xl font-semibold">Listo para lanzar</h3>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-4 sm:col-span-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
                          Objetivo
                        </p>
                        <p className="mt-1.5 font-display text-lg font-semibold text-[var(--onda-ink)]">
                          {objective}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
                          Audiencia
                        </p>
                        <p className="mt-1 font-display text-3xl font-bold text-[var(--onda-ink)]">
                          104
                        </p>
                        <p className="text-sm text-[var(--onda-muted)]">clientes</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {audience.chips.slice(0, 3).map((chip) => (
                            <span
                              key={chip}
                              className="rounded-full bg-[var(--onda-primary-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--onda-primary-700)]"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
                          Canales
                        </p>
                        <ul className="mt-3 space-y-2">
                          {CHANNELS.map((c) => (
                            <li
                              key={c}
                              className="flex items-center gap-2 text-sm text-[var(--onda-ink)]"
                            >
                              <span className="h-2 w-2 rounded-full bg-[var(--onda-success)]" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-2xl border border-[var(--onda-border)] bg-white p-4 sm:col-span-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
                          Mensaje
                        </p>
                        <p className="mt-2 font-display text-xl font-semibold leading-snug text-[var(--onda-ink)]">
                          “{message || audience.defaultMessage}”
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          <aside className="flex flex-col items-center border-t border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-6 lg:border-l lg:border-t-0">
            <p className="mb-4 self-start text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Preview
            </p>
            <IPhonePreview>
              <LockScreen
                visibleChannels={visibleChannels}
                message={message || audience.defaultMessage}
              />
            </IPhonePreview>

            {launched ? (
              <a
                href={onboardingUrl('PRO')}
                className="mt-5 flex w-full max-w-[280px] items-center justify-center rounded-full bg-[var(--onda-primary-500)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--onda-primary-600)] active:scale-[0.98]"
              >
                Poner mi negocio en la Onda →
              </a>
            ) : (
              <button
                type="button"
                onClick={handleCta}
                className="mt-5 flex w-full max-w-[280px] items-center justify-center rounded-full bg-[var(--onda-primary-500)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--onda-primary-600)] active:scale-[0.98]"
              >
                {ctaLabel}
                {step < 3 ? ' →' : ''}
              </button>
            )}
          </aside>
        </div>
      </motion.div>
    </section>
  );
}
