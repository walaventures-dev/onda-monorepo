'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  api,
  GradientButton,
  OndaLogo,
  OndaSelect,
  PlacesAddressField,
  PassPreview,
  ImageUploadField,
  OndaColorPicker,
  OndaIcons,
  PROMO_TYPE_OPTIONS,
  type PromoTypeKey,
} from '@onda/shared-ui';
import {
  StoreCategory,
  StoreSubcategory,
  STORE_CATEGORY_LABELS,
  STORE_SUBCATEGORY_LABELS,
  STORE_SUBCATEGORIES_BY_CATEGORY,
} from '@onda/shared-types';
import { derivePassPalette, normalizeStoreSlug } from '@onda/shared-utils';

type Step = 1 | 2 | 3;
type PlanChoice = 'BASIC' | 'PRO';

type DesignForm = {
  title: string;
  subtitle: string;
  logoUrl: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
};

const PLAN_OPTIONS: Array<{
  id: PlanChoice;
  name: string;
  price: string;
  blurb: string;
  features: string[];
}> = [
  {
    id: 'BASIC',
    name: 'Básico Lite',
    price: '$49.900',
    blurb: 'Ideal para empezar',
    features: ['Pases ilimitados', '150 msgs WhatsApp/mes'],
  },
  {
    id: 'PRO',
    name: 'PRO Crecimiento',
    price: '$79.900',
    blurb: 'Para crecer más rápido',
    features: ['350 msgs WhatsApp/mes', 'NPS, GPS y review gating'],
  },
];

function parsePlanParam(raw: string | null): PlanChoice {
  const v = (raw || '').trim().toUpperCase();
  return v === 'PRO' ? 'PRO' : 'BASIC';
}

/** Extrae solo el código limpio de ?ref= (evita texto pegado por share). */
function sanitizeReferralCode(raw: string | null): string {
  const decoded = (raw || '').trim().toUpperCase();
  const match = decoded.match(/^[A-Z0-9]{4,16}/);
  return match?.[0] || '';
}

const CATEGORY_OPTIONS = (
  Object.keys(STORE_CATEGORY_LABELS) as StoreCategory[]
).map((id) => ({ id, label: STORE_CATEGORY_LABELS[id] }));

const STEPS: Array<{ id: Step; label: string; hint: string; icon: ReactNode }> = [
  {
    id: 1,
    label: 'Negocio',
    hint: 'Datos y ubicación',
    icon: OndaIcons.near,
  },
  {
    id: 2,
    label: 'Tarjeta',
    hint: 'Diseño wallet',
    icon: OndaIcons.pass,
  },
  {
    id: 3,
    label: 'Promo',
    hint: 'Primera recompensa',
    icon: OndaIcons.redeem,
  },
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

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
      {children}
    </p>
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

export function MerchantOnboarding({
  onCompleted,
}: {
  onCompleted?: (storeId: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refFromUrl = sanitizeReferralCode(searchParams.get('ref'));
  const planFromUrl = parsePlanParam(searchParams.get('plan'));

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storeId, setStoreId] = useState('');
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [planType, setPlanType] = useState<PlanChoice>(planFromUrl);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState<string | undefined>();
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [ownerName, setOwnerName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState<StoreCategory>(
    StoreCategory.RESTAURANT
  );
  const [subcategory, setSubcategory] = useState<StoreSubcategory>(
    StoreSubcategory.CAFE
  );
  const [ownerEmail, setOwnerEmail] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [referralCode, setReferralCode] = useState(refFromUrl);

  const [design, setDesign] = useState<DesignForm>({
    title: '',
    subtitle: 'Programa de lealtad Onda',
    logoUrl: '',
    backgroundColor: '#052DDE',
    foregroundColor: '#FFFFFF',
    labelColor: '#E5F6FC',
  });

  const [promoTitle, setPromoTitle] = useState('');
  const [promoType, setPromoType] = useState<PromoTypeKey>('PRODUCT');
  const [promoPoints, setPromoPoints] = useState('5');
  const [productName, setProductName] = useState('');
  const [promoValue, setPromoValue] = useState('');
  const [buyQuantity, setBuyQuantity] = useState('2');
  const [getQuantity, setGetQuantity] = useState('1');
  const [expiryMode, setExpiryMode] = useState<'' | 'TIME' | 'QUANTITY'>(
    'QUANTITY'
  );
  const [endsAt, setEndsAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('50');

  const subcategoryOptions = useMemo(
    () =>
      STORE_SUBCATEGORIES_BY_CATEGORY[category].map((id) => ({
        id,
        label: STORE_SUBCATEGORY_LABELS[id],
      })),
    [category]
  );

  useEffect(() => {
    setPlanType(parsePlanParam(searchParams.get('plan')));
  }, [searchParams]);

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
    if (!slugTouched) {
      setSlug(normalizeStoreSlug(name));
    }
  }, [name, slugTouched]);

  useEffect(() => {
    if (!referralCode) {
      setReferrerName(null);
      return;
    }
    let cancelled = false;
    api<{ code: string; storeName: string }>(
      `/referrals/resolve/${encodeURIComponent(referralCode)}`
    )
      .then((r) => {
        if (!cancelled) setReferrerName(r.storeName);
      })
      .catch(() => {
        if (!cancelled) setReferrerName('');
      });
    return () => {
      cancelled = true;
    };
  }, [referralCode]);

  function finish(id: string) {
    onCompleted?.(id);
    try {
      localStorage.setItem('onda-merchant-store-id', id);
    } catch {
      /* ignore */
    }
    router.push('/resumen');
  }

  async function submitStep1(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const created = await api<any>('/stores', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: normalizeStoreSlug(slug),
          ownerName: ownerName.trim(),
          category,
          subcategory,
          pinCode,
          ownerEmail: ownerEmail.trim() || undefined,
          address: address.trim() || undefined,
          googlePlaceId,
          lat,
          lng,
          referralCode: referralCode.trim() || undefined,
          planType,
        }),
      });
      setStoreId(created.id);
      setDesign((d) => ({
        ...d,
        title: created.passDesign?.title || name.trim(),
        subtitle:
          created.passDesign?.subtitle || 'Programa de lealtad Onda',
        backgroundColor:
          created.passDesign?.backgroundColor || d.backgroundColor,
        foregroundColor:
          created.passDesign?.foregroundColor || d.foregroundColor,
        labelColor: created.passDesign?.labelColor || d.labelColor,
        logoUrl: created.passDesign?.logoUrl || '',
      }));
      setStep(2);
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear el negocio');
    } finally {
      setBusy(false);
    }
  }

  async function submitStep2(e: FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    setError('');
    setBusy(true);
    try {
      await api(`/pass-designs/store/${storeId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: design.title.trim() || name.trim(),
          subtitle: design.subtitle.trim() || undefined,
          logoUrl: design.logoUrl || undefined,
          backgroundColor: design.backgroundColor,
          foregroundColor: design.foregroundColor,
          labelColor: design.labelColor,
        }),
      });
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar el diseño');
    } finally {
      setBusy(false);
    }
  }

  async function submitStep3(e: FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    setError('');
    if (!promoTitle.trim()) {
      setError('Indica el título de la recompensa');
      return;
    }
    if (!expiryMode) {
      setError('Indica cómo caduca la promo');
      return;
    }
    if (expiryMode === 'TIME' && !endsAt) {
      setError('Indica la fecha de caducidad');
      return;
    }
    if (
      expiryMode === 'QUANTITY' &&
      (!maxRedemptions || Number(maxRedemptions) < 1)
    ) {
      setError('Indica el máximo de redenciones');
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        storeId,
        title: promoTitle.trim(),
        pointsRequired: Number(promoPoints) || 5,
        isActive: true,
        type: promoType,
        expiryMode,
      };
      if (expiryMode === 'TIME') body.endsAt = endsAt;
      if (expiryMode === 'QUANTITY') {
        body.maxRedemptions = Number(maxRedemptions);
      }
      if (promoType === 'PERCENT_OFF' || promoType === 'AMOUNT_OFF') {
        body.value = Number(promoValue) || 0;
      }
      if (promoType === 'BUY_GET') {
        body.buyQuantity = Number(buyQuantity) || 1;
        body.getQuantity = Number(getQuantity) || 1;
      }
      if (promoType === 'PRODUCT') {
        body.productName = productName.trim() || promoTitle.trim();
        if (promoValue) body.value = Number(promoValue);
      }
      await api('/promotions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      finish(storeId);
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear la promo');
    } finally {
      setBusy(false);
    }
  }

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
        {/* Brand panel */}
        <aside className="hidden min-h-0 flex-col justify-between overflow-y-auto overscroll-contain px-10 py-10 lg:flex xl:px-14">
          <div>
            <OndaLogo />
            <p className="mt-10 font-display text-4xl font-semibold leading-tight tracking-tight text-[var(--onda-ink)] xl:text-5xl">
              Activa Onda
              <br />
              en tu negocio
            </p>
            <p className="mt-4 max-w-sm text-[var(--onda-muted)]">
              Alta sencilla: datos del local, diseño de tu pase wallet y la
              primera recompensa para tus clientes.
            </p>

            <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--onda-violet-soft)] px-4 py-2 text-sm font-medium text-[var(--onda-violet)]">
              {OndaIcons.sparkle}
              1 mes gratis al registrarte
            </div>

            <ul className="mt-10 space-y-4">
              {STEPS.map((s) => {
                const active = s.id === step;
                const done = s.id < step;
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

          <p className="mt-8 text-xs text-[var(--onda-muted)]">
            ¿Ya tienes cuenta? Entra al panel y selecciona tu sede.
          </p>
        </aside>

        {/* Form panel */}
        <main className="flex min-h-0 flex-col px-4 py-4 sm:px-6 lg:py-8 lg:pr-10">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3 lg:hidden">
            <OndaLogo />
            <span className="rounded-full bg-[var(--onda-card)] px-3 py-1 text-xs font-medium text-[var(--onda-muted)] ring-1 ring-[var(--onda-border)]">
              Paso {step}/3
            </span>
          </div>

          {/* Mobile step pills */}
          <div className="mb-3 flex shrink-0 gap-2 lg:hidden" aria-label="Progreso">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s.id <= step
                    ? 'bg-[var(--onda-violet)]'
                    : 'bg-[var(--onda-border)]'
                }`}
              />
            ))}
          </div>

          <div className="onda-card flex min-h-0 flex-1 flex-col overflow-hidden p-5 sm:p-7">
            <header className="mb-4 shrink-0 space-y-2 border-b border-[var(--onda-border)] pb-4">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--onda-ink)] sm:text-3xl">
                {step === 1
                  ? 'Registra tu comercio'
                  : step === 2
                    ? 'Diseña tu tarjeta'
                    : 'Tu primera recompensa'}
              </h1>
              <p className="max-w-lg text-sm leading-relaxed text-[var(--onda-muted)]">
                {step === 1
                  ? 'Completa los datos básicos. Empiezas con 1 mes gratis.'
                  : step === 2
                    ? 'Así se verá el pase en Apple y Google Wallet. Puedes ajustarlo después.'
                    : 'Define qué ganan tus clientes al acumular ondas. También puedes saltar.'}
              </p>
            </header>

            {referrerName && step === 1 ? (
              <div className="mb-4 flex shrink-0 items-start gap-3 rounded-2xl bg-[var(--onda-sky-soft)] px-4 py-3 text-sm text-[var(--onda-ink)]">
                <span className="mt-0.5 text-[var(--onda-sky)]">{OndaIcons.users}</span>
                <div>
                  <p className="font-medium">Invitado por {referrerName}</p>
                  <p className="text-[var(--onda-muted)]">
                    Ambos ganan un mes gratis con este registro.
                  </p>
                </div>
              </div>
            ) : null}

            <div
              key={step}
              className="min-h-0 flex-1 duration-300 ease-out animate-[fadeIn_0.28s_ease-out]"
            >
              {step === 1 ? (
                <form onSubmit={submitStep1} className="flex h-full min-h-0 flex-col">
                  <FormShell
                    footer={
                      <div className="flex flex-wrap items-center gap-3">
                        <GradientButton
                          type="submit"
                          disabled={busy || pinCode.length < 4}
                          className="min-w-[10rem]"
                        >
                          {busy ? 'Creando…' : 'Continuar'}
                        </GradientButton>
                        <p className="text-xs text-[var(--onda-muted)]">
                          Luego personalizas el pase y la promo.
                        </p>
                      </div>
                    }
                  >
                  <div className="space-y-6 pb-2">
                    <div className="space-y-4">
                      <SectionTitle>Identidad</SectionTitle>
                      <Field label="Nombre del negocio">
                        <input
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Café del Río"
                          className="onda-input"
                        />
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
                      <Field label="Nombre del encargado">
                        <input
                          required
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          placeholder="Ana Pérez"
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
                    </div>

                    <div className="space-y-4">
                      <SectionTitle>Plan</SectionTitle>
                      <p className="text-xs text-[var(--onda-muted)]">
                        El primer mes es gratis en ambos planes.
                        {planFromUrl === planType && searchParams.get('plan') ? (
                          <> Seleccionado desde la landing.</>
                        ) : null}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {PLAN_OPTIONS.map((p) => {
                          const selected = planType === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPlanType(p.id)}
                              className={`rounded-2xl border px-4 py-4 text-left transition ${
                                selected
                                  ? 'border-[var(--onda-violet)] bg-[var(--onda-violet-soft)] shadow-[0_8px_20px_rgba(5,45,222,0.12)]'
                                  : 'border-[var(--onda-border)] bg-[var(--onda-card)] hover:border-[var(--onda-bridge)]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-display text-base font-semibold text-[var(--onda-ink)]">
                                    {p.name}
                                  </p>
                                  <p className="mt-0.5 text-xs text-[var(--onda-muted)]">
                                    {p.blurb}
                                  </p>
                                </div>
                                <span
                                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                    selected
                                      ? 'bg-[var(--onda-violet)] text-white'
                                      : 'ring-1 ring-[var(--onda-border)]'
                                  }`}
                                  aria-hidden
                                >
                                  {selected ? OndaIcons.check : null}
                                </span>
                              </div>
                              <p className="mt-3 font-display text-xl font-semibold text-[var(--onda-violet)]">
                                {p.price}
                                <span className="text-sm font-normal text-[var(--onda-muted)]">
                                  {' '}
                                  /mes
                                </span>
                              </p>
                              <ul className="mt-3 space-y-1 text-xs text-[var(--onda-muted)]">
                                {p.features.map((f) => (
                                  <li key={f}>• {f}</li>
                                ))}
                              </ul>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <SectionTitle>Categoría</SectionTitle>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Tipo de negocio">
                          <OndaSelect
                            aria-label="Tipo de negocio"
                            value={category}
                            onChange={(v) => setCategory(v as StoreCategory)}
                            options={CATEGORY_OPTIONS}
                          />
                        </Field>
                        <Field label="Subcategoría">
                          <OndaSelect
                            aria-label="Subcategoría"
                            value={subcategory}
                            onChange={(v) =>
                              setSubcategory(v as StoreSubcategory)
                            }
                            options={subcategoryOptions}
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <SectionTitle>Acceso</SectionTitle>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Email">
                          <input
                            type="email"
                            value={ownerEmail}
                            onChange={(e) => setOwnerEmail(e.target.value)}
                            placeholder="dueno@negocio.com"
                            className="onda-input"
                          />
                        </Field>
                        <Field
                          label="PIN de caja"
                          hint="4 dígitos para aprobar acumulaciones"
                        >
                          <input
                            required
                            inputMode="numeric"
                            pattern="[0-9]{4}"
                            maxLength={4}
                            value={pinCode}
                            onChange={(e) =>
                              setPinCode(
                                e.target.value.replace(/\D/g, '').slice(0, 4)
                              )
                            }
                            placeholder="••••"
                            className="onda-input tracking-[0.35em]"
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <SectionTitle>Referido</SectionTitle>
                      <Field
                        label="Código de referido"
                        hint="Opcional. Si alguien te invitó, pégalo aquí."
                      >
                        <input
                          value={referralCode}
                          onChange={(e) =>
                            setReferralCode(e.target.value.trim().toUpperCase())
                          }
                          placeholder="ABC12345"
                          className="onda-input uppercase tracking-wider"
                        />
                      </Field>
                      {referralCode && referrerName === '' ? (
                        <p className="text-sm text-[var(--onda-danger)]">
                          Código de referido no válido
                        </p>
                      ) : referralCode && referrerName === null ? (
                        <p className="text-sm text-[var(--onda-muted)]">
                          Verificando código…
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {error ? (
                    <p className="mt-5 text-sm text-[var(--onda-danger)]">{error}</p>
                  ) : null}
                  </FormShell>
                </form>
              ) : null}

              {step === 2 ? (
                <form onSubmit={submitStep2} className="flex h-full min-h-0 flex-col">
                  <FormShell
                    footer={
                      <div className="flex flex-wrap items-center gap-3">
                        <GradientButton type="submit" disabled={busy} className="min-w-[10rem]">
                          {busy ? 'Guardando…' : 'Continuar'}
                        </GradientButton>
                        <button
                          type="button"
                          className="rounded-full px-4 py-2.5 text-sm font-medium text-[var(--onda-muted)] transition hover:bg-[var(--onda-bg)] hover:text-[var(--onda-ink)]"
                          disabled={busy}
                          onClick={() => setStep(3)}
                        >
                          Saltar por ahora
                        </button>
                      </div>
                    }
                  >
                  <div className="grid gap-8 pb-2 lg:grid-cols-[1fr_minmax(240px,280px)]">
                    <div className="space-y-4">
                      <SectionTitle>Marca</SectionTitle>
                      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                        <ImageUploadField
                          label="Logo"
                          hint="JPG, PNG o WEBP"
                          aspectClass="aspect-square"
                          value={design.logoUrl}
                          onChange={(logoUrl) =>
                            setDesign({ ...design, logoUrl })
                          }
                        />
                        <div className="space-y-4">
                          <OndaColorPicker
                            label="Color de marca"
                            value={design.backgroundColor}
                            fallback="#052DDE"
                            onChange={(backgroundColor) =>
                              setDesign({
                                ...design,
                                ...derivePassPalette(backgroundColor),
                              })
                            }
                          />
                          <p className="text-xs leading-snug text-[var(--onda-muted)]">
                            El texto y las etiquetas se ajustan solos para
                            contraste.
                          </p>
                        </div>
                      </div>
                      <Field label="Título">
                        <input
                          value={design.title}
                          onChange={(e) =>
                            setDesign({ ...design, title: e.target.value })
                          }
                          className="onda-input"
                        />
                      </Field>
                      <Field label="Subtítulo">
                        <input
                          value={design.subtitle}
                          onChange={(e) =>
                            setDesign({ ...design, subtitle: e.target.value })
                          }
                          className="onda-input"
                        />
                      </Field>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <SectionTitle>Vista previa</SectionTitle>
                      <div className="w-full max-w-[280px]">
                        <PassPreview
                          title={design.title || name || 'Tu negocio'}
                          subtitle={design.subtitle}
                          logoUrl={design.logoUrl || undefined}
                          backgroundColor={design.backgroundColor}
                          foregroundColor={design.foregroundColor}
                          labelColor={design.labelColor}
                          points={3}
                          maxStamps={12}
                          memberName="Cliente"
                          compact
                        />
                      </div>
                    </div>
                  </div>

                  {error ? (
                    <p className="mt-5 text-sm text-[var(--onda-danger)]">{error}</p>
                  ) : null}
                  </FormShell>
                </form>
              ) : null}

              {step === 3 ? (
                <form onSubmit={submitStep3} className="flex h-full min-h-0 flex-col">
                  <FormShell
                    footer={
                      <div className="flex flex-wrap items-center gap-3">
                        <GradientButton type="submit" disabled={busy}>
                          {busy ? 'Creando…' : 'Crear y entrar al panel'}
                        </GradientButton>
                        <button
                          type="button"
                          className="rounded-full px-4 py-2.5 text-sm font-medium text-[var(--onda-muted)] transition hover:bg-[var(--onda-bg)] hover:text-[var(--onda-ink)]"
                          disabled={busy}
                          onClick={() => finish(storeId)}
                        >
                          Saltar por ahora
                        </button>
                      </div>
                    }
                  >
                  <div className="space-y-6 pb-2">
                    <div className="space-y-4">
                      <SectionTitle>Recompensa</SectionTitle>
                      <Field label="Título">
                        <input
                          required
                          value={promoTitle}
                          onChange={(e) => setPromoTitle(e.target.value)}
                          placeholder="Café cortesía"
                          className="onda-input"
                        />
                      </Field>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-[var(--onda-ink)]">
                          Tipo
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {PROMO_TYPE_OPTIONS.map((o) => {
                            const selected = promoType === o.id;
                            return (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => setPromoType(o.id)}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                                  selected
                                    ? 'bg-[var(--onda-violet)] text-white shadow-[0_6px_16px_rgba(5,45,222,0.22)]'
                                    : 'bg-[var(--onda-bg)] text-[var(--onda-muted)] ring-1 ring-[var(--onda-border)] hover:text-[var(--onda-ink)]'
                                }`}
                              >
                                {o.icon}
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {promoType === 'PRODUCT' ? (
                        <Field label="Producto">
                          <input
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            placeholder="Café americano"
                            className="onda-input"
                          />
                        </Field>
                      ) : null}

                      {promoType === 'PERCENT_OFF' ||
                      promoType === 'AMOUNT_OFF' ? (
                        <Field
                          label={
                            promoType === 'PERCENT_OFF'
                              ? 'Porcentaje'
                              : 'Valor (COP)'
                          }
                        >
                          <input
                            inputMode="decimal"
                            value={promoValue}
                            onChange={(e) => setPromoValue(e.target.value)}
                            placeholder={
                              promoType === 'PERCENT_OFF' ? '10' : '5000'
                            }
                            className="onda-input"
                          />
                        </Field>
                      ) : null}

                      {promoType === 'BUY_GET' ? (
                        <div className="grid grid-cols-2 gap-4">
                          <Field label="Compra">
                            <input
                              inputMode="numeric"
                              value={buyQuantity}
                              onChange={(e) => setBuyQuantity(e.target.value)}
                              className="onda-input"
                            />
                          </Field>
                          <Field label="Lleva">
                            <input
                              inputMode="numeric"
                              value={getQuantity}
                              onChange={(e) => setGetQuantity(e.target.value)}
                              className="onda-input"
                            />
                          </Field>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-4">
                      <SectionTitle>Reglas</SectionTitle>
                      <Field
                        label="Ondas requeridas"
                        hint="Cuántos sellos necesita el cliente para canjear"
                      >
                        <input
                          inputMode="numeric"
                          value={promoPoints}
                          onChange={(e) => setPromoPoints(e.target.value)}
                          className="onda-input"
                        />
                      </Field>

                      <Field label="Caducidad">
                        <OndaSelect
                          aria-label="Caducidad"
                          value={expiryMode}
                          onChange={(v) =>
                            setExpiryMode(v as '' | 'TIME' | 'QUANTITY')
                          }
                          options={[
                            {
                              id: 'QUANTITY',
                              label: 'Por cantidad de redenciones',
                            },
                            { id: 'TIME', label: 'Por fecha' },
                          ]}
                        />
                      </Field>

                      {expiryMode === 'TIME' ? (
                        <Field label="Disponible hasta">
                          <input
                            type="date"
                            value={endsAt}
                            onChange={(e) => setEndsAt(e.target.value)}
                            className="onda-input"
                          />
                        </Field>
                      ) : null}

                      {expiryMode === 'QUANTITY' ? (
                        <Field label="Máximo de redenciones">
                          <input
                            inputMode="numeric"
                            value={maxRedemptions}
                            onChange={(e) => setMaxRedemptions(e.target.value)}
                            className="onda-input"
                          />
                        </Field>
                      ) : null}
                    </div>
                  </div>

                  {error ? (
                    <p className="mt-5 text-sm text-[var(--onda-danger)]">{error}</p>
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
