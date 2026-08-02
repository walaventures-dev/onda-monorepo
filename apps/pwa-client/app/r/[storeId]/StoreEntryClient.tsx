'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PhoneInput, api } from '@onda/shared-ui';
import { toE164Colombia, isCompletePhoneMask } from '@onda/shared-utils';
import { PassSwipe, type PassSwipeCard } from './PassSwipe';

type Step = 'loading' | 'enroll' | 'home' | 'rewards';

const SESSION_KEY = 'onda_pwa_session';

function isAppleDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default function StoreEntryPage() {
  const params = useParams<{ storeId: string }>();
  const search = useSearchParams();
  const storeIdParam = params.storeId;
  const eventParam = search.get('event') || undefined;
  const tableId = search.get('table') || undefined;

  const nameRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('loading');
  const [store, setStore] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [event, setEvent] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [session, setSession] = useState<any>(null);
  const [walletLinks, setWalletLinks] = useState<{
    appleUrl?: string;
    googleUrl?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const resolvedStoreId = useMemo(() => {
    if (storeIdParam && storeIdParam !== 'demo') return storeIdParam;
    return stores[0]?.id as string | undefined;
  }, [storeIdParam, stores]);

  const resolvedEventId = event?.id as string | undefined;
  const isFirstVisit = step === 'enroll';
  const canStart = name.trim().length >= 2 && isCompletePhoneMask(phone) && !busy;

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const list = await api<any[]>('/stores');
        if (cancelled) return;
        setStores(list);
        const s =
          storeIdParam && storeIdParam !== 'demo'
            ? list.find((x) => x.id === storeIdParam)
            : list[0];
        setStore(s || null);

        if (eventParam) {
          try {
            const path = looksLikeUuid(eventParam)
              ? `/events/${eventParam}`
              : `/events/slug/${eventParam}`;
            const ev = await api<any>(path);
            if (!cancelled) setEvent(ev);
          } catch {
            if (!cancelled) setEvent(null);
          }
        }

        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          setSession(JSON.parse(raw));
          setStep('home');
        } else {
          setStep('enroll');
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'No se pudo conectar');
          setStep('enroll');
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [storeIdParam, eventParam]);

  useEffect(() => {
    if (step === 'enroll') {
      const t = setTimeout(() => nameRef.current?.focus(), 320);
      return () => clearTimeout(t);
    }
  }, [step]);

  async function openWallet(passId?: string) {
    const id = passId || session?.pass?.id;
    if (!id) return;
    try {
      const links = await api<{ appleUrl?: string; googleUrl?: string }>(
        `/passes/${id}/issue`,
        { method: 'POST' }
      );
      setWalletLinks(links);
      const target = isAppleDevice() ? links.appleUrl : links.googleUrl;
      if (target && typeof window !== 'undefined') {
        window.open(target, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo abrir Wallet');
    }
  }

  async function enroll(e?: FormEvent) {
    e?.preventDefault();
    if (!canStart) return;
    if (!resolvedStoreId) {
      setError('Negocio no disponible ahora');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api<any>('/enroll', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone: toE164Colombia(phone),
          storeId: resolvedStoreId,
          eventId: resolvedEventId,
          tableId,
        }),
      });
      localStorage.setItem(SESSION_KEY, JSON.stringify(res));
      setSession(res);
      setStep('home');
      await openWallet(res.pass?.id);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear tu pase');
    } finally {
      setBusy(false);
    }
  }

  async function issueWallet() {
    setBusy(true);
    setError('');
    try {
      await openWallet();
    } finally {
      setBusy(false);
    }
  }

  const storeDesign = store?.passDesign || session?.pass?.store?.passDesign;
  const eventDesign = event?.passDesign || session?.pass?.event?.passDesign;
  const points = session?.pass?.points ?? 0;
  const storePromos = store?.promotions?.filter((p: any) => p.isActive) || [];
  const eventPromos = event?.promotions?.filter((p: any) => p.isActive) || [];
  const promotions = [...storePromos, ...eventPromos];
  const storeName = store?.name || 'tu visita';
  const eventName = event?.name || eventDesign?.title || 'Evento';
  const memberName = isFirstVisit ? name : session?.user?.name || name;
  const walletLabel = isAppleDevice() ? 'Agregar a Apple Wallet' : 'Añadir a Google Wallet';
  const logoUrl = storeDesign?.logoUrl as string | undefined;
  const storeInitial = (storeName.trim().charAt(0) || 'O').toUpperCase();

  const swipeCards = useMemo(() => {
    const cards: PassSwipeCard[] = [];
    if (storeDesign || store) {
      cards.push({
        key: 'store',
        badge: 'Pase del negocio',
        design: {
          backgroundColor: storeDesign?.backgroundColor,
          foregroundColor: storeDesign?.foregroundColor,
          labelColor: storeDesign?.labelColor,
          title: storeDesign?.title || storeName,
          subtitle: storeDesign?.subtitle || 'Onda Rewards',
          description: storeDesign?.description,
          logoUrl: storeDesign?.logoUrl,
        },
        points: isFirstVisit ? 1 : points,
      });
    }
    if (event && (eventDesign || eventName)) {
      cards.push({
        key: 'event',
        badge: 'Pase del evento',
        design: {
          backgroundColor: eventDesign?.backgroundColor || '#6E5AE6',
          foregroundColor: eventDesign?.foregroundColor || '#FFFFFF',
          labelColor: eventDesign?.labelColor || '#E5F6FC',
          title: eventDesign?.title || eventName,
          subtitle: eventDesign?.subtitle || eventName,
          description: eventDesign?.description,
          logoUrl: eventDesign?.logoUrl,
        },
        points: isFirstVisit ? 1 : Math.max(points, event?.globalTarget ? 1 : points),
      });
    }
    return cards;
  }, [
    storeDesign,
    store,
    storeName,
    event,
    eventDesign,
    eventName,
    isFirstVisit,
    points,
  ]);

  if (step === 'loading') {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3">
        <div className="onda-pwa-avatar onda-pwa-avatar--pulse" aria-hidden />
        <p className="text-sm text-[var(--onda-muted)]">Preparando tu pase…</p>
      </div>
    );
  }

  return (
    <div className="onda-pwa-shell">
      <header className="onda-pwa-hero">
        <div className="onda-pwa-avatar" aria-hidden>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" />
          ) : (
            <span>{storeInitial}</span>
          )}
        </div>
        <div className="onda-pwa-hero-copy">
          <p className="onda-pwa-eyebrow">Onda</p>
          <h1 className="onda-pwa-title">
            {step === 'enroll'
              ? event
                ? 'Tus pases'
                : 'Tu pase'
              : step === 'rewards'
                ? 'Recompensas'
                : storeName}
          </h1>
          <p className="onda-pwa-sub">
            {step === 'enroll'
              ? event
                ? `${storeName} · ${eventName}${tableId ? ` · Mesa ${tableId}` : ''}`
                : `${storeName}${tableId ? ` · Mesa ${tableId}` : ''} · +1 onda`
              : step === 'home'
                ? event
                  ? 'Negocio + evento'
                  : 'Listo para Wallet'
                : storeName}
          </p>
        </div>
      </header>

      <div className="onda-pwa-body onda-pwa-fade">
        {step === 'enroll' && (
          <form className="flex flex-1 flex-col" onSubmit={enroll}>
            <PassSwipe cards={swipeCards} memberName={name} compact />

            <div className="onda-pwa-bottom">
              <div className="onda-pwa-fields">
                <input
                  ref={nameRef}
                  required
                  autoComplete="given-name"
                  enterKeyHint="next"
                  placeholder="Tu nombre en el pase"
                  className="onda-pwa-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (
                        document.querySelector(
                          'input[inputmode="numeric"]'
                        ) as HTMLInputElement | null
                      )?.focus();
                    }
                  }}
                />
                <PhoneInput
                  required
                  enterKeyHint="go"
                  placeholder="WhatsApp"
                  className="onda-pwa-field"
                  value={phone}
                  onChange={setPhone}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter' && canStart) {
                      e.preventDefault();
                      void enroll();
                    }
                  }}
                />
                {error ? (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[var(--onda-danger)]">
                    {error}
                  </p>
                ) : null}
              </div>

              <button type="submit" className="onda-pwa-cta" disabled={!canStart}>
                {busy
                  ? 'Creando tus pases…'
                  : event
                    ? `${walletLabel} · 2 pases`
                    : `${walletLabel} · +1`}
              </button>
              <p className="onda-pwa-legal">
                Al continuar aceptas{' '}
                <a href="/privacidad">Privacidad</a> y <a href="/terminos">Términos</a>.
              </p>
            </div>
          </form>
        )}

        {step === 'home' && session && (
          <div className="flex flex-1 flex-col">
            <PassSwipe cards={swipeCards} memberName={memberName} compact={false} />

            <div className="onda-pwa-bottom">
              {error ? (
                <p className="mb-2 text-sm text-[var(--onda-danger)]">{error}</p>
              ) : null}
              <button
                type="button"
                className="onda-pwa-cta"
                disabled={busy}
                onClick={issueWallet}
              >
                {busy ? 'Abriendo Wallet…' : walletLabel}
              </button>
              <button
                type="button"
                className="onda-pwa-secondary"
                onClick={() => setStep('rewards')}
              >
                Ver recompensas
              </button>
              {walletLinks ? (
                <p className="onda-pwa-legal">
                  Si no se abrió,{' '}
                  <a
                    href={isAppleDevice() ? walletLinks.appleUrl : walletLinks.googleUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    toca aquí
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        )}

        {step === 'rewards' && (
          <div className="flex flex-1 flex-col gap-3">
            <button
              type="button"
              className="self-start text-sm font-medium text-[var(--onda-violet)]"
              onClick={() => setStep('home')}
            >
              ← Volver al pase
            </button>
            <div className="flex flex-col gap-3 pb-6">
              {promotions.map((p: any) => (
                <div key={p.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-[16/9] bg-[var(--onda-violet-soft)]" />
                  )}
                  <div className="p-4">
                    <p className="font-semibold">{p.title}</p>
                    {p.description ? (
                      <p className="mt-1 text-sm text-[var(--onda-muted)]">{p.description}</p>
                    ) : null}
                    <p className="mt-2 text-sm font-semibold text-[var(--onda-violet)]">
                      {p.pointsRequired} ondas
                    </p>
                  </div>
                </div>
              ))}
              {!promotions.length ? (
                <p className="text-[var(--onda-muted)]">Pronto habrá recompensas aquí.</p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
