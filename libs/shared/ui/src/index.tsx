'use client';

import React from 'react';

export { Button, Card, Chip, Avatar, Badge, Spinner, Form, TextField, Input, TextArea, InputOTP, Table, ColorPicker } from '@heroui/react';
export { api, API_URL } from './api';
export { HeatmapPoints } from './HeatmapPoints';
export { PhoneInput } from './PhoneInput';
export type { PhoneInputProps } from './PhoneInput';
export { OndaSelect } from './OndaSelect';
export type { OndaSelectProps, OndaSelectOption } from './OndaSelect';
export {
  LegalLayout,
  PrivacyPolicyContent,
  TermsContent,
  PoliciesConsent,
} from './legal';
export { ImageUploadField, uploadFile } from './ImageUploadField';
export { OndaColorPicker } from './OndaColorPicker';
export type { OndaColorPickerProps } from './OndaColorPicker';
export { useOndaDialogs } from './OndaDialogs';
export {
  AnalyticsFiltersBar,
  InsightCard,
  FilterSelect,
  FilterChip,
  FilterGroup,
  SegmentedControl,
  PROMO_TYPE_OPTIONS,
  DATE_PRESETS,
  rangeFromPreset,
  isoDate,
  promoTypeLabel,
  formatPromoBenefit,
} from './AnalyticsFilters';
export type {
  AnalyticsFiltersValue,
  AnalyticsFilterExtraGroup,
  DatePreset,
  PromoTypeKey,
} from './AnalyticsFilters';

export function OndaLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-8 w-8 rounded-xl onda-gradient" aria-hidden />
      <span className="font-display text-lg font-semibold tracking-tight text-[var(--onda-ink)]">
        Onda
      </span>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  positive,
  children,
}: {
  label: string;
  value: string | number;
  delta?: string;
  positive?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="onda-card p-5">
      <p className="text-sm text-[var(--onda-muted)]">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-semibold text-[var(--onda-ink)]">
            {value}
          </p>
          {delta ? (
            <p
              className={`mt-1 text-sm font-medium ${
                positive
                  ? 'text-[var(--onda-success)]'
                  : 'text-[var(--onda-danger)]'
              }`}
            >
              {delta}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function GradientButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`onda-gradient inline-flex items-center justify-center rounded-full border-0 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function PassPreview({
  backgroundColor = '#6E5AE6',
  foregroundColor = '#FFFFFF',
  labelColor = '#E5F6FC',
  title = 'Onda Rewards',
  subtitle = 'Tu pase de lealtad',
  description = 'Acumula ondas en cada visita',
  logoUrl,
  points = 0,
  memberName,
  compact = false,
}: {
  backgroundColor?: string;
  foregroundColor?: string;
  labelColor?: string;
  title?: string;
  subtitle?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  points?: number;
  /** Nombre del miembro (como en Wallet) */
  memberName?: string | null;
  compact?: boolean;
}) {
  const displayName = memberName?.trim() || 'Tu nombre';
  const hasName = Boolean(memberName?.trim());

  return (
    <div
      className={`relative mx-auto w-full max-w-sm overflow-hidden rounded-[1.35rem] shadow-[0_20px_50px_rgba(26,27,46,0.22)] ${
        compact ? '' : ''
      }`}
      style={{ backgroundColor, color: foregroundColor }}
      aria-label={`Vista previa del pase ${title}`}
    >
      <div className={`flex items-start justify-between ${compact ? 'p-4' : 'p-5'}`}>
        <div className="min-w-0 pr-3">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.14em]"
            style={{ color: labelColor ?? undefined }}
          >
            Pase de lealtad
          </p>
          <h3 className={`font-display mt-1 font-semibold leading-tight ${compact ? 'text-lg' : 'text-xl'}`}>
            {title}
          </h3>
          {subtitle ? <p className="mt-0.5 truncate text-sm opacity-90">{subtitle}</p> : null}
        </div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-lg font-bold">
            O
          </div>
        )}
      </div>

      <div className={`grid grid-cols-2 gap-3 ${compact ? 'px-4 pb-3' : 'px-5 pb-4'}`}>
        <div>
          <p
            className="text-[10px] font-medium uppercase tracking-[0.12em]"
            style={{ color: labelColor ?? undefined }}
          >
            Miembro
          </p>
          <p
            className={`mt-0.5 truncate font-semibold ${compact ? 'text-sm' : 'text-base'} ${
              hasName ? '' : 'opacity-50'
            }`}
          >
            {displayName}
          </p>
        </div>
        <div className="text-right">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.12em]"
            style={{ color: labelColor ?? undefined }}
          >
            Ondas
          </p>
          <p className={`font-display font-bold ${compact ? 'text-2xl' : 'text-3xl'}`}>{points}</p>
        </div>
      </div>

      {!compact && description ? (
        <p className="px-5 pb-3 text-sm opacity-80">{description}</p>
      ) : null}

      {/* Franja tipo código de barras / QR strip de Wallet */}
      <div
        className={`mx-4 mb-4 flex items-end justify-center gap-[2px] overflow-hidden rounded-lg bg-white/95 px-3 py-2.5 ${
          compact ? 'mx-3 mb-3' : ''
        }`}
        aria-hidden
      >
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="rounded-[1px] bg-[#1a1b2e]"
            style={{
              width: i % 5 === 0 ? 3 : 1.5,
              height: 22 + ((i * 7) % 14),
              opacity: 0.85,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export type NavItem = {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
};

export function AppShell({
  title,
  nav,
  children,
  userName = 'Usuario',
  toolbar,
}: {
  title: string;
  nav: NavItem[];
  children: React.ReactNode;
  userName?: string;
  toolbar?: React.ReactNode;
}) {
  return (
    <div className="onda-shell">
      <aside className="onda-sidebar">
        <OndaLogo className="mb-8 px-2" />
        <nav className="onda-sidebar-nav">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`onda-nav-link${item.active ? ' is-active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>
      <div className="onda-shell-main">
        <header className="onda-topbar">
          <div className="onda-topbar-brand">
            <p className="onda-topbar-sub">Panel Onda</p>
            <h1 className="onda-topbar-title">{title}</h1>
          </div>
          <div className="onda-topbar-actions">
            {toolbar}
            <div className="onda-avatar">{userName.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>
        <main className="onda-content">{children}</main>
      </div>
    </div>
  );
}

export function ActivityTimeline({
  items,
  className = '',
}: {
  items: Array<{ id: string; title: string; subtitle: string; time: string }>;
  className?: string;
}) {
  return (
    <div className={`onda-card flex h-full min-h-0 flex-col p-5 ${className}`}>
      <h3 className="font-display shrink-0 text-lg font-semibold">Actividad reciente</h3>
      <ul className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3">
            <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--onda-sky)]" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--onda-ink)]">{item.title}</p>
              <p className="truncate text-sm text-[var(--onda-muted)]">{item.subtitle}</p>
              <p className="mt-0.5 text-xs text-[var(--onda-muted)]">{item.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
