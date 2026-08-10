'use client';

import { motion } from 'framer-motion';
import { CheckIcon as Check } from '@phosphor-icons/react/dist/csr/Check';
import { fadeUp } from '../lib/motion';
import { formatCop, onboardingUrl, PLAN_META, PLAN_MONTHLY, type PlanId } from '../lib/pricing';

const ORDER: PlanId[] = ['BASIC', 'PRO'];

export function PricingCards() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <motion.div {...fadeUp} className="max-w-2xl">
        <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-[var(--onda-ink)]">
          Elige tu Onda.
        </h2>
        <p className="mt-3 text-lg text-[var(--onda-muted)]">
          Empieza simple o potencia tu canal de retorno con Pro.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr_auto]">
        {ORDER.map((id) => {
          const meta = PLAN_META[id];
          const popular = id === 'PRO';
          return (
            <motion.div
              key={id}
              {...fadeUp}
              whileHover={{ y: -4, scale: 1.01 }}
              className={`relative flex flex-col rounded-[1.5rem] border bg-[var(--onda-card)] p-8 shadow-[0_16px_40px_rgba(26,27,46,0.06)] ${
                popular
                  ? 'border-[var(--onda-primary-500)] ring-1 ring-[var(--onda-primary-500)]'
                  : 'border-[var(--onda-border)]'
              }`}
            >
              {popular ? (
                <span className="absolute -top-3 left-6 rounded-full bg-[var(--onda-primary-500)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                  Más popular
                </span>
              ) : null}
              <h3 className="font-display text-2xl font-semibold text-[var(--onda-ink)]">
                {meta.name}
              </h3>
              <p className="mt-3 font-display text-4xl font-bold text-[var(--onda-primary-500)]">
                {formatCop(PLAN_MONTHLY[id])}
                <span className="text-base font-normal text-[var(--onda-muted)]"> / mes</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {meta.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-[var(--onda-muted)]">
                    <Check
                      size={18}
                      className="mt-0.5 shrink-0 text-[var(--onda-primary-500)]"
                      weight="bold"
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={onboardingUrl(id)}
                className={`mt-8 flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                  popular
                    ? 'bg-[var(--onda-primary-500)] text-white shadow-[0_10px_24px_rgba(5,45,222,0.28)] hover:bg-[var(--onda-primary-600)]'
                    : 'border border-[var(--onda-primary-500)] text-[var(--onda-primary-500)] hover:bg-[var(--onda-primary-50)]'
                }`}
              >
                Empezar con {meta.shortName}
              </a>
            </motion.div>
          );
        })}

        <motion.aside
          {...fadeUp}
          className="flex max-w-xs flex-col justify-center rounded-[1.5rem] bg-[var(--onda-primary-50)] p-6 text-[var(--onda-ink)] lg:max-w-[200px]"
        >
          <p className="font-display text-lg font-semibold leading-snug">
            Por solo {formatCop(20_000)} más
          </p>
          <p className="mt-3 text-sm text-[var(--onda-muted)]">
            Onda Pro se convierte en tu mejor canal para traer clientes de vuelta.
          </p>
        </motion.aside>
      </div>
    </section>
  );
}
