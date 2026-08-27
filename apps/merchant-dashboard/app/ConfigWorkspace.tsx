'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { BooksIcon as Books } from '@phosphor-icons/react/dist/csr/Books';
import { BuildingsIcon as Buildings } from '@phosphor-icons/react/dist/csr/Buildings';
import { CameraIcon as Camera } from '@phosphor-icons/react/dist/csr/Camera';
import { CashRegisterIcon as CashRegister } from '@phosphor-icons/react/dist/csr/CashRegister';
import { CreditCardIcon as CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';
import { GearIcon as Gear } from '@phosphor-icons/react/dist/csr/Gear';
import { GiftIcon as Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { UsersThreeIcon as UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import {
  api,
  GradientButton,
  ImageUploadField,
  OndaIcons,
  OndaSelect,
} from '@onda/shared-ui';
import {
  formatMoneyInput,
  parseMoneyInput,
  formatCop,
  formatChargeDate,
  parseBillingPeriod,
  parsePlanId,
  quotePlan,
  type BillingPeriod,
  type PlanId,
} from '@onda/shared-utils';
import {
  PLAN_ONDA_MONTHLY_LIMIT,
  CAMPAIGN_FREE_REACH_MONTHLY,
} from '@onda/shared-types';
import { PosPaymentMethodsConfig } from './PosPaymentMethodsConfig';
import { PosAccountingConfig } from './PosAccountingConfig';
import { PlanPicker } from './PlanPicker';
import { PaymentCardForm } from './PaymentCardForm';

const STORE_CURRENCIES = [
  { id: 'COP', label: 'COP — peso colombiano' },
  { id: 'USD', label: 'USD — dólar' },
  { id: 'EUR', label: 'EUR — euro' },
] as const;

const NAV_ICON_SIZE = 18;

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

type NavItem = {
  id: ConfigSectionId;
  href: string;
  label: string;
  description?: string;
  icon: ReactNode;
};

type NavGroup = {
  id: string;
  label: string;
  icon: ReactNode;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'negocio',
    label: 'Negocio',
    icon: <Buildings size={14} weight="regular" aria-hidden />,
    items: [
      {
        id: 'general',
        href: '/config',
        label: 'General',
        description: 'Sede y plan',
        icon: <Gear size={NAV_ICON_SIZE} weight="regular" aria-hidden />,
      },
      {
        id: 'marca',
        href: '/config/marca',
        label: 'Marca',
        description: 'Logo del negocio',
        icon: <Camera size={NAV_ICON_SIZE} weight="regular" aria-hidden />,
      },
      {
        id: 'lealtad',
        href: '/config/lealtad',
        label: 'Lealtad',
        description: 'Moneda y valor onda',
        icon: <Gift size={NAV_ICON_SIZE} weight="regular" aria-hidden />,
      },
      {
        id: 'equipo',
        href: '/config/equipo',
        label: 'Equipo',
        description: 'Accesos de caja',
        icon: <UsersThree size={NAV_ICON_SIZE} weight="regular" aria-hidden />,
      },
    ],
  },
  {
    id: 'pos',
    label: 'POS',
    icon: <CashRegister size={14} weight="regular" aria-hidden />,
    items: [
      {
        id: 'pos-pagos',
        href: '/config/pos-pagos',
        label: 'Medios de pago',
        description: 'Cobro en caja',
        icon: <CreditCard size={NAV_ICON_SIZE} weight="regular" aria-hidden />,
      },
      {
        id: 'contabilidad',
        href: '/config/contabilidad',
        label: 'Contabilidad',
        description: 'Alegra, Siigo…',
        icon: <Books size={NAV_ICON_SIZE} weight="regular" aria-hidden />,
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
  groups?: NavGroup[];
}) {
  return (
    <nav className="lg:w-64 lg:shrink-0" aria-label="Secciones de configuración">
      <div className="onda-card space-y-5 p-3 sm:p-3.5">
        {groups.map((group, groupIndex) => (
          <div key={group.id}>
            {groupIndex > 0 ? (
              <div
                className="mb-4 border-t border-[var(--onda-border)]"
                aria-hidden
              />
            ) : null}
            <p className="mb-2 flex items-center gap-1.5 px-2.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--onda-muted)]">
              <span className="inline-flex text-[var(--onda-muted)] opacity-80">
                {group.icon}
              </span>
              {group.label}
            </p>
            <ul className="space-y-1">
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
                      className={`group flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors ${
                        active
                          ? 'bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]'
                          : 'text-[var(--onda-ink)] hover:bg-[var(--onda-bg)]'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          active
                            ? 'bg-[var(--onda-primary-500)] text-white shadow-[0_6px_14px_rgba(5,45,222,0.22)]'
                            : 'bg-[var(--onda-bg)] text-[var(--onda-muted)] ring-1 ring-[var(--onda-border)] group-hover:text-[var(--onda-ink)]'
                        }`}
                        aria-hidden
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 pt-0.5">
                        <span
                          className={`block text-sm leading-tight ${
                            active ? 'font-semibold' : 'font-medium'
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.description ? (
                          <span
                            className={`mt-0.5 block text-xs leading-snug ${
                              active
                                ? 'text-[var(--onda-primary-700)]/75'
                                : 'text-[var(--onda-muted)]'
                            }`}
                          >
                            {item.description}
                          </span>
                        ) : null}
                      </span>
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
  onBillingUpdated,
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
  /** @deprecated use plan editor */
  onUpgrade?: () => void;
  onBillingUpdated?: () => void | Promise<void>;
}) {
  const pathname = usePathname();
  const section = parseConfigSection(pathname);
  const posEnabled = Boolean(store?.posEnabled);

  const currentPlan =
    parsePlanId(billing?.planType || store?.planType) || 'BASIC';
  const currentPeriod =
    parseBillingPeriod(billing?.billingPeriod || store?.billingPeriod) ||
    'monthly';
  const [editPlan, setEditPlan] = useState<PlanId>(currentPlan);
  const [editPeriod, setEditPeriod] = useState<BillingPeriod>(currentPeriod);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState('');
  const [showCard, setShowCard] = useState(false);
  const editQuote = quotePlan(editPlan, editPeriod);
  const needsCard =
    !billing?.hasPaymentMethod && Boolean(billing?.wompiConfigured);

  useEffect(() => {
    setEditPlan(parsePlanId(billing?.planType || store?.planType) || 'BASIC');
    setEditPeriod(
      parseBillingPeriod(billing?.billingPeriod || store?.billingPeriod) ||
        'monthly'
    );
  }, [billing?.planType, billing?.billingPeriod, store?.planType, store?.billingPeriod]);

  const navGroups = NAV_GROUPS.filter(
    (group) => group.id !== 'pos' || posEnabled,
  ).map((group) => ({
    ...group,
    // Temporal: ocultar Equipo del menú de config
    items: group.items.filter((item) => item.id !== 'equipo'),
  }));

  async function applyPlanChange(tokens?: {
    cardToken?: string;
    acceptanceToken?: string;
    acceptPersonalAuth?: string;
  }) {
    setPlanError('');
    setPlanBusy(true);
    try {
      await api(`/billing/store/${storeId}/plan`, {
        method: 'POST',
        body: JSON.stringify({
          planType: editPlan,
          billingPeriod: editPeriod,
          cardToken: tokens?.cardToken,
          acceptanceToken: tokens?.acceptanceToken,
          acceptPersonalAuth: tokens?.acceptPersonalAuth,
        }),
      });
      setShowCard(false);
      await onBillingUpdated?.();
    } catch (err) {
      setPlanError(
        err instanceof Error ? err.message : 'No se pudo cambiar el plan'
      );
    } finally {
      setPlanBusy(false);
    }
  }

  function renderSection() {
    if (
      !posEnabled &&
      (section === 'pos-pagos' || section === 'contabilidad')
    ) {
      return (
        <SectionHeader
          title="POS no disponible"
          description="El punto de venta no está habilitado para este negocio."
        />
      );
    }

    switch (section) {
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
                      {billing?.billingPeriod
                        ? ` · ${billing.billingPeriod === 'monthly' ? 'mensual' : billing.billingPeriod === '6' ? '6 meses' : '12 meses'}`
                        : ''}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--onda-muted)]">Próximo cobro</dt>
                    <dd className="font-medium text-[var(--onda-ink)]">
                      {billing?.nextBillingAt
                        ? formatChargeDate(new Date(billing.nextBillingAt))
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--onda-muted)]">Tarjeta</dt>
                    <dd className="font-medium text-[var(--onda-ink)]">
                      {billing?.hasPaymentMethod ? 'Guardada' : 'Sin método'}
                    </dd>
                  </div>
                </dl>
                <div className="rounded-xl bg-[var(--onda-bg)] px-3 py-2.5 text-sm">
                  <p className="font-medium text-[var(--onda-ink)]">
                    Bonos referidos:{' '}
                    {billing?.freeMonthsBalance ?? store?.freeMonthsBalance ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-[var(--onda-muted)]">
                    +30 días en tu fecha de cobro cuando un referido paga
                    cualquier plan.
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
                    <dt className="text-[var(--onda-muted)]">Alcance campañas</dt>
                    <dd className="tabular-nums text-[var(--onda-ink)]">
                      {billing?.reachUsed ?? billing?.smsCampaignsUsed ?? 0}/
                      {billing?.reachLimit ?? billing?.smsCampaignsLimit ?? CAMPAIGN_FREE_REACH_MONTHLY}{' '}
                      personas gratis
                    </dd>
                  </div>
                  <p className="text-xs text-[var(--onda-muted)]">
                    Excedente: {formatCop(billing?.reachUnitCop ?? 200)} por persona al enviar.
                  </p>
                </dl>
              </div>
            </div>
            <div className="onda-card mt-6 space-y-4 p-5">
              <h3 className="font-display text-sm font-semibold text-[var(--onda-ink)]">
                Cambiar suscripción
              </h3>
              <p className="text-sm text-[var(--onda-muted)]">
                Al aplicar se cobra {formatCop(editQuote.total)} y se reinicia la
                fecha de corte (+{editQuote.firstIntervalDays} días).
              </p>
              <PlanPicker
                plan={editPlan}
                billing={editPeriod}
                onPlan={setEditPlan}
                onBilling={setEditPeriod}
                compact
              />
              {showCard || needsCard ? (
                <PaymentCardForm
                  publicKey={
                    billing?.wompiPublicKey ||
                    process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ||
                    null
                  }
                  stubMode={!billing?.wompiConfigured}
                  busy={planBusy}
                  submitLabel={`Cobrar ${formatCop(editQuote.total)}`}
                  onSubmit={(tokens) => void applyPlanChange(tokens)}
                />
              ) : (
                <GradientButton
                  type="button"
                  disabled={planBusy}
                  onClick={() => void applyPlanChange()}
                >
                  {planBusy
                    ? 'Procesando…'
                    : `Aplicar y cobrar ${formatCop(editQuote.total)}`}
                </GradientButton>
              )}
              {!needsCard && !showCard && onUpgrade ? (
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--onda-muted)] underline"
                  onClick={() => setShowCard(true)}
                >
                  Usar otra tarjeta
                </button>
              ) : null}
              {planError ? (
                <p className="text-sm text-[var(--onda-danger)]">{planError}</p>
              ) : null}
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
          Ajustes del negocio{posEnabled ? ', lealtad y punto de venta' : ' y lealtad'}.
        </p>
      </div>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <ConfigNav section={section} pathname={pathname} groups={navGroups} />
        <ConfigPanel>{renderSection()}</ConfigPanel>
      </div>
    </div>
  );
}
