'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, PassPreview } from '@onda/shared-ui';
import { loadSession, type CustomerSession } from '../lib/session';
import { issueWalletPass, walletInstallUrl } from '../lib/wallet';

type Step = 'loading' | 'cards';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function passHref(pass: any): string | null {
  if (!pass?.storeId) return null;
  return `/r/${pass.store?.slug || pass.storeId}`;
}

function passDesign(pass: any) {
  return pass.passDesign || pass.cartilla?.passDesign || pass.store?.passDesign || pass.event?.passDesign || {};
}

function passTitle(pass: any) {
  const design = passDesign(pass);
  return design.title || pass.store?.name || pass.event?.name || 'Onda Rewards';
}

function rewardProgress(pass: any) {
  const claimed = new Set(pass.claimedPromotionIdsThisCycle || []);
  const promos = [...(pass.promotions || [])]
    .filter((p: any) => p && !claimed.has(p.id))
    .sort((a: any, b: any) => a.pointsRequired - b.pointsRequired);
  const points = pass.points ?? 0;
  const ready = promos.find((p: any) => p.pointsRequired <= points);
  if (ready) {
    return {
      rank: 0,
      ready: true,
      label: `¡Listo! Reclama ${ready.title}`,
    };
  }
  const next = promos.find((p: any) => p.pointsRequired > points);
  if (next) {
    const remaining = next.pointsRequired - points;
    return {
      rank: remaining,
      ready: false,
      label:
        remaining === 1
          ? `Te falta 1 onda para ${next.title}`
          : `Te faltan ${remaining} ondas para ${next.title}`,
    };
  }
  return { rank: 999, ready: false, label: null as string | null };
}

export function MisTarjetasClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('loading');
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [passes, setPasses] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const existing = loadSession();
      if (cancelled) return;

      if (!existing) {
        setStep('cards');
        return;
      }

      setSession(existing);
      let userPasses: any[] = [];
      try {
        userPasses = await api<any[]>(`/passes?userId=${existing.user.id}`);
        userPasses = await Promise.all(
          userPasses.map(async (p) => {
            if (p.appleUrl || p.googleUrl) return p;
            try {
              const links = await issueWalletPass(p.id);
              return { ...p, ...links };
            } catch {
              return p;
            }
          })
        );
      } catch {
        userPasses = [];
      }
      if (cancelled) return;

      setPasses(userPasses);
      setStep('cards');
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    async function refresh() {
      if (document.visibilityState !== 'visible') return;
      try {
        const userPasses = await api<any[]>(`/passes?userId=${userId}`);
        setPasses(userPasses);
      } catch {
        /* ignore */
      }
    }

    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [session]);

  const walletPasses = useMemo(
    () =>
      [...passes].sort((a, b) => {
        const pa = rewardProgress(a);
        const pb = rewardProgress(b);
        if (pa.rank !== pb.rank) return pa.rank - pb.rank;
        return (b.points ?? 0) - (a.points ?? 0);
      }),
    [passes]
  );

  const userName = session?.user.name?.trim();
  const userInitial = (userName?.charAt(0) || 'O').toUpperCase();
  const readyCount = walletPasses.filter((p) => rewardProgress(p).ready).length;

  if (step === 'loading') {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3">
        <div className="onda-pwa-avatar onda-pwa-avatar--pulse" aria-hidden />
      </div>
    );
  }

  return (
    <div className="onda-pwa-shell">
      <header className={`onda-pwa-hero${userName ? ' onda-pwa-hero--split' : ''}`}>
        {userName ? (
          <Link
            href="/perfil"
            className="onda-pwa-avatar onda-pwa-avatar--user no-underline"
            aria-label="Ver perfil"
          >
            <span aria-hidden>{userInitial}</span>
          </Link>
        ) : null}
        <div className="onda-pwa-hero-copy">
          {userName ? (
            <>
              <p className="onda-pwa-eyebrow">{getGreeting()}</p>
              <h1 className="onda-pwa-title">{userName}</h1>
            </>
          ) : (
            <>
              <p className="onda-pwa-eyebrow">
                <img src="/brand/onda-wordmark.png" alt="Onda" className="h-4 w-auto" />
              </p>
              <h1 className="onda-pwa-title">Mis tarjetas</h1>
            </>
          )}
        </div>
      </header>

      <div className="onda-pwa-body onda-pwa-fade">
        {walletPasses.length ? (
          <div className="onda-pwa-wallet">
            <div className="onda-pwa-wallet-heading">
              <p className="onda-pwa-label">En progreso</p>
              <p className="onda-pwa-wallet-count">
                {walletPasses.length} tarjeta{walletPasses.length === 1 ? '' : 's'}
                {readyCount
                  ? ` · ${readyCount} para reclamar`
                  : ''}
              </p>
            </div>

            {walletPasses.map((pass, index) => {
              const design = passDesign(pass);
              const href = passHref(pass);
              const progress = rewardProgress(pass);
              const milestoneStamps = (pass.promotions || []).map(
                (p: any) => p.pointsRequired as number
              );
              const inWallet = Boolean(pass.walletActive);
              const card = (
                <>
                  <PassPreview
                    compact
                    {...design}
                    title={passTitle(pass)}
                    subtitle={design.subtitle || pass.store?.name || pass.event?.name || 'Onda Rewards'}
                    points={pass.points}
                    maxStamps={pass.maxStamps ?? pass.cartilla?.maxStamps ?? pass.store?.maxStamps ?? 12}
                    milestoneStamps={milestoneStamps}
                    memberName={session?.user.name ?? ''}
                    inWallet={inWallet}
                    walletUrl={inWallet ? undefined : walletInstallUrl(pass)}
                  />
                  {progress.label ? (
                    <p
                      className={`onda-pwa-wallet-next${progress.ready ? ' is-ready' : ''}`}
                    >
                      {progress.label}
                    </p>
                  ) : null}
                </>
              );

              return href ? (
                <div
                  key={pass.id}
                  role="link"
                  tabIndex={0}
                  className="onda-pwa-wallet-item"
                  style={{ animationDelay: `${index * 60}ms` }}
                  onClick={() => router.push(href)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(href);
                    }
                  }}
                >
                  {card}
                </div>
              ) : (
                <div
                  key={pass.id}
                  className="onda-pwa-wallet-item"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  {card}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="onda-pwa-wallet-empty">
            <img
              src="/brand/onda-hand.png"
              alt=""
              aria-hidden
              draggable={false}
              className="onda-pwa-wallet-empty-mark"
            />
            <h2>Aún no tienes tarjetas</h2>
            <p>Escanea el QR de un negocio para empezar a acumular ondas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
