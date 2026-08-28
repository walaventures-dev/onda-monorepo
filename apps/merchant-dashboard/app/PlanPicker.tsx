'use client';

import { useEffect, useMemo } from 'react';
import { CheckIcon as Check } from '@phosphor-icons/react/dist/csr/Check';
import { GiftIcon as Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { PackageIcon as Package } from '@phosphor-icons/react/dist/csr/Package';
import { ShieldCheckIcon as ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import {
  formatCop,
  PLAN_META,
  quotePlanWithDiscount,
  type BillingPeriod,
  type PlanId,
} from '@onda/shared-utils';
import { SubscriptionCalendar } from './SubscriptionCalendar';

const ORDER: PlanId[] = ['BASIC', 'PRO'];

const BILLING_TABS: {
  id: BillingPeriod;
  label: string;
  hint?: string;
}[] = [
  { id: 'monthly', label: 'Mensual' },
  { id: '6', label: '6 meses', hint: 'prepago' },
  { id: '12', label: '12 meses', hint: 'prepago' },
];

export function PlanPicker({
  plan,
  billing,
  onPlan,
  onBilling,
  discountPercentage = 0,
  forceMonthlyOnly = false,
  referred = false,
}: {
  plan: PlanId;
  billing: BillingPeriod;
  onPlan: (plan: PlanId) => void;
  onBilling: (billing: BillingPeriod) => void;
  discountPercentage?: number;
  forceMonthlyOnly?: boolean;
  referred?: boolean;
}) {
  const quotes = useMemo(
    () => ({
      BASIC: quotePlanWithDiscount('BASIC', billing, discountPercentage),
      PRO: quotePlanWithDiscount('PRO', billing, discountPercentage),
    }),
    [billing, discountPercentage]
  );
  const activeQuote = quotes[plan];
  const includesKit = billing !== 'monthly';

  useEffect(() => {
    if (forceMonthlyOnly && billing !== 'monthly') {
      onBilling('monthly');
    }
  }, [forceMonthlyOnly, billing, onBilling]);

  return (
    <div className="space-y-6 pb-2">
      {discountPercentage > 0 ? (
        <div className="rounded-2xl bg-[var(--onda-sky-soft)] px-4 py-3 text-sm text-[var(--onda-ink)]">
          <p className="font-medium">
            Descuento del {discountPercentage}% aplicado
          </p>
          {forceMonthlyOnly ? (
            <p className="text-[var(--onda-muted)]">
              Con este descuento solo puedes pagar mensual.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
          ¿Cómo quieres pagar?
        </p>
        <div className="flex flex-wrap justify-center gap-2 rounded-full bg-[var(--onda-bg)] p-1.5 ring-1 ring-[var(--onda-border)]">
          {BILLING_TABS.map((t) => {
            const active = billing === t.id;
            const disabled = forceMonthlyOnly && t.id !== 'monthly';
            return (
              <button
                key={t.id}
                type="button"
                disabled={disabled}
                onClick={() => onBilling(t.id)}
                className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  disabled
                    ? 'cursor-not-allowed opacity-40'
                    : active
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
        <p className="inline-flex items-center gap-1.5 text-center text-sm text-[var(--onda-muted)]">
          <ShieldCheck
            size={16}
            className="shrink-0 text-[var(--onda-success)]"
            weight="fill"
          />
          {activeQuote.skipPayment
            ? 'Total $0 — no necesitas tarjeta.'
            : 'Pagas hoy y guardamos tu tarjeta para renovar.'}
        </p>
        {referred ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-[var(--onda-muted)]">
            <Gift size={16} className="text-[var(--onda-success)]" weight="fill" />
            Referido: +30 días extra en la fecha de cobro al pagar.
          </p>
        ) : null}
        <p className="inline-flex items-start justify-center gap-1.5 text-center text-sm text-[var(--onda-muted)]">
          <Package
            size={16}
            className="mt-0.5 shrink-0 text-[var(--onda-success)]"
            weight="fill"
          />
          <span>
            {includesKit
              ? 'Con tu pago te llega el Kit a tu negocio, con NFC + QR.'
              : 'Activación digital ya. El Kit NFC + QR viene en planes de 6 o 12 meses.'}
          </span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ORDER.map((id) => {
          const meta = PLAN_META[id];
          const quote = quotes[id];
          const selected = plan === id;
          const popular = id === 'PRO';
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPlan(id)}
              className={`relative rounded-2xl border px-5 py-5 text-left transition ${
                selected
                  ? 'border-[var(--onda-primary-500)] bg-[var(--onda-violet-soft)] shadow-[0_8px_20px_rgba(5,45,222,0.12)]'
                  : 'border-[var(--onda-border)] bg-[var(--onda-card)] hover:border-[var(--onda-bridge)]'
              }`}
            >
              {popular ? (
                <span className="absolute -top-2.5 left-4 rounded-full bg-[var(--onda-primary-500)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                  Más popular
                </span>
              ) : null}
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-lg font-semibold text-[var(--onda-ink)]">
                  {meta.name}
                </p>
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    selected
                      ? 'bg-[var(--onda-violet)] text-white'
                      : 'ring-1 ring-[var(--onda-border)]'
                  }`}
                  aria-hidden
                >
                  {selected ? (
                    <Check size={12} weight="bold" />
                  ) : null}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <p className="font-display text-2xl font-semibold text-[var(--onda-primary-500)]">
                  {formatCop(quote.amountDue)}
                  {billing !== 'monthly' ? (
                    <span className="text-sm font-normal text-[var(--onda-muted)]">
                      {' '}
                      total
                    </span>
                  ) : (
                    <span className="text-sm font-normal text-[var(--onda-muted)]">
                      {' '}
                      / mes
                    </span>
                  )}
                </p>
                {quote.promoSavings > 0 || quote.discount > 0 ? (
                  <p className="pb-0.5 text-xs text-[var(--onda-muted)] line-through">
                    {formatCop(quote.total)}
                  </p>
                ) : null}
              </div>
              {billing === 'monthly' ? (
                <p className="mt-1.5 text-xs text-[var(--onda-muted)]">
                  Cobro hoy · próximo pago según calendario
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-[var(--onda-muted)]">
                  Pagas {quote.paidMonths} meses · cubiertos en el periodo
                </p>
              )}
              <ul className="mt-3 space-y-1.5 text-xs text-[var(--onda-muted)]">
                {meta.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex gap-1.5">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--onda-primary-500)]"
                      weight="bold"
                    />
                    <span>{f}</span>
                  </li>
                ))}
                {quote.includesKit ? (
                  <li className="flex gap-1.5 font-medium text-[var(--onda-ink)]">
                    <Package
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--onda-primary-500)]"
                      weight="bold"
                    />
                    <span>Kit físico con NFC + QR</span>
                  </li>
                ) : null}
              </ul>
            </button>
          );
        })}
      </div>

      <SubscriptionCalendar plan={plan} billing={billing} referred={referred} />
    </div>
  );
}
