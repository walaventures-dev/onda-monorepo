'use client';

import {
  formatChargeDate,
  formatCop,
  quotePlan,
  subscriptionChargeDates,
  type BillingPeriod,
  type PlanId,
} from '@onda/shared-utils';

export function SubscriptionCalendar({
  plan,
  billing,
}: {
  plan: PlanId;
  billing: BillingPeriod;
}) {
  const quote = quotePlan(plan, billing);
  const { firstCharge, nextCharge } = subscriptionChargeDates(billing);
  const firstLabel = formatChargeDate(firstCharge);
  const nextLabel = formatChargeDate(nextCharge);

  const milestones =
    billing === 'monthly'
      ? [
          { label: 'Ahora', value: 'Mes gratis', tone: 'free' as const },
          {
            label: 'Primer cobro',
            value: `${firstLabel} · ${formatCop(quote.monthlyList)}`,
            tone: 'next' as const,
          },
          { label: 'Después', value: 'Cada mes', tone: 'later' as const },
        ]
      : [
          { label: 'Ahora', value: 'Mes gratis', tone: 'free' as const },
          {
            label: 'Cubierto',
            value: `${quote.serviceMonths} meses de servicio`,
            tone: 'later' as const,
          },
          {
            label: 'Siguiente cobro',
            value: nextLabel,
            tone: 'next' as const,
          },
        ];

  return (
    <div className="rounded-2xl bg-[var(--onda-bg)] px-4 py-4 ring-1 ring-[var(--onda-border)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
        Cómo funciona el cobro
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--onda-ink)]">
        {billing === 'monthly' ? (
          <>
            Este mes no pagas. El {firstLabel} son{' '}
            {formatCop(quote.monthlyList)} y sigue mensual.
          </>
        ) : (
          <>
            Este mes no pagas. El {firstLabel} cubres {quote.paidMonths} meses (
            {formatCop(quote.total)}) y recibes {quote.serviceMonths}. El
            siguiente cobro es el {nextLabel}.
          </>
        )}
      </p>

      <ol className="mt-4 grid grid-cols-3 gap-2">
        {milestones.map((m, i) => {
          const tone =
            m.tone === 'free'
              ? 'bg-[color-mix(in_srgb,var(--onda-success)_16%,white)] text-[var(--onda-success)]'
              : m.tone === 'next'
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
