'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon as ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { BankIcon as Bank } from '@phosphor-icons/react/dist/csr/Bank';
import { CalendarBlankIcon as CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { CheckCircleIcon as CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { CreditCardIcon as CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';
import { MoneyIcon as Money } from '@phosphor-icons/react/dist/csr/Money';
import { PackageIcon as Package } from '@phosphor-icons/react/dist/csr/Package';
import { ReceiptIcon as Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { SealCheckIcon as SealCheck } from '@phosphor-icons/react/dist/csr/SealCheck';
import { WavesIcon as Waves } from '@phosphor-icons/react/dist/csr/Waves';
import { ArrowCounterClockwiseIcon as ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { Button, SkeletonDetail, api } from '@onda/shared-ui';
import { formatCop } from '@onda/shared-utils';
import type { PosSaleDto } from '@onda/shared-types';

function paymentMethodMeta(key: string): {
  label: string;
  icon: ReactNode;
  tone: string;
} {
  const iconCls = 'h-4 w-4 shrink-0';
  if (key === 'cash') {
    return {
      label: 'Efectivo',
      icon: <Money className={iconCls} weight="duotone" aria-hidden />,
      tone: 'bg-[var(--onda-success)]/10 text-[var(--onda-success)]',
    };
  }
  if (key === 'card') {
    return {
      label: 'Tarjeta',
      icon: <CreditCard className={iconCls} weight="duotone" aria-hidden />,
      tone: 'bg-[var(--onda-sky-soft)] text-[var(--onda-sky)]',
    };
  }
  if (key === 'transfer') {
    return {
      label: 'Transferencia',
      icon: <Bank className={iconCls} weight="duotone" aria-hidden />,
      tone: 'bg-[var(--onda-violet-soft)] text-[var(--onda-primary-700)]',
    };
  }
  return {
    label: key,
    icon: <Money className={iconCls} weight="duotone" aria-hidden />,
    tone: 'bg-[var(--onda-bg)] text-[var(--onda-muted)]',
  };
}

function statusMeta(status: string): {
  label: string;
  icon: ReactNode;
  className: string;
} {
  if (status === 'REFUNDED') {
    return {
      label: 'Devuelta',
      icon: (
        <ArrowCounterClockwise className="h-3.5 w-3.5" weight="bold" aria-hidden />
      ),
      className: 'bg-[var(--onda-danger)]/10 text-[var(--onda-danger)]',
    };
  }
  if (status === 'VOID') {
    return {
      label: 'Anulada',
      icon: (
        <ArrowCounterClockwise className="h-3.5 w-3.5" weight="bold" aria-hidden />
      ),
      className: 'bg-[var(--onda-danger)]/10 text-[var(--onda-danger)]',
    };
  }
  return {
    label: 'Completada',
    icon: <CheckCircle className="h-3.5 w-3.5" weight="fill" aria-hidden />,
    className: 'bg-[var(--onda-success)]/10 text-[var(--onda-success)]',
  };
}

export function PosSaleDetail({
  storeId,
  saleId,
}: {
  storeId: string;
  saleId: string;
}) {
  const router = useRouter();
  const [sale, setSale] = useState<
    (PosSaleDto & {
      refunds?: Array<{
        id: string;
        kind: string;
        reason: string | null;
        amount: number;
        ondasReversed: number;
        createdAt: string;
        lines?: Array<{ quantity: number; unitPrice: number; itemId: string }>;
      }>;
    }) | null
  >(null);
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    void api(`/pos/sales/${saleId}?storeId=${storeId}`).then(setSale);
  }, [storeId, saleId]);

  async function refund() {
    if (
      !confirm(
        '¿Devolver esta venta completa? Se restaurará el inventario y se revertirán las ondas otorgadas.',
      )
    ) {
      return;
    }
    setRefunding(true);
    try {
      const updated = await api(
        `/pos/sales/${saleId}/refund?storeId=${storeId}`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'Devolución desde dashboard' }),
        },
      );
      setSale(updated);
    } finally {
      setRefunding(false);
    }
  }

  if (!sale) {
    return <SkeletonDetail />;
  }

  const status = statusMeta(sale.status);
  const lineCount = sale.lines?.length ?? 0;
  const itemUnits =
    sale.lines?.reduce((s, l) => s + l.quantity, 0) ?? 0;
  const primaryPayment = sale.payments?.[0];
  const payMeta = primaryPayment
    ? paymentMethodMeta(primaryPayment.methodKey)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-[var(--onda-primary)] transition hover:opacity-80"
        onClick={() => router.push('/pos/ventas')}
      >
        <ArrowLeft className="h-4 w-4" weight="bold" aria-hidden />
        Ventas
      </button>

      {/* Hero total */}
      <div className="onda-card overflow-hidden p-0">
        <div className="relative bg-[var(--onda-primary-50)] px-5 pb-5 pt-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-primary-700)] shadow-sm">
                  <Receipt className="h-3.5 w-3.5" weight="duotone" aria-hidden />
                  Resumen de venta
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}
                >
                  {status.icon}
                  {status.label}
                </span>
              </div>
              <p className="font-display text-3xl font-semibold tabular-nums tracking-tight text-[var(--onda-ink)] sm:text-4xl">
                {formatCop(sale.total)}
              </p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--onda-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarBlank
                    className="h-4 w-4 text-[var(--onda-sky)]"
                    weight="duotone"
                    aria-hidden
                  />
                  {new Date(sale.completedAt).toLocaleString('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </p>
            </div>
            {sale.status === 'COMPLETED' ? (
              <Button
                variant="outline"
                onPress={() => void refund()}
                isDisabled={refunding}
              >
                Devolver venta
              </Button>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-white/70 px-3 py-2.5 shadow-sm">
              <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--onda-muted)]">
                <Package className="h-3.5 w-3.5" weight="duotone" aria-hidden />
                Ítems
              </p>
              <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-[var(--onda-ink)]">
                {itemUnits}
                <span className="ml-1 text-xs font-normal text-[var(--onda-muted)]">
                  ({lineCount} línea{lineCount === 1 ? '' : 's'})
                </span>
              </p>
            </div>
            {payMeta && primaryPayment ? (
              <div className="rounded-xl bg-white/70 px-3 py-2.5 shadow-sm">
                <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--onda-muted)]">
                  Pago
                </p>
                <p
                  className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-sm font-semibold ${payMeta.tone}`}
                >
                  {payMeta.icon}
                  {payMeta.label}
                </p>
              </div>
            ) : null}
            <div className="rounded-xl bg-white/70 px-3 py-2.5 shadow-sm col-span-2 sm:col-span-1">
              <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--onda-muted)]">
                <Waves className="h-3.5 w-3.5" weight="duotone" aria-hidden />
                Ondas
              </p>
              <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-[var(--onda-primary-700)]">
                {sale.ondasGranted > 0 ? `+${sale.ondasGranted}` : '0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Líneas */}
      <div className="onda-card overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-[var(--onda-border)] px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--onda-sky-soft)] text-[var(--onda-sky)]">
            <Package className="h-4 w-4" weight="duotone" aria-hidden />
          </span>
          <div>
            <h3 className="font-display text-sm font-semibold">Detalle</h3>
            <p className="text-xs text-[var(--onda-muted)]">
              Productos cobrados en esta venta
            </p>
          </div>
        </div>
        <ul className="divide-y divide-[var(--onda-border)]">
          {(sale.lines ?? []).map((line) => {
            const lineTotal = line.unitPrice * line.quantity;
            return (
              <li
                key={line.id}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--onda-bg)] font-display text-sm font-semibold tabular-nums text-[var(--onda-ink)]">
                    {line.quantity}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--onda-ink)]">
                      {line.name}
                    </p>
                    {line.variantName ? (
                      <p className="text-xs text-[var(--onda-muted)]">
                        {line.variantName}
                      </p>
                    ) : null}
                    {line.addons && line.addons.length > 0 ? (
                      <ul className="mt-1 space-y-0.5">
                        {line.addons.map((a) => (
                          <li
                            key={a.id}
                            className="text-xs text-[var(--onda-muted)]"
                          >
                            + {a.name}
                            {a.price > 0 ? ` (${formatCop(a.price)})` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-0.5 text-xs text-[var(--onda-muted)] tabular-nums">
                      {formatCop(line.unitPrice)} c/u
                    </p>
                  </div>
                </div>
                <p className="shrink-0 font-display text-sm font-semibold tabular-nums text-[var(--onda-ink)]">
                  {formatCop(lineTotal)}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t border-[var(--onda-border)] bg-[var(--onda-bg)]/60 px-4 py-3">
          <span className="text-sm font-medium text-[var(--onda-muted)]">
            Total
          </span>
          <span className="font-display text-lg font-semibold tabular-nums text-[var(--onda-ink)]">
            {formatCop(sale.total)}
          </span>
        </div>
      </div>

      {/* Pagos */}
      {(sale.payments?.length ?? 0) > 0 ? (
        <div className="onda-card overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-[var(--onda-border)] px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--onda-violet-soft)] text-[var(--onda-primary)]">
              <SealCheck className="h-4 w-4" weight="duotone" aria-hidden />
            </span>
            <div>
              <h3 className="font-display text-sm font-semibold">Cobro</h3>
              <p className="text-xs text-[var(--onda-muted)]">
                Medio de pago registrado
              </p>
            </div>
          </div>
          <ul className="divide-y divide-[var(--onda-border)]">
            {sale.payments.map((p) => {
              const meta = paymentMethodMeta(p.methodKey);
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${meta.tone}`}
                  >
                    {meta.icon}
                    {meta.label}
                  </span>
                  <div className="text-right">
                    <p className="font-display text-sm font-semibold tabular-nums">
                      {formatCop(p.amount)}
                    </p>
                    {p.cashReceived != null ? (
                      <p className="text-xs text-[var(--onda-muted)] tabular-nums">
                        Recibido {formatCop(p.cashReceived)}
                        {p.changeGiven != null && p.changeGiven > 0
                          ? ` · Cambio ${formatCop(p.changeGiven)}`
                          : ''}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Devoluciones */}
      {sale.refunds && sale.refunds.length > 0 ? (
        <div className="onda-card overflow-hidden border-[var(--onda-danger)]/30 p-0">
          <div className="flex items-center gap-2 border-b border-[var(--onda-danger)]/20 bg-[var(--onda-danger)]/5 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--onda-danger)]/10 text-[var(--onda-danger)]">
              <ArrowCounterClockwise
                className="h-4 w-4"
                weight="duotone"
                aria-hidden
              />
            </span>
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--onda-danger)]">
                Devoluciones
              </h3>
              <p className="text-xs text-[var(--onda-muted)]">
                Movimientos de reverso sobre esta venta
              </p>
            </div>
          </div>
          <ul className="divide-y divide-[var(--onda-border)]">
            {sale.refunds.map((r) => (
              <li key={r.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-sm font-semibold tabular-nums text-[var(--onda-danger)]">
                    −{formatCop(r.amount)}
                  </p>
                  <p className="text-xs text-[var(--onda-muted)]">
                    {new Date(r.createdAt).toLocaleString('es-CO')}
                  </p>
                </div>
                {r.reason ? (
                  <p className="text-sm text-[var(--onda-muted)]">{r.reason}</p>
                ) : null}
                {r.ondasReversed > 0 ? (
                  <p className="inline-flex items-center gap-1 text-xs font-medium text-[var(--onda-muted)]">
                    <Waves className="h-3.5 w-3.5" weight="duotone" aria-hidden />
                    {r.ondasReversed} ondas revertidas
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
