'use client';

import { useEffect, useState } from 'react';
import { api, getApiUrl } from '@onda/shared-ui';

type PendingItem = {
  id: string;
  type: 'ACCUMULATE' | 'CLAIM';
  code: string;
  pass?: { user?: { name?: string } };
  promotion?: { title?: string } | null;
  createdAt: string;
};

type SsePayload = {
  id: string;
  type: 'ACCUMULATE' | 'CLAIM';
  code: string;
  customerName?: string;
  promotionTitle?: string;
  createdAt: string;
};

export function PendingRequestsPanel({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;

    api<PendingItem[]>(`/pending-requests/pending?storeId=${storeId}`)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        /* la conexión SSE de abajo seguirá empujando novedades */
      });

    const source = new EventSource(
      `${getApiUrl()}/api/pending-requests/stream?storeId=${storeId}`
    );
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as SsePayload;
      setItems((prev) => [
        ...prev,
        {
          id: payload.id,
          type: payload.type,
          code: payload.code,
          pass: { user: { name: payload.customerName } },
          promotion: payload.promotionTitle ? { title: payload.promotionTitle } : null,
          createdAt: payload.createdAt,
        },
      ]);
    };

    return () => {
      cancelled = true;
      source.close();
    };
  }, [storeId]);

  async function resolve(id: string, action: 'confirm' | 'reject') {
    setBusyId(id);
    try {
      await api(`/pending-requests/${id}/${action}`, { method: 'POST' });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      /* el item sigue visible para reintentar */
    } finally {
      setBusyId(null);
    }
  }

  if (!items.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="onda-card space-y-2 border-l-4 border-[var(--onda-violet)] p-4 shadow-lg">
          <p className="text-sm font-semibold">
            {item.type === 'ACCUMULATE' ? 'Acumular onda' : `Reclamar: ${item.promotion?.title || 'premio'}`}
          </p>
          <p className="text-xs text-[var(--onda-muted)]">{item.pass?.user?.name || 'Cliente'}</p>
          <p className="text-center font-display text-2xl font-bold tracking-[0.3em]">{item.code}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-full bg-[var(--onda-success)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={busyId === item.id}
              onClick={() => resolve(item.id, 'confirm')}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="flex-1 rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              disabled={busyId === item.id}
              onClick={() => resolve(item.id, 'reject')}
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
