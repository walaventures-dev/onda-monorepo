'use client';

import React from 'react';
import { OndaIcons } from './icons';
import { TxActivityRow, type TxActivityItem } from './TxActivity';

export { Button, Card, Chip, Avatar, Badge, Spinner, Form, TextField, Input, TextArea, InputOTP, Table, ColorPicker } from '@heroui/react';
export { api, API_URL, getApiUrl } from './api';
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
  InsightsPanel,
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
  InsightItem,
  InsightTone,
  AnalyticsFiltersValue,
  AnalyticsFilterExtraGroup,
  DatePreset,
  PromoTypeKey,
} from './AnalyticsFilters';
export { OndaIcon, OndaIcons, BadgePill, badgeIcon } from './icons';
export {
  TxActivityRow,
  TxTypeBadge,
  PromoTypeChip,
  promoTypeIcon,
} from './TxActivity';
export type { TxActivityItem, TxKind } from './TxActivity';

export function OndaLogo({
  className = '',
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-8 w-8 shrink-0 rounded-xl onda-gradient" aria-hidden />
      {!compact ? (
        <span className="onda-logo-text font-display text-lg font-semibold tracking-tight text-[var(--onda-ink)]">
          Onda
        </span>
      ) : null}
    </div>
  );
}

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex" tabIndex={0}>
      <span className="cursor-help text-[var(--onda-muted)] hover:text-[var(--onda-ink)] focus-visible:text-[var(--onda-ink)]">
        {OndaIcons.info}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-[var(--onda-ink)] px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  positive,
  hint,
  children,
}: {
  label: string;
  value: string | number;
  delta?: string;
  positive?: boolean;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="onda-card flex h-full w-full flex-col px-4 py-3.5">
      <p className="flex items-center gap-1 text-xs text-[var(--onda-muted)]">
        {label}
        {hint ? <InfoTooltip text={hint} /> : null}
      </p>
      <div className="mt-1.5 flex flex-1 items-end justify-between gap-2">
        <div>
          <p className="font-display text-2xl font-semibold tabular-nums text-[var(--onda-ink)]">
            {value}
          </p>
          {delta ? (
            <p
              className={`mt-0.5 text-xs font-medium ${
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
      className={`onda-gradient inline-flex items-center justify-center gap-1.5 rounded-full border-0 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${className}`}
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
  maxStamps = 12,
  milestoneStamps = [],
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
  maxStamps?: number;
  milestoneStamps?: number[];
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
          <p className={`font-display font-bold ${compact ? 'text-2xl' : 'text-3xl'}`}>
            {points}/{maxStamps}
          </p>
        </div>
      </div>

      <div
        className={`flex flex-wrap gap-1.5 ${compact ? 'px-4 pb-3' : 'px-5 pb-4'}`}
        aria-label="Progreso de sellos"
      >
        {Array.from({ length: maxStamps }).map((_, i) => {
          const stampNumber = i + 1;
          const filled = stampNumber <= points;
          const hasMilestone = milestoneStamps.includes(stampNumber);
          return (
            <span
              key={stampNumber}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
              style={{
                backgroundColor: filled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.18)',
                color: filled ? backgroundColor : foregroundColor,
                border: hasMilestone ? `1.5px solid ${foregroundColor}` : 'none',
              }}
              title={hasMilestone ? `Premio en el sello ${stampNumber}` : undefined}
            >
              {hasMilestone ? '★' : ''}
            </span>
          );
        })}
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
  /** Va al pie del sidebar (ej. Configuración), separado del menú principal */
  footer?: boolean;
};

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="onda-menu-icon"
    >
      {open ? (
        <path
          d="M5 5l10 10M15 5L5 15"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function AppShell({
  title,
  nav,
  children,
  userName = 'Usuario',
  toolbar,
  linkComponent,
}: {
  title: string;
  nav: NavItem[];
  children: React.ReactNode;
  userName?: string;
  toolbar?: React.ReactNode;
  /** p.ej. next/link para SPA navigation */
  linkComponent?: React.ElementType;
}) {
  const Link = linkComponent || 'a';
  const [navOpen, setNavOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('onda-sidebar-collapsed') === '1');
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem('onda-sidebar-collapsed', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  React.useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  React.useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => {
      if (mq.matches) setNavOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const closeNav = () => setNavOpen(false);
  const toggleCollapsed = () => setCollapsed((v) => !v);

  const mainNav = nav.filter((item) => !item.footer);
  const footerNav = nav.filter((item) => item.footer);

  const renderLink = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      className={`onda-nav-link${item.active ? ' is-active' : ''}`}
      onClick={closeNav}
      title={collapsed ? item.label : undefined}
    >
      <span className="onda-nav-icon" aria-hidden>
        {item.icon || OndaIcons.all}
      </span>
      <span className="onda-nav-label">{item.label}</span>
    </Link>
  );

  return (
    <div
      className={`onda-shell${navOpen ? ' is-nav-open' : ''}${
        collapsed ? ' is-sidebar-collapsed' : ''
      }`}
    >
      {navOpen ? (
        <button
          type="button"
          className="onda-nav-backdrop"
          aria-label="Cerrar menú"
          onClick={closeNav}
        />
      ) : null}
      <aside
        className={`onda-sidebar${navOpen ? ' is-open' : ''}${
          collapsed ? ' is-collapsed' : ''
        }`}
        id="onda-sidebar-nav"
      >
        <div className="onda-sidebar-header">
          <OndaLogo
            className={collapsed ? 'justify-center' : 'px-2'}
            compact={collapsed}
          />
        </div>
        <nav className="onda-sidebar-nav" aria-label="Principal">
          {mainNav.map(renderLink)}
        </nav>
        <div className="onda-sidebar-footer">
          {footerNav.length > 0 ? (
            <nav className="onda-sidebar-footer-nav" aria-label="Ajustes">
              {footerNav.map(renderLink)}
            </nav>
          ) : null}
          <button
            type="button"
            className="onda-sidebar-collapse"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expandir' : 'Colapsar'}
            onClick={toggleCollapsed}
          >
            <span className="onda-nav-icon" aria-hidden>
              {collapsed ? OndaIcons.chevronRight : OndaIcons.chevronLeft}
            </span>
            <span className="onda-nav-label">
              {collapsed ? 'Expandir' : 'Colapsar'}
            </span>
          </button>
        </div>
      </aside>
      <div className="onda-shell-main">
        <header className="onda-topbar">
          <div className="onda-topbar-leading">
            <button
              type="button"
              className="onda-menu-btn"
              aria-label={navOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={navOpen}
              aria-controls="onda-sidebar-nav"
              onClick={() => setNavOpen((v) => !v)}
            >
              <MenuIcon open={navOpen} />
            </button>
            <div className="onda-topbar-brand">
              <p className="onda-topbar-sub">Panel Onda</p>
              <h1 className="onda-topbar-title">{title}</h1>
            </div>
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
  items: TxActivityItem[];
  className?: string;
}) {
  return (
    <div
      className={`onda-card flex min-h-0 flex-col overflow-hidden p-4 ${className}`}
    >
      <h3 className="font-display shrink-0 text-sm font-semibold">
        Actividad reciente
      </h3>
      <ul className="onda-tx-list mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {items.length === 0 ? (
          <li className="py-4 text-center text-xs text-[var(--onda-muted)]">
            Sin actividad aún.
          </li>
        ) : (
          items.map((item) => (
            <TxActivityRow key={item.id} item={item} dense />
          ))
        )}
      </ul>
    </div>
  );
}
