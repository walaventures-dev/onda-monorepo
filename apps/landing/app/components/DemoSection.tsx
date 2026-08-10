'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { fadeUp } from '../lib/motion';
import { PhoneFrame } from './mocks/PhoneFrame';

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full"
          style={{
            left: `${8 + ((i * 17) % 84)}%`,
            top: `${10 + ((i * 29) % 60)}%`,
            background: i % 3 === 0 ? '#DDF24E' : i % 3 === 1 ? '#3DB9E8' : '#ffffff',
            animation: `onda-confetti 1.2s ease-out ${i * 0.04}s both`,
          }}
        />
      ))}
    </div>
  );
}

function DemoScreen({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className="flex h-full flex-col bg-[#0B1220] px-4 pb-5 pt-10 text-white">
        <p className="text-xs text-white/60">Café Central</p>
        <div className="mt-6 rounded-2xl bg-white/8 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">Ondas</p>
          <p className="font-display text-5xl font-bold">4</p>
          <div className="mt-3 h-2 rounded-full bg-white/10">
            <div className="h-full w-4/5 rounded-full bg-[var(--onda-sky)]" />
          </div>
        </div>
        <button
          type="button"
          className="mt-auto rounded-full bg-[var(--onda-primary-500)] py-3 text-xs font-bold tracking-wide"
        >
          + DAR UNA ONDA
        </button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="relative flex h-full flex-col bg-[#0B1220] px-4 pb-5 pt-10 text-white">
        <Confetti />
        <p className="text-xs text-white/60">Café Central</p>
        <div className="mt-6 rounded-2xl bg-white/8 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">Ondas</p>
          <p className="font-display text-5xl font-bold text-[var(--onda-sky)]">5</p>
          <p className="mt-3 text-sm font-semibold text-[var(--onda-lime)]">
            ¡Recompensa desbloqueada!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0B1220] px-4 pb-5 pt-10 text-white">
      <div className="mt-8 rounded-2xl bg-white p-4 text-[var(--onda-ink)]">
        <div className="mx-auto h-20 w-20 rounded-full bg-[var(--onda-primary-100)]" />
        <p className="mt-4 text-center font-display text-base font-semibold">
          ¡Felicidades!
        </p>
        <p className="mt-1 text-center text-sm text-[var(--onda-muted)]">
          Tienes un café gratis
        </p>
      </div>
      <button
        type="button"
        className="mt-auto rounded-full bg-[var(--onda-primary-500)] py-3 text-xs font-bold"
      >
        Ver recompensa
      </button>
    </div>
  );
}

export function DemoSection() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % 3);
    }, 2600);
    return () => window.clearInterval(id);
  }, [paused]);

  const advance = () => {
    setPaused(true);
    setStep((s) => (s + 1) % 3);
    window.setTimeout(() => setPaused(false), 4000);
  };

  return (
    <section id="demo" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <motion.div {...fadeUp} className="max-w-2xl">
        <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-[var(--onda-ink)]">
          Ahora dale una Onda
        </h2>
        <p className="mt-3 text-lg text-[var(--onda-muted)]">
          Acerca el celular o escanea el QR. El cliente acumula, desbloquea y vuelve.
        </p>
      </motion.div>

      <div className="mt-12 grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.button
          type="button"
          onClick={advance}
          className="relative mx-auto flex h-56 w-56 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-primary-500)]"
          aria-label="Simular acercar celular"
          whileTap={{ scale: 0.97 }}
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--onda-primary-100)] opacity-40" />
          <span className="absolute inset-4 rounded-full border-2 border-[var(--onda-primary-200)]" />
          <span className="absolute inset-10 rounded-full border border-[var(--onda-primary-300)]" />
          <span className="relative z-10 flex h-20 w-20 flex-col items-center justify-center rounded-full bg-[var(--onda-primary-500)] text-white shadow-[0_12px_30px_rgba(5,45,222,0.35)]">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path
                d="M7 14c3.5-3.5 10.5-3.5 14 0M10 17c2-2 6-2 8 0M13 20c1-1 3-1 4 0"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="14" cy="22.5" r="1.25" fill="white" />
            </svg>
          </span>
          <span className="absolute -bottom-10 text-center text-sm font-medium text-[var(--onda-muted)]">
            Acerca tu celular o escanea el QR
          </span>
        </motion.button>

        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-4">
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -24, scale: 0.98 }}
                transition={{ duration: 0.35 }}
              >
                <PhoneFrame>
                  <DemoScreen step={step} />
                </PhoneFrame>
              </motion.div>
            </AnimatePresence>
            {step === 0 ? (
              <button
                type="button"
                onClick={advance}
                className="absolute -bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--onda-primary-500)] px-4 py-2 text-xs font-bold text-white shadow-lg active:scale-[0.98]"
              >
                + DAR UNA ONDA
              </button>
            ) : null}
          </div>

          <div className="flex gap-2 sm:flex-col">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Paso ${i + 1}`}
                onClick={() => {
                  setPaused(true);
                  setStep(i);
                  window.setTimeout(() => setPaused(false), 4000);
                }}
                className={`h-2.5 w-2.5 rounded-full transition ${
                  step === i
                    ? 'bg-[var(--onda-primary-500)]'
                    : 'bg-[var(--onda-border)] hover:bg-[var(--onda-primary-200)]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
