'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { CheckIcon as Check } from '@phosphor-icons/react/dist/csr/Check';
import { GiftIcon as Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { PackageIcon as Package } from '@phosphor-icons/react/dist/csr/Package';
import { ShieldCheckIcon as ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { fadeUp } from '../lib/motion';
import {
  formatCop,
  onboardingUrl,
  PLAN_META,
  quotePlan,
  type BillingPeriod,
  type PlanId,
} from '../lib/pricing';
import { KitVisual } from './mocks/KitVisual';

const ORDER: PlanId[] = ['BASIC', 'PRO'];

const BILLING_TABS: {
  id: BillingPeriod;
  label: string;
  hint?: string;
}[] = [
  { id: 'monthly', label: 'Mensual' },
  { id: '6', label: '6 meses', hint: '+ mes gratis' },
  { id: '12', label: '12 meses', hint: '+ mes gratis' },
];

export function PricingSection() {
  const [billing, setBilling] = useState<BillingPeriod>('12');

  const quotes = useMemo(
    () => ({
      BASIC: quotePlan('BASIC', billing),
      PRO: quotePlan('PRO', billing),
    }),
    [billing],
  );

  const includesKit = billing !== 'monthly';

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-[var(--onda-ink)]">
          Planes que se pagan solos
        </h2>
        <p className="mt-3 text-lg text-[var(--onda-muted)]">
          Primer mes gratis. Elige plan y periodo — sin tarjeta para empezar.
        </p>
      </motion.div>

      <motion.div
        {...fadeUp}
        className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-3"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
          ¿Cómo quieres pagar?
        </p>
        <div className="flex flex-wrap justify-center gap-2 rounded-full bg-[var(--onda-card)] p-1.5 shadow-[0_8px_24px_rgba(26,27,46,0.06)] ring-1 ring-[var(--onda-border)]">
          {BILLING_TABS.map((t) => {
            const active = billing === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setBilling(t.id)}
                className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-[var(--onda-primary-500)] text-white shadow-[0_8px_18px_rgba(5,45,222,0.22)]'
                    : 'text-[var(--onda-muted)] hover:text-[var(--onda-ink)]'
                }`}
              >
                {t.label}
                {t.hint ? (
                  <span
                    className={`ml-1.5 text-[10px] font-medium ${
                      active ? 'text-white/80' : 'text-[var(--onda-sky)]'
                    }`}
                  >
                    {t.hint}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-1 flex flex-col items-center gap-2">
          <p className="inline-flex max-w-lg items-start justify-center gap-1.5 text-center text-sm text-[var(--onda-muted)]">
            <ShieldCheck
              size={16}
              className="mt-0.5 shrink-0 text-[var(--onda-success)]"
              weight="fill"
            />
            <span>No necesitas tarjeta de crédito para iniciar.</span>
          </p>

          <AnimatePresence mode="wait">
            <motion.p
              key={includesKit ? `kit-${billing}` : 'digital'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="inline-flex max-w-lg items-start justify-center gap-1.5 text-center text-sm text-[var(--onda-muted)]"
            >
              <Package
                size={16}
                className="mt-0.5 shrink-0 text-[var(--onda-success)]"
                weight="fill"
              />
              <span>
                {includesKit
                  ? 'Con tu primer pago te llega el Kit a tu negocio, con NFC + QR listos para usar.'
                  : 'Activación digital ya. El Kit NFC + QR viene en planes de 6 o 12 meses.'}
              </span>
            </motion.p>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {billing !== 'monthly' ? (
              <motion.p
                key={billing}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--onda-muted)]"
              >
                <Gift size={16} className="text-[var(--onda-success)]" weight="fill" />
                Descuento + 1 mes gratis adicional ·{' '}
                {billing === '6' ? '7 meses' : '13 meses'} de servicio
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {ORDER.map((id) => {
          const meta = PLAN_META[id];
          const quote = quotes[id];
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

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${id}-${billing}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="mt-4"
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <p className="font-display text-4xl font-bold text-[var(--onda-primary-500)]">
                      {formatCop(quote.monthlyEffective)}
                      <span className="text-base font-normal text-[var(--onda-muted)]">
                        {' '}
                        / mes
                      </span>
                    </p>
                    {quote.discount > 0 ? (
                      <p className="pb-1 text-sm text-[var(--onda-muted)] line-through">
                        {formatCop(quote.monthlyList)}
                      </p>
                    ) : null}
                  </div>

                  {billing === 'monthly' ? (
                    <p className="mt-2 text-sm text-[var(--onda-muted)]">
                      Primer mes gratis · después {formatCop(quote.monthlyList)}/mes
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--onda-muted)]">
                      Pagas {quote.paidMonths} meses ({formatCop(quote.total)}) ·{' '}
                      <span className="font-medium text-[var(--onda-success)]">
                        recibes {quote.serviceMonths} meses
                      </span>
                    </p>
                  )}

                  {quote.discountSavings > 0 ? (
                    <span className="mt-3 inline-flex rounded-full bg-[color-mix(in_srgb,var(--onda-success)_16%,white)] px-3 py-1 text-xs font-semibold text-[var(--onda-success)]">
                      Ahorras {formatCop(quote.discountSavings)} + 1 mes gratis
                    </span>
                  ) : (
                    <span className="mt-3 inline-flex rounded-full bg-[color-mix(in_srgb,var(--onda-success)_16%,white)] px-3 py-1 text-xs font-semibold text-[var(--onda-success)]">
                      1er mes gratis
                    </span>
                  )}
                </motion.div>
              </AnimatePresence>

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
                {quote.includesKit ? (
                  <li className="flex gap-2 text-sm font-medium text-[var(--onda-ink)]">
                    <Package
                      size={18}
                      className="mt-0.5 shrink-0 text-[var(--onda-primary-500)]"
                      weight="bold"
                    />
                    <span>Kit físico con NFC + QR · te llega con tu primer pago</span>
                  </li>
                ) : null}
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
      </div>

      <motion.div
        {...fadeUp}
        className="mt-16 grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]"
      >
        <KitVisual />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--onda-primary-500)]">
            Kit de bienvenida
          </p>
          <h3 className="mt-2 font-display text-[clamp(1.5rem,3vw,2.1rem)] font-bold tracking-tight text-[var(--onda-ink)]">
            Todo listo para poner Onda en tu local
          </h3>
          <p className="mt-3 text-[var(--onda-muted)]">
            Incluido en planes de 6 o 12 meses. Llega con tu primer pago — NFC y QR
            configurados para empezar a acumular Ondas desde el mostrador.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-[var(--onda-ink)]">
            {[
              'Hablador NFC + QR para el mostrador',
              'Señalética “Pague aquí” / acerca tu celular',
              'Caja y materiales de marca Onda',
              'Stickers y piezas para vitrina o barra',
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check
                  size={18}
                  className="mt-0.5 shrink-0 text-[var(--onda-primary-500)]"
                  weight="bold"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-[var(--onda-muted)]">
            En el plan mensual la activación es digital; el Kit físico está disponible al
            pasar a 6 o 12 meses.
          </p>
        </div>
      </motion.div>

      <motion.p
        {...fadeUp}
        className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-[var(--onda-muted)]"
      >
        <ShieldCheck size={14} className="text-[var(--onda-success)]" weight="fill" />
        Sin tarjeta para empezar
        {includesKit
          ? ' · el Kit llega con tu primer pago'
          : ' · activación digital (Kit en planes de 6 o 12 meses)'}
      </motion.p>
    </section>
  );
}
