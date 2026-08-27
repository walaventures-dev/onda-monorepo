'use client';

import { useMemo } from 'react';
import { CheckIcon as Check } from '@phosphor-icons/react/dist/csr/Check';
import { GiftIcon as Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { PackageIcon as Package } from '@phosphor-icons/react/dist/csr/Package';
import { CreditCardIcon as CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';
import {
  formatCop,
  PLAN_META,
  quotePlan,
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
  { id: 'monthly', label: 'Mensual', hint: '+30 días' },
  { id: '6', label: '6 meses', hint: '+30 días' },
  { id: '12', label: '12 meses', hint: '+30 días' },
];

export function PlanPicker({
  plan,
  billing,
  onPlan,
  onBilling,
  referred = false,
  compact = false,
}: {
  plan: PlanId;
  billing: BillingPeriod;
  onPlan: (plan: PlanId) => void;
  onBilling: (billing: BillingPeriod) => void;
  referred?: boolean;
  compact?: boolean;
}) {
  const quotes = useMemo(
    () => ({
      BASIC: quotePlan('BASIC', billing),
      PRO: quotePlan('PRO', billing),
    }),
    [billing]
  );
  const includesKit = billing !== 'monthly';
  const selectedQuote = quotes[plan];

  return (
    <div className={`space-y-6 ${compact ? 'pb-0' : 'pb-2'}`}>
      <div className="flex flex-col items-center gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
          ¿Cómo quieres pagar?
        </p>
        <div className="flex flex-wrap justify-center gap-2 rounded-full bg-[var(--onda-bg)] p-1.5 ring-1 ring-[var(--onda-border)]">
          {BILLING_TABS.map((t) => {
            const active = billing === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onBilling(t.id)}
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
        <p className="inline-flex items-center gap-1.5 text-center text-sm text-[var(--onda-muted)]">
          <CreditCard
            size={16}
            className="shrink-0 text-[var(--onda-primary-500)]"
            weight="fill"
          />
          Pagas hoy {formatCop(selectedQuote.total)}. Próximo cobro en{' '}
          {referred
            ? selectedQuote.referredFirstIntervalDays
            : selectedQuote.firstIntervalDays}{' '}
          días.
        </p>
        <p className="inline-flex items-start justify-center gap-1.5 text-center text-sm text-[var(--onda-muted)]">
          <Package
            size={16}
            className="mt-0.5 shrink-0 text-[var(--onda-success)]"
            weight="fill"
          />
          <span>
            {includesKit
              ? 'Con tu primer pago te llega el Kit a tu negocio, con NFC + QR.'
              : 'Activación digital ya. El Kit NFC + QR viene en planes de 6 o 12 meses.'}
          </span>
        </p>
        {billing !== 'monthly' ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-[var(--onda-muted)]">
            <Gift size={16} className="text-[var(--onda-success)]" weight="fill" />
            Descuento por prepago · +30 días hasta el siguiente cobro
          </p>
        ) : null}
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
                  {selected ? <Check size={12} weight="bold" /> : null}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <p className="font-display text-2xl font-semibold text-[var(--onda-primary-500)]">
                  {formatCop(quote.monthlyEffective)}
                  <span className="text-sm font-normal text-[var(--onda-muted)]">
                    {' '}
                    / mes
                  </span>
                </p>
                {quote.discount > 0 ? (
                  <p className="pb-0.5 text-xs text-[var(--onda-muted)] line-through">
                    {formatCop(quote.monthlyList)}
                  </p>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs text-[var(--onda-muted)]">
                Hoy pagas {formatCop(quote.total)}
                {quote.paidMonths > 1
                  ? ` (${quote.paidMonths} meses)`
                  : ''}{' '}
                · siguiente cobro en {quote.firstIntervalDays} días
              </p>
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

      {!compact ? (
        <SubscriptionCalendar
          plan={plan}
          billing={billing}
          referred={referred}
        />
      ) : null}
    </div>
  );
}
