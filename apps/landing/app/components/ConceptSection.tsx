'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { OndaScriptMark } from '@onda/shared-ui';
import { useRef } from 'react';
import { fadeUp } from '../lib/motion';

export function ConceptSection() {
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const waveScale = useTransform(scrollYProgress, [0.2, 0.6], [0.7, 1.15]);
  const waveOpacity = useTransform(scrollYProgress, [0.15, 0.45], [0.35, 1]);

  return (
    <section ref={ref} className="relative overflow-hidden bg-[var(--onda-card)] py-20 md:py-28">
      <OndaScriptMark className="pointer-events-none absolute -right-8 top-8 h-24 w-auto opacity-[0.08] md:h-36" />
      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div {...fadeUp}>
          <h2 className="font-display text-[clamp(2rem,6vw,4rem)] font-bold leading-[1.05] tracking-tight text-[var(--onda-ink)]">
            <span className="text-[var(--onda-muted)] line-through decoration-[var(--onda-danger)] decoration-2">
              Puntos.
            </span>{' '}
            <span className="text-[var(--onda-muted)] line-through decoration-[var(--onda-danger)] decoration-2">
              Pesos.
            </span>
            <br />
            <span className="text-[var(--onda-primary-500)]">No. Ondas.</span>
          </h2>
        </motion.div>

        <div className="mt-10 grid items-center gap-10 md:grid-cols-[1fr_1.1fr]">
          <motion.div style={{ scale: waveScale, opacity: waveOpacity }} className="origin-left">
            <svg viewBox="0 0 320 120" className="w-full max-w-md" aria-hidden>
              <path
                d="M10 80c30-50 70-50 100 0s70 50 100 0 70-50 100 0"
                fill="none"
                stroke="var(--onda-primary-200)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M10 60c30-50 70-50 100 0s70 50 100 0 70-50 100 0"
                fill="none"
                stroke="var(--onda-sky)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M10 40c30-50 70-50 100 0s70 50 100 0 70-50 100 0"
                fill="none"
                stroke="var(--onda-primary-500)"
                strokeWidth="8"
                strokeLinecap="round"
              />
            </svg>
          </motion.div>

          <ul className="space-y-5 text-[var(--onda-muted)]">
            <li className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--onda-primary-500)]" />
              <p>
                Una Onda no es moneda ni saldo: es progreso medible hacia una recompensa que
                tú defines.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--onda-sky)]" />
              <p>
                El cliente la ve en Wallet. Tú la usas para traerlo de vuelta cuando quieres
                vender.
              </p>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
