'use client';

import { OndaScriptMark } from '@onda/shared-ui';
import { fadeUp } from '../lib/motion';
import { motion } from 'framer-motion';

export function ConceptSection() {
  return (
    <section className="relative z-10 overflow-visible pt-36 text-white md:pt-48 lg:pt-56">
      {/* Franja azul: ella a ras del borde inferior; la cabeza sobresale por arriba */}
      <div className="relative overflow-visible bg-[var(--onda-primary-500)]">
        <OndaScriptMark
          variant="onPrimary"
          className="pointer-events-none absolute -left-4 top-4 z-0 h-16 w-auto opacity-[0.1] md:h-24"
        />

        <div className="relative mx-auto max-w-6xl px-6 py-12 md:py-14 lg:py-16">
          <div className="relative z-10 max-w-xl md:max-w-[52%] lg:max-w-xl">
            <motion.div {...fadeUp}>
              <h2 className="font-display text-[clamp(2rem,5.5vw,3.75rem)] font-bold leading-[1.05] tracking-tight">
                Ni{' '}
                <span className="text-white/55 line-through decoration-[var(--onda-lime)] decoration-2">
                  puntos
                </span>{' '}
                ni{' '}
                <span className="text-white/55 line-through decoration-[var(--onda-lime)] decoration-2">
                  pesos
                </span>
                .
                <br />
                <span>Ondas.</span>
              </h2>
            </motion.div>

            <motion.div
              {...fadeUp}
              className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-5 md:grid-cols-1 md:gap-7 lg:max-w-lg"
            >
              <div className="relative pl-4 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-full before:bg-[var(--onda-lime)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--onda-lime)]">
                  Qué es
                </p>
                <p className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight">
                  Progreso, no saldo
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  Una Onda no es moneda: es el camino medible hacia la recompensa que tú defines.
                </p>
              </div>

              <div className="relative pl-4 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-full before:bg-white/55">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                  Para qué sirve
                </p>
                <p className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight">
                  Traer al cliente de vuelta
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  Él la ve en Wallet. Tú la usas para vender de nuevo, cuando te conviene.
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Anclada al borde inferior de la franja (fuera del padding del contenido) */}
        <motion.div
          {...fadeUp}
          className="pointer-events-none absolute bottom-0 right-4 z-20 w-[min(88%,20rem)] sm:right-8 sm:w-[22rem] md:right-[max(1.5rem,calc((100%-72rem)/2+1.5rem))] md:w-[26rem] lg:w-[28rem]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/product/reward-moment.png"
            alt="Cliente celebrando una recompensa canjeada en Onda"
            className="block h-auto w-full origin-bottom select-none drop-shadow-[0_24px_48px_rgba(5,20,80,0.4)]"
            draggable={false}
          />
        </motion.div>
      </div>
    </section>
  );
}
