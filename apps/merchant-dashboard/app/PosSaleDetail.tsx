'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, api } from '@onda/shared-ui';
import { formatCop } from '@onda/shared-utils';
import type { PosSaleDto } from '@onda/shared-types';

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
    if (!confirm('¿Devolver esta venta completa? Se restaurará el inventario y se revertirán las ondas otorgadas.')) {
      return;
    }
    setRefunding(true);
    try {
      const updated = await api(`/pos/sales/${saleId}/refund?storeId=${storeId}`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Devolución desde dashboard' }),
      });
      setSale(updated);
    } finally {
      setRefunding(false);
    }
  }

  if (!sale) {
    return <p className="text-sm text-[var(--onda-muted)]">Cargando venta…</p>;
  }

  const isRefunded = sale.status === 'REFUNDED' || sale.status === 'VOID';

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="text-sm text-[var(--onda-primary)]"
        onClick={() => router.push('/pos/ventas')}
      >
        ← Ventas
      </button>
      <div className="onda-card space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">
              {formatCop(sale.total)}
            </h2>
            <p className="text-sm text-[var(--onda-muted)]">
              {new Date(sale.completedAt).toLocaleString('es-CO')} ·{' '}
              <span
                className={
                  isRefunded
                    ? 'font-medium text-[var(--onda-danger)]'
                    : undefined
                }
              >
                {sale.status === 'REFUNDED' ? 'Devuelta' : sale.status}
              </span>
            </p>
          </div>
          {sale.status === 'COMPLETED' ? (
            <Button variant="outline" onPress={() => void refund()} isDisabled={refunding}>
              Devolver venta
            </Button>
          ) : null}
        </div>
        {sale.ondasGranted > 0 ? (
          <p className="text-sm">Ondas otorgadas: {sale.ondasGranted}</p>
        ) : null}
        <ul className="divide-y divide-[var(--onda-border)] text-sm">
          {sale.lines?.map((line) => (
            <li key={line.id} className="flex justify-between py-2">
              <span>
                {line.quantity}× {line.name}
              </span>
              <span className="tabular-nums">{formatCop(line.unitPrice * line.quantity)}</span>
            </li>
          ))}
        </ul>
        {sale.payments?.map((p) => (
          <p key={p.id} className="text-sm text-[var(--onda-muted)]">
            Pago: {p.methodKey} · {formatCop(p.amount)}
            {p.changeGiven != null ? ` · Cambio ${formatCop(p.changeGiven)}` : ''}
          </p>
        ))}
        {sale.refunds && sale.refunds.length > 0 ? (
          <div className="rounded-xl border border-[var(--onda-border)] bg-[var(--onda-surface)] p-3 text-sm">
            <h3 className="mb-2 font-semibold">Devoluciones</h3>
            <ul className="space-y-2">
              {sale.refunds.map((r) => (
                <li key={r.id}>
                  <p>
                    {formatCop(r.amount)} · {new Date(r.createdAt).toLocaleString('es-CO')}
                  </p>
                  {r.reason ? (
                    <p className="text-[var(--onda-muted)]">{r.reason}</p>
                  ) : null}
                  {r.ondasReversed > 0 ? (
                    <p className="text-[var(--onda-muted)]">
                      Ondas revertidas: {r.ondasReversed}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
