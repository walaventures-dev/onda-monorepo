'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon as ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowCounterClockwiseIcon as ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { BankIcon as Bank } from '@phosphor-icons/react/dist/csr/Bank';
import { CalendarBlankIcon as CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { CaretDownIcon as CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { CaretLeftIcon as CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon as CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { CaretUpIcon as CaretUp } from '@phosphor-icons/react/dist/csr/CaretUp';
import { CheckCircleIcon as CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { CreditCardIcon as CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';
import { FunnelSimpleIcon as FunnelSimple } from '@phosphor-icons/react/dist/csr/FunnelSimple';
import { MagnifyingGlassIcon as MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { MoneyIcon as Money } from '@phosphor-icons/react/dist/csr/Money';
import { ReceiptIcon as Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import {
  api,
  OndaDatePicker,
  OndaMark,
  OndaSelect,
  SkeletonTable,
  rangeFromPreset,
} from '@onda/shared-ui';
import { formatCop } from '@onda/shared-utils';
import type { PosPaymentMethodDto, PosSaleDto } from '@onda/shared-types';

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

const STATUS_OPTIONS = [
  { id: 'ALL', label: 'Todos los estados' },
  { id: 'COMPLETED', label: 'Completada' },
  { id: 'REFUNDED', label: 'Devuelta' },
  { id: 'VOID', label: 'Anulada' },
];

const PAGE_SIZE_OPTIONS = [
  { id: '10', label: '10 por página' },
  { id: '25', label: '25 por página' },
  { id: '50', label: '50 por página' },
];

type SortField = 'completedAt' | 'total' | 'ondasGranted';
type SortDir = 'asc' | 'desc';
type Preset = 'all' | 'today' | '7d' | '30d' | 'month' | 'custom';

const RANGE_PRESETS: Array<{ id: Preset; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'month', label: 'Mes' },
  { id: 'custom', label: 'Pers.' },
];

const DEFAULT_CUSTOM_RANGE = rangeFromPreset('7d');

type PosUserStatsRow = {
  id: string;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  sales: { count: number; totalCop: number };
  accumulate: { count: number; ondas: number; salesCop: number };
  redeem: { count: number; ondas: number };
};

function PosUserStats({
  storeId,
  from,
  to,
}: {
  storeId: string;
  from: string;
  to: string;
}) {
  const [rows, setRows] = useState<PosUserStatsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api<PosUserStatsRow[]>(
      `/stores/${storeId}/pos-users/stats?${params.toString()}`,
    )
      .then((list) => {
        setRows(
          list.filter(
            (r) =>
              r.sales.count > 0 ||
              r.accumulate.count > 0 ||
              r.redeem.count > 0,
          ),
        );
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [storeId, from, to]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--onda-muted)]">
        Cargando estadísticas por usuario…
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--onda-muted)]">
        Sin actividad de usuarios de caja en este rango. Crea usuarios en{' '}
        <Link href="/pos/equipo" className="font-medium text-[var(--onda-primary-700)]">
          Usuarios
        </Link>{' '}
        para medir el desempeño del equipo.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <div key={r.id} className="onda-card space-y-1.5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-[var(--onda-ink)]">
              {r.name}
            </p>
            <span className="shrink-0 rounded-full bg-[var(--onda-bg)] px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--onda-muted)]">
              {r.role === 'ATENCION'
                ? 'Atención'
                : r.role === 'PREPARACION'
                  ? 'Preparación'
                  : r.role === 'ADMIN'
                    ? 'Admin'
                    : 'Caja'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <p className="text-sm font-bold text-[var(--onda-ink)]">
                {r.sales.count}
              </p>
              <p className="text-[10px] uppercase text-[var(--onda-muted)]">
                Ventas
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--onda-ink)]">
                {formatCop(r.sales.totalCop)}
              </p>
              <p className="text-[10px] uppercase text-[var(--onda-muted)]">
                Total vendido
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--onda-ink)]">
                {r.accumulate.count}
              </p>
              <p className="text-[10px] uppercase text-[var(--onda-muted)]">
                Acumulaciones
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
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
  const [methods, setMethods] = useState<PosPaymentMethodDto[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [preset, setPreset] = useState<Preset>('all');
  const [customFrom, setCustomFrom] = useState(DEFAULT_CUSTOM_RANGE.from);
  const [customTo, setCustomTo] = useState(DEFAULT_CUSTOM_RANGE.to);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<SortField>('completedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!storeId) return;
    void api<PosPaymentMethodDto[]>(
      `/pos/stores/${storeId}/payment-methods`,
    ).then(setMethods);
  }, [storeId]);

  const { from, to } = useMemo(() => {
    if (preset === 'all') return { from: '', to: '' };
    if (preset === 'custom') return { from: customFrom, to: customTo };
    return rangeFromPreset(preset);
  }, [preset, customFrom, customTo]);

  const hasActiveFilters =
    search !== '' ||
    statusFilter !== 'ALL' ||
    methodFilter !== 'ALL' ||
    preset !== 'all';

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    const params = new URLSearchParams({ storeId });
    params.set('limit', String(pageSize));
    params.set('offset', String((page - 1) * pageSize));
    params.set('sort', sortField);
    params.set('order', sortDir);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (search) params.set('search', search);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (methodFilter !== 'ALL') params.set('paymentMethod', methodFilter);
    void api<{ sales: PosSaleDto[]; total: number }>(`/pos/sales?${params}`)
      .then((res) => {
        setSales(res.sales);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [
    storeId,
    search,
    statusFilter,
    methodFilter,
    from,
    to,
    page,
    pageSize,
    sortField,
    sortDir,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  function resetToFirstPage() {
    setPage(1);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir(field === 'completedAt' ? 'desc' : 'desc');
    }
    setPage(1);
  }

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setStatusFilter('ALL');
    setMethodFilter('ALL');
    setPreset('all');
    setPage(1);
  }

  function sortHeader(field: SortField, label: string) {
    const active = sortField === field;
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition ${
          active ? 'text-[var(--onda-primary-700)]' : 'hover:text-[var(--onda-ink)]'
        }`}
      >
        {label}
        {active ? (
          sortDir === 'desc' ? (
            <CaretDown className="h-3 w-3" weight="bold" aria-hidden />
          ) : (
            <CaretUp className="h-3 w-3" weight="bold" aria-hidden />
          )
        ) : (
          <CaretUp
            className="h-3 w-3 opacity-30"
            weight="bold"
            aria-hidden
          />
        )}
      </button>
    );
  }

  const colSpan = readOnly ? 5 : 6;
  const firstItem = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(total, safePage * pageSize);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--onda-primary-50)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-primary-700)]">
          <Receipt className="h-3.5 w-3.5" weight="bold" aria-hidden />
          Historial
        </div>
        <h2 className="font-display text-xl font-semibold">Ventas</h2>
        <p className="text-sm text-[var(--onda-muted)]">
          {!loading
            ? `${total} venta${total === 1 ? '' : 's'} registrada${total === 1 ? '' : 's'}`
            : '\u00a0'}
        </p>
      </div>

      <div className="onda-card space-y-2 p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
          Por usuario
        </p>
        <PosUserStats storeId={storeId} from={from} to={to} />
      </div>

      <div className="onda-card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <MagnifyingGlass
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--onda-muted)]"
              aria-hidden
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                resetToFirstPage();
              }}
              placeholder="Buscar por producto o ID de venta…"
              className="w-full rounded-full border border-[var(--onda-border)] bg-transparent py-1.5 pl-9 pr-3 text-xs text-[var(--onda-ink)] outline-none placeholder:text-[var(--onda-muted)] focus:border-[var(--onda-primary-500)]"
            />
          </div>
          <OndaSelect
            aria-label="Filtrar por estado"
            compact
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              resetToFirstPage();
            }}
            options={STATUS_OPTIONS}
          />
          <OndaSelect
            aria-label="Filtrar por método de pago"
            compact
            value={methodFilter}
            onChange={(v) => {
              setMethodFilter(v);
              resetToFirstPage();
            }}
            options={[
              { id: 'ALL', label: 'Todos los pagos' },
              ...methods.map((m) => ({
                id: m.key,
                label: m.label || paymentMethodMeta(m.key).label,
              })),
            ]}
          />
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--onda-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--onda-muted)] transition hover:border-[var(--onda-danger)]/40 hover:text-[var(--onda-danger)]"
            >
              <FunnelSimple className="h-3.5 w-3.5" aria-hidden />
              Limpiar
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex flex-wrap items-center gap-1">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPreset(p.id);
                  resetToFirstPage();
                }}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  preset === p.id
                    ? 'bg-[var(--onda-primary-500)] text-white'
                    : 'bg-[var(--onda-bg)] text-[var(--onda-muted)] hover:text-[var(--onda-ink)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <OndaDatePicker
                compact
                aria-label="Desde"
                value={customFrom}
                onChange={(v) => {
                  setCustomFrom(v);
                  resetToFirstPage();
                }}
              />
              <span className="text-xs text-[var(--onda-muted)]">→</span>
              <OndaDatePicker
                compact
                aria-label="Hasta"
                value={customTo}
                onChange={(v) => {
                  setCustomTo(v);
                  resetToFirstPage();
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={colSpan} />
      ) : (
        <div className="onda-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-[var(--onda-border)] bg-[var(--onda-bg)]/80 text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                    {sortHeader('completedAt', 'Fecha')}
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                    {sortHeader('total', 'Total')}
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                    Pago
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                    {sortHeader('ondasGranted', 'Ondas')}
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
                {sales.length === 0 ? (
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
                          {hasActiveFilters
                            ? 'Sin resultados'
                            : 'Sin ventas aún'}
                        </p>
                        <p className="max-w-xs text-xs text-[var(--onda-muted)]">
                          {hasActiveFilters
                            ? 'Ninguna venta coincide con los filtros aplicados.'
                            : 'Cuando cobres en Vender, las verás aquí con total, pago y ondas.'}
                        </p>
                        {hasActiveFilters ? (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-1 inline-flex items-center gap-1 rounded-full border border-[var(--onda-border)] px-3 py-1 text-xs font-medium text-[var(--onda-primary-500)] transition hover:bg-[var(--onda-primary-50)]"
                          >
                            <FunnelSimple className="h-3.5 w-3.5" aria-hidden />
                            Limpiar filtros
                          </button>
                        ) : null}
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
                              <OndaMark className="h-3.5 w-3.5" />
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
                              className="inline-flex items-center gap-1 rounded-full border border-[var(--onda-border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--onda-primary-500)] no-underline opacity-100 transition group-hover:border-[var(--onda-primary-500)]/30 group-hover:bg-[var(--onda-primary-50)] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                            >
                              Ver
                              <ArrowRight
                                className="h-3.5 w-3.5"
                                weight="regular"
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

          {!loading && total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--onda-border)] px-4 py-2.5">
              <p className="text-xs text-[var(--onda-muted)]">
                {firstItem}–{lastItem} de {total} ventas · página {safePage} de{' '}
                {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <OndaSelect
                  aria-label="Ventas por página"
                  compact
                  value={String(pageSize)}
                  onChange={(v) => {
                    setPageSize(Number(v));
                    setPage(1);
                  }}
                  options={PAGE_SIZE_OPTIONS}
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    aria-label="Página anterior"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--onda-border)] text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CaretLeft className="h-3.5 w-3.5" weight="bold" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={safePage >= totalPages}
                    aria-label="Página siguiente"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--onda-border)] text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CaretRight className="h-3.5 w-3.5" weight="bold" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
