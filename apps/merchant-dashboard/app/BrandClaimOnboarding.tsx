'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  api,
  GradientButton,
  OndaLogo,
  PasswordInput,
  SkeletonScreen,
} from '@onda/shared-ui';
import {
  formatCop,
  isReferralCodeComplete,
  parseBillingPeriod,
  parsePlanId,
  PLAN_META,
  quotePlanWithDiscount,
  type BillingPeriod,
  type PlanId,
} from '@onda/shared-utils';
import {
  StoreCategory,
  StoreSubcategory,
  STORE_CATEGORY_LABELS,
  STORE_SUBCATEGORY_LABELS,
} from '@onda/shared-types';
import { useMerchantAuth, mapFirebaseAuthError } from '../lib/MerchantAuth';
import { PlanPicker } from './PlanPicker';
import { PaymentCardForm, type PaymentCardResult } from './PaymentCardForm';
import {
  rememberPlanChoice,
  sanitizeReferralCode,
  formatReferralCodeInput,
} from './onboardingQuery';

type Step = 'preview' | 'auth' | 'plan' | 'pay' | 'activating';

type ClaimPreview = {
  storeName: string;
  logoUrl: string | null;
  category: string;
  subcategory: string;
  address?: string | null;
};

type CodeResolveResponse =
  | { kind: 'referral'; code: string; storeName: string }
  | { kind: 'promo'; code: string; discountPercentage: number }
  | { kind: 'expired'; code: string };

export function BrandClaimOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { user, ready, signUp, signIn } = useMerchantAuth();

  const [step, setStep] = useState<Step>('preview');
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');

  const [planType, setPlanType] = useState<PlanId>(
    () => parsePlanId(searchParams.get('plan')) ?? 'BASIC'
  );
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(
    () => parseBillingPeriod(searchParams.get('billing')) ?? '12'
  );
  const [referralCode, setReferralCode] = useState(() =>
    sanitizeReferralCode(searchParams.get('ref'))
  );
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [codeKind, setCodeKind] = useState<
    'promo' | 'referral' | 'expired' | 'invalid' | null
  >(null);
  const [codeReady, setCodeReady] = useState(
    () => !sanitizeReferralCode(searchParams.get('ref'))
  );
  const [wompiConfigured, setWompiConfigured] = useState(false);
  const [wompiPublicKey, setWompiPublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Enlace inválido');
      return;
    }
    void api<ClaimPreview>(`/stores/claim/${token}`)
      .then(setPreview)
      .catch(() => setError('Enlace de asociación inválido o expirado'));
  }, [token]);

  useEffect(() => {
    void api<{ wompiConfigured: boolean; wompiPublicKey: string | null }>(
      '/billing/config'
    ).then((cfg) => {
      setWompiConfigured(cfg.wompiConfigured);
      setWompiPublicKey(cfg.wompiPublicKey || null);
    });
  }, []);

  useEffect(() => {
    const normalized = sanitizeReferralCode(referralCode);
    if (!normalized) {
      setCodeKind(null);
      setDiscountPercentage(0);
      setCodeReady(true);
      return;
    }
    if (!isReferralCodeComplete(normalized)) {
      setCodeKind(null);
      setDiscountPercentage(0);
      setCodeReady(false);
      return;
    }

    setCodeReady(false);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api<CodeResolveResponse>(
        `/referrals/resolve/${encodeURIComponent(normalized)}`
      )
        .then((r) => {
          if (cancelled) return;
          if (r.kind === 'promo') {
            setCodeKind('promo');
            setDiscountPercentage(r.discountPercentage);
            if (r.discountPercentage > 30) setBillingPeriod('monthly');
            setCodeReady(true);
            return;
          }
          if (r.kind === 'referral') {
            setCodeKind('referral');
            setDiscountPercentage(0);
            setCodeReady(true);
            return;
          }
          if (r.kind === 'expired') {
            setCodeKind('expired');
            setDiscountPercentage(0);
            setCodeReady(true);
          }
        })
        .catch(() => {
          if (cancelled) return;
          setCodeKind('invalid');
          setDiscountPercentage(0);
          setCodeReady(true);
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [referralCode]);

  const activeQuote = quotePlanWithDiscount(
    planType,
    billingPeriod,
    discountPercentage
  );
  const freeViaPromo =
    codeKind === 'promo' && activeQuote.skipPayment && codeReady;

  useEffect(() => {
    if (!ready || !user || !token || storeId || !codeReady) return;
    void acceptClaim();
  }, [ready, user, token, storeId, codeReady, freeViaPromo]);

  async function acceptClaim() {
    if (!user || !token) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ storeId: string }>(
        `/stores/claim/${token}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({
            ownerName: user.displayName?.trim() || undefined,
          }),
        }
      );
      setStoreId(res.storeId);
      if (freeViaPromo) {
        setStep('activating');
        setBusy(true);
        rememberPlanChoice(planType, billingPeriod);
        try {
          await api(`/billing/store/${res.storeId}/activate`, {
            method: 'POST',
            body: JSON.stringify({
              planType,
              billingPeriod,
              referralCode: sanitizeReferralCode(referralCode) || undefined,
            }),
          });
          router.replace('/resumen');
          return;
        } catch (err: unknown) {
          setError(
            err instanceof Error ? err.message : 'No se pudo activar el plan'
          );
          setStep('plan');
        }
      } else {
        setStep('plan');
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo asociar el negocio'
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (authMode === 'signup') {
        if (!name.trim()) {
          setError('Indica tu nombre');
          return;
        }
        await signUp(email.trim(), password, name.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(
        mapFirebaseAuthError(
          err,
          authMode === 'signup'
            ? 'No se pudo crear la cuenta'
            : 'No se pudo iniciar sesión'
        ) || ''
      );
    } finally {
      setBusy(false);
    }
  }

  async function activateStore(payment?: PaymentCardResult) {
    if (!storeId) return;
    setError('');
    if (!activeQuote.skipPayment && wompiConfigured && !payment?.cardToken) {
      setError('Completa los datos de la tarjeta');
      return;
    }
    setBusy(true);
    rememberPlanChoice(planType, billingPeriod);
    try {
      await api(`/billing/store/${storeId}/activate`, {
        method: 'POST',
        body: JSON.stringify({
          planType,
          billingPeriod,
          referralCode: sanitizeReferralCode(referralCode) || undefined,
          cardToken: payment?.cardToken,
          acceptanceToken: payment?.acceptanceToken,
          acceptPersonalAuth: payment?.acceptPersonalAuth,
        }),
      });
      router.replace('/resumen');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo activar el plan');
      if (freeViaPromo) setStep('plan');
    } finally {
      setBusy(false);
    }
  }

  if (!ready || (!preview && !error)) {
    return <SkeletonScreen label="Cargando asociación" />;
  }

  if (error && !preview) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-[var(--onda-muted)]">{error}</p>
      </div>
    );
  }

  if (!preview) {
    return <SkeletonScreen label="Cargando asociación" />;
  }

  const categoryLabel =
    STORE_CATEGORY_LABELS[preview.category as StoreCategory] || preview.category;
  const subcategoryLabel =
    STORE_SUBCATEGORY_LABELS[preview.subcategory as StoreSubcategory] ||
    preview.subcategory;

  const urlCode = sanitizeReferralCode(searchParams.get('ref'));
  const codeHint =
    urlCode && codeKind === 'promo' && activeQuote.skipPayment
      ? `Código ${urlCode} aplicado — activación sin costo.`
      : urlCode && codeKind === 'promo'
        ? `Código ${urlCode}: −${discountPercentage}%.`
        : urlCode && codeKind === 'expired'
          ? 'El código del enlace expiró.'
          : urlCode && codeKind === 'invalid'
            ? 'El código del enlace no es válido.'
            : null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--onda-bg)] px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <OndaLogo />

        {step === 'preview' ||
        step === 'activating' ||
        (step === 'auth' && !user) ? (
          <div className="onda-card space-y-4 p-6">
            <div className="flex items-center gap-4">
              {preview.logoUrl ? (
                <img
                  src={preview.logoUrl}
                  alt=""
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : null}
              <div>
                <h1 className="font-display text-xl font-semibold">
                  {preview.storeName}
                </h1>
                <p className="text-sm text-[var(--onda-muted)]">
                  {categoryLabel} · {subcategoryLabel}
                </p>
                {preview.address ? (
                  <p className="text-sm text-[var(--onda-muted)]">{preview.address}</p>
                ) : null}
              </div>
            </div>
            <p className="text-sm text-[var(--onda-muted)]">
              Crea tu cuenta o inicia sesión para administrar este negocio en Onda.
            </p>
            {codeHint ? (
              <p
                className={`text-sm ${
                  codeKind === 'promo'
                    ? 'text-[var(--onda-sky)]'
                    : 'text-[var(--onda-danger)]'
                }`}
              >
                {codeHint}
              </p>
            ) : null}

            {!user ? (
              <form onSubmit={submitAuth} className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1 text-sm ${
                      authMode === 'signup'
                        ? 'bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]'
                        : 'text-[var(--onda-muted)]'
                    }`}
                    onClick={() => setAuthMode('signup')}
                  >
                    Crear cuenta
                  </button>
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1 text-sm ${
                      authMode === 'login'
                        ? 'bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]'
                        : 'text-[var(--onda-muted)]'
                    }`}
                    onClick={() => setAuthMode('login')}
                  >
                    Ya tengo cuenta
                  </button>
                </div>
                {authMode === 'signup' ? (
                  <input
                    className="onda-input w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    required
                  />
                ) : null}
                <input
                  className="onda-input w-full"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Correo"
                  required
                />
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {error ? (
                  <p className="text-sm text-[var(--onda-danger)]">{error}</p>
                ) : null}
                <GradientButton
                  type="submit"
                  disabled={busy || (!!urlCode && !codeReady)}
                  className="w-full"
                >
                  {busy ? 'Entrando…' : 'Continuar'}
                </GradientButton>
              </form>
            ) : busy || step === 'activating' ? (
              <p className="text-sm text-[var(--onda-muted)]">
                {freeViaPromo
                  ? 'Asociando y activando tu negocio…'
                  : 'Asociando negocio…'}
              </p>
            ) : null}
            {error && user ? (
              <p className="text-sm text-[var(--onda-danger)]">{error}</p>
            ) : null}
          </div>
        ) : null}

        {step === 'plan' && storeId ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (activeQuote.skipPayment) {
                void activateStore();
                return;
              }
              setStep('pay');
            }}
            className="onda-card space-y-4 p-6"
          >
            <h2 className="font-display text-lg font-semibold">Elige tu plan</h2>
            <PlanPicker
              plan={planType}
              billing={billingPeriod}
              onPlan={setPlanType}
              onBilling={setBillingPeriod}
              discountPercentage={discountPercentage}
              forceMonthlyOnly={discountPercentage > 30}
              referred={false}
            />
            <input
              className="onda-input w-full"
              value={referralCode}
              onChange={(e) =>
                setReferralCode(formatReferralCodeInput(e.target.value))
              }
              placeholder="Código de referido o promo (opcional)"
            />
            {error ? <p className="text-sm text-[var(--onda-danger)]">{error}</p> : null}
            <GradientButton type="submit" disabled={busy}>
              {activeQuote.skipPayment ? 'Activar' : 'Continuar al pago'}
            </GradientButton>
          </form>
        ) : null}

        {step === 'pay' && storeId ? (
          <div className="onda-card space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Paga y activa</h2>
            <p className="text-sm text-[var(--onda-muted)]">
              Total hoy {formatCop(activeQuote.amountDue)} · {PLAN_META[planType].name}
            </p>
            {wompiConfigured && wompiPublicKey ? (
              <PaymentCardForm
                formId="onda-claim-pay-form"
                publicKey={wompiPublicKey}
                onSubmit={(payment) => void activateStore(payment)}
              />
            ) : null}
            {error ? <p className="text-sm text-[var(--onda-danger)]">{error}</p> : null}
            <GradientButton
              type="button"
              disabled={busy}
              onClick={() => {
                if (!wompiConfigured) {
                  void activateStore();
                  return;
                }
                const form = document.getElementById(
                  'onda-claim-pay-form'
                ) as HTMLFormElement | null;
                form?.requestSubmit();
              }}
            >
              {busy ? 'Procesando…' : `Activar ${formatCop(activeQuote.amountDue)}`}
            </GradientButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
