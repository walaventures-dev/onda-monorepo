'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Button } from '@heroui/react';
import { CaretLeftIcon as CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { PhoneIcon as Phone } from '@phosphor-icons/react/dist/csr/Phone';
import { PlusCircleIcon as PlusCircle } from '@phosphor-icons/react/dist/csr/PlusCircle';
import { QrCodeIcon as QrCode } from '@phosphor-icons/react/dist/csr/QrCode';
import { ReceiptIcon as Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { UserCircleIcon as UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { CurrencyDollarIcon as CurrencyDollar } from '@phosphor-icons/react/dist/csr/CurrencyDollar';
import { ListBulletsIcon as ListBullets } from '@phosphor-icons/react/dist/csr/ListBullets';
import { api } from './api';
import { CajaScanClient } from './CajaScanClient';
import { CajaPendingQueue } from './CajaPendingQueue';
import { PhoneInput } from './PhoneInput';
import { PasswordInput } from './PasswordInput';
import { OndaWordmark } from './brand';
import { OndaIcons } from './icons';
import {
  PosVenderCore,
  type PosVenderMemberSession,
} from './PosVenderCore';
import {
  formatCop,
  isCompletePhoneMask,
  ondasFromPayment,
  toE164Colombia,
} from '@onda/shared-utils';
import { SkeletonList } from './Skeleton';
import type { PosTabDto } from '@onda/shared-types';

function CajaIdentity({ storeName }: { storeName?: string }) {
  const name = storeName?.trim() || 'tu comercio';
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <OndaWordmark className="h-6 w-auto" />
      <h1 className="font-display text-xl font-bold leading-snug text-[var(--onda-ink)] sm:text-2xl">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--onda-muted)]">
          Caja móvil de
        </span>
        <span className="mt-1 block">{name}</span>
      </h1>
    </div>
  );
}

/** Cabecera compacta al entrar a Acumular / Cuentas. */
function CajaIdentityBar({
  storeName,
  onLogout,
  logoutBusy,
}: {
  storeName?: string;
  onLogout?: () => void;
  logoutBusy?: boolean;
}) {
  const name = storeName?.trim() || 'tu comercio';
  return (
    <header className="flex items-center justify-between gap-3">
      <OndaWordmark className="h-4 w-auto shrink-0" />
      <p className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-[var(--onda-ink)]">
        {name}
      </p>
      {onLogout ? (
        <button
          type="button"
          onClick={onLogout}
          disabled={logoutBusy}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)] disabled:opacity-50"
          aria-label="Cerrar sesión"
        >
          {OndaIcons.logout}
          <span className="hidden sm:inline">Salir</span>
        </button>
      ) : null}
    </header>
  );
}

type CajaPane = 'camera' | 'queue';

function CajaDualPane({
  storeId,
  token,
  ondaValue,
  posEnabled,
  storeName,
  onLogout,
  logoutBusy,
  onBack,
}: {
  storeId: string;
  token?: string;
  ondaValue?: number | null;
  posEnabled?: boolean;
  storeName?: string;
  onLogout?: () => void;
  logoutBusy?: boolean;
  onBack?: () => void;
}) {
  const [pane, setPane] = useState<CajaPane>('camera');
  const [pendingCount, setPendingCount] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  const scrollToPane = useCallback((next: CajaPane) => {
    const track = trackRef.current;
    if (!track) return;
    const index = next === 'camera' ? 0 : 1;
    syncingRef.current = true;
    track.scrollTo({
      left: index * track.clientWidth,
      behavior: 'smooth',
    });
    setPane(next);
    window.setTimeout(() => {
      syncingRef.current = false;
    }, 350);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function onScroll() {
      if (syncingRef.current || !track) return;
      const index = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
      const next: CajaPane = index >= 1 ? 'queue' : 'camera';
      setPane((prev) => (prev === next ? prev : next));
    }

    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, []);

  const badge = pendingCount > 99 ? '99+' : String(pendingCount);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <CajaIdentityBar
        storeName={storeName}
        onLogout={onLogout}
        logoutBusy={logoutBusy}
      />

      <div className="onda-caja-tabs" role="tablist" aria-label="Vista de caja">
        <button
          type="button"
          role="tab"
          aria-selected={pane === 'camera'}
          className={`onda-caja-tab${pane === 'camera' ? ' is-active' : ''}`}
          onClick={() => scrollToPane('camera')}
        >
          <QrCode className="h-4 w-4" weight="regular" aria-hidden />
          Cámara
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === 'queue'}
          className={`onda-caja-tab${pane === 'queue' ? ' is-active' : ''}`}
          onClick={() => scrollToPane('queue')}
        >
          <ListBullets className="h-4 w-4" weight="regular" aria-hidden />
          Solicitudes
          {pendingCount > 0 ? (
            <span className="onda-caja-tab-badge">{badge}</span>
          ) : null}
        </button>
      </div>

      <div ref={trackRef} className="onda-caja-swipe">
        <section
          className="onda-caja-swipe-pane"
          aria-label="Escanear QR"
          aria-hidden={pane !== 'camera'}
        >
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
            <CajaScanClient
              storeId={storeId}
              token={token}
              embedded
              hideHeader
              posEnabled={posEnabled}
              active={pane === 'camera'}
            />
          </div>
        </section>
        <section
          className="onda-caja-swipe-pane"
          aria-label="Solicitudes pendientes"
          aria-hidden={pane !== 'queue'}
        >
          <CajaPendingQueue
            storeId={storeId}
            ondaValue={ondaValue}
            onCountChange={setPendingCount}
          />
        </section>
      </div>

      {onBack ? (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-12 min-w-[12rem] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-6 text-sm font-semibold text-[var(--onda-ink)] shadow-[0_8px_24px_rgba(26,27,46,0.06)] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-primary-500)]/35"
          >
            <CaretLeft className="h-4 w-4" weight="regular" aria-hidden />
            Inicio
          </button>
        </div>
      ) : null}
    </div>
  );
}

function QrLinkScanner({
  onScan,
  disabled,
}: {
  onScan: (payload: string) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    if (disabled) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    void reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        video,
        (result) => {
          if (!result || scanningRef.current || disabled) return;
          const text = result.getText().trim();
          if (!text) return;
          scanningRef.current = true;
          onScan(text);
          window.setTimeout(() => {
            scanningRef.current = false;
          }, 2000);
        }
      )
      .then((controls) => {
        if (cancelled) controls.stop();
      })
      .catch(() => {
        /* cámara no disponible */
      });

    return () => {
      cancelled = true;
    };
  }, [disabled, onScan]);

  return (
    <div className="onda-caja-scan relative mt-2 min-h-[16rem] overflow-hidden rounded-2xl">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        muted
        playsInline
      />
      <div className="onda-caja-scan-frame" />
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--onda-primary-500)]"
    >
      <CaretLeft className="h-4 w-4" weight="regular" aria-hidden />
      {label}
    </button>
  );
}

export function AsociarVentaList({
  storeId,
  onSelect,
  token,
}: {
  storeId: string;
  onSelect: (tabId: string) => void;
  token?: string;
}) {
  const [tabs, setTabs] = useState<PosTabDto[]>([]);

  const loadTabs = useCallback(async () => {
    const qs = new URLSearchParams({
      storeId,
      status: 'OPEN,CHECKOUT',
    });
    if (token) qs.set('token', token);
    const rows = await api<PosTabDto[]>(`/pos/tabs?${qs.toString()}`);
    setTabs(rows);
  }, [storeId, token]);

  useEffect(() => {
    void loadTabs();
    const qs = new URLSearchParams({ storeId });
    if (token) qs.set('token', token);
    const es = new EventSource(`/api/pos/stream?${qs.toString()}`);
    es.onmessage = () => void loadTabs();
    return () => es.close();
  }, [storeId, token, loadTabs]);

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--onda-primary-50)] text-[var(--onda-primary-500)]">
          <Receipt className="h-8 w-8" weight="regular" aria-hidden />
        </span>
        <p className="font-display text-lg font-semibold text-[var(--onda-ink)]">
          Sin cuentas
        </p>
        <p className="max-w-[16rem] text-sm text-[var(--onda-muted)]">
          Ábrelas en Vender (caja o panel del comercio).
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {tabs.map((tab) => {
        const linked = Boolean(tab.passId);
        return (
          <li key={tab.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-4 text-left shadow-[0_8px_24px_rgba(26,27,46,0.06)] transition active:scale-[0.98]"
              onClick={() => onSelect(tab.id)}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  linked
                    ? 'bg-[var(--onda-success)]/15 text-[var(--onda-success)]'
                    : 'bg-[var(--onda-primary-50)] text-[var(--onda-primary-500)]'
                }`}
              >
                {linked ? (
                  <UserCircle className="h-7 w-7" weight="regular" aria-hidden />
                ) : (
                  <Receipt className="h-7 w-7" weight="regular" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-semibold text-[var(--onda-ink)]">
                  {tab.label}
                </p>
                <p className="truncate text-sm text-[var(--onda-muted)]">
                  {linked
                    ? tab.customerName || 'Cliente listo'
                    : 'Toca para asociar'}
                </p>
              </div>
              <p className="shrink-0 font-display text-lg font-bold tabular-nums text-[var(--onda-ink)]">
                {formatCop(tab.total)}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function AsociarVentaDetail({
  storeId,
  tabId,
  onBack,
  token,
  ondaValue,
}: {
  storeId: string;
  tabId: string;
  onBack: () => void;
  token?: string;
  ondaValue?: number | null;
}) {
  const [tab, setTab] = useState<PosTabDto | null>(null);
  const [phone, setPhone] = useState('');
  const [linking, setLinking] = useState(false);
  const [message, setMessage] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [mode, setMode] = useState<'qr' | 'phone'>('qr');

  const reload = useCallback(async () => {
    const qs = new URLSearchParams({
      storeId,
      status: 'OPEN,CHECKOUT',
    });
    if (token) qs.set('token', token);
    const tabs = await api<PosTabDto[]>(`/pos/tabs?${qs.toString()}`);
    setTab(tabs.find((t) => t.id === tabId) ?? null);
  }, [storeId, tabId, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function linkPhone() {
    if (!isCompletePhoneMask(phone)) return;
    setLinking(true);
    setMessage(null);
    try {
      const qs = new URLSearchParams({ storeId });
      if (token) qs.set('token', token);
      const updated = await api<PosTabDto>(
        `/pos/tabs/${tabId}/link-phone?${qs.toString()}`,
        {
          method: 'POST',
          body: JSON.stringify({ phone: toE164Colombia(phone) }),
        }
      );
      setTab(updated);
      setPhone('');
      setMessage({ tone: 'ok', text: 'Cliente asociado' });
    } catch (err) {
      setMessage({
        tone: 'err',
        text: err instanceof Error ? err.message : 'No se pudo asociar',
      });
    } finally {
      setLinking(false);
    }
  }

  const linkPass = useCallback(
    async (payload: string) => {
      setLinking(true);
      setMessage(null);
      try {
        const qs = new URLSearchParams({ storeId });
        if (token) qs.set('token', token);
        const updated = await api<PosTabDto>(
          `/pos/tabs/${tabId}/link-pass?${qs.toString()}`,
          {
            method: 'POST',
            body: JSON.stringify({ payload: payload.trim() }),
          }
        );
        setTab(updated);
        setMessage({ tone: 'ok', text: 'Cliente asociado' });
      } catch (err) {
        setMessage({
          tone: 'err',
          text: err instanceof Error ? err.message : 'No se pudo asociar',
        });
      } finally {
        setLinking(false);
      }
    },
    [storeId, tabId, token]
  );

  if (!tab) {
    return <SkeletonList rows={3} />;
  }

  if (tab.status !== 'OPEN' && tab.status !== 'CHECKOUT') {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-sm text-[var(--onda-muted)]">Esta cuenta ya cerró.</p>
        <BackButton onClick={onBack} label="Volver" />
      </div>
    );
  }

  const value =
    ondaValue != null && Number(ondaValue) > 0 ? Number(ondaValue) : null;
  const previewOndas =
    tab.passId && value != null
      ? ondasFromPayment(tab.total, value)
      : null;

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} label="Cuentas" />

      <div className="rounded-2xl bg-[var(--onda-primary-50)] px-4 py-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--onda-primary-700)]">
          {tab.label}
        </p>
        <p className="mt-1 font-display text-3xl font-bold tabular-nums text-[var(--onda-ink)]">
          {formatCop(tab.total)}
        </p>
        <p className="mt-1 text-sm text-[var(--onda-muted)]">
          {tab.lines.length} producto{tab.lines.length === 1 ? '' : 's'}
        </p>
      </div>

      {message ? (
        <p
          className={`rounded-2xl px-4 py-3 text-center text-sm font-medium ${
            message.tone === 'ok'
              ? 'bg-[var(--onda-success)]/10 text-[var(--onda-success)]'
              : 'bg-[var(--onda-danger)]/10 text-[var(--onda-danger)]'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {tab.passId ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--onda-success)]/25 bg-[var(--onda-success)]/10 px-4 py-8 text-center">
          <UserCircle
            className="h-14 w-14 text-[var(--onda-success)]"
            weight="regular"
            aria-hidden
          />
          <p className="font-display text-xl font-semibold text-[var(--onda-ink)]">
            {tab.customerName || 'Cliente listo'}
          </p>
          <p className="text-sm text-[var(--onda-muted)]">
            {previewOndas == null
              ? 'Ondas al cobrar en el POS'
              : previewOndas > 0
                ? `+${previewOndas} onda${previewOndas === 1 ? '' : 's'} al cobrar`
                : '+0 ondas al cobrar (venta registrada)'}
          </p>
          <Button className="mt-2" onPress={onBack}>
            Listo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('qr')}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                mode === 'qr'
                  ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-50)] text-[var(--onda-primary-700)]'
                  : 'border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-muted)]'
              }`}
            >
              <QrCode className="h-6 w-6" weight="regular" aria-hidden />
              Escanear
            </button>
            <button
              type="button"
              onClick={() => setMode('phone')}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                mode === 'phone'
                  ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-50)] text-[var(--onda-primary-700)]'
                  : 'border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-muted)]'
              }`}
            >
              <Phone className="h-6 w-6" weight="regular" aria-hidden />
              Celular
            </button>
          </div>

          {mode === 'qr' ? (
            <div>
              <p className="mb-1 text-center text-sm text-[var(--onda-muted)]">
                Apunta al QR del pase
              </p>
              <QrLinkScanner
                onScan={(p) => void linkPass(p)}
                disabled={linking}
              />
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-[var(--onda-border)] p-4">
              <PhoneInput
                value={phone}
                onChange={setPhone}
                className="onda-input w-full text-center text-lg"
                disabled={linking}
              />
              <Button
                className="w-full"
                onPress={() => void linkPhone()}
                isDisabled={linking || !isCompletePhoneMask(phone)}
              >
                {linking ? 'Asociando…' : 'Asociar'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CajaOperationsPanel({
  storeId,
  defaultMode = 'acumular',
  posEnabled = false,
  token,
  storeName,
  ondaValue,
  signInMember,
  restoreCajaAuth,
  activateMemberAuth,
  resumeMemberSession,
  onLogout,
}: {
  storeId: string;
  defaultMode?: 'acumular' | 'asociar';
  posEnabled?: boolean;
  token?: string;
  storeName?: string;
  ondaValue?: number | null;
  /** Firebase login for Vender; returns active member for this store. */
  signInMember?: (
    email: string,
    password: string,
  ) => Promise<PosVenderMemberSession>;
  /** Restore CajaLink bearer after leaving Vender (keeps Firebase signed in). */
  restoreCajaAuth?: () => void;
  /** Re-attach Firebase bearer when re-entering Vender with an existing session. */
  activateMemberAuth?: () => Promise<void>;
  /** Silent resume if Firebase already has a user for this device. */
  resumeMemberSession?: () => Promise<PosVenderMemberSession | null>;
  /** Cerrar sesión de caja (Firebase hub o revocar enlace kiosk). */
  onLogout?: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<
    'home' | 'acumular' | 'asociar' | 'vender' | 'vender-login'
  >(() =>
    posEnabled ? (defaultMode === 'asociar' ? 'asociar' : 'home') : 'acumular',
  );
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [memberSession, setMemberSession] =
    useState<PosVenderMemberSession | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [openingVender, setOpeningVender] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  useEffect(() => {
    if (!posEnabled) setMode('acumular');
  }, [posEnabled]);

  async function handleLogout() {
    if (!onLogout || logoutBusy) return;
    setLogoutBusy(true);
    try {
      await onLogout();
    } finally {
      setLogoutBusy(false);
    }
  }

  function leaveVender() {
    restoreCajaAuth?.();
    setMode('home');
  }

  async function openVender() {
    setOpeningVender(true);
    setLoginError('');
    try {
      if (memberSession) {
        await activateMemberAuth?.();
        setMode('vender');
        return;
      }
      const resumed = (await resumeMemberSession?.()) ?? null;
      if (resumed) {
        setMemberSession(resumed);
        setMode('vender');
        return;
      }
      setMode('vender-login');
    } catch {
      setMemberSession(null);
      setMode('vender-login');
    } finally {
      setOpeningVender(false);
    }
  }

  async function submitVenderLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!signInMember) return;
    setLoginBusy(true);
    setLoginError('');
    try {
      const member = await signInMember(loginEmail.trim(), loginPassword);
      setMemberSession(member);
      setLoginPassword('');
      setMode('vender');
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : 'No se pudo iniciar sesión',
      );
    } finally {
      setLoginBusy(false);
    }
  }

  if (selectedTabId) {
    return (
      <div className="flex min-h-[70dvh] flex-col gap-3">
        <CajaIdentityBar
          storeName={storeName}
          onLogout={onLogout ? () => void handleLogout() : undefined}
          logoutBusy={logoutBusy}
        />
        <AsociarVentaDetail
          storeId={storeId}
          tabId={selectedTabId}
          token={token}
          ondaValue={ondaValue}
          onBack={() => setSelectedTabId(null)}
        />
      </div>
    );
  }

  if (mode === 'vender-login') {
    return (
      <div className="flex min-h-[70dvh] flex-col gap-4">
        <CajaIdentityBar
          storeName={storeName}
          onLogout={onLogout ? () => void handleLogout() : undefined}
          logoutBusy={logoutBusy}
        />
        {!signInMember ? (
          <p className="text-center text-sm text-[var(--onda-danger)]">
            Esta caja no tiene login de miembro configurado.
          </p>
        ) : (
        <div className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-5 shadow-[0_12px_28px_rgba(26,27,46,0.08)]">
          <div className="text-center">
            <CurrencyDollar
              className="mx-auto h-8 w-8 text-[var(--onda-primary-500)]"
              weight="regular"
              aria-hidden
            />
            <h2 className="mt-2 font-display text-lg font-semibold">
              Entrar a Vender
            </h2>
            <p className="mt-1 text-sm text-[var(--onda-muted)]">
              Usa tu email y contraseña de miembro Onda.
            </p>
          </div>
          <form onSubmit={submitVenderLogin} className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--onda-muted)]">Email</span>
              <input
                className="onda-input w-full"
                type="email"
                autoComplete="username"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--onda-muted)]">Contraseña</span>
              <PasswordInput
                className="rounded-xl"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {loginError ? (
              <p className="text-sm text-[var(--onda-danger)]">{loginError}</p>
            ) : null}
            <Button type="submit" className="w-full" isDisabled={loginBusy}>
              {loginBusy ? 'Entrando…' : 'Continuar'}
            </Button>
          </form>
        </div>
        )}
        <div className="flex justify-center pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setMode('home')}
            className="inline-flex min-h-12 min-w-[12rem] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-6 text-sm font-semibold text-[var(--onda-ink)]"
          >
            <CaretLeft className="h-4 w-4" weight="regular" aria-hidden />
            Inicio
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'vender' && memberSession) {
    return (
      <PosVenderCore
        storeId={storeId}
        ondaValue={ondaValue}
        variant="kiosk"
        memberSession={memberSession}
        headerExtra={
          <CajaIdentityBar
            storeName={storeName}
            onLogout={onLogout ? () => void handleLogout() : undefined}
            logoutBusy={logoutBusy}
          />
        }
        onLeave={leaveVender}
      />
    );
  }

  if (mode === 'acumular') {
    return (
      <CajaDualPane
        storeId={storeId}
        token={token}
        ondaValue={ondaValue}
        posEnabled={posEnabled}
        storeName={storeName}
        onLogout={onLogout ? () => void handleLogout() : undefined}
        logoutBusy={logoutBusy}
        onBack={posEnabled ? () => setMode('home') : undefined}
      />
    );
  }

  if (mode === 'asociar') {
    return (
      <div className="flex min-h-[70dvh] flex-col gap-4">
        <CajaIdentityBar
          storeName={storeName}
          onLogout={onLogout ? () => void handleLogout() : undefined}
          logoutBusy={logoutBusy}
        />
        <div className="flex items-center justify-center gap-2">
          <PlusCircle
            className="h-5 w-5 text-[var(--onda-primary-500)]"
            weight="regular"
            aria-hidden
          />
          <h2 className="font-display text-lg font-semibold text-[var(--onda-ink)]">
            Cuentas
          </h2>
        </div>
        <div className="min-h-0 flex-1">
          <AsociarVentaList
            storeId={storeId}
            token={token}
            onSelect={setSelectedTabId}
          />
        </div>
        <div className="flex justify-center pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1">
          <button
            type="button"
            onClick={() => setMode('home')}
            className="inline-flex min-h-12 min-w-[12rem] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-6 text-sm font-semibold text-[var(--onda-ink)] shadow-[0_8px_24px_rgba(26,27,46,0.06)] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-primary-500)]/35"
          >
            <CaretLeft className="h-4 w-4" weight="regular" aria-hidden />
            Inicio
          </button>
        </div>
      </div>
    );
  }

  /* Home: acciones grandes */
  return (
    <div className="flex min-h-[70dvh] flex-col">
      <div className="mb-2 flex justify-end">
        {onLogout ? (
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={logoutBusy}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-1.5 text-xs font-medium text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)] disabled:opacity-50"
            aria-label="Cerrar sesión"
          >
            {OndaIcons.logout}
            Cerrar sesión
          </button>
        ) : null}
      </div>
      <div className="mb-8">
        <CajaIdentity storeName={storeName} />
      </div>

      <div className="grid flex-1 content-center gap-3">
        <button
          type="button"
          onClick={() => setMode('acumular')}
          className="flex flex-col items-center gap-3 rounded-[1.5rem] bg-[var(--onda-sky)] px-6 py-8 text-[var(--onda-ink)] shadow-[0_16px_40px_rgba(61,185,232,0.35)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(61,185,232,0.45)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-sky)] focus-visible:ring-offset-2"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/55 text-[var(--onda-ink)]">
            <QrCode className="h-8 w-8" weight="regular" aria-hidden />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Acumular
          </span>
          <span className="text-sm font-medium text-[var(--onda-ink)]/70">
            Cámara y solicitudes
          </span>
        </button>

        <button
          type="button"
          onClick={() => void openVender()}
          disabled={openingVender}
          className="flex flex-col items-center gap-3 rounded-[1.5rem] bg-[var(--onda-primary-500)] px-6 py-8 text-white shadow-[0_16px_40px_rgba(5,45,222,0.28)] transition duration-150 hover:-translate-y-0.5 hover:bg-[var(--onda-primary-600)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-primary-500)] focus-visible:ring-offset-2 disabled:opacity-70"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/15">
            <CurrencyDollar className="h-8 w-8" weight="regular" aria-hidden />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Vender
          </span>
          <span className="text-sm font-medium text-white/80">
            {memberSession
              ? `Como ${memberSession.name}`
              : openingVender
                ? 'Abriendo…'
                : 'Cuentas, cobro y catálogo'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMode('asociar')}
          className="flex flex-col items-center gap-3 rounded-[1.5rem] border border-[var(--onda-border)] bg-[var(--onda-card)] px-6 py-8 text-[var(--onda-ink)] shadow-[0_12px_28px_rgba(26,27,46,0.08)] transition duration-150 hover:-translate-y-0.5 hover:border-[var(--onda-primary-500)]/30 hover:shadow-[0_16px_36px_rgba(26,27,46,0.12)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-primary-500)]/35 focus-visible:ring-offset-2"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--onda-primary-100)] text-[var(--onda-primary-500)]">
            <Receipt className="h-8 w-8" weight="regular" aria-hidden />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Cuentas
          </span>
          <span className="text-sm font-medium text-[var(--onda-muted)]">
            Asociar cliente a venta
          </span>
        </button>
      </div>
    </div>
  );
}
