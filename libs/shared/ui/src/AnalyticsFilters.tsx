'use client';

import React, { useState } from 'react';
import { OndaSelect } from './OndaSelect';
import { OndaIcons } from './icons';

export type PromoTypeKey =
  | 'PERCENT_OFF'
  | 'AMOUNT_OFF'
  | 'BUY_GET'
  | 'PRODUCT'
  | 'OTHER';

export const PROMO_TYPE_OPTIONS: {
  id: PromoTypeKey;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: 'PERCENT_OFF', label: '%', icon: OndaIcons.percent },
  { id: 'AMOUNT_OFF', label: '$', icon: OndaIcons.dollar },
  { id: 'BUY_GET', label: 'NxM', icon: OndaIcons.nXm },
  { id: 'PRODUCT', label: 'Producto', icon: OndaIcons.product },
  { id: 'OTHER', label: 'Otro', icon: OndaIcons.other },
];

export const DATE_PRESETS = [
  { id: 'today', label: 'Hoy', icon: OndaIcons.day },
  { id: '7d', label: '7D', icon: OndaIcons.week },
  { id: '14d', label: '14D', icon: OndaIcons.calendar },
  { id: '30d', label: '30D', icon: OndaIcons.calendar },
  { id: 'month', label: 'Mes', icon: OndaIcons.calendar },
  { id: 'custom', label: 'Custom', icon: OndaIcons.edit },
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

export function promoDisplayTitle(p: {
  type?: string | null;
  value?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  productName?: string | null;
  title?: string | null;
}) {
  switch (p.type) {
    case 'PRODUCT': {
      const name = (p.productName || '').trim();
      return name ? `${name} Gratis` : 'Producto Gratis';
    }
    case 'PERCENT_OFF':
      return `${p.value ?? 0}% de descuento`;
    case 'AMOUNT_OFF':
      return `$${Number(p.value || 0).toLocaleString('es-CO')} de descuento`;
    case 'BUY_GET':
      return `${p.buyQuantity || 1}x${p.getQuantity || 1}`;
    default:
      return (p.title || '').trim() || 'Promo';
  }
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
  const name = promoDisplayTitle(p);
  const pts =
    p.pointsRequired != null && p.pointsRequired > 0
      ? ` · ${p.pointsRequired} ondas`
      : '';
  return `${name}${pts}`;
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
  options: { id: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  'aria-label'?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex max-w-full flex-wrap rounded-lg bg-[#e8edf5] p-0.5"
    >
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
              selected
                ? 'bg-[var(--onda-card)] text-[var(--onda-ink)] shadow-[0_1px_2px_rgba(26,27,46,0.12)]'
                : 'text-[var(--onda-muted)] hover:text-[var(--onda-ink)]'
            }`}
            onClick={() => onChange(opt.id)}
          >
            {opt.icon}
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
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  muted?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
        selected
          ? 'border-[var(--onda-ink)]/15 bg-[var(--onda-ink)] text-white'
          : muted
            ? 'border-transparent bg-transparent text-[var(--onda-muted)] hover:bg-[var(--onda-card)] hover:text-[var(--onda-ink)]'
            : 'border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-muted)] hover:border-[var(--onda-ink)]/25 hover:text-[var(--onda-ink)]'
      }`}
    >
      {icon}
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
    <div className="sticky top-0 z-10 mb-5 overflow-x-auto rounded-xl border border-[var(--onda-border)] bg-[var(--onda-card)] shadow-[0_1px_2px_rgba(26,27,46,0.04)]">
      {/* Periodo — primario */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <FilterGroup label="Periodo" className="min-w-0 flex-1 basis-full sm:basis-auto sm:flex-none">
          <SegmentedControl
            aria-label="Rango de fechas"
            options={DATE_PRESETS.map((p) => ({
              id: p.id,
              label: p.label,
              icon: p.icon,
            }))}
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
                icon={OndaIcons.all}
                onClick={() => onChange({ ...value, promoTypes: [] })}
              >
                Todos
              </FilterChip>
              {PROMO_TYPE_OPTIONS.map((t) => (
                <FilterChip
                  key={t.id}
                  selected={value.promoTypes.includes(t.id)}
                  icon={t.icon}
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
          {value.promoTypes.map((t) => {
            const opt = PROMO_TYPE_OPTIONS.find((o) => o.id === t);
            return (
              <button
                key={t}
                type="button"
                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[var(--onda-violet-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--onda-violet)] hover:bg-[var(--onda-violet)]/15"
                onClick={() => toggleType(t)}
                aria-label={`Quitar filtro ${promoTypeLabel(t)}`}
              >
                {opt?.icon}
                {promoTypeLabel(t)}
                <span aria-hidden className="text-[10px] opacity-70">
                  ×
                </span>
              </button>
            );
          })}
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

export type InsightTone = 'success' | 'warning' | 'danger' | 'accent';

export type InsightItem = {
  id?: string;
  tone?: InsightTone;
  title: string;
  message: string;
  /** Highlighted metric shown on the left (e.g. "−25%", "12") */
  stat?: string;
  action?: string;
  onAction?: () => void;
};

const TONE_BAR: Record<InsightTone, string> = {
  success: 'bg-[var(--onda-success)]',
  warning: 'bg-amber-400',
  danger: 'bg-[var(--onda-danger)]',
  accent: 'bg-[var(--onda-violet)]',
};

const TONE_STAT: Record<InsightTone, string> = {
  success: 'text-[var(--onda-success)]',
  warning: 'text-amber-600',
  danger: 'text-[var(--onda-danger)]',
  accent: 'text-[var(--onda-violet)]',
};

function InsightRow({
  tone = 'accent',
  title,
  message,
  stat,
  action,
  onAction,
}: InsightItem) {
  return (
    <div className="grid grid-cols-[0.25rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[0.25rem_4.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-3">
      <div
        className={`w-1 self-stretch rounded-full sm:min-h-[2.5rem] ${TONE_BAR[tone]}`}
        aria-hidden
      />
      {stat ? (
        <p
          className={`hidden font-display text-xl font-semibold leading-none tabular-nums sm:block ${TONE_STAT[tone]}`}
        >
          {stat}
        </p>
      ) : (
        <span className="hidden sm:block" aria-hidden />
      )}
      <div className="min-w-0 col-start-2 sm:col-start-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {stat ? (
            <p
              className={`font-display text-base font-semibold tabular-nums sm:hidden ${TONE_STAT[tone]}`}
            >
              {stat}
            </p>
          ) : null}
          <p className="font-display text-sm font-semibold text-[var(--onda-ink)]">
            {title}
          </p>
        </div>
        <p className="mt-0.5 text-sm leading-snug text-[var(--onda-muted)] line-clamp-2">
          {message}
        </p>
      </div>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="col-start-2 mt-1 cursor-pointer justify-self-start text-xs font-semibold text-[var(--onda-violet)] hover:underline sm:col-start-4 sm:mt-0 sm:justify-self-end sm:whitespace-nowrap"
        >
          {action} →
        </button>
      ) : (
        <span className="hidden sm:block" aria-hidden />
      )}
    </div>
  );
}

const TONE_LEGEND: { tone: InsightTone; label: string }[] = [
  { tone: 'danger', label: 'Urgente' },
  { tone: 'warning', label: 'Atención' },
  { tone: 'accent', label: 'Oportunidad' },
  { tone: 'success', label: 'Bien' },
];

const INSIGHTS_PREVIEW = 3;

/** Dense list of insights: stat + message + action in one card. */
export function InsightsPanel({
  items,
  title = 'Recomendaciones',
}: {
  items: InsightItem[];
  title?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;

  const hasMore = items.length > INSIGHTS_PREVIEW;
  const visible = expanded || !hasMore ? items : items.slice(0, INSIGHTS_PREVIEW);

  return (
    <div className="onda-card overflow-hidden p-4">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h3 className="font-display text-sm font-semibold text-[var(--onda-ink)]">
          {title}
        </h3>
        <ul
          className="flex flex-wrap items-center gap-x-2.5 gap-y-1"
          aria-label="Significado de colores"
        >
          {TONE_LEGEND.map(({ tone, label }) => (
            <li
              key={tone}
              className="flex items-center gap-1 text-[10px] font-medium text-[var(--onda-muted)]"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_BAR[tone]}`}
                aria-hidden
              />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="divide-y divide-[var(--onda-border)]">
        {visible.map((item, i) => (
          <InsightRow key={item.id ?? `${item.title}-${i}`} {...item} />
        ))}
      </div>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 cursor-pointer text-xs font-semibold text-[var(--onda-violet)] hover:underline"
        >
          {expanded ? 'Ver menos' : `Ver todas (${items.length})`}
        </button>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer InsightsPanel — kept for single-insight call sites. */
export function InsightCard(props: InsightItem) {
  return <InsightsPanel items={[props]} />;
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
