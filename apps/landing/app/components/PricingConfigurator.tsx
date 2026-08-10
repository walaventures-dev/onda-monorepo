'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { CheckIcon as Check } from '@phosphor-icons/react/dist/csr/Check';
import { ShieldCheckIcon as ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { fadeUp } from '../lib/motion';
import {
  formatCop,
  onboardingUrl,
  quotePlan,
  type BillingPeriod,
  type PlanId,
} from '../lib/pricing';
import { KitVisual } from './mocks/KitVisual';
import { ProductPhoto } from './ProductPhoto';

const PLAN_TABS: { id: PlanId; label: string }[] = [
  { id: 'BASIC', label: 'Onda' },
  { id: 'PRO', label: 'Onda Pro' },
];

const BILLING_TABS: { id: BillingPeriod; label: string; hint?: string }[] = [
  { id: 'monthly', label: 'Mensual' },
  { id: '6', label: '6 meses', hint: 'Ahorra 12%' },
  { id: '12', label: '12 meses', hint: 'Ahorra 17%' },
];

export function PricingConfigurator() {
  const [plan, setPlan] = useState<PlanId>('PRO');
  const [billing, setBilling] = useState<BillingPeriod>('12');
  const quote = useMemo(() => quotePlan(plan, billing), [plan, billing]);

  const included = [
    `${quote.months === 1 ? '1 mes' : `${quote.months} meses`} de servicio`,
    quote.includesKit ? 'Kit Onda físico' : 'Activación digital',
    'Sin costo de activación',
  ];

  return (
    <section id="arma" className="bg-[var(--onda-bg)] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div {...fadeUp} className="max-w-2xl">
          <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-[var(--onda-ink)]">
            Arma tu Onda
          </h2>
          <p className="mt-3 text-lg text-[var(--onda-muted)]">
            Elige plan y periodo. El precio y lo incluido se actualizan al instante.
          </p>
        </motion.div>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <motion.div {...fadeUp} className="relative min-h-[280px] rounded-[1.5rem] border border-[var(--onda-border)] bg-[var(--onda-card)] p-8">
            <ProductPhoto
              src="/product/kit.png"
              alt="Kit Onda físico"
              width={480}
              height={360}
              className="mx-auto h-56 w-auto object-contain"
              fallback={<KitVisual className="mx-auto h-56 w-full max-w-sm" />}
            />
            <p className="mt-4 text-center text-sm text-[var(--onda-muted)]">
              {quote.includesKit
                ? 'Kit incluido en planes de 6 y 12 meses'
                : 'Pasa a 6 o 12 meses y lleva el Kit Onda'}
            </p>
          </motion.div>

          <motion.div
            {...fadeUp}
            className="rounded-[1.5rem] border border-[var(--onda-border)] bg-[var(--onda-card)] p-6 shadow-[0_16px_40px_rgba(26,27,46,0.06)] md:p-8"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              1. Elige tu plan
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PLAN_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPlan(t.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    plan === t.id
                      ? 'bg-[var(--onda-primary-500)] text-white'
                      : 'bg-[var(--onda-bg)] text-[var(--onda-muted)] hover:text-[var(--onda-ink)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              2. Elige tu pago
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {BILLING_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setBilling(t.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    billing === t.id
                      ? 'bg-[var(--onda-primary-500)] text-white'
                      : 'bg-[var(--onda-bg)] text-[var(--onda-muted)] hover:text-[var(--onda-ink)]'
                  }`}
                >
                  {t.label}
                  {t.hint && billing !== t.id ? (
                    <span className="ml-1 text-[10px] font-medium opacity-80">{t.hint}</span>
                  ) : null}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${plan}-${billing}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="mt-8 rounded-2xl bg-[var(--onda-bg)] p-5"
              >
                <p className="text-sm text-[var(--onda-muted)]">
                  {plan === 'PRO' ? 'Onda Pro' : 'Onda'}{' '}
                  <strong className="text-[var(--onda-ink)]">{quote.periodLabel}</strong>
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <p className="font-display text-4xl font-bold text-[var(--onda-primary-500)]">
                    {formatCop(quote.monthlyEffective)}
                    <span className="text-base font-normal text-[var(--onda-muted)]"> / mes</span>
                  </p>
                  {quote.discount > 0 ? (
                    <p className="pb-1 text-sm text-[var(--onda-muted)] line-through">
                      {formatCop(quote.monthlyList)}
                    </p>
                  ) : null}
                </div>
                {quote.months > 1 ? (
                  <p className="mt-1 text-sm text-[var(--onda-muted)]">
                    Total {quote.months} meses: {formatCop(quote.total)}
                  </p>
                ) : null}
                {quote.savings > 0 ? (
                  <span className="mt-3 inline-flex rounded-full bg-[color-mix(in_srgb,var(--onda-success)_16%,white)] px-3 py-1 text-xs font-semibold text-[var(--onda-success)]">
                    Ahorras {formatCop(quote.savings)}
                  </span>
                ) : null}

                <ul className="mt-5 space-y-2">
                  {included.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-[var(--onda-ink)]">
                      <Check size={16} className="text-[var(--onda-primary-500)]" weight="bold" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={onboardingUrl(plan)}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[var(--onda-primary-500)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(5,45,222,0.28)] transition hover:bg-[var(--onda-primary-600)] active:scale-[0.98]"
              >
                Poner mi negocio en la Onda
              </a>
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--onda-muted)]">
                <ShieldCheck size={16} className="text-[var(--onda-success)]" weight="fill" />
                Pago 100% seguro
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
