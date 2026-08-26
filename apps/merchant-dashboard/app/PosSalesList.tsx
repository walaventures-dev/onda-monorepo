'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@onda/shared-ui';
import { formatCop } from '@onda/shared-utils';
import type { PosSaleDto } from '@onda/shared-types';

export function PosSalesList({
  storeId,
  readOnly = false,
}: {
  storeId: string;
  readOnly?: boolean;
}) {
  const [sales, setSales] = useState<PosSaleDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    void api<{ sales: PosSaleDto[]; total: number }>(
      `/pos/sales?storeId=${storeId}&limit=100`
    )
      .then((res) => {
        setSales(res.sales);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">Ventas</h2>
        <p className="text-sm text-[var(--onda-muted)]">
          {total} venta{total === 1 ? '' : 's'} registradas
        </p>
      </div>
      <div className="onda-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--onda-border)] bg-[var(--onda-bg)] text-left text-[var(--onda-muted)]">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Ondas</th>
              <th className="px-4 py-2">Estado</th>
              {!readOnly ? <th className="px-4 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center">
                  Cargando…
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--onda-muted)]">
                  Sin ventas aún.
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale.id} className="border-b border-[var(--onda-border)]">
                  <td className="px-4 py-3">
                    {new Date(sale.completedAt).toLocaleString('es-CO')}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatCop(sale.total)}</td>
                  <td className="px-4 py-3 tabular-nums">{sale.ondasGranted || '—'}</td>
                  <td className="px-4 py-3">{sale.status}</td>
                  {!readOnly ? (
                    <td className="px-4 py-3">
                      <Link
                        href={`/pos/ventas/${sale.id}`}
                        className="text-xs font-medium text-[var(--onda-primary)]"
                      >
                        Ver
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
