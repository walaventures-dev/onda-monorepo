'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Armchair,
  Bed,
  Bell,
  Broom,
  Buildings,
  Clock,
  CurrencyCircleDollar,
  ForkKnife,
  HandWaving,
  MapPin,
  ShoppingBag,
  Sparkle,
  Storefront,
  Wrench,
  type Icon,
} from '@phosphor-icons/react';
import { api, SkeletonPwa } from '@onda/shared-ui';
import type { FeedbackDimensionDto, FeedbackSubmitResponse } from '@onda/shared-types';
import { loadSession, type CustomerSession } from '../../../../lib/session';
import { OtpStep } from '../OtpStep';

type Step = 'loading' | 'otp' | 'sentiment' | 'dimensions' | 'comment' | 'success';

const ICON_MAP: Record<string, Icon> = {
  HandWaving,
  ForkKnife,
  Clock,
  Armchair,
  CurrencyCircleDollar,
  Sparkle,
  ShoppingBag,
  Storefront,
  Bell,
  Bed,
  Broom,
  MapPin,
  Buildings,
  Wrench,
};

function FeedbackIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICON_MAP[name] || Sparkle;
  return <Cmp className={className} weight="duotone" aria-hidden />;
}

function SuccessAnimation({ positive }: { positive: boolean }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="relative flex h-28 w-28 items-center justify-center animate-[onda-pop_0.5s_ease-out]">
        <img
          src={positive ? '/brand/positive.png' : '/brand/negative.png'}
          alt=""
          className="h-24 w-24 object-contain"
          draggable={false}
        />
      </div>
      <h2 className="onda-pwa-headline mt-6">
        {positive ? '¡Gracias por contarnos!' : 'Gracias por tu honestidad'}
      </h2>
      <p className="onda-pwa-sub mt-2 max-w-xs">
        {positive
          ? 'Nos alegra que hayas tenido una buena experiencia.'
          : 'Tu opinión nos ayuda a mejorar. El negocio ya fue notificado.'}
      </p>
    </div>
  );
}

function FeedbackFlowInner() {
  const params = useParams<{ storeId: string }>();
  const searchParams = useSearchParams();
  const storeKey = params.storeId;
  const passFromQuery = searchParams.get('pass') || '';

  const [step, setStep] = useState<Step>('loading');
  const [store, setStore] = useState<any>(null);
  const [pass, setPass] = useState<any>(null);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [passId, setPassId] = useState('');
  const [dimensions, setDimensions] = useState<FeedbackDimensionDto[]>([]);
  const [sentiment, setSentiment] = useState<'POSITIVE' | 'NEGATIVE' | null>(null);
  const [selectedDims, setSelectedDims] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FeedbackSubmitResponse | null>(null);

  const source = useMemo(() => {
    return passFromQuery ? 'POST_ACCUMULATE' : 'MANUAL';
  }, [passFromQuery]);

  const storeDesign = useMemo(
    () =>
      pass?.passDesign ||
      pass?.cartilla?.passDesign ||
      store?.passDesign,
    [pass, store]
  );
  const storeName = store?.name || 'Tu experiencia';
  const logoUrl = storeDesign?.logoUrl as string | undefined;
  const storeInitial = (storeName.trim().charAt(0) || 'O').toUpperCase();

  const boot = useCallback(async () => {
    try {
      const s = await api<any>(`/stores/${storeKey}`);
      setStore(s);
      if (s.planType !== 'PRO') {
        setError('Este negocio no tiene feedback activo.');
        setStep('sentiment');
        return;
      }

      const dims = await api<FeedbackDimensionDto[]>(
        `/feedback/dimensions/${s.id}`
      );
      setDimensions(dims);

      const existing = loadSession();
      if (!existing) {
        setStep('otp');
        return;
      }
      setSession(existing);

      let resolvedPassId = passFromQuery;
      let passRecord: any = null;
      if (existing) {
        const passes = await api<any[]>(
          `/passes?userId=${existing.user.id}&storeId=${s.id}`
        );
        passRecord = passFromQuery
          ? passes.find((p) => p.id === passFromQuery) || passes[0]
          : passes[0];
        resolvedPassId = passRecord?.id || passFromQuery;
      }
      if (passRecord) setPass(passRecord);
      if (!resolvedPassId) {
        setError('Primero necesitas tu tarjeta de lealtad en este negocio.');
        setStep('sentiment');
        return;
      }
      setPassId(resolvedPassId);
      setStep('sentiment');
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar');
      setStep('otp');
    }
  }, [storeKey, passFromQuery]);

  useEffect(() => {
    void boot();
  }, [boot]);

  async function onOtpVerified(sess: CustomerSession) {
    setSession(sess);
    await boot();
  }

  function toggleDim(id: string) {
    setSelectedDims((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function submitFeedback(skipComment = false) {
    if (!store?.id || !passId || !sentiment || !session) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<FeedbackSubmitResponse>('/feedback', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          storeId: store.id,
          passId,
          sentiment,
          dimensions: selectedDims,
          comment: skipComment ? undefined : comment.trim() || undefined,
          source,
        }),
      });
      setResult(res);
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'No se pudo enviar');
    } finally {
      setBusy(false);
    }
  }

  const backHref = `/r/${storeKey}`;

  if (step === 'loading') {
    return (
      <div className="onda-pwa-shell items-center justify-center">
        <SkeletonPwa />
      </div>
    );
  }

  return (
    <div className="onda-pwa-shell">
      <header className="onda-pwa-hero flex-col items-stretch gap-3">
        <Link
          href={backHref}
          className="text-sm font-medium text-[var(--onda-violet)] no-underline"
        >
          ← Volver
        </Link>
        <div className="flex items-center gap-3">
          <div className="onda-pwa-avatar" aria-hidden>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" />
            ) : (
              <span>{storeInitial}</span>
            )}
          </div>
          <div className="onda-pwa-hero-copy min-w-0">
            <p className="onda-pwa-eyebrow">Feedback</p>
            <h1 className="onda-pwa-title truncate">{storeName}</h1>
          </div>
        </div>
      </header>

      <div className="onda-pwa-body onda-pwa-fade flex min-h-0 flex-1 flex-col">
        {step === 'otp' && (
          <OtpStep onVerified={onOtpVerified} />
        )}

        {step === 'sentiment' && (
          <div className="flex min-h-0 flex-1 flex-col justify-center py-4">
            <h2 className="onda-pwa-headline text-center">¿Cómo estuvo tu experiencia?</h2>
            <p className="onda-pwa-sub mt-2 text-center">
              Cuéntanos en un par de toques — es rápido y anónimo para el local.
            </p>
            {error && store?.planType !== 'PRO' ? (
              <p className="mt-4 text-center text-sm text-[var(--onda-muted)]">{error}</p>
            ) : null}
            <div className="mt-8 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="onda-pwa-card flex flex-col items-center gap-3 p-6 transition hover:border-[var(--onda-success)] hover:bg-[var(--onda-success)]/5"
                onClick={() => {
                  setSentiment('POSITIVE');
                  setStep('dimensions');
                }}
                disabled={store?.planType !== 'PRO'}
              >
                <img
                  src="/brand/positive.png"
                  alt=""
                  className="h-16 w-16 object-contain"
                  draggable={false}
                />
                <span className="font-semibold text-[var(--onda-ink)]">¡Genial!</span>
              </button>
              <button
                type="button"
                className="onda-pwa-card flex flex-col items-center gap-3 p-6 transition hover:border-[var(--onda-danger)] hover:bg-[var(--onda-danger)]/5"
                onClick={() => {
                  setSentiment('NEGATIVE');
                  setStep('dimensions');
                }}
                disabled={store?.planType !== 'PRO'}
              >
                <img
                  src="/brand/negative.png"
                  alt=""
                  className="h-16 w-16 object-contain"
                  draggable={false}
                />
                <span className="font-semibold text-[var(--onda-ink)]">Regular o mal</span>
              </button>
            </div>
          </div>
        )}

        {step === 'dimensions' && sentiment && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col justify-center py-4">
              <h2 className="onda-pwa-headline text-center">
                {sentiment === 'POSITIVE'
                  ? '¿Qué destacarías?'
                  : '¿Qué podría mejorar?'}
              </h2>
              <p className="onda-pwa-sub mt-2 text-center">Elige uno o más</p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {dimensions.map((d) => {
                const active = selectedDims.includes(d.id);
                const label =
                  sentiment === 'POSITIVE' ? d.positiveLabel : d.negativeLabel;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDim(d.id)}
                    className={`onda-pwa-card flex flex-col items-center gap-2 p-4 text-center transition ${
                      active
                        ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-100)]'
                        : ''
                    }`}
                  >
                    <FeedbackIcon
                      name={d.icon}
                      className="h-8 w-8 text-[var(--onda-primary-500)]"
                    />
                    <span className="text-xs font-medium text-[var(--onda-ink)]">
                      {label}
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-3 pb-2 pt-4">
              <button
                type="button"
                className="onda-pwa-cta"
                disabled={selectedDims.length === 0}
                onClick={() => setStep('comment')}
              >
                Continuar →
              </button>
              <button
                type="button"
                className="text-sm text-[var(--onda-muted)]"
                onClick={() => {
                  setSelectedDims([]);
                  setStep('comment');
                }}
              >
                Omitir razones
              </button>
            </div>
          </div>
        )}

        {step === 'comment' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col justify-center py-4">
              <h2 className="onda-pwa-headline text-center">
                ¿Algo más que quieras contarnos?
              </h2>
              <p className="onda-pwa-sub mt-2 text-center">
                Opcional — tu mensaje es privado.
              </p>
              <textarea
                className="onda-pwa-field mt-6 min-h-[120px] resize-none"
                placeholder="Escribe aquí si quieres…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              {error ? (
                <p className="mt-2 text-center text-sm text-[var(--onda-danger)]">
                  {error}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-3 pb-2 pt-4">
              <button
                type="button"
                className="onda-pwa-cta"
                disabled={busy}
                onClick={() => void submitFeedback(false)}
              >
                {busy ? 'Enviando…' : 'Enviar feedback'}
              </button>
              <button
                type="button"
                className="text-sm text-[var(--onda-muted)]"
                disabled={busy}
                onClick={() => void submitFeedback(true)}
              >
                Enviar sin comentario
              </button>
            </div>
          </div>
        )}

        {step === 'success' && result && (
          <div className="flex min-h-0 flex-1 flex-col justify-center py-4">
            <SuccessAnimation positive={sentiment === 'POSITIVE'} />
            {result.redirectToGoogle && result.googleMapsUrl ? (
              <div className="mt-8 flex flex-col gap-3">
                <a
                  href={result.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="onda-pwa-cta text-center"
                >
                  Dejar reseña en Google Maps
                </a>
                <Link href={backHref} className="onda-pwa-secondary mt-3 text-center">
                  Listo
                </Link>
              </div>
            ) : (
              <Link href={backHref} className="onda-pwa-cta mt-8 text-center">
                Volver a mi tarjeta
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FeedbackFlowClient() {
  return (
    <Suspense
      fallback={
        <div className="onda-pwa-shell items-center justify-center">
          <SkeletonPwa />
        </div>
      }
    >
      <FeedbackFlowInner />
    </Suspense>
  );
}
