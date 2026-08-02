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
  { id: '7d', label: '7d' },
  { id: '14d', label: '14d' },
  { id: '30d', label: '30d' },
  { id: 'month', label: 'Este mes' },
  { id: 'custom', label: 'Personalizado' },
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

export type AnalyticsFiltersValue = {
  preset: DatePreset;
  from: string;
  to: string;
  promoTypes: PromoTypeKey[];
};

export function AnalyticsFiltersBar({
  value,
  onChange,
  showPromoTypes = true,
  extra,
}: {
  value: AnalyticsFiltersValue;
  onChange: (next: AnalyticsFiltersValue) => void;
  showPromoTypes?: boolean;
  extra?: React.ReactNode;
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

  return (
    <div className="sticky top-0 z-10 mb-5 space-y-3 rounded-2xl border border-[var(--onda-border)] bg-white/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--onda-muted)]">
          Rango
        </span>
        {DATE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition ${
              value.preset === p.id
                ? 'bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]'
                : 'bg-[var(--onda-bg)] text-[var(--onda-muted)] hover:text-[var(--onda-ink)]'
            }`}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
        {value.preset === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="rounded-lg border border-[var(--onda-border)] px-2 py-1 text-xs"
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
            <span className="text-xs text-[var(--onda-muted)]">→</span>
            <input
              type="date"
              className="rounded-lg border border-[var(--onda-border)] px-2 py-1 text-xs"
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </div>
        ) : null}
      </div>

      {showPromoTypes ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--onda-muted)]">
            Tipo promo
          </span>
          <button
            type="button"
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium ${
              value.promoTypes.length === 0
                ? 'bg-[var(--onda-sky-soft)] text-[var(--onda-sky)]'
                : 'bg-[var(--onda-bg)] text-[var(--onda-muted)]'
            }`}
            onClick={() => onChange({ ...value, promoTypes: [] })}
          >
            Todos
          </button>
          {PROMO_TYPE_OPTIONS.map((t) => {
            const on = value.promoTypes.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition ${
                  on
                    ? 'bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]'
                    : 'bg-[var(--onda-bg)] text-[var(--onda-muted)] hover:text-[var(--onda-ink)]'
                }`}
                onClick={() => toggleType(t.id)}
              >
                {t.label}
              </button>
            );
          })}
          {extra}
        </div>
      ) : extra ? (
        <div className="flex flex-wrap items-center gap-2">{extra}</div>
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
          className="mt-3 text-xs font-semibold text-[var(--onda-violet)] hover:underline"
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
