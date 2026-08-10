'use client';

import { motion } from 'framer-motion';
import { fadeUp } from '../lib/motion';
import { PhoneFrame } from './mocks/PhoneFrame';

export function ChannelsSection() {
  return (
    <section className="bg-[var(--onda-card)] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-[var(--onda-ink)]">
            Habla cuando importa. Vende cuando quieres.
          </h2>
        </motion.div>

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr]">
          <motion.div {...fadeUp} className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--onda-primary-500)]">
              Cuando Onda necesita hablar
            </p>
            <ul className="space-y-3 text-[var(--onda-muted)]">
              {[
                'Acumulaste una Onda',
                'Recompensa desbloqueada',
                'Canje confirmado',
                'Recordatorio de visita',
              ].map((t) => (
                <li
                  key={t}
                  className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-3 text-sm text-[var(--onda-ink)]"
                >
                  {t}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div {...fadeUp} className="relative mx-auto">
            <PhoneFrame className="w-[200px]">
              <div className="flex h-full flex-col bg-[#111827] px-3 pb-4 pt-10">
                <div className="rounded-2xl bg-white/95 p-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--onda-primary-500)] text-[10px] font-bold text-white">
                      CC
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-[var(--onda-ink)]">Café Central</p>
                      <p className="text-[10px] text-[var(--onda-muted)]">ahora</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--onda-ink)]">
                    ¡Tienes un café gratis esperándote! Acerca tu celular en el local.
                  </p>
                </div>
                <p className="mt-auto text-center text-[10px] text-white/40">Pantalla de bloqueo</p>
              </div>
            </PhoneFrame>
          </motion.div>

          <motion.div {...fadeUp} className="space-y-4 lg:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--onda-sky)]">
              Y cuando tú quieres vender
            </p>
            <ul className="space-y-3 text-[var(--onda-muted)]">
              {[
                'Lanzamiento de temporada',
                'Días especiales',
                'Reactivación de inactivos',
                'Cross-sell de menú',
              ].map((t) => (
                <li
                  key={t}
                  className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-3 text-sm text-[var(--onda-ink)] lg:ml-auto lg:max-w-xs"
                >
                  {t}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
