'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon as ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowCounterClockwiseIcon as ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { BankIcon as Bank } from '@phosphor-icons/react/dist/csr/Bank';
import { CalendarBlankIcon as CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { CheckCircleIcon as CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { CreditCardIcon as CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';
import { MoneyIcon as Money } from '@phosphor-icons/react/dist/csr/Money';
import { ReceiptIcon as Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { WavesIcon as Waves } from '@phosphor-icons/react/dist/csr/Waves';
import { api } from '@onda/shared-ui';
import { formatCop } from '@onda/shared-utils';
import type { PosSaleDto } from '@onda/shared-types';

function paymentMethodMeta(key: string): {
  label: string;
  icon: ReactNode;
  tone: string;
} {
  const iconCls = 'h-3.5 w-3.5 shrink-0';
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
        <ArrowCounterClockwise
          className="h-3.5 w-3.5"
          weight="bold"
          aria-hidden
        />
      ),
      className: 'bg-[var(--onda-danger)]/10 text-[var(--onda-danger)]',
    };
  }
  if (status === 'VOID') {
    return {
      label: 'Anulada',
      icon: (
        <ArrowCounterClockwise
          className="h-3.5 w-3.5"
          weight="bold"
          aria-hidden
        />
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

export function PosSalesList({
  storeId,
  readOnly = false,
}: {
  storeId: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [sales, setSales] = useState<PosSaleDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    void api<{ sales: PosSaleDto[]; total: number }>(
      `/pos/sales?storeId=${storeId}&limit=100`,
    )
      .then((res) => {
        setSales(res.sales);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  const colSpan = readOnly ? 5 : 6;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--onda-primary-50)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-primary-700)]">
          <Receipt className="h-3.5 w-3.5" weight="bold" aria-hidden />
          Historial
        </div>
        <h2 className="font-display text-xl font-semibold">Ventas</h2>
        <p className="text-sm text-[var(--onda-muted)]">
          {loading
            ? 'Cargando ventas…'
            : `${total} venta${total === 1 ? '' : 's'} registrada${total === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="onda-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--onda-border)] bg-[var(--onda-bg)]/80 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                  Fecha
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                  Total
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                  Pago
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                  Ondas
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                  Estado
                </th>
                {!readOnly ? (
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                    <span className="sr-only">Acción</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={colSpan}
                    className="px-4 py-12 text-center text-[var(--onda-muted)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-14">
                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--onda-bg)] text-[var(--onda-muted)]">
                        <Receipt
                          className="h-6 w-6"
                          weight="duotone"
                          aria-hidden
                        />
                      </span>
                      <p className="text-sm font-medium text-[var(--onda-ink)]">
                        Sin ventas aún
                      </p>
                      <p className="max-w-xs text-xs text-[var(--onda-muted)]">
                        Cuando cobres en Vender, las verás aquí con total, pago
                        y ondas.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sales.map((sale) => {
                  const status = statusMeta(sale.status);
                  const methodKey = sale.payments?.[0]?.methodKey;
                  const pay = methodKey
                    ? paymentMethodMeta(methodKey)
                    : null;
                  const completed = new Date(sale.completedAt);
                  const isRefunded =
                    sale.status === 'REFUNDED' || sale.status === 'VOID';
                  const href = `/pos/ventas/${sale.id}`;

                  return (
                    <tr
                      key={sale.id}
                      className={`border-b border-[var(--onda-border)] last:border-b-0 transition ${
                        readOnly
                          ? ''
                          : 'group cursor-pointer hover:bg-[var(--onda-primary-50)]/45'
                      }`}
                      onClick={
                        readOnly
                          ? undefined
                          : () => router.push(href)
                      }
                      onKeyDown={
                        readOnly
                          ? undefined
                          : (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                router.push(href);
                              }
                            }
                      }
                      tabIndex={readOnly ? undefined : 0}
                      role={readOnly ? undefined : 'link'}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--onda-sky-soft)] text-[var(--onda-sky)]">
                            <CalendarBlank
                              className="h-4 w-4"
                              weight="duotone"
                              aria-hidden
                            />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--onda-ink)]">
                              {completed.toLocaleDateString('es-CO', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-xs tabular-nums text-[var(--onda-muted)]">
                              {completed.toLocaleTimeString('es-CO', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p
                          className={`font-display text-base font-semibold tabular-nums ${
                            isRefunded
                              ? 'text-[var(--onda-muted)] line-through'
                              : 'text-[var(--onda-ink)]'
                          }`}
                        >
                          {formatCop(sale.total)}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        {pay ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${pay.tone}`}
                          >
                            {pay.icon}
                            {pay.label}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--onda-muted)]">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {sale.ondasGranted > 0 ? (
                          <span className="inline-flex items-center gap-1 font-display text-sm font-semibold tabular-nums text-[var(--onda-primary-700)]">
                            <Waves
                              className="h-3.5 w-3.5"
                              weight="duotone"
                              aria-hidden
                            />
                            +{sale.ondasGranted}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--onda-muted)]">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}
                        >
                          {status.icon}
                          {status.label}
                        </span>
                      </td>
                      {!readOnly ? (
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            href={href}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--onda-border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--onda-primary)] no-underline transition group-hover:border-[var(--onda-primary)]/30 group-hover:bg-[var(--onda-primary-50)]"
                          >
                            Ver
                            <ArrowRight
                              className="h-3.5 w-3.5"
                              weight="bold"
                              aria-hidden
                            />
                          </Link>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
