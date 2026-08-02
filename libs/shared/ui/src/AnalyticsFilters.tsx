'use client';

import React from 'react';
import { OndaSelect } from './OndaSelect';

export type PromoTypeKey =
  | 'PERCENT_OFF'
  | 'AMOUNT_OFF'
  | 'BUY_GET'
  | 'PRODUCT'
  | 'OTHER';

export const PROMO_TYPE_OPTIONS: { id: PromoTypeKey; label: string }[] = [
  { id: 'PERCENT_OFF', label: '%' },
  { id: 'AMOUNT_OFF', label: '$' },
  { id: 'BUY_GET', label: 'NxM' },
  { id: 'PRODUCT', label: 'Producto' },
  { id: 'OTHER', label: 'Otro' },
];

export const DATE_PRESETS = [
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: '7D' },
  { id: '14d', label: '14D' },
  { id: '30d', label: '30D' },
  { id: 'month', label: 'Mes' },
  { id: 'custom', label: 'Custom' },
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number]['id'];

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function rangeFromPreset(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setHours(0, 0, 0, 0);

  if (preset === 'today') {
    return { from: isoDate(from), to: isoDate(to) };
  }
  if (preset === '7d') {
    from.setDate(from.getDate() - 6);
    return { from: isoDate(from), to: isoDate(to) };
  }
  if (preset === '14d') {
    from.setDate(from.getDate() - 13);
    return { from: isoDate(from), to: isoDate(to) };
  }
  if (preset === '30d') {
    from.setDate(from.getDate() - 29);
    return { from: isoDate(from), to: isoDate(to) };
  }
  if (preset === 'month') {
    from.setDate(1);
    return { from: isoDate(from), to: isoDate(to) };
  }
  from.setDate(from.getDate() - 13);
  return { from: isoDate(from), to: isoDate(to) };
}

export function promoTypeLabel(type?: string | null) {
  const found = PROMO_TYPE_OPTIONS.find((o) => o.id === type);
  return found?.label || type || 'Otro';
}

export function formatPromoBenefit(p: {
  type?: string;
  value?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  productName?: string | null;
  pointsRequired?: number;
  title?: string;
}) {
  const pts = p.pointsRequired != null ? ` · ${p.pointsRequired} ondas` : '';
  switch (p.type) {
    case 'PERCENT_OFF':
      return `${p.value ?? 0}% de descuento${pts}`;
    case 'AMOUNT_OFF':
      return `$${Number(p.value || 0).toLocaleString('es-CO')} off${pts}`;
    case 'BUY_GET':
      return `${p.buyQuantity || 1}x${p.getQuantity || 1}${pts}`;
    case 'PRODUCT':
      return `${p.productName || p.title || 'Producto'}${pts}`;
    default:
      return p.title ? `${p.title}${pts}` : `Promo${pts}`;
  }
}

function formatRangeLabel(from: string, to: string) {
  const fmt = (s: string) => {
    const d = new Date(`${s}T12:00:00`);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };
  if (from === to) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

/** Segmented control: una sola selección en track hundido (patrón Stripe / Linear) */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  'aria-label'?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg bg-[#e8edf5] p-0.5"
    >
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              selected
                ? 'bg-white text-[var(--onda-ink)] shadow-[0_1px_2px_rgba(26,27,46,0.12)]'
                : 'text-[var(--onda-muted)] hover:text-[var(--onda-ink)]'
            }`}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Chip toggle para multi-select (tipos de promo) */
export function FilterChip({
  selected,
  onClick,
  children,
  muted,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition ${
        selected
          ? 'border-[var(--onda-ink)]/15 bg-[var(--onda-ink)] text-white'
          : muted
            ? 'border-transparent bg-transparent text-[var(--onda-muted)] hover:bg-white hover:text-[var(--onda-ink)]'
            : 'border-[var(--onda-border)] bg-white text-[var(--onda-muted)] hover:border-[var(--onda-ink)]/25 hover:text-[var(--onda-ink)]'
      }`}
    >
      {children}
    </button>
  );
}

/** Columna de dimensión con label + control */
export function FilterGroup({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-medium text-[var(--onda-muted)]">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

export type AnalyticsFiltersValue = {
  preset: DatePreset;
  from: string;
  to: string;
  promoTypes: PromoTypeKey[];
};

export type AnalyticsFilterExtraGroup = {
  id: string;
  label: string;
  children: React.ReactNode;
};

export function AnalyticsFiltersBar({
  value,
  onChange,
  showPromoTypes = true,
  extraGroups,
}: {
  value: AnalyticsFiltersValue;
  onChange: (next: AnalyticsFiltersValue) => void;
  showPromoTypes?: boolean;
  /** Dimensiones extra (Estado, Movimiento…) — columnas al lado de tipo promo */
  extraGroups?: AnalyticsFilterExtraGroup[];
}) {
  function setPreset(preset: DatePreset) {
    if (preset === 'custom') {
      onChange({ ...value, preset });
      return;
    }
    const range = rangeFromPreset(preset);
    onChange({ ...value, preset, ...range });
  }

  function toggleType(t: PromoTypeKey) {
    const has = value.promoTypes.includes(t);
    const promoTypes = has
      ? value.promoTypes.filter((x) => x !== t)
      : [...value.promoTypes, t];
    onChange({ ...value, promoTypes });
  }

  const hasTypeFilter = value.promoTypes.length > 0;
  const showDimensions = showPromoTypes || (extraGroups && extraGroups.length > 0);

  return (
    <div className="sticky top-0 z-10 mb-5 overflow-hidden rounded-xl border border-[var(--onda-border)] bg-white shadow-[0_1px_2px_rgba(26,27,46,0.04)]">
      {/* Periodo — primario */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <FilterGroup label="Periodo">
          <SegmentedControl
            aria-label="Rango de fechas"
            options={[...DATE_PRESETS]}
            value={value.preset}
            onChange={setPreset}
          />
        </FilterGroup>

        <div className="hidden h-8 w-px bg-[var(--onda-border)] sm:block" aria-hidden />

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] font-medium text-[var(--onda-muted)]">Rango</span>
          {value.preset === 'custom' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                className="cursor-pointer rounded-md border border-[var(--onda-border)] bg-[var(--onda-bg)] px-2 py-1 text-xs text-[var(--onda-ink)]"
                value={value.from}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
              />
              <span className="text-xs text-[var(--onda-muted)]">→</span>
              <input
                type="date"
                className="cursor-pointer rounded-md border border-[var(--onda-border)] bg-[var(--onda-bg)] px-2 py-1 text-xs text-[var(--onda-ink)]"
                value={value.to}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
              />
            </div>
          ) : (
            <p className="text-sm font-medium text-[var(--onda-ink)]">
              {formatRangeLabel(value.from, value.to)}
              <span className="ml-2 text-xs font-normal text-[var(--onda-muted)]">
                vs periodo anterior
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Dimensiones — secundarias */}
      {showDimensions ? (
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 border-t border-[var(--onda-border)] bg-[var(--onda-bg)]/50 px-4 py-3">
          {showPromoTypes ? (
            <FilterGroup label="Tipo de promo">
              <FilterChip
                selected={!hasTypeFilter}
                muted={hasTypeFilter}
                onClick={() => onChange({ ...value, promoTypes: [] })}
              >
                Todos
              </FilterChip>
              {PROMO_TYPE_OPTIONS.map((t) => (
                <FilterChip
                  key={t.id}
                  selected={value.promoTypes.includes(t.id)}
                  onClick={() => toggleType(t.id)}
                >
                  {t.label}
                </FilterChip>
              ))}
            </FilterGroup>
          ) : null}

          {extraGroups?.map((g, i) => (
            <React.Fragment key={g.id}>
              {(showPromoTypes || i > 0) && (
                <div
                  className="hidden h-10 w-px self-center bg-[var(--onda-border)] md:block"
                  aria-hidden
                />
              )}
              <FilterGroup label={g.label}>{g.children}</FilterGroup>
            </React.Fragment>
          ))}
        </div>
      ) : null}

      {/* Chips activos removibles */}
      {hasTypeFilter ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--onda-border)] px-4 py-2">
          <span className="text-[11px] text-[var(--onda-muted)]">Activos</span>
          {value.promoTypes.map((t) => (
            <button
              key={t}
              type="button"
              className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[var(--onda-violet-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--onda-violet)] hover:bg-[var(--onda-violet)]/15"
              onClick={() => toggleType(t)}
              aria-label={`Quitar filtro ${promoTypeLabel(t)}`}
            >
              {promoTypeLabel(t)}
              <span aria-hidden className="text-[10px] opacity-70">
                ×
              </span>
            </button>
          ))}
          <button
            type="button"
            className="ml-auto cursor-pointer text-[11px] font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
            onClick={() => onChange({ ...value, promoTypes: [] })}
          >
            Limpiar
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function InsightCard({
  tone = 'accent',
  title,
  message,
  action,
  onAction,
}: {
  tone?: 'success' | 'warning' | 'danger' | 'accent';
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  const tones: Record<string, string> = {
    success: 'border-[var(--onda-success)]/30 bg-[var(--onda-success)]/8',
    warning: 'border-amber-400/40 bg-amber-50',
    danger: 'border-[var(--onda-danger)]/30 bg-[var(--onda-danger)]/8',
    accent: 'border-[var(--onda-violet)]/25 bg-[var(--onda-violet-soft)]',
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.accent}`}>
      <p className="font-display text-sm font-semibold text-[var(--onda-ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--onda-muted)]">{message}</p>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 cursor-pointer text-xs font-semibold text-[var(--onda-violet)] hover:underline"
        >
          {action} →
        </button>
      ) : null}
    </div>
  );
}

/** Compact select for small toolbar filters (narrower than OndaSelect default) */
export function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  label: string;
}) {
  return (
    <OndaSelect
      aria-label={label}
      value={value}
      onChange={onChange}
      options={options}
      className="!min-w-[10rem] !w-[10rem]"
      placeholder={label}
    />
  );
}
