'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { FormEvent, ReactNode } from 'react';
import {
  GradientButton,
  ImageUploadField,
  OndaIcons,
  OndaSelect,
} from '@onda/shared-ui';
import { formatMoneyInput, parseMoneyInput } from '@onda/shared-utils';
import {
  PLAN_ONDA_MONTHLY_LIMIT,
  PLAN_SMS_CAMPAIGNS_MONTHLY,
} from '@onda/shared-types';
import { TeamMembersPanel } from './TeamMembersPanel';
import { PosPaymentMethodsConfig } from './PosPaymentMethodsConfig';
import { PosAccountingConfig } from './PosAccountingConfig';

const STORE_CURRENCIES = [
  { id: 'COP', label: 'COP — peso colombiano' },
  { id: 'USD', label: 'USD — dólar' },
  { id: 'EUR', label: 'EUR — euro' },
] as const;

export type ConfigSectionId =
  | 'general'
  | 'marca'
  | 'lealtad'
  | 'equipo'
  | 'pos-pagos'
  | 'contabilidad';

export function parseConfigSection(pathname: string): ConfigSectionId {
  const sub = pathname.split('/').filter(Boolean)[1];
  switch (sub) {
    case 'marca':
      return 'marca';
    case 'lealtad':
      return 'lealtad';
    case 'equipo':
      return 'equipo';
    case 'pos-pagos':
      return 'pos-pagos';
    case 'contabilidad':
      return 'contabilidad';
    default:
      return 'general';
  }
}

type NavItem = { id: ConfigSectionId; href: string; label: string; description?: string };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Negocio',
    items: [
      { id: 'general', href: '/config', label: 'General', description: 'Sede y plan' },
      { id: 'marca', href: '/config/marca', label: 'Marca', description: 'Logo del negocio' },
      {
        id: 'lealtad',
        href: '/config/lealtad',
        label: 'Lealtad',
        description: 'Moneda y valor onda',
      },
      { id: 'equipo', href: '/config/equipo', label: 'Equipo', description: 'Accesos de caja' },
    ],
  },
  {
    label: 'POS',
    items: [
      {
        id: 'pos-pagos',
        href: '/config/pos-pagos',
        label: 'Medios de pago',
        description: 'Cobro en caja',
      },
      {
        id: 'contabilidad',
        href: '/config/contabilidad',
        label: 'Contabilidad',
        description: 'Alegra, Siigo…',
      },
    ],
  },
];

function ConfigNav({
  section,
  pathname,
  groups = NAV_GROUPS,
}: {
  section: ConfigSectionId;
  pathname: string;
  groups?: typeof NAV_GROUPS;
}) {
  return (
    <nav className="lg:w-56 lg:shrink-0" aria-label="Secciones de configuración">
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--onda-muted)]">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.id === section ||
                  (item.href === '/config' &&
                    pathname === '/config' &&
                    section === 'general');
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`block rounded-xl px-3 py-2.5 transition-colors ${
                        active
                          ? 'bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]'
                          : 'text-[var(--onda-muted)] hover:bg-[var(--onda-bg)] hover:text-[var(--onda-ink)]'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span
                        className={`block text-sm ${active ? 'font-semibold' : 'font-medium'}`}
                      >
                        {item.label}
                      </span>
                      {item.description ? (
                        <span
                          className={`mt-0.5 block text-xs ${
                            active
                              ? 'text-[var(--onda-primary-700)]/80'
                              : 'text-[var(--onda-muted)]'
                          }`}
                        >
                          {item.description}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6 border-b border-[var(--onda-border)] pb-4">
      <h2 className="font-display text-xl font-semibold text-[var(--onda-ink)]">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-[var(--onda-muted)]">{description}</p>
      ) : null}
    </header>
  );
}

function ConfigPanel({ children }: { children: ReactNode }) {
  return <div className="min-w-0 flex-1">{children}</div>;
}

export function ConfigWorkspace({
  storeId,
  store,
  billing,
  storeLogoUrl,
  setStoreLogoUrl,
  storeCurrency,
  setStoreCurrency,
  storeOndaValue,
  setStoreOndaValue,
  savingStoreLogo,
  savingStoreEconomics,
  onSaveLogo,
  onSaveEconomics,
  onUpgrade,
  onTogglePos,
  savingPos,
}: {
  storeId: string;
  store: any;
  billing: any;
  storeLogoUrl: string;
  setStoreLogoUrl: (v: string) => void;
  storeCurrency: string;
  setStoreCurrency: (v: string) => void;
  storeOndaValue: string;
  setStoreOndaValue: (v: string) => void;
  savingStoreLogo: boolean;
  savingStoreEconomics: boolean;
  onSaveLogo: (e: FormEvent) => void;
  onSaveEconomics: (e: FormEvent) => void;
  onUpgrade: () => void;
  onTogglePos: (enabled: boolean) => void;
  savingPos?: boolean;
}) {
  const pathname = usePathname();
  const section = parseConfigSection(pathname);
  const posEnabled = Boolean(store?.posEnabled);

  const navGroups = NAV_GROUPS.filter(
    (group) => group.label !== 'POS' || posEnabled,
  );

  function renderSection() {
    if (
      !posEnabled &&
      (section === 'pos-pagos' || section === 'contabilidad')
    ) {
      return (
        <>
          <SectionHeader
            title="POS deshabilitado"
            description="Activa el punto de venta en General para configurar pagos y contabilidad."
          />
          <Link
            href="/config"
            className="text-sm font-medium text-[var(--onda-primary)]"
          >
            Ir a General
          </Link>
        </>
      );
    }

    switch (section) {
      case 'equipo':
        return (
          <>
            <SectionHeader
              title="Equipo y accesos"
              description="Invita cajeros y administra quién puede operar la caja."
            />
            <TeamMembersPanel storeId={storeId} />
          </>
        );
      case 'pos-pagos':
        return (
          <>
            <SectionHeader
              title="Medios de pago"
              description="Opciones disponibles al cobrar en el POS."
            />
            <PosPaymentMethodsConfig storeId={storeId} />
          </>
        );
      case 'contabilidad':
        return (
          <>
            <SectionHeader
              title="Contabilidad"
              description="Integración con tu software contable (opcional)."
            />
            <PosAccountingConfig storeId={storeId} />
          </>
        );
      case 'marca':
        return (
          <>
            <SectionHeader
              title="Marca"
              description="Logo que heredan tus cartillas y pases."
            />
            <form onSubmit={onSaveLogo} className="onda-card max-w-xl space-y-4 p-5">
              <ImageUploadField
                label="Logo"
                hint="JPG, PNG o WEBP · esquinas redondeadas"
                aspectClass="aspect-square max-w-[8rem]"
                variant="logo"
                value={storeLogoUrl}
                onChange={setStoreLogoUrl}
              />
              <GradientButton type="submit" disabled={savingStoreLogo || !storeId}>
                {OndaIcons.save}
                {savingStoreLogo ? 'Guardando…' : 'Guardar logo'}
              </GradientButton>
            </form>
          </>
        );
      case 'lealtad':
        return (
          <>
            <SectionHeader
              title="Lealtad"
              description="Moneda y equivalencia de ondas para acumulación en caja."
            />
            <form
              onSubmit={onSaveEconomics}
              className="onda-card max-w-xl space-y-4 p-5"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="text-sm text-[var(--onda-muted)]">
                  <span className="mb-1 block">Moneda</span>
                  <OndaSelect
                    aria-label="Moneda"
                    value={storeCurrency}
                    onChange={setStoreCurrency}
                    options={STORE_CURRENCIES.map((c) => ({
                      id: c.id,
                      label: c.label,
                    }))}
                  />
                </div>
                <label className="text-sm text-[var(--onda-muted)]">
                  Una onda cuesta ({storeCurrency || 'COP'})
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2.5 text-sm text-[var(--onda-ink)]"
                    value={formatMoneyInput(storeOndaValue)}
                    onChange={(e) => setStoreOndaValue(parseMoneyInput(e.target.value))}
                    placeholder="Ej. 8.000"
                  />
                </label>
              </div>
              <p className="text-sm text-[var(--onda-muted)]">
                Si lo configuras, al acumular las ondas se calculan solas (valor de la cuenta ÷
                precio de la onda). Si lo dejas vacío, en caja pedirás monto y ondas manualmente.
              </p>
              <GradientButton type="submit" disabled={savingStoreEconomics || !storeId}>
                {OndaIcons.save}
                {savingStoreEconomics ? 'Guardando…' : 'Guardar'}
              </GradientButton>
            </form>
          </>
        );
      case 'general':
      default:
        return (
          <>
            <SectionHeader
              title="General"
              description="Información de la sede, plan y límites de uso."
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="onda-card space-y-3 p-5">
                <h3 className="font-display text-sm font-semibold text-[var(--onda-ink)]">
                  Sede
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--onda-muted)]">Nombre</dt>
                    <dd className="font-medium text-[var(--onda-ink)]">{store?.name || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--onda-muted)]">Place ID</dt>
                    <dd className="font-mono text-xs text-[var(--onda-ink)]">
                      {store?.googlePlaceId || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--onda-muted)]">Plan</dt>
                    <dd className="font-medium text-[var(--onda-ink)]">
                      {billing?.planType || '—'}
                    </dd>
                  </div>
                </dl>
                <div className="rounded-xl bg-[var(--onda-bg)] px-3 py-2.5 text-sm">
                  <p className="font-medium text-[var(--onda-ink)]">
                    Meses gratis:{' '}
                    {billing?.freeMonthsBalance ?? store?.freeMonthsBalance ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--onda-muted)]">
                    Detalle en Referidos (bienvenida + meses por cada alta)
                  </p>
                </div>
              </div>
              <div className="onda-card space-y-3 p-5">
                <h3 className="font-display text-sm font-semibold text-[var(--onda-ink)]">
                  Uso del mes
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--onda-muted)]">Ondas</dt>
                    <dd className="tabular-nums text-[var(--onda-ink)]">
                      {billing?.ondasUsed ?? 0}/{billing?.ondasLimit ?? PLAN_ONDA_MONTHLY_LIMIT}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--onda-muted)]">Campañas SMS</dt>
                    <dd className="tabular-nums text-[var(--onda-ink)]">
                      {billing?.smsCampaignsUsed ?? 0}/
                      {billing?.smsCampaignsLimit ?? PLAN_SMS_CAMPAIGNS_MONTHLY} gratis
                    </dd>
                  </div>
                  {billing?.campaignCredits != null ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--onda-muted)]">Créditos campaña</dt>
                      <dd className="text-[var(--onda-ink)]">{billing.campaignCredits}</dd>
                    </div>
                  ) : null}
                </dl>
                {billing?.planType === 'BASIC' ? (
                  <GradientButton type="button" onClick={onUpgrade}>
                    {OndaIcons.upgrade}
                    Upgrade a PRO
                  </GradientButton>
                ) : null}
              </div>
            </div>
            <div className="onda-card mt-6 space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-[var(--onda-ink)]">
                    Punto de venta (POS)
                  </h3>
                  <p className="mt-1 text-sm text-[var(--onda-muted)]">
                    Actívalo para vender con catálogo, cuentas y cobro. Si lo dejas apagado, el
                    negocio opera solo con lealtad (acumular / redimir) como siempre.
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[var(--onda-border)]"
                    checked={posEnabled}
                    disabled={savingPos}
                    onChange={(e) => onTogglePos(e.target.checked)}
                  />
                  {posEnabled ? 'Habilitado' : 'Deshabilitado'}
                </label>
              </div>
            </div>
            <div className="onda-card mt-6 p-5">
              <h3 className="font-display text-sm font-semibold text-[var(--onda-ink)]">
                Features PRO
              </h3>
              <ul className="mt-3 space-y-1.5 text-sm text-[var(--onda-muted)]">
                <li className="flex justify-between">
                  <span>Review gating</span>
                  <span className="text-[var(--onda-ink)]">
                    {billing?.features?.reviewGating ? 'Sí' : 'No'}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>NPS</span>
                  <span className="text-[var(--onda-ink)]">
                    {billing?.features?.npsSurveys ? 'Sí' : 'No'}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>GPS proximidad</span>
                  <span className="text-[var(--onda-ink)]">
                    {billing?.features?.gpsProximity ? 'Sí' : 'No'}
                  </span>
                </li>
              </ul>
            </div>
          </>
        );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--onda-ink)]">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-[var(--onda-muted)]">
          Ajustes del negocio, lealtad y punto de venta.
        </p>
      </div>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <ConfigNav section={section} pathname={pathname} groups={navGroups} />
        <ConfigPanel>{renderSection()}</ConfigPanel>
      </div>
    </div>
  );
}
