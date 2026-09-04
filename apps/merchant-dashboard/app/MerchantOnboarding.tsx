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
  quotePlanWithDiscount,
  formatCop,
  type BillingPeriod,
  type PlanId,
} from '@onda/shared-utils';
import { useMerchantAuth } from '../lib/MerchantAuth';
import { MerchantSignup } from './MerchantSignup';
import { PlanPicker } from './PlanPicker';
import { PaymentCardForm, type PaymentCardResult } from './PaymentCardForm';
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

type SetupStep = 'local' | 'plan' | 'pay';

type CodeKind = 'referral' | 'promo' | 'expired' | null;

type CodeResolveResponse =
  | { kind: 'referral'; code: string; storeName: string }
  | { kind: 'promo'; code: string; discountPercentage: number }
  | { kind: 'expired'; code: string };

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
  { id: 'pay', label: 'Pago', hint: 'Activar', icon: OndaIcons.sparkle },
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
  const [codeKind, setCodeKind] = useState<CodeKind>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [wompiConfigured, setWompiConfigured] = useState(false);
  const [wompiPublicKey, setWompiPublicKey] = useState<string | null>(null);

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
    let cancelled = false;
    api<{ wompiConfigured: boolean; wompiPublicKey: string | null }>(
      '/billing/config'
    )
      .then((cfg) => {
        if (cancelled) return;
        setWompiConfigured(cfg.wompiConfigured);
        setWompiPublicKey(
          cfg.wompiPublicKey ||
            process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ||
            null
        );
      })
      .catch(() => {
        /* keep env defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      setCodeKind(null);
      setDiscountPercentage(0);
      return;
    }

    setReferrerName(null);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api<CodeResolveResponse>(
        `/referrals/resolve/${encodeURIComponent(normalized)}`
      )
        .then((r) => {
          if (cancelled) return;
          if (r.kind === 'referral') {
            setCodeKind('referral');
            setReferrerName(r.storeName);
            setDiscountPercentage(0);
            return;
          }
          if (r.kind === 'promo') {
            setCodeKind('promo');
            setReferrerName('Promo Onda');
            setDiscountPercentage(r.discountPercentage);
            if (r.discountPercentage > 30) {
              setBillingPeriod('monthly');
            }
            return;
          }
          if (r.kind === 'expired') {
            setCodeKind('expired');
            setReferrerName('');
            setDiscountPercentage(0);
          }
        })
        .catch(() => {
          if (cancelled) return;
          setCodeKind(null);
          setReferrerName('');
          setDiscountPercentage(0);
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
      if (codeKind === 'expired') {
        setError('Este código expiró');
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
    setStep('plan');
  }

  const activeQuote = quotePlanWithDiscount(
    planType,
    billingPeriod,
    discountPercentage
  );
  const forceMonthlyOnly = discountPercentage > 30;
  const isReferred = codeKind === 'referral';

  function goNextFromPlan(e: FormEvent) {
    e.preventDefault();
    setError('');
    rememberPlanChoice(planType, billingPeriod);
    if (activeQuote.skipPayment) {
      void submitWithSubscription();
      return;
    }
    setStep('pay');
  }

  async function submitWithSubscription(payment?: PaymentCardResult) {
    setError('');
    const slugValue = normalizeStoreSlug(slug);
    if (!slugValue) {
      setError('El slug es inválido');
      return;
    }
    if (!activeQuote.skipPayment && wompiConfigured && !payment?.cardToken) {
      setError('Completa los datos de la tarjeta');
      return;
    }
    setBusy(true);
    rememberPlanChoice(planType, billingPeriod);
    try {
      const created = await api<{ id: string }>('/stores/with-subscription', {
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
          planType,
          billingPeriod,
          cardToken: payment?.cardToken,
          acceptanceToken: payment?.acceptanceToken,
          acceptPersonalAuth: payment?.acceptPersonalAuth,
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
      : step === 'plan'
        ? {
            title: 'Elige tu plan',
            sub: activeQuote.skipPayment
              ? 'Total $0 con tu código. Activas sin tarjeta.'
              : 'Pagas hoy el periodo elegido. Guardamos tu tarjeta para renovar.',
          }
        : {
            title: 'Paga y activa',
            sub: `Total hoy ${formatCop(activeQuote.amountDue)}. Cobro seguro con Wompi.`,
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
              {PLAN_META[planType].name}
              {discountPercentage > 0
                ? ` · −${discountPercentage}%`
                : isReferred
                  ? ' · referido'
                  : ''}
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

            {codeKind === 'expired' && step === 'local' ? (
              <div className="mb-4 flex shrink-0 items-start gap-3 rounded-2xl bg-[var(--onda-danger)]/10 px-4 py-3 text-sm text-[var(--onda-danger)]">
                <span className="mt-0.5">{OndaIcons.users}</span>
                <div>
                  <p className="font-medium">Este código expiró</p>
                  <p>Prueba otro código o continúa sin él.</p>
                </div>
              </div>
            ) : referrerName && codeKind !== 'expired' && step === 'local' ? (
              <div className="mb-4 flex shrink-0 items-start gap-3 rounded-2xl bg-[var(--onda-sky-soft)] px-4 py-3 text-sm text-[var(--onda-ink)]">
                <span className="mt-0.5 text-[var(--onda-sky)]">
                  {OndaIcons.users}
                </span>
                <div>
                  <p className="font-medium">
                    {codeKind === 'promo'
                      ? `Descuento del ${discountPercentage}%`
                      : `Invitado por ${referrerName}`}
                  </p>
                  <p className="text-[var(--onda-muted)]">
                    {codeKind === 'promo'
                      ? forceMonthlyOnly
                        ? 'Solo aplica en plan mensual.'
                        : 'Se aplica al total del periodo que elijas.'
                      : 'Al pagar, ambos ganan +30 días en la fecha de cobro.'}
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
                          {busy ? 'Creando…' : 'Continuar'}
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
                      {category !== StoreCategory.BRAND ? (
                        <PlacesAddressField
                          value={address}
                          onChange={(next) => {
                            setAddress(next.address);
                            setGooglePlaceId(next.googlePlaceId);
                            setLat(next.lat);
                            setLng(next.lng);
                          }}
                        />
                      ) : null}
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
                      codeKind === 'expired' ? (
                        <p className="text-sm text-[var(--onda-danger)]">
                          Este código expiró
                        </p>
                      ) : isReferralCodeComplete(referralCode) &&
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
                  onSubmit={goNextFromPlan}
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
                            ? 'Activando…'
                            : activeQuote.skipPayment
                              ? `Activar ${PLAN_META[planType].shortName}`
                              : 'Continuar al pago'}
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
                      discountPercentage={discountPercentage}
                      forceMonthlyOnly={forceMonthlyOnly}
                      referred={isReferred}
                    />
                    {error ? (
                      <p className="mt-4 text-sm text-[var(--onda-danger)]">
                        {error}
                      </p>
                    ) : null}
                  </FormShell>
                </form>
              ) : null}

              {step === 'pay' ? (
                <div className="flex h-full min-h-0 flex-col">
                  <FormShell
                    footer={
                      <div className="flex flex-wrap items-center gap-3">
                        <GradientButton
                          type="button"
                          disabled={
                            busy ||
                            (wompiConfigured && !wompiPublicKey)
                          }
                          className="min-w-[10rem]"
                          onClick={() => {
                            if (!wompiConfigured) {
                              void submitWithSubscription();
                              return;
                            }
                            const form = document.getElementById(
                              'onda-pay-form'
                            ) as HTMLFormElement | null;
                            form?.requestSubmit();
                          }}
                        >
                          {busy
                            ? 'Procesando…'
                            : wompiConfigured
                              ? `Pagar ${formatCop(activeQuote.amountDue)}`
                              : `Activar ${formatCop(activeQuote.amountDue)}`}
                        </GradientButton>
                        <button
                          type="button"
                          className="rounded-full px-4 py-2.5 text-sm font-medium text-[var(--onda-muted)] transition hover:bg-[var(--onda-bg)] hover:text-[var(--onda-ink)]"
                          disabled={busy}
                          onClick={() => setStep('plan')}
                        >
                          Volver
                        </button>
                      </div>
                    }
                  >
                    <div className="space-y-4 pb-2">
                      <p className="text-sm text-[var(--onda-muted)]">
                        {PLAN_META[planType].name} ·{' '}
                        {billingPeriod === 'monthly'
                          ? 'mensual'
                          : billingPeriod === '6'
                            ? '6 meses'
                            : '12 meses'}{' '}
                        · {formatCop(activeQuote.amountDue)}
                      </p>
                      {wompiConfigured ? (
                        wompiPublicKey ? (
                          <PaymentCardForm
                            publicKey={wompiPublicKey}
                            busy={busy}
                            onSubmit={(payment) =>
                              submitWithSubscription(payment)
                            }
                          />
                        ) : (
                          <p className="text-sm text-[var(--onda-danger)]">
                            Wompi no está configurado. Revisa las llaves en el
                            servidor.
                          </p>
                        )
                      ) : (
                        <p className="text-sm text-[var(--onda-muted)]">
                          Wompi no está configurado en este entorno. Puedes
                          activar la suscripción en modo desarrollo sin tarjeta.
                        </p>
                      )}
                      {error ? (
                        <p className="text-sm text-[var(--onda-danger)]">
                          {error}
                        </p>
                      ) : null}
                    </div>
                  </FormShell>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
