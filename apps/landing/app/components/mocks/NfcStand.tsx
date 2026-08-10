import { OndaWordmark } from '@onda/shared-ui';

export function NfcStand({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`} aria-hidden>
      <div className="mx-auto w-36">
        <div className="relative aspect-[5/6] rounded-2xl border border-[var(--onda-border)] bg-[linear-gradient(145deg,#E8D5B5_0%,#C4A574_55%,#A8844E_100%)] shadow-[0_18px_40px_rgba(26,27,46,0.18)]">
          <div className="absolute inset-3 rounded-xl bg-[var(--onda-primary-500)] p-3 text-white shadow-inner">
            <OndaWordmark variant="onPrimary" className="h-5 w-auto" />
            <div className="mt-4 flex flex-col items-center gap-2">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path
                  d="M10 18c4-4 12-4 16 0M13 21c2.5-2.5 7.5-2.5 10 0M16.5 24c1.2-1.2 3.8-1.2 5 0"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="18" cy="27" r="1.5" fill="white" />
              </svg>
              <div className="rounded-md bg-white p-1.5">
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <rect width="40" height="40" fill="white" />
                  <path
                    fill="#111"
                    d="M4 4h12v12H4zm4 4h4v4H8zm16-4h12v12H20zm4 4h4v4h-4zM4 20h12v12H4zm4 4h4v4H8zm20-4h4v4h-4zm-4 4h4v4h-4zm8 0h4v8h-4zm-4 4h4v4h-4z"
                  />
                </svg>
              </div>
              <p className="text-center text-[10px] font-medium leading-tight text-white/90">
                Acerca tu celular
              </p>
            </div>
          </div>
        </div>
        <div className="mx-auto -mt-1 h-3 w-28 rounded-b-lg bg-[#8B6A3E]" />
        <div className="mx-auto h-2 w-36 rounded-full bg-[#6E5332]/opacity-70 blur-[1px]" />
      </div>
    </div>
  );
}
