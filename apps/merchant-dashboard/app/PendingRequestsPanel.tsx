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

function pinStorageKey(storeId: string) {
  return `onda_dashboard_pin_${storeId}`;
}

function getOrPromptPin(storeId: string): string | null {
  const existing = localStorage.getItem(pinStorageKey(storeId));
  if (existing) return existing;
  const entered = window.prompt('PIN de la tienda para confirmar acciones de caja');
  if (!entered) return null;
  localStorage.setItem(pinStorageKey(storeId), entered);
  return entered;
}

function clearStoredPin(storeId: string) {
  localStorage.removeItem(pinStorageKey(storeId));
}

export function PendingRequestsPanel({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) return;
    setPin(getOrPromptPin(storeId));
  }, [storeId]);

  useEffect(() => {
    if (!storeId || !pin) return;
    let cancelled = false;

    api<PendingItem[]>(`/pending-requests/pending?storeId=${storeId}&pinCode=${encodeURIComponent(pin)}`)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((err: any) => {
        if (err.message === 'PIN de tienda inválido') {
          clearStoredPin(storeId);
          setPin(getOrPromptPin(storeId));
        }
        /* si no es error de PIN, la conexión SSE de abajo seguirá empujando novedades */
      });

    const source = new EventSource(
      `${getApiUrl()}/api/pending-requests/stream?storeId=${storeId}&pinCode=${encodeURIComponent(pin)}`
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
  }, [storeId, pin]);

  async function resolve(id: string, action: 'confirm' | 'reject') {
    if (!pin) return;
    setBusyId(id);
    try {
      await api(`/pending-requests/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ pinCode: pin }),
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
      if (err.message === 'PIN de tienda inválido' && storeId) {
        clearStoredPin(storeId);
        setPin(getOrPromptPin(storeId));
      }
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
