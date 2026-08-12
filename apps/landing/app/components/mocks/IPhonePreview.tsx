'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';
import type { Channel } from '../../lib/campaign-demo';

const SPA_LOGO = '/demo/onda-spa-logo.svg';

function WhatsAppIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#fff"
        d="M12.04 2C6.58 2 2.15 6.4 2.15 11.86c0 1.94.56 3.76 1.54 5.32L2 22l4.98-1.64a9.86 9.86 0 0 0 5.06 1.37h.01c5.46 0 9.89-4.4 9.89-9.86C21.94 6.4 17.5 2 12.04 2Zm5.75 14.01c-.24.67-1.4 1.23-1.94 1.31-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.93-4.36-.14-.19-1.15-1.53-1.15-2.92 0-1.39.73-2.07.99-2.35.26-.28.57-.35.76-.35h.55c.17 0 .41-.07.64.49.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.56.16.28.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.28.36-.23.61-.14.24.1 1.54.73 1.8.86.27.14.44.2.51.31.07.12.07.67-.17 1.34Z"
      />
    </svg>
  );
}

function ChannelIcon({ channel }: { channel: Channel }) {
  if (channel === 'Wallet') {
    return (
      <span className="mt-0.5 flex h-7 w-7 shrink-0 overflow-hidden rounded-lg bg-white">
        <img src={SPA_LOGO} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  if (channel === 'WhatsApp') {
    return (
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#25D366]">
        <WhatsAppIcon className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#3DB9E8] text-[8px] font-bold text-white">
      SMS
    </span>
  );
}

const CHANNEL_META: Record<Channel, { title: string; subtitle: string; brand: string }> = {
  Wallet: {
    title: 'Wallet',
    subtitle: 'ahora',
    brand: 'Onda Spa',
  },
  WhatsApp: {
    title: 'WhatsApp',
    subtitle: 'ahora',
    brand: 'Onda',
  },
  SMS: {
    title: 'Mensajes',
    subtitle: 'ahora',
    brand: 'Onda Spa',
  },
};

export function IPhonePreview({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const gradId = `iphone-bezel-${useId().replace(/:/g, '')}`;

  return (
    <div className={`relative mx-auto w-full max-w-[280px] ${className}`}>
      <svg
        viewBox="0 0 320 650"
        className="pointer-events-none absolute inset-0 z-20 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3A3B4D" />
            <stop offset="45%" stopColor="#1A1B2E" />
            <stop offset="100%" stopColor="#0C0D18" />
          </linearGradient>
        </defs>
        {/* Outer frame only — screen hole is transparent so content shows through */}
        <path
          fill={`url(#${gradId})`}
          fillRule="evenodd"
          d="M58 4h204c29.8 0 54 24.2 54 54v534c0 29.8-24.2 54-54 54H58c-29.8 0-54-24.2-54-54V58C4 28.2 28.2 4 58 4zm-2 12c-23.2 0-42 18.8-42 42v534c0 23.2 18.8 42 42 42h208c23.2 0 42-18.8 42-42V58c0-23.2-18.8-42-42-42H56z"
        />
        <rect x="0" y="118" width="5" height="34" rx="2" fill="#2A2B3D" />
        <rect x="0" y="168" width="5" height="54" rx="2" fill="#2A2B3D" />
        <rect x="0" y="236" width="5" height="54" rx="2" fill="#2A2B3D" />
        <rect x="315" y="178" width="5" height="78" rx="2" fill="#2A2B3D" />
      </svg>

      <div
        className="relative z-10 overflow-hidden rounded-[2.55rem] bg-[#0B1220]"
        style={{
          aspectRatio: '9 / 19.5',
          margin: '3.2% 4%',
        }}
      >
        <div className="absolute inset-0">{children}</div>
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 h-[22px] w-[88px] -translate-x-1/2 rounded-full bg-black" />
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-30 h-1 w-28 -translate-x-1/2 rounded-full bg-white/40" />
      </div>
    </div>
  );
}

/** Pantalla tipo Apple Wallet — pase sin overlap ni scale. */
export function WalletScreen({
  children,
}: {
  children: ReactNode;
  passTitle?: string;
}) {
  const now = new Date();
  const time = now.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div className="relative flex h-full flex-col bg-[#0B0B0F] px-2.5 pb-4 pt-11">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(61,185,232,0.1) 0%, transparent 45%), linear-gradient(180deg, #1A1B2E 0%, #0B0B0F 48%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex shrink-0 items-center justify-between px-1 text-white">
        <p className="text-[10px] font-semibold tabular-nums">{time}</p>
        <p className="text-[10px] font-semibold tracking-tight">Wallet</p>
        <span className="w-7" aria-hidden />
      </div>

      <p className="relative z-10 mt-3 shrink-0 px-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-white/45">
        Pases
      </p>

      <div className="relative z-10 mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

/** Pase compacto pensado para caber en el iPhone sin solaparse. */
export function WalletPassCard({
  backgroundColor = '#052DDE',
  foregroundColor = '#FFFFFF',
  title = 'Onda Spa',
  subtitle,
  logoUrl,
  points = 0,
  maxStamps = 10,
  memberName,
}: {
  backgroundColor?: string;
  foregroundColor?: string;
  title?: string;
  subtitle?: string | null;
  logoUrl?: string | null;
  points?: number;
  maxStamps?: number;
  memberName?: string | null;
}) {
  const remaining = Math.max(0, maxStamps - points);
  const remainingText =
    remaining === 0
      ? '¡Listo para canjear!'
      : remaining === 1
        ? 'Te falta 1 onda'
        : `Te faltan ${remaining}`;

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ backgroundColor, color: foregroundColor }}
      aria-label={`Pase ${title}`}
    >
      <div className="flex items-center gap-2 px-2.5 pt-2.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-xs font-bold">
            O
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold leading-tight">{title}</p>
          {subtitle ? (
            <p className="truncate text-[9px] leading-tight opacity-80">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="px-2.5 pt-2">
        <p className="text-[13px] font-bold leading-none">
          {points}/{maxStamps}
        </p>
        <p className="mt-0.5 text-[9px] opacity-80">{remainingText}</p>
      </div>

      <div className="flex flex-wrap gap-1 px-2.5 py-2.5" aria-label="Progreso de ondas">
        {Array.from({ length: maxStamps }, (_, i) => {
          const filled = i < points;
          return (
            <span
              key={i}
              className="flex h-4 w-4 items-center justify-center rounded-full"
              style={{
                backgroundColor: filled ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)',
                boxShadow: filled ? undefined : 'inset 0 0 0 1px rgba(255,255,255,0.28)',
              }}
            >
              <span
                className="block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: foregroundColor,
                  opacity: filled ? 1 : 0.25,
                }}
              />
            </span>
          );
        })}
      </div>

      <div
        className="flex items-center justify-between gap-2 border-t px-2.5 py-2"
        style={{ borderColor: 'rgba(255,255,255,0.16)' }}
      >
        <p
          className={`truncate text-[9px] font-semibold ${
            memberName?.trim() ? '' : 'opacity-45'
          }`}
        >
          {memberName?.trim() || 'Tu nombre'}
        </p>
      </div>
    </div>
  );
}

export function LockScreen({
  visibleChannels,
  message,
}: {
  visibleChannels: Channel[];
  message: string;
}) {
  const now = new Date();
  const time = now.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  const date = now.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="relative flex h-full flex-col px-3 pb-6 pt-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse at 50% 20%, #3DB9E833 0%, transparent 55%), linear-gradient(180deg, #1A1B2E 0%, #0B1220 55%, #052DDE22 100%)',
        }}
      />

      <div className="relative z-10 text-center text-white">
        <p className="text-[11px] font-medium capitalize text-white/70">{date}</p>
        <p className="mt-1 font-display text-[2.75rem] font-semibold leading-none tracking-tight">
          {time}
        </p>
        {visibleChannels.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M7 11V8a5 5 0 0 1 10 0v3"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <rect
                  x="5"
                  y="11"
                  width="14"
                  height="10"
                  rx="2.5"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth="1.8"
                />
              </svg>
            </span>
            <p className="text-[10px] text-white/45">Pantalla bloqueada</p>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 mt-5 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <AnimatePresence initial={false}>
          {visibleChannels.map((channel) => {
            const meta = CHANNEL_META[channel];
            return (
              <motion.div
                key={channel}
                initial={{ opacity: 0, y: -18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="rounded-[1.1rem] bg-white/92 p-2.5 shadow-lg backdrop-blur-md"
              >
                <div className="flex items-start gap-2">
                  <ChannelIcon channel={channel} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[11px] font-semibold text-[var(--onda-ink)]">
                        {meta.title}
                      </p>
                      <p className="text-[9px] text-[var(--onda-muted)]">{meta.subtitle}</p>
                    </div>
                    <p className="mt-0.5 text-[10px] font-medium text-[var(--onda-ink)]">
                      {meta.brand}
                    </p>
                    <p className="mt-0.5 line-clamp-3 text-[10px] leading-snug text-[var(--onda-muted)]">
                      {message || '…'}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
