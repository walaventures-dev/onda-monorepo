'use client';

import {
  formatChargeDate,
  formatCop,
  quotePlanWithDiscount,
  subscriptionChargeDates,
  type BillingPeriod,
  type PlanId,
} from '@onda/shared-utils';

export function SubscriptionCalendar({
  plan,
  billing,
  discountPercentage = 0,
  referred = false,
}: {
  plan: PlanId;
  billing: BillingPeriod;
  discountPercentage?: number;
  referred?: boolean;
}) {
  const quote = quotePlanWithDiscount(plan, billing, discountPercentage);
  const { firstCharge, nextCharge } = subscriptionChargeDates(billing, new Date(), {
    referred,
  });
  const firstLabel = formatChargeDate(firstCharge);
  const nextLabel = formatChargeDate(nextCharge);

  const milestones =
    billing === 'monthly'
      ? [
          {
            label: 'Hoy',
            value: formatCop(quote.amountDue),
            tone: 'next' as const,
          },
          {
            label: 'Próximo cobro',
            value: nextLabel,
            tone: 'later' as const,
          },
          { label: 'Después', value: 'Cada 30 días', tone: 'later' as const },
        ]
      : [
          {
            label: 'Hoy',
            value: formatCop(quote.amountDue),
            tone: 'next' as const,
          },
          {
            label: 'Cubierto',
            value: `${quote.paidMonths} meses`,
            tone: 'later' as const,
          },
          {
            label: 'Siguiente cobro',
            value: nextLabel,
            tone: 'later' as const,
          },
        ];

  return (
    <div className="rounded-2xl bg-[var(--onda-bg)] px-4 py-4 ring-1 ring-[var(--onda-border)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
        Cómo funciona el cobro
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--onda-ink)]">
        {quote.skipPayment ? (
          <>Activación gratis hoy. El próximo cobro sería el {nextLabel}.</>
        ) : billing === 'monthly' ? (
          <>
            Pagas {formatCop(quote.amountDue)} hoy ({firstLabel}). El próximo
            cobro es el {nextLabel}
            {referred ? ' (+30 días por referido)' : ''}.
          </>
        ) : (
          <>
            Pagas {formatCop(quote.amountDue)} hoy por {quote.paidMonths} meses.
            El siguiente cobro es el {nextLabel}.
          </>
        )}
      </p>

      <ol className="mt-4 grid grid-cols-3 gap-2">
        {milestones.map((m, i) => {
          const tone =
            m.tone === 'next'
              ? 'bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]'
              : 'bg-[var(--onda-card)] text-[var(--onda-ink)] ring-1 ring-[var(--onda-border)]';
          return (
            <li
              key={m.label}
              className={`flex flex-col rounded-xl px-2.5 py-2.5 ${tone}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-80">
                {i + 1}. {m.label}
              </span>
              <span className="mt-1 text-xs font-semibold leading-snug">
                {m.value}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
