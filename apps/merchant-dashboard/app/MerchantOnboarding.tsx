'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  api,
  GradientButton,
  OndaLogo,
  OndaHandMark,
  OndaScriptMark,
  OndaSelect,
  PlacesAddressField,
  OndaIcons,
} from '@onda/shared-ui';
import {
  StoreCategory,
  StoreSubcategory,
  StoreSegment,
  STORE_CATEGORY_LABELS,
  STORE_SUBCATEGORY_LABELS,
  STORE_SUBCATEGORIES_BY_CATEGORY,
  STORE_SEGMENT_LABELS,
  STORE_SEGMENTS_BY_SUBCATEGORY,
  defaultSegmentFor,
} from '@onda/shared-types';
import {
  normalizeStoreSlug,
  parseBillingPeriod,
  parsePlanId,
  PLAN_META,
  isReferralCodeComplete,
  type BillingPeriod,
  type PlanId,
} from '@onda/shared-utils';
import { useMerchantAuth } from '../lib/MerchantAuth';
import { MerchantSignup } from './MerchantSignup';
import { PlanPicker } from './PlanPicker';
import {
  persistOnboardingQuery,
  readStoredBilling,
  readStoredPlan,
  readStoredReferral,
  rememberPlanChoice,
  sanitizeReferralCode,
  formatReferralCodeInput,
  readStoredOwnerName,
} from './onboardingQuery';

type SetupStep = 'local' | 'plan';

function configuredDemoReferralCode(): string {
  return sanitizeReferralCode(process.env.NEXT_PUBLIC_ONDA_DEMO_REFERRAL_CODE);
}

function applyDemoReferralState(setters: {
  setReferrerName: (v: string) => void;
  setIsDemoReferral: (v: boolean) => void;
  setPlanType: (v: PlanId) => void;
  setBillingPeriod: (v: BillingPeriod) => void;
}) {
  setters.setReferrerName('Onda (demo)');
  setters.setIsDemoReferral(true);
  setters.setPlanType('PRO');
  setters.setBillingPeriod('monthly');
}

const CATEGORY_OPTIONS = (
  Object.keys(STORE_CATEGORY_LABELS) as StoreCategory[]
).map((id) => ({ id, label: STORE_CATEGORY_LABELS[id] }));

const STEPS: Array<{
  id: SetupStep;
  label: string;
  hint: string;
  icon: ReactNode;
}> = [
  { id: 'local', label: 'Local', hint: 'Datos y enlace', icon: OndaIcons.near },
  { id: 'plan', label: 'Plan', hint: 'Suscripción', icon: OndaIcons.crown },
];

function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`onda-field ${className}`}>
      <span className="onda-field__label">{label}</span>
      {children}
      {hint ? <span className="onda-field__hint">{hint}</span> : null}
    </div>
  );
}

function FormShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
      <div className="shrink-0 border-t border-[var(--onda-border)] bg-[var(--onda-card)] pt-4">
        {footer}
      </div>
    </div>
  );
}

export function MerchantOnboarding() {
  const { firebaseEnabled, user } = useMerchantAuth();
  const needsAuth = firebaseEnabled && !user;

  if (needsAuth) {
    return <MerchantSignup />;
  }

  return <MerchantBusinessSetup />;
}

function MerchantBusinessSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { email: sessionEmail, user, logout } = useMerchantAuth();

  const [step, setStep] = useState<SetupStep>('local');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [isDemoReferral, setIsDemoReferral] = useState(false);

  const [planType, setPlanType] = useState<PlanId>(
    () => parsePlanId(searchParams.get('plan')) ?? 'BASIC'
  );
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(
    () => parseBillingPeriod(searchParams.get('billing')) ?? '12'
  );

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState<string | undefined>();
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState<StoreCategory>(
    StoreCategory.RESTAURANT
  );
  const [subcategory, setSubcategory] = useState<StoreSubcategory>(
    StoreSubcategory.CAFE
  );
  const [segment, setSegment] = useState<StoreSegment>(
    StoreSegment.CAFE_COFFEE
  );
  const [ownerName, setOwnerName] = useState(user?.displayName?.trim() || '');
  const [ownerEmail, setOwnerEmail] = useState(
    sessionEmail || user?.email || ''
  );
  const [referralCode, setReferralCode] = useState(
    () => sanitizeReferralCode(searchParams.get('ref'))
  );

  const needsOwnerName = !ownerName.trim();
  const needsOwnerEmail = !ownerEmail.trim();

  const subcategoryOptions = useMemo(
    () =>
      STORE_SUBCATEGORIES_BY_CATEGORY[category].map((id) => ({
        id,
        label: STORE_SUBCATEGORY_LABELS[id],
      })),
    [category]
  );

  const segmentOptions = useMemo(
    () =>
      STORE_SEGMENTS_BY_SUBCATEGORY[subcategory].map((id) => ({
        id,
        label: STORE_SEGMENT_LABELS[id],
      })),
    [subcategory]
  );

  useEffect(() => {
    const negocio = name.trim();
    document.title = negocio ? `Onda - ${negocio}` : 'Onda - Crear negocio';
  }, [name]);

  useEffect(() => {
    persistOnboardingQuery(searchParams);
    if (!parsePlanId(searchParams.get('plan'))) {
      setPlanType(readStoredPlan());
    }
    if (!parseBillingPeriod(searchParams.get('billing'))) {
      setBillingPeriod(readStoredBilling());
    }
    if (!sanitizeReferralCode(searchParams.get('ref'))) {
      const storedRef = readStoredReferral();
      if (storedRef) setReferralCode(storedRef);
    }
    // Solo hidrata desde sessionStorage en el primer montaje.
  }, []);

  useEffect(() => {
    rememberPlanChoice(planType, billingPeriod);
  }, [planType, billingPeriod]);

  useEffect(() => {
    if (user?.displayName && !ownerName) setOwnerName(user.displayName);
    else if (!ownerName) {
      const stored = readStoredOwnerName();
      if (stored) setOwnerName(stored);
    }
  }, [user, ownerName]);

  useEffect(() => {
    if (sessionEmail && !ownerEmail) setOwnerEmail(sessionEmail);
  }, [sessionEmail, ownerEmail]);

  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  useEffect(() => {
    const allowed = STORE_SUBCATEGORIES_BY_CATEGORY[category];
    if (!allowed.includes(subcategory)) {
      setSubcategory(allowed[0]);
    }
  }, [category, subcategory]);

  useEffect(() => {
    const allowed = STORE_SEGMENTS_BY_SUBCATEGORY[subcategory];
    if (!allowed.includes(segment)) {
      setSegment(allowed[0] ?? defaultSegmentFor(subcategory));
    }
  }, [subcategory, segment]);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(normalizeStoreSlug(name));
    }
  }, [name, slugTouched]);

  useEffect(() => {
    const normalized = sanitizeReferralCode(referralCode);
    if (!normalized || !isReferralCodeComplete(normalized)) {
      setReferrerName(null);
      setIsDemoReferral(false);
      return;
    }

    const demoCode = configuredDemoReferralCode();
    if (demoCode && normalized === demoCode) {
      applyDemoReferralState({
        setReferrerName,
        setIsDemoReferral,
        setPlanType,
        setBillingPeriod,
      });
      return;
    }

    setReferrerName(null);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api<{ code: string; storeName: string; demo?: boolean }>(
        `/referrals/resolve/${encodeURIComponent(normalized)}`
      )
        .then((r) => {
          if (cancelled) return;
          setReferrerName(r.storeName);
          setIsDemoReferral(Boolean(r.demo));
          if (r.demo) {
            setPlanType('PRO');
            setBillingPeriod('monthly');
          }
        })
        .catch(() => {
          if (cancelled) return;
          setReferrerName('');
          setIsDemoReferral(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [referralCode]);

  function finish(id: string) {
    try {
      localStorage.setItem('onda-merchant-store-id', id);
    } catch {
      /* ignore */
    }
    router.push('/completar');
  }

  function goNextFromLocal(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Indica el nombre del negocio');
      return;
    }
    const slugValue = normalizeStoreSlug(slug);
    if (!slugValue) {
      setError('El slug es inválido');
      return;
    }
    if (needsOwnerName && !ownerName.trim()) {
      setError('Indica tu nombre');
      return;
    }
    if (needsOwnerEmail && !ownerEmail.trim()) {
      setError('Indica el email del encargado');
      return;
    }
    const normalizedReferral = sanitizeReferralCode(referralCode);
    if (normalizedReferral) {
      if (!isReferralCodeComplete(normalizedReferral)) {
        setError('El código de referido debe tener 8 caracteres');
        return;
      }
      if (referrerName === null) {
        setError('Espera a verificar el código de referido');
        return;
      }
      if (referrerName === '') {
        setError('Código de referido no válido');
        return;
      }
    }
    // Código demo: salta plan y crea como PRO mensual.
    if (isDemoReferral) {
      void createStore('PRO', 'monthly');
      return;
    }
    setStep('plan');
  }

  async function submitBusiness(e: FormEvent) {
    e.preventDefault();
    await createStore(planType, billingPeriod);
  }

  async function createStore(plan: PlanId, billing: BillingPeriod) {
    setError('');
    const slugValue = normalizeStoreSlug(slug);
    if (!slugValue) {
      setError('El slug es inválido');
      return;
    }
    setBusy(true);
    rememberPlanChoice(plan, billing);
    try {
      const created = await api<{ id: string }>('/stores', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: slugValue,
          ownerName: ownerName.trim() || user?.displayName?.trim() || 'Encargado',
          category,
          subcategory,
          segment,
          ownerEmail: ownerEmail.trim() || sessionEmail || undefined,
          address: address.trim() || undefined,
          googlePlaceId,
          lat,
          lng,
          referralCode: sanitizeReferralCode(referralCode) || undefined,
          planType: plan,
          billingPeriod: billing,
        }),
      });
      finish(created.id);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'No se pudo crear el negocio';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const header =
    step === 'local'
      ? {
          title: 'Tu negocio',
          sub: 'Ya estás dentro. Datos del local y tu enlace público; el pase y las recompensas los configuras después en el panel.',
        }
      : {
          title: 'Elige tu plan',
          sub: 'Último paso. El primer mes es gratis y no necesitas tarjeta.',
        };

  return (
    <div className="relative h-dvh max-h-dvh overflow-hidden bg-[var(--onda-bg)]">
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--onda-sky)]/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-[var(--onda-violet)]/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-[var(--onda-bridge)]/15 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto grid h-full max-w-6xl min-h-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <aside className="relative hidden min-h-0 flex-col justify-between overflow-y-auto overscroll-contain px-10 py-10 lg:flex xl:px-14">
          <OndaScriptMark className="pointer-events-none absolute bottom-10 right-6 h-20 w-auto opacity-[0.08]" />
          <div>
            <OndaLogo />
            <p className="mt-10 font-display text-4xl font-semibold leading-tight tracking-tight text-[var(--onda-ink)] xl:text-5xl">
              Completa tu
              <br />
              negocio
            </p>
            <p className="mt-4 max-w-sm text-[var(--onda-muted)]">
              Ya tienes cuenta
              {user?.displayName ? ` · ${user.displayName}` : ''}. Completa el
              local y elige plan para entrar al panel.
            </p>

            <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--onda-violet-soft)] px-4 py-2 text-sm font-medium text-[var(--onda-violet)]">
              {OndaIcons.sparkle}
              {PLAN_META[planType].name} · 1 mes gratis
            </div>

            <ul className="mt-10 space-y-4">
              {STEPS.map((s, i) => {
                const active = s.id === step;
                const done = i < stepIndex;
                return (
                  <li
                    key={s.id}
                    className={`flex items-start gap-3 transition ${
                      active ? 'opacity-100' : done ? 'opacity-80' : 'opacity-45'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${
                        done
                          ? 'bg-[var(--onda-success)] text-white'
                          : active
                            ? 'onda-gradient text-white shadow-[0_8px_20px_rgba(5,45,222,0.25)]'
                            : 'bg-[var(--onda-card)] text-[var(--onda-muted)] ring-1 ring-[var(--onda-border)]'
                      }`}
                    >
                      {done ? OndaIcons.check : s.icon}
                    </span>
                    <div>
                      <p className="font-display text-base font-semibold text-[var(--onda-ink)]">
                        {s.label}
                      </p>
                      <p className="text-sm text-[var(--onda-muted)]">{s.hint}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--onda-primary-500)]">
              <OndaHandMark variant="onPrimary" className="h-6 w-auto" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--onda-ink)]">
                {sessionEmail || user?.email || 'Sesión activa'}
              </p>
              <button
                type="button"
                onClick={() => void logout()}
                className="text-xs font-medium text-[var(--onda-primary-500)]"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col px-4 py-4 sm:px-6 lg:py-8 lg:pr-10">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3 lg:hidden">
            <OndaLogo />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void logout()}
                className="text-xs font-medium text-[var(--onda-primary-500)]"
              >
                Salir
              </button>
              <span className="rounded-full bg-[var(--onda-card)] px-3 py-1 text-xs font-medium text-[var(--onda-muted)] ring-1 ring-[var(--onda-border)]">
                Paso {stepIndex + 1}/{STEPS.length}
              </span>
            </div>
          </div>

          <div className="mb-3 flex shrink-0 gap-2 lg:hidden" aria-label="Progreso">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= stepIndex
                    ? 'bg-[var(--onda-violet)]'
                    : 'bg-[var(--onda-border)]'
                }`}
              />
            ))}
          </div>

          <div className="onda-card flex min-h-0 flex-1 flex-col overflow-hidden p-5 sm:p-7">
            <header className="mb-4 shrink-0 space-y-2 border-b border-[var(--onda-border)] pb-4">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--onda-ink)] sm:text-3xl">
                {header.title}
              </h1>
              <p className="max-w-lg text-sm leading-relaxed text-[var(--onda-muted)]">
                {header.sub}
              </p>
            </header>

            {referrerName && step === 'local' ? (
              <div className="mb-4 flex shrink-0 items-start gap-3 rounded-2xl bg-[var(--onda-sky-soft)] px-4 py-3 text-sm text-[var(--onda-ink)]">
                <span className="mt-0.5 text-[var(--onda-sky)]">
                  {OndaIcons.users}
                </span>
                <div>
                  <p className="font-medium">
                    {isDemoReferral
                      ? 'Código demo de Onda'
                      : `Invitado por ${referrerName}`}
                  </p>
                  <p className="text-[var(--onda-muted)]">
                    {isDemoReferral
                      ? 'Se activa Onda Pro mensual al crear el negocio; no eliges plan.'
                      : 'Ambos ganan un mes gratis con este registro.'}
                  </p>
                </div>
              </div>
            ) : null}

            <div
              key={step}
              className="min-h-0 flex-1 duration-300 ease-out animate-[fadeIn_0.28s_ease-out]"
            >
              {step === 'local' ? (
                <form
                  onSubmit={goNextFromLocal}
                  className="flex h-full min-h-0 flex-col"
                >
                  <FormShell
                    footer={
                      <div className="flex flex-wrap items-center gap-3">
                        <GradientButton
                          type="submit"
                          disabled={busy}
                          className="min-w-[10rem]"
                        >
                          {busy
                            ? 'Creando…'
                            : isDemoReferral
                              ? 'Crear con Onda Pro'
                              : 'Continuar'}
                        </GradientButton>
                      </div>
                    }
                  >
                    <div className="space-y-4 pb-2">
                      <Field label="Nombre del negocio">
                        <input
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Café del Río"
                          className="onda-input"
                        />
                      </Field>
                      <Field
                        label="Slug público"
                        hint="Tu enlace público en Onda (ej. /r/cafe-del-rio). Solo letras, números y guiones."
                      >
                        <div className="onda-input-group">
                          <span className="onda-input-group__prefix">/r/</span>
                          <input
                            required
                            value={slug}
                            onChange={(e) => {
                              setSlugTouched(true);
                              setSlug(normalizeStoreSlug(e.target.value));
                            }}
                            placeholder="cafe-del-rio"
                            className="onda-input"
                          />
                        </div>
                      </Field>
                      <PlacesAddressField
                        value={address}
                        onChange={(next) => {
                          setAddress(next.address);
                          setGooglePlaceId(next.googlePlaceId);
                          setLat(next.lat);
                          setLng(next.lng);
                        }}
                      />
                      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
                        <Field label="Tipo de negocio">
                          <OndaSelect
                            aria-label="Tipo de negocio"
                            value={category}
                            onChange={(v) => setCategory(v as StoreCategory)}
                            options={CATEGORY_OPTIONS}
                          />
                        </Field>
                        <Field label="Categoría">
                          <OndaSelect
                            aria-label="Categoría"
                            value={subcategory}
                            onChange={(v) =>
                              setSubcategory(v as StoreSubcategory)
                            }
                            options={subcategoryOptions}
                          />
                        </Field>
                        <Field label="Subcategoría">
                          <OndaSelect
                            aria-label="Subcategoría"
                            value={segment}
                            onChange={(v) => setSegment(v as StoreSegment)}
                            options={segmentOptions}
                          />
                        </Field>
                      </div>
                      {needsOwnerName ? (
                        <Field label="Tu nombre">
                          <input
                            required
                            value={ownerName}
                            onChange={(e) => setOwnerName(e.target.value)}
                            placeholder="Ana Pérez"
                            className="onda-input"
                          />
                        </Field>
                      ) : null}
                      {needsOwnerEmail ? (
                        <Field label="Email">
                          <input
                            type="email"
                            required
                            value={ownerEmail}
                            onChange={(e) => setOwnerEmail(e.target.value)}
                            placeholder="dueno@negocio.com"
                            className="onda-input"
                          />
                        </Field>
                      ) : null}
                      <Field
                        label="Código de referido"
                        hint="Opcional. Si alguien te invitó, pégalo aquí."
                      >
                        <input
                          value={referralCode}
                          onChange={(e) =>
                            setReferralCode(formatReferralCodeInput(e.target.value))
                          }
                          onBlur={() =>
                            setReferralCode((current) =>
                              sanitizeReferralCode(current)
                            )
                          }
                          placeholder="ABC12345"
                          className="onda-input uppercase tracking-wider"
                        />
                      </Field>
                      {isReferralCodeComplete(referralCode) &&
                      referrerName === '' ? (
                        <p className="text-sm text-[var(--onda-danger)]">
                          Código de referido no válido
                        </p>
                      ) : isReferralCodeComplete(referralCode) &&
                        referrerName === null ? (
                        <p className="text-sm text-[var(--onda-muted)]">
                          Verificando código…
                        </p>
                      ) : null}
                      {error ? (
                        <p className="text-sm text-[var(--onda-danger)]">{error}</p>
                      ) : null}
                    </div>
                  </FormShell>
                </form>
              ) : null}

              {step === 'plan' ? (
                <form
                  onSubmit={submitBusiness}
                  className="flex h-full min-h-0 flex-col"
                >
                  <FormShell
                    footer={
                      <div className="flex flex-wrap items-center gap-3">
                        <GradientButton
                          type="submit"
                          disabled={busy}
                          className="min-w-[10rem]"
                        >
                          {busy
                            ? 'Creando…'
                            : `Activar ${PLAN_META[planType].shortName}`}
                        </GradientButton>
                        <button
                          type="button"
                          className="rounded-full px-4 py-2.5 text-sm font-medium text-[var(--onda-muted)] transition hover:bg-[var(--onda-bg)] hover:text-[var(--onda-ink)]"
                          disabled={busy}
                          onClick={() => setStep('local')}
                        >
                          Volver
                        </button>
                      </div>
                    }
                  >
                    <PlanPicker
                      plan={planType}
                      billing={billingPeriod}
                      onPlan={setPlanType}
                      onBilling={setBillingPeriod}
                    />
                    {error ? (
                      <p className="mt-4 text-sm text-[var(--onda-danger)]">
                        {error}
                      </p>
                    ) : null}
                  </FormShell>
                </form>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
