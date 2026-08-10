import type { ReactNode } from 'react';

export function PhoneFrame({
  children,
  className = '',
  notch = true,
}: {
  children: ReactNode;
  className?: string;
  notch?: boolean;
}) {
  return (
    <div
      className={`relative mx-auto w-[220px] overflow-hidden rounded-[2rem] border-[6px] border-[var(--onda-ink)] bg-[var(--onda-ink)] shadow-[0_24px_60px_rgba(26,27,46,0.28)] ${className}`}
    >
      {notch ? (
        <div className="absolute left-1/2 top-2 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
      ) : null}
      <div className="relative aspect-[9/19] overflow-hidden rounded-[1.55rem] bg-[#0B1220]">
        {children}
      </div>
    </div>
  );
}
