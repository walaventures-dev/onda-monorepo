'use client';

import {
  formatChargeDate,
  formatCop,
  quotePlan,
  subscriptionCalendar,
  subscriptionChargeDates,
  type BillingPeriod,
  type PlanId,
} from '@onda/shared-utils';

const KIND_LABEL: Record<string, string> = {
  free: 'Gratis',
  paid: 'Pago',
  renewal: 'Pagas',
};

export function SubscriptionCalendar({
  plan,
  billing,
}: {
  plan: PlanId;
  billing: BillingPeriod;
}) {
  const quote = quotePlan(plan, billing);
  const months = subscriptionCalendar(billing);
  const { firstCharge, nextCharge } = subscriptionChargeDates(billing);
  const firstLabel = formatChargeDate(firstCharge);
  const nextLabel = formatChargeDate(nextCharge);
  const sameCharge = firstCharge.getTime() === nextCharge.getTime();

  return (
    <div className="rounded-2xl bg-[var(--onda-bg)] px-4 py-4 ring-1 ring-[var(--onda-border)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
        Tu suscripción
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--onda-ink)]">
        Este mes no pagas.{' '}
        {billing === 'monthly' ? (
          <>
            El primer cobro es el {firstLabel} ({formatCop(quote.monthlyList)}
            ). Luego, cada mes.
          </>
        ) : (
          <>
            El primer cobro es el {firstLabel} por {quote.paidMonths} meses (
            {formatCop(quote.total)}). El siguiente, el {nextLabel}.
          </>
        )}
      </p>
      {!sameCharge && billing !== 'monthly' ? (
        <p className="mt-1 text-xs text-[var(--onda-muted)]">
          Recibes {quote.serviceMonths} meses de servicio · 1 mes gratis +{' '}
          {quote.paidMonths} pagos.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {months.map((m) => {
          const tone =
            m.kind === 'free'
              ? 'bg-[color-mix(in_srgb,var(--onda-success)_16%,white)] text-[var(--onda-success)] ring-[color-mix(in_srgb,var(--onda-success)_28%,white)]'
              : m.kind === 'renewal'
                ? 'bg-[var(--onda-violet-soft)] text-[var(--onda-violet)] ring-[var(--onda-violet)]'
                : 'bg-[var(--onda-card)] text-[var(--onda-ink)] ring-[var(--onda-border)]';
          return (
            <div
              key={m.key}
              className={`flex min-w-[3.25rem] flex-1 flex-col items-center rounded-xl px-1.5 py-2 ring-1 ${tone}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
                {m.label}
              </span>
              <span className="mt-0.5 text-[10px] font-medium">
                {KIND_LABEL[m.kind]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
