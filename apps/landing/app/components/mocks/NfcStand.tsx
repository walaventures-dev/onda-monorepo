/** Decorative NFC stand mock (static). For the live demo use `HabladorStand`. */
import { OndaWordmark } from '@onda/shared-ui';

export function NfcStand({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`} aria-hidden>
      <div className="mx-auto w-36">
        <div className="relative overflow-hidden rounded-t-2xl rounded-b-md bg-[var(--onda-primary-500)] px-3 pb-3 pt-4 text-white shadow-[0_16px_36px_rgba(5,45,222,0.35)]">
          <OndaWordmark variant="onPrimary" className="mx-auto h-5 w-auto" />
          <div className="mt-3 flex flex-col items-center gap-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
              <svg width="18" height="18" viewBox="0 0 26 26" fill="none">
                <path
                  d="M6.5 13c3.5-3.5 9.5-3.5 13 0M9 15.5c2-2 6-2 8 0M11.5 18c1-1 3-1 4 0"
                  stroke="var(--onda-primary-500)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle cx="13" cy="20.5" r="1.35" fill="var(--onda-primary-500)" />
              </svg>
            </span>
            <p className="text-center text-[9px] font-semibold leading-tight">Acerca tu celular</p>
            <div className="mt-1 w-[72%] rounded-sm bg-white p-1">
              <svg viewBox="0 0 40 40" className="h-auto w-full">
                <rect width="40" height="40" fill="white" />
                <path
                  fill="#111"
                  d="M4 4h12v12H4zm4 4h4v4H8zm16-4h12v12H20zm4 4h4v4h-4zM4 20h12v12H4zm4 4h4v4H8zm20-4h4v4h-4zm-4 4h4v4h-4zm8 0h4v8h-4zm-4 4h4v4h-4z"
                />
              </svg>
            </div>
            <p className="mt-1 text-center text-[9px] font-bold">¡Ponte en la Onda!</p>
          </div>
        </div>
        <div className="mx-auto h-2.5 w-[90%] bg-[var(--onda-primary-600)]" />
        <div className="mx-auto h-1.5 w-full rounded-b-sm bg-[var(--onda-primary-700)]" />
      </div>
    </div>
  );
}
