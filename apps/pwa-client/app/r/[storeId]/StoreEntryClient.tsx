// apps/pwa-client/app/r/[storeId]/StoreEntryClient.tsx
'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@onda/shared-ui';
import { loadSession, saveSession, type CustomerSession } from '../../../lib/session';
import { PassSwipe, type PassSwipeCard } from './PassSwipe';
import { OtpStep } from './OtpStep';
import { PendingRequestWait, type PendingRequestDto } from './PendingRequestWait';

type Step = 'loading' | 'otp' | 'name' | 'preview' | 'home' | 'pendingWait' | 'rewards';

function isAppleDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
}

export default function StoreEntryPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId;

  const [step, setStep] = useState<Step>('loading');
  const [store, setStore] = useState<any>(null);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [pass, setPass] = useState<any>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [walletLinks, setWalletLinks] = useState<{ appleUrl?: string; googleUrl?: string } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequestDto | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const s = await api<any>(`/stores/${storeId}`);
        if (cancelled) return;
        setStore(s);

        const existing = loadSession();
        if (!existing) {
          setStep('otp');
          return;
        }
        setSession(existing);
        await loadOrPreview(existing, s);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'No se pudo conectar');
          setStep('otp');
        }
      }
    }

    async function loadOrPreview(sess: CustomerSession, s: any) {
      const passes = await api<any[]>(`/passes?userId=${sess.user.id}&storeId=${storeId}`);
      if (passes[0]) {
        setPass(passes[0]);
        setStep('home');
      } else {
        setStep('preview');
      }
      void s;
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  async function onOtpVerified(result: { token: string; user: CustomerSession['user']; isNewUser: boolean }) {
    const sess: CustomerSession = { token: result.token, user: result.user };
    saveSession(sess);
    setSession(sess);
    if (result.isNewUser) {
      setStep('name');
      return;
    }
    const passes = await api<any[]>(`/passes?userId=${sess.user.id}&storeId=${storeId}`);
    if (passes[0]) {
      setPass(passes[0]);
      setStep('home');
    } else {
      setStep('preview');
    }
  }

  async function submitName(e: FormEvent) {
    e.preventDefault();
    if (!session || name.trim().length < 2) return;
    setBusy(true);
    setError('');
    try {
      const updated = await api<CustomerSession['user']>('/customer-auth/profile', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ name: name.trim() }),
      });
      const sess: CustomerSession = { token: session.token, user: updated };
      saveSession(sess);
      setSession(sess);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar tu nombre');
    } finally {
      setBusy(false);
    }
  }

  async function claimCard() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const created = await api<any>(`/passes/store/${storeId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      setPass(created);
      setStep('home');
    } catch (err: any) {
      setError(err.message || 'No se pudo reclamar tu tarjeta');
    } finally {
      setBusy(false);
    }
  }

  async function openWallet() {
    if (!pass?.id) return;
    setBusy(true);
    try {
      const links = await api<{ appleUrl?: string; googleUrl?: string }>(
        `/passes/${pass.id}/issue`,
        { method: 'POST' }
      );
      setWalletLinks(links);
      const target = isAppleDevice() ? links.appleUrl : links.googleUrl;
      if (target && typeof window !== 'undefined') {
        window.open(target, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo abrir Wallet');
    } finally {
      setBusy(false);
    }
  }

  async function startPendingRequest(type: 'ACCUMULATE' | 'CLAIM', promotionId?: string) {
    if (!session || !pass) return;
    setBusy(true);
    setError('');
    try {
      const created = await api<PendingRequestDto>('/pending-requests', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ passId: pass.id, type, promotionId }),
      });
      setPendingRequest(created);
      setStep('pendingWait');
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar la solicitud');
    } finally {
      setBusy(false);
    }
  }

  async function onPendingResolved(status: 'CONFIRMED' | 'REJECTED' | 'EXPIRED') {
    if (status === 'CONFIRMED' && pass) {
      const refreshed = await api<any>(`/passes/${pass.id}`);
      setPass(refreshed);
    }
    setPendingRequest(null);
    setStep('home');
  }

  const promotions = useMemo(
    () => (store?.promotions || []).filter((p: any) => p.isActive),
    [store]
  );
  const milestoneStamps = useMemo(
    () => promotions.map((p: any) => p.pointsRequired as number),
    [promotions]
  );
  const claimablePromotion = useMemo(() => {
    if (!pass) return null;
    const claimed: string[] = pass.claimedPromotionIdsThisCycle || [];
    return (
      promotions.find(
        (p: any) => p.pointsRequired === pass.points && !claimed.includes(p.id)
      ) || null
    );
  }, [pass, promotions]);

  const storeDesign = store?.passDesign;
  const storeName = store?.name || 'tu visita';
  const walletLabel = isAppleDevice() ? 'Agregar a Apple Wallet' : 'Añadir a Google Wallet';
  const logoUrl = storeDesign?.logoUrl as string | undefined;
  const storeInitial = (storeName.trim().charAt(0) || 'O').toUpperCase();

  const swipeCards: PassSwipeCard[] = useMemo(() => {
    if (!storeDesign && !store) return [];
    return [
      {
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
        points: pass?.points ?? 0,
        maxStamps: store?.maxStamps ?? 12,
        milestoneStamps,
      },
    ];
  }, [storeDesign, store, storeName, pass, milestoneStamps]);

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
            {step === 'rewards' ? 'Recompensas' : storeName}
          </h1>
        </div>
      </header>

      <div className="onda-pwa-body onda-pwa-fade">
        {step === 'otp' && <OtpStep onVerified={onOtpVerified} />}

        {step === 'name' && (
          <form className="flex flex-1 flex-col justify-center gap-3" onSubmit={submitName}>
            <p className="onda-pwa-sub">¿Cómo te llamas?</p>
            <input
              required
              autoFocus
              autoComplete="given-name"
              placeholder="Tu nombre en el pase"
              className="onda-pwa-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error ? <p className="text-sm text-[var(--onda-danger)]">{error}</p> : null}
            <button type="submit" className="onda-pwa-cta" disabled={name.trim().length < 2 || busy}>
              {busy ? 'Guardando…' : 'Continuar'}
            </button>
          </form>
        )}

        {step === 'preview' && (
          <div className="flex flex-1 flex-col">
            <PassSwipe cards={swipeCards} memberName={session?.user.name} compact />
            <div className="onda-pwa-bottom">
              {error ? <p className="mb-2 text-sm text-[var(--onda-danger)]">{error}</p> : null}
              <button type="button" className="onda-pwa-cta" disabled={busy} onClick={claimCard}>
                {busy ? 'Reclamando…' : 'Reclamar onda'}
              </button>
            </div>
          </div>
        )}

        {step === 'home' && pass && (
          <div className="flex flex-1 flex-col">
            <PassSwipe cards={swipeCards} memberName={session?.user.name} compact={false} />
            <div className="onda-pwa-bottom">
              {error ? <p className="mb-2 text-sm text-[var(--onda-danger)]">{error}</p> : null}
              <button type="button" className="onda-pwa-cta" disabled={busy} onClick={openWallet}>
                {busy ? 'Abriendo Wallet…' : walletLabel}
              </button>
              <button
                type="button"
                className="onda-pwa-secondary"
                disabled={busy}
                onClick={() => startPendingRequest('ACCUMULATE')}
              >
                Acumular onda
              </button>
              {claimablePromotion ? (
                <button
                  type="button"
                  className="onda-pwa-secondary"
                  disabled={busy}
                  onClick={() => startPendingRequest('CLAIM', claimablePromotion.id)}
                >
                  Reclamar {claimablePromotion.title}
                </button>
              ) : null}
              {promotions.length >= 2 ? (
                <button
                  type="button"
                  className="onda-pwa-secondary"
                  onClick={() => setStep('rewards')}
                >
                  Ver premios del ciclo
                </button>
              ) : null}
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

        {step === 'pendingWait' && pendingRequest && session && pass && (
          <PendingRequestWait
            request={pendingRequest}
            passId={pass.id}
            session={session}
            onResolved={onPendingResolved}
          />
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
                      Sello {p.pointsRequired} de {store?.maxStamps ?? 12}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
