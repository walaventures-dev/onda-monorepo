'use client';

import { OndaWordmark } from '@onda/shared-ui';

export function HabladorStand({
  qrSrc,
  proxyUrl,
  onTap,
  busy = false,
  className = '',
}: {
  qrSrc: string;
  proxyUrl: string;
  onTap?: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative mx-auto w-full max-w-[220px] ${className}`}>
      <button
        type="button"
        onClick={onTap}
        disabled={busy || !onTap}
        aria-label="Acercar celular al hablador Onda"
        className="group relative z-10 w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-primary-500)] focus-visible:ring-offset-2 disabled:opacity-70"
      >
        {/* Front face — acrylic stand like hero product shot */}
        <div className="relative overflow-hidden rounded-t-[1.65rem] rounded-b-md bg-[var(--onda-primary-500)] px-5 pb-5 pt-7 text-white shadow-[0_22px_48px_rgba(5,45,222,0.38)] transition group-hover:shadow-[0_26px_56px_rgba(5,45,222,0.45)] group-active:scale-[0.99]">
          {/* Soft edge highlight (acrylic sheen) */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/18 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-px bg-white/25"
            aria-hidden
          />

          <div className="relative flex justify-center">
            <OndaWordmark variant="onPrimary" className="h-7 w-auto" />
          </div>

          <div className="relative mt-5 flex flex-col items-center gap-1.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
                <path
                  d="M6.5 13c3.5-3.5 9.5-3.5 13 0"
                  stroke="var(--onda-primary-500)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M9 15.5c2-2 6-2 8 0"
                  stroke="var(--onda-primary-500)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M11.5 18c1-1 3-1 4 0"
                  stroke="var(--onda-primary-500)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle cx="13" cy="20.5" r="1.35" fill="var(--onda-primary-500)" />
              </svg>
            </span>
            <p className="mt-1 text-center text-[13px] font-semibold leading-tight">
              Acerca tu celular
            </p>
            <p className="text-center text-[11px] font-medium text-white/85">
              o escanea el QR
            </p>
          </div>

          <div className="relative mx-auto mt-4 w-[78%] overflow-hidden rounded-md bg-white p-1.5">
            {qrSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrSrc}
                alt={`QR ${proxyUrl}`}
                width={160}
                height={160}
                className="h-auto w-full"
              />
            ) : (
              <div className="aspect-square animate-pulse bg-[var(--onda-bg)]" />
            )}
          </div>

          <p className="relative mt-4 text-center text-[13px] font-bold tracking-tight">
            ¡Ponte en la Onda!
          </p>
        </div>

        {/* L-stand foot */}
        <div className="relative mx-auto" aria-hidden>
          <div
            className="mx-auto h-3 w-[90%] bg-[var(--onda-primary-600)]"
            style={{
              clipPath: 'polygon(4% 0, 96% 0, 100% 100%, 0 100%)',
            }}
          />
          <div className="mx-auto -mt-px h-[7px] w-full rounded-b-[4px] bg-[linear-gradient(180deg,var(--onda-primary-600)_0%,#0418a8_100%)] shadow-[0_10px_18px_rgba(5,45,222,0.35)]" />
          <div className="mx-auto mt-1 h-2 w-[94%] rounded-full bg-[var(--onda-primary-700)]/25 blur-[3px]" />
        </div>
      </button>
    </div>
  );
}
