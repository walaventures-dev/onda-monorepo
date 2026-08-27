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
  referred = false,
}: {
  plan: PlanId;
  billing: BillingPeriod;
  referred?: boolean;
}) {
  const quote = quotePlan(plan, billing);
  const { firstCharge, nextCharge, firstIntervalDays, renewIntervalDays } =
    subscriptionChargeDates(billing, new Date(), { referred });
  const firstLabel = formatChargeDate(firstCharge);
  const nextLabel = formatChargeDate(nextCharge);

  const milestones = [
    {
      label: 'Ahora',
      value: `Pagas ${formatCop(quote.total)}`,
      tone: 'next' as const,
    },
    {
      label: 'Próximo cobro',
      value: `${nextLabel} · +${firstIntervalDays}d`,
      tone: 'later' as const,
    },
    {
      label: 'Después',
      value: `Cada ${renewIntervalDays} días`,
      tone: 'later' as const,
    },
  ];

  return (
    <div className="rounded-2xl bg-[var(--onda-bg)] px-4 py-4 ring-1 ring-[var(--onda-border)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
        Cómo funciona el cobro
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--onda-ink)]">
        Cobras hoy {formatCop(quote.total)}. El siguiente cobro es el {nextLabel}{' '}
        (+{firstIntervalDays} días
        {referred ? ', incluye +30 por referido' : ', incluye +30 de regalo'}).
        Luego cada {renewIntervalDays} días. Activación el {firstLabel}.
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
