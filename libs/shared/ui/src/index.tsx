'use client';

import React from 'react';
import { Button } from '@heroui/react';
import { OndaIcons } from './icons';
import { ONDA_BRAND, OndaLogo } from './brand';
import { TxActivityRow, type TxActivityItem } from './TxActivity';

export { Button, Card, Chip, Avatar, Badge, Spinner, Form, TextField, Input, TextArea, InputOTP, Table, ColorPicker, Tabs, toast, ToastProvider } from '@heroui/react';
export { api, API_URL, getApiUrl, setApiAuthTokenGetter } from './api';
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
export { PlacesAddressField } from './PlacesAddressField';
export type {
  PlacesAddressFieldProps,
  PlacesAddressValue,
} from './PlacesAddressField';
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
export { OndaIcons, BadgePill, badgeIcon } from './icons';
export {
  OndaLogo,
  OndaWordmark,
  OndaHandMark,
  OndaScriptMark,
  ONDA_BRAND,
} from './brand';
export type { OndaBrandVariant } from './brand';
export {
  TxActivityRow,
  TxTypeBadge,
  PromoTypeChip,
  promoTypeIcon,
} from './TxActivity';
export type { TxActivityItem, TxKind } from './TxActivity';

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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace('#', '').trim();
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function isLightHexColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b > 180;
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
  onAddToWallet,
  walletBusy = false,
  walletLabel = 'Añadir a billetera digital',
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
  /** Si se provee, muestra el botón de wallet dentro de la tarjeta */
  onAddToWallet?: () => void;
  walletBusy?: boolean;
  walletLabel?: string;
}) {
  const displayName = memberName?.trim() || 'Tu nombre';
  const hasName = Boolean(memberName?.trim());
  const lightForeground = isLightHexColor(foregroundColor);
  const stampInk = lightForeground
    ? 'rgba(255,255,255,'
    : (() => {
        const rgb = hexToRgb(foregroundColor);
        return rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},` : 'rgba(47,79,70,';
      })();

  const ondasRemaining = Math.max(0, maxStamps - points);
  const ondasRemainingText =
    ondasRemaining === 0
      ? '¡Ya puedes reclamar tu premio!'
      : ondasRemaining === 1
        ? 'Te falta 1 onda'
        : `Te faltan ${ondasRemaining} ondas`;

  const stampRowCounts =
    maxStamps <= 5 ? [maxStamps] : [Math.ceil(maxStamps / 2), Math.floor(maxStamps / 2)];
  const stampRows: number[][] = [];
  let stampCursor = 0;
  for (const count of stampRowCounts) {
    stampRows.push(Array.from({ length: count }, (_, i) => stampCursor + i + 1));
    stampCursor += count;
  }

  const renderStamp = (stampNumber: number) => {
    const filled = stampNumber <= points;
    const hasMilestone = milestoneStamps.includes(stampNumber);
    return (
      <span
        key={stampNumber}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={
          filled
            ? { backgroundColor: `${stampInk}0.16)` }
            : {
                backgroundColor: `${stampInk}0.05)`,
                boxShadow: `inset 0 0 0 1.5px ${stampInk}0.28)`,
              }
        }
        title={hasMilestone ? `Premio en el sello ${stampNumber}` : undefined}
        aria-label={filled ? `Onda ${stampNumber} acumulada` : `Ubicación ${stampNumber} vacía`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ONDA_BRAND.hand}
          alt=""
          aria-hidden
          draggable={false}
          className={`h-5 w-5 object-contain brightness-0 ${lightForeground ? 'invert' : ''}`}
          style={{ opacity: filled ? 1 : 0.22 }}
        />
      </span>
    );
  };

  return (
    <div
      className={`relative mx-auto w-full max-w-sm overflow-hidden rounded-[.5rem] shadow-[0_20px_50px_rgba(26,27,46,0.22)] ${
        compact ? '' : ''
      }`}
      style={{ backgroundColor, color: foregroundColor }}
      aria-label={`Vista previa del pase ${title}`}
    >
      <div className={`flex items-start justify-between gap-3 px-4 ${compact ? 'py-4' : 'py-5'}`}>
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
          ) : (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
              style={{ backgroundColor: lightForeground ? 'rgba(255,255,255,0.2)' : `${stampInk}0.12)` }}
            >
              O
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold leading-tight">{title}</h3>
            {subtitle ? <p className="mt-0.5 truncate text-xs opacity-90">{subtitle}</p> : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-bold leading-tight">
            {points} de {maxStamps} ondas
          </p>
          <p className="mt-0.5 text-xs opacity-90">{ondasRemainingText}</p>
        </div>
      </div>

      <div
        className={`flex flex-col gap-1.5 px-4 ${compact ? 'pb-3' : 'pb-4'}`}
        aria-label="Progreso de sellos"
      >
        {stampRows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`flex gap-1.5 ${row.length > 1 ? 'justify-between' : 'justify-center'}`}
          >
            {row.map((stampNumber) => renderStamp(stampNumber))}
          </div>
        ))}
      </div>

      <div
        className={`flex items-center justify-between gap-3 px-4 ${
          compact ? 'pb-4 pt-3' : 'pb-5 pt-3'
        }`}
        style={{ borderTop: `1px solid ${stampInk}0.18)` }}
      >
        <p
          className={`truncate font-semibold ${compact ? 'text-xs' : 'text-sm'} ${
            hasName ? '' : 'opacity-50'
          }`}
        >
          {displayName}
        </p>
        {onAddToWallet ? (
          <Button
            variant="outline"
            size="sm"
            onPress={onAddToWallet}
            isDisabled={walletBusy}
            className="shrink-0 gap-1.5 text-xs"
            style={
              {
                '--button-bg': 'transparent',
                '--button-bg-hover': 'rgba(255,255,255,0.18)',
                '--button-fg': foregroundColor,
                borderColor: foregroundColor,
              } as React.CSSProperties
            }
          >
            {OndaIcons.wallet}
            {walletBusy ? 'Abriendo…' : walletLabel}
          </Button>
        ) : null}
      </div>

      {/*{!compact && description ? (
        <p className="px-5 pb-3 text-sm opacity-80">{description}</p>
      ) : null}

      {/* Franja tipo código de barras / QR strip de Wallet 
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
      </div> */}
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
  onLogout,
}: {
  title: string;
  nav: NavItem[];
  children: React.ReactNode;
  userName?: string;
  toolbar?: React.ReactNode;
  /** p.ej. next/link para SPA navigation */
  linkComponent?: React.ElementType;
  onLogout?: () => void;
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
          {onLogout ? (
            <button
              type="button"
              className="onda-sidebar-collapse"
              onClick={onLogout}
              title="Cerrar sesión"
            >
              <span className="onda-nav-icon" aria-hidden>
                {OndaIcons.logout}
              </span>
              <span className="onda-nav-label">Cerrar sesión</span>
            </button>
          ) : null}
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
