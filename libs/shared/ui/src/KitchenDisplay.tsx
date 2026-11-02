'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PicnicTableIcon as PicnicTable } from '@phosphor-icons/react/dist/csr/PicnicTable';
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
import { useOndaDialogs } from './OndaDialogs';

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
      return 'bg-amber-100 text-amber-800';
    case 'ACCEPTED':
      return 'bg-[var(--onda-sky-soft)] text-[#1a8fb8]';
    case 'IN_PREPARATION':
      return 'bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]';
    case 'READY':
      return 'bg-[var(--onda-success)]/10 text-[var(--onda-success)]';
    case 'DELIVERED':
      return 'bg-[var(--onda-bg)] text-[var(--onda-muted)]';
    case 'CANCELLED':
      return 'bg-[var(--onda-danger)]/10 text-[var(--onda-danger)] line-through';
    default:
      return 'bg-[var(--onda-bg)] text-[var(--onda-muted)]';
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
  const { alert: showAlert, dialogs } = useOndaDialogs();

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const qs = useCallback(
    (path: string) => {
      const params = new URLSearchParams();
      params.set('storeId', storeId);
      if (token) params.set('token', token);
      const suffix = params.toString();
      return suffix ? `${path}?${suffix}` : path;
    },
    [storeId, token],
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
      void showAlert({
        tone: 'danger',
        title: 'No se pudo actualizar',
        message: e instanceof Error ? e.message : 'Intenta de nuevo.',
      });
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

  const activeStation = useMemo(
    () => stations.find((s) => s.id === stationId),
    [stations, stationId],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 rounded-3xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-4 text-[var(--onda-ink)] shadow-[0_8px_24px_rgba(26,27,46,0.06)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--onda-primary-100)] text-[var(--onda-primary-600)]">
            <CookingPot className="h-6 w-6" weight="regular" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold leading-tight">
              {activeStation?.name ?? 'Todas las estaciones'}
            </h2>
            <p className="text-sm text-[var(--onda-muted)]">
              {storeName?.trim() ? `${storeName.trim()} · ` : ''}
              {activeCount} comanda{activeCount === 1 ? '' : 's'} activa
              {activeCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto">
            <button
              type="button"
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                stationId === ''
                  ? 'bg-[var(--onda-primary-500)] text-white'
                  : 'bg-[var(--onda-bg)] text-[var(--onda-muted)] hover:bg-[var(--onda-primary-50)] hover:text-[var(--onda-ink)]'
              }`}
              onClick={() => setStationId('')}
            >
              Todas
            </button>
            {stations.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  stationId === s.id
                    ? 'bg-[var(--onda-primary-500)] text-white'
                    : 'bg-[var(--onda-bg)] text-[var(--onda-muted)] hover:bg-[var(--onda-primary-50)] hover:text-[var(--onda-ink)]'
                }`}
                onClick={() => setStationId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--onda-muted)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-[var(--onda-primary-500)]"
              checked={includeDone}
              onChange={(e) => setIncludeDone(e.target.checked)}
            />
            Entregadas (24 h)
          </label>
        </div>
      </div>

      {loading ? (
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-[var(--onda-bg)]" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--onda-bg)]">
            <Flame className="h-7 w-7 text-[var(--onda-muted)]" weight="regular" aria-hidden />
          </span>
          <p className="text-base text-[var(--onda-muted)]">Sin comandas pendientes.</p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
                className={`flex flex-col gap-3 rounded-2xl border bg-[var(--onda-card)] p-4 shadow-[0_1px_2px_rgba(26,27,46,0.04)] ${
                  stalled
                    ? 'border-[var(--onda-danger)]/50 ring-2 ring-[var(--onda-danger)]/20'
                    : ticket.status === 'READY'
                      ? 'border-[var(--onda-success)]/40'
                      : 'border-[var(--onda-border)]'
                }`}
              >
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-display text-lg font-semibold leading-tight">
                      <PicnicTable
                        className="h-5 w-5 shrink-0 text-[var(--onda-muted)]"
                        weight="regular"
                        aria-hidden
                      />
                      <span className="truncate">
                        {ticket.tabLabel || `#${ticket.id.slice(-4).toUpperCase()}`}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[var(--onda-muted)]">
                      #{ticket.id.slice(-4).toUpperCase()}
                      {ticket.stationName ? ` · ${ticket.stationName}` : ' · General'}
                      {ticket.openedByName ? ` · ${ticket.openedByName}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                        stalled
                          ? 'bg-[var(--onda-danger)]/10 text-[var(--onda-danger)]'
                          : 'bg-[var(--onda-bg)] text-[var(--onda-ink)]'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" weight="regular" aria-hidden />
                      {elapsedLabel(elapsed)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ticketTone(ticket.status)}`}
                    >
                      {TICKET_STATUS_LABEL[ticket.status]}
                    </span>
                  </div>
                </header>

                <ul className="space-y-2">
                  {ticket.items.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-center gap-3 rounded-xl bg-[var(--onda-bg)] px-3 py-2.5 ${
                        item.status === 'CANCELLED' ? 'opacity-50' : ''
                      }`}
                    >
                      <span className="w-8 shrink-0 text-center text-base font-bold tabular-nums text-[var(--onda-ink)]">
                        ×{item.quantity}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-base font-semibold leading-tight ${
                            item.status === 'CANCELLED'
                              ? 'line-through text-[var(--onda-muted)]'
                              : ''
                          }`}
                        >
                          {item.name}
                        </p>
                        {item.note ? (
                          <p className="truncate text-xs italic text-amber-700">
                            {item.note}
                          </p>
                        ) : null}
                        <p className="text-[11px] uppercase tracking-wide text-[var(--onda-muted)]">
                          {ITEM_STATUS_LABEL[item.status]}
                        </p>
                      </div>
                      {!closed ? (
                        <div className="shrink-0">
                          {item.status === 'QUEUED' ? (
                            <button
                              type="button"
                              disabled={busyKey !== null}
                              className="min-h-10 rounded-full bg-[var(--onda-sky)] px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50"
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
                              className="min-h-10 rounded-full bg-[var(--onda-primary-500)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--onda-primary-600)] disabled:opacity-50"
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
                              className="min-h-10 rounded-full bg-[var(--onda-success)] px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50"
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
                        <Check className="h-5 w-5 shrink-0 text-[var(--onda-success)]" weight="regular" aria-hidden />
                      ) : null}
                    </li>
                  ))}
                </ul>

                {!closed ? (
                  <footer className="flex items-center gap-2 border-t border-[var(--onda-border)] pt-3">
                    {ticket.status === 'PENDING' ? (
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        className="min-h-11 flex-1 rounded-full bg-[var(--onda-primary-500)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--onda-primary-600)] disabled:opacity-50"
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
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <input
                          className="min-h-10 min-w-0 flex-1 rounded-full border border-[var(--onda-border)] bg-white px-4 py-2 text-sm text-[var(--onda-ink)] outline-none placeholder:text-[var(--onda-muted)] focus:border-[var(--onda-bridge)]"
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
                          className="min-h-10 rounded-full bg-[var(--onda-danger)] px-4 py-2 text-xs font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                          onClick={() => void confirmCancel(ticket.id)}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--onda-bg)] text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)]"
                          onClick={() => setCancelTicketId(null)}
                          aria-label="Cerrar"
                        >
                          <X className="h-4 w-4" weight="regular" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        className="min-h-10 rounded-full bg-[var(--onda-danger)]/10 px-4 py-2 text-xs font-bold text-[var(--onda-danger)] transition hover:bg-[var(--onda-danger)]/15 disabled:opacity-50"
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
      {dialogs}
    </div>
  );
}
