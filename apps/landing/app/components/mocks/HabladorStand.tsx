"use client";

import { OndaWordmark } from "@onda/shared-ui";

export function HabladorStand({
  qrSrc,
  proxyUrl,
  onTap,
  busy = false,
  className = "",
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
        aria-label="Activar tarjeta Onda Spa con el hablador"
        className="group relative z-10 w-full text-left opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-primary-500)] focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-100"
      >
        {/* Front face — sólido, opaco */}
        <div className="relative overflow-hidden rounded-t-[1.65rem] rounded-b-md bg-[#052DDE] px-5 pb-5 pt-7 text-white transition group-active:scale-[0.99] group-disabled:active:scale-100">
          <div className="relative flex justify-center">
            <OndaWordmark variant="onPrimary" className="h-7 w-auto" />
          </div>

          <div className="relative mt-5 flex flex-col items-center gap-1.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
              <svg
                width="26"
                height="26"
                viewBox="0 0 26 26"
                fill="none"
                aria-hidden
              >
                <path
                  d="M6.5 13c3.5-3.5 9.5-3.5 13 0"
                  stroke="#052DDE"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M9 15.5c2-2 6-2 8 0"
                  stroke="#052DDE"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M11.5 18c1-1 3-1 4 0"
                  stroke="#052DDE"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle cx="13" cy="20.5" r="1.35" fill="#052DDE" />
              </svg>
            </span>
            <p className="mt-1 text-center text-[13px] font-semibold leading-tight text-white">
              Escanea y activa
            </p>
            <p className="text-center text-[11px] font-medium text-white">
              NFC o código QR
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

          <p className="relative mt-4 text-center text-[13px] font-bold tracking-tight text-white"></p>
        </div>

        {/* L-stand foot */}
        <div className="relative mx-auto" aria-hidden>
          <div
            className="mx-auto h-3 w-[90%] bg-[#041DB2]"
            style={{
              clipPath: "polygon(4% 0, 96% 0, 100% 100%, 0 100%)",
            }}
          />
          <div className="mx-auto -mt-px h-[7px] w-full rounded-b-[4px] bg-[#0418a8]" />
        </div>
      </button>
    </div>
  );
}
