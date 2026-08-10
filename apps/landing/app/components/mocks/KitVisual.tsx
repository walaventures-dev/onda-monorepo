import { OndaHandMark, OndaWordmark } from '@onda/shared-ui';

export function KitVisual({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`} aria-hidden>
      <div className="absolute -left-2 top-8 h-28 w-36 rotate-[-8deg] rounded-2xl bg-[var(--onda-primary-500)] shadow-xl" />
      <div className="absolute left-10 top-4 h-32 w-40 rotate-[6deg] rounded-2xl border border-[var(--onda-border)] bg-white shadow-xl">
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
          <OndaWordmark className="h-7 w-auto" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
            Kit Onda
          </p>
        </div>
      </div>
      <div className="relative z-10 ml-16 mt-16">
        <div className="w-28 rounded-xl border border-[var(--onda-border)] bg-[linear-gradient(145deg,#E8D5B5,#A8844E)] p-2 shadow-lg">
          <div className="rounded-lg bg-[var(--onda-primary-500)] px-2 py-3 text-center text-[10px] font-bold text-white">
            NFC
          </div>
        </div>
      </div>
      <OndaHandMark className="absolute -right-2 bottom-0 h-24 w-auto opacity-90" />
    </div>
  );
}
