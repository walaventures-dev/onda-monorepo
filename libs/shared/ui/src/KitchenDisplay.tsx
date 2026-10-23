'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArmchairIcon as Armchair } from '@phosphor-icons/react/dist/csr/Armchair';
import { CheckIcon as Check } from '@phosphor-icons/react/dist/csr/Check';
import { ClockIcon as Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { CookingPotIcon as CookingPot } from '@phosphor-icons/react/dist/csr/CookingPot';
import { FlameIcon as Flame } from '@phosphor-icons/react/dist/csr/Flame';
import { XIcon as X } from '@phosphor-icons/react/dist/csr/X';
import type {
  KitchenTicketDto,
  KitchenTicketStatus,
  KitchenItemStatus,
  PosStationDto,
} from '@onda/shared-types';
import { api } from './api';

export type KitchenDisplayProps = {
  storeId: string;
  /** Token de CajaLink (el SSE no puede llevar headers). */
  token?: string;
  storeName?: string;
};

const TICKET_STATUS_LABEL: Record<KitchenTicketStatus, string> = {
  PENDING: 'Por aceptar',
  ACCEPTED: 'Aceptada',
  IN_PREPARATION: 'En preparación',
  READY: 'Lista',
  DELIVERED: 'Entregada',
  CANCELLED: 'Anulada',
};

const ITEM_STATUS_LABEL: Record<KitchenItemStatus, string> = {
  QUEUED: 'En cola',
  IN_PREPARATION: 'Preparando',
  READY: 'Listo',
  DELIVERED: 'Entregado',
  CANCELLED: 'Anulado',
};

/** Resaltado de ticket activo que lleva demasiado tiempo abierto. */
const STALL_MS = 15 * 60 * 1000;

function elapsedLabel(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function ticketTone(status: KitchenTicketStatus) {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-400/20 text-amber-200';
    case 'ACCEPTED':
      return 'bg-sky-400/20 text-sky-200';
    case 'IN_PREPARATION':
      return 'bg-blue-400/20 text-blue-200';
    case 'READY':
      return 'bg-emerald-400/20 text-emerald-200';
    case 'DELIVERED':
      return 'bg-white/10 text-white/50';
    case 'CANCELLED':
      return 'bg-red-400/10 text-red-200/60 line-through';
    default:
      return 'bg-white/10 text-white/60';
  }
}

export function KitchenDisplay({ storeId, token, storeName }: KitchenDisplayProps) {
  const [stations, setStations] = useState<PosStationDto[]>([]);
  const [stationId, setStationId] = useState('');
  const [tickets, setTickets] = useState<KitchenTicketDto[]>([]);
  const [includeDone, setIncludeDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [cancelTicketId, setCancelTicketId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const reloadSeq = useRef(0);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const qs = useCallback(
    (path: string) => {
      const params = new URLSearchParams();
      if (token) params.set('token', token);
      const suffix = params.toString();
      return suffix ? `${path}?${suffix}` : path;
    },
    [token],
  );

  const loadStations = useCallback(async () => {
    const rows = await api<PosStationDto[]>(
      qs(`/pos/stores/${storeId}/stations`),
    );
    setStations(rows);
  }, [storeId, qs]);

  const loadTickets = useCallback(async () => {
    const params = new URLSearchParams();
    if (stationId) params.set('stationId', stationId);
    if (includeDone) params.set('includeDone', 'true');
    if (token) params.set('token', token);
    const query = params.toString();
    const rows = await api<KitchenTicketDto[]>(
      `/pos/stores/${storeId}/kitchen${query ? `?${query}` : ''}`,
    );
    setTickets(rows);
  }, [storeId, stationId, includeDone, token]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([loadStations(), loadTickets()])
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadStations, loadTickets]);

  // SSE: cualquier evento del store puede mover comandas (tabs → send/pay/void).
  useEffect(() => {
    const params = new URLSearchParams({ storeId });
    if (token) params.set('token', token);
    const es = new EventSource(`/api/pos/stream?${params.toString()}`);
    es.onmessage = () => {
      const seq = ++reloadSeq.current;
      void loadTickets().catch(() => undefined);
      if (seq % 10 === 0) void loadStations().catch(() => undefined);
    };
    return () => es.close();
  }, [storeId, token, loadTickets, loadStations]);

  // Polling de respaldo por si cae el SSE.
  useEffect(() => {
    const t = window.setInterval(() => {
      void loadTickets().catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(t);
  }, [loadTickets]);

  async function run(key: string, action: () => Promise<unknown>) {
    if (busyKey) return;
    setBusyKey(key);
    try {
      await action();
      await loadTickets();
    } catch (e) {
      window.alert?.(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setBusyKey(null);
    }
  }

  async function confirmCancel(ticketId: string) {
    const reason = cancelReason.trim();
    if (!reason) return;
    await run(`cancel:${ticketId}`, async () => {
      await api(qs(`/pos/kitchen/tickets/${ticketId}/cancel`), {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    });
    setCancelTicketId(null);
    setCancelReason('');
  }

  const activeCount = useMemo(
    () =>
      tickets.filter(
        (t) => t.status !== 'DELIVERED' && t.status !== 'CANCELLED',
      ).length,
    [tickets],
  );

  return (
    <div className="flex min-h-[70dvh] flex-col gap-4 rounded-3xl bg-[#141625] p-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
            <CookingPot className="h-5 w-5" weight="regular" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold leading-tight">
              Cocina{storeName?.trim() ? ` · ${storeName.trim()}` : ''}
            </h2>
            <p className="text-xs text-white/50">
              {activeCount} comanda{activeCount === 1 ? '' : 's'} activa
              {activeCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto">
            <button
              type="button"
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                stationId === ''
                  ? 'bg-white text-[#141625]'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
              onClick={() => setStationId('')}
            >
              Todas
            </button>
            {stations.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  stationId === s.id
                    ? 'bg-white text-[#141625]'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
                onClick={() => setStationId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-white/60">
            <input
              type="checkbox"
              className="rounded border-white/30 bg-transparent"
              checked={includeDone}
              onChange={(e) => setIncludeDone(e.target.checked)}
            />
            Entregadas (24 h)
          </label>
        </div>
      </div>

      {loading ? (
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <Flame className="h-8 w-8 text-white/30" weight="regular" aria-hidden />
          <p className="text-sm text-white/50">Sin comandas pendientes.</p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {tickets.map((ticket) => {
            const elapsed = now - new Date(ticket.createdAt).getTime();
            const stalled =
              elapsed > STALL_MS &&
              ticket.status !== 'DELIVERED' &&
              ticket.status !== 'CANCELLED';
            const closed =
              ticket.status === 'DELIVERED' || ticket.status === 'CANCELLED';
            return (
              <article
                key={ticket.id}
                className={`flex flex-col gap-3 rounded-2xl border bg-white/[0.06] p-3 ${
                  stalled
                    ? 'border-red-400/70 ring-2 ring-red-400/40'
                    : ticket.status === 'READY'
                      ? 'border-emerald-300/50'
                      : 'border-white/10'
                }`}
              >
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-display text-base font-semibold leading-tight">
                      <Armchair
                        className="h-4 w-4 shrink-0 text-white/50"
                        weight="regular"
                        aria-hidden
                      />
                      <span className="truncate">
                        {ticket.tabLabel || `#${ticket.id.slice(-4).toUpperCase()}`}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/45">
                      #{ticket.id.slice(-4).toUpperCase()}
                      {ticket.stationName ? ` · ${ticket.stationName}` : ' · General'}
                      {ticket.openedByName ? ` · ${ticket.openedByName}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                        stalled ? 'bg-red-400/20 text-red-100' : 'bg-white/10 text-white/70'
                      }`}
                    >
                      <Clock className="h-3 w-3" weight="regular" aria-hidden />
                      {elapsedLabel(elapsed)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ticketTone(ticket.status)}`}
                    >
                      {TICKET_STATUS_LABEL[ticket.status]}
                    </span>
                  </div>
                </header>

                <ul className="space-y-1.5">
                  {ticket.items.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-center gap-2 rounded-xl bg-black/20 px-2.5 py-2 ${
                        item.status === 'CANCELLED' ? 'opacity-50' : ''
                      }`}
                    >
                      <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-white/80">
                        ×{item.quantity}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium leading-tight ${
                            item.status === 'CANCELLED' ? 'line-through' : ''
                          }`}
                        >
                          {item.name}
                        </p>
                        {item.note ? (
                          <p className="truncate text-[11px] italic text-amber-200/80">
                            {item.note}
                          </p>
                        ) : null}
                        <p className="text-[10px] uppercase tracking-wide text-white/40">
                          {ITEM_STATUS_LABEL[item.status]}
                        </p>
                      </div>
                      {!closed ? (
                        <div className="shrink-0">
                          {item.status === 'QUEUED' ? (
                            <button
                              type="button"
                              disabled={busyKey !== null}
                              className="rounded-full bg-sky-400/20 px-2.5 py-1 text-[11px] font-semibold text-sky-100 transition hover:bg-sky-400/30 disabled:opacity-50"
                              onClick={() =>
                                void run(`item:${item.id}:start`, () =>
                                  api(qs(`/pos/kitchen/tickets/${ticket.id}/items/${item.id}`), {
                                    method: 'POST',
                                    body: JSON.stringify({ status: 'IN_PREPARATION' }),
                                  }),
                                )
                              }
                            >
                              Iniciar
                            </button>
                          ) : item.status === 'IN_PREPARATION' ? (
                            <button
                              type="button"
                              disabled={busyKey !== null}
                              className="rounded-full bg-blue-400/20 px-2.5 py-1 text-[11px] font-semibold text-blue-100 transition hover:bg-blue-400/30 disabled:opacity-50"
                              onClick={() =>
                                void run(`item:${item.id}:ready`, () =>
                                  api(qs(`/pos/kitchen/tickets/${ticket.id}/items/${item.id}`), {
                                    method: 'POST',
                                    body: JSON.stringify({ status: 'READY' }),
                                  }),
                                )
                              }
                            >
                              Listo
                            </button>
                          ) : item.status === 'READY' ? (
                            <button
                              type="button"
                              disabled={busyKey !== null}
                              className="rounded-full bg-emerald-400/25 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-400/35 disabled:opacity-50"
                              onClick={() =>
                                void run(`item:${item.id}:deliver`, () =>
                                  api(
                                    qs(`/pos/kitchen/tickets/${ticket.id}/items/${item.id}/deliver`),
                                    { method: 'POST', body: JSON.stringify({}) },
                                  ),
                                )
                              }
                            >
                              Entregar
                            </button>
                          ) : null}
                        </div>
                      ) : item.status === 'DELIVERED' ? (
                        <Check className="h-4 w-4 shrink-0 text-emerald-300" weight="regular" aria-hidden />
                      ) : null}
                    </li>
                  ))}
                </ul>

                {!closed ? (
                  <footer className="flex items-center gap-2 border-t border-white/10 pt-2.5">
                    {ticket.status === 'PENDING' ? (
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        className="flex-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#141625] transition hover:bg-white/90 disabled:opacity-50"
                        onClick={() =>
                          void run(`accept:${ticket.id}`, () =>
                            api(qs(`/pos/kitchen/tickets/${ticket.id}/accept`), {
                              method: 'POST',
                              body: JSON.stringify({}),
                            }),
                          )
                        }
                      >
                        Aceptar
                      </button>
                    ) : null}
                    {cancelTicketId === ticket.id ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <input
                          className="min-w-0 flex-1 rounded-full border border-red-300/40 bg-black/30 px-3 py-1.5 text-xs text-white placeholder:text-white/40"
                          placeholder="Motivo"
                          autoFocus
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void confirmCancel(ticket.id);
                            if (e.key === 'Escape') setCancelTicketId(null);
                          }}
                        />
                        <button
                          type="button"
                          disabled={busyKey !== null || !cancelReason.trim()}
                          className="rounded-full bg-red-400/25 px-2.5 py-1.5 text-[11px] font-semibold text-red-100 disabled:opacity-50"
                          onClick={() => void confirmCancel(ticket.id)}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-white/10 px-2 py-1.5 text-white/60"
                          onClick={() => setCancelTicketId(null)}
                          aria-label="Cerrar"
                        >
                          <X className="h-3.5 w-3.5" weight="regular" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        className="rounded-full bg-red-400/10 px-3 py-1.5 text-[11px] font-semibold text-red-200/80 transition hover:bg-red-400/20 disabled:opacity-50"
                        onClick={() => {
                          setCancelTicketId(ticket.id);
                          setCancelReason('');
                        }}
                      >
                        Anular
                      </button>
                    )}
                  </footer>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
