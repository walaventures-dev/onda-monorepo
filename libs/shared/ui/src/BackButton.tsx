'use client';

import { CaretLeftIcon as CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';

/**
 * Botón de navegación atrás estilo app: píldora con borde y sombra,
 * suficientemente grande para pulgar en pantallas táctiles.
 */
export function OndaBackButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-4 text-sm font-semibold text-[var(--onda-ink)] shadow-[0_4px_16px_rgba(26,27,46,0.08)] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-primary-500)]/35"
    >
      <CaretLeft className="h-4 w-4" weight="regular" aria-hidden />
      {label}
    </button>
  );
}
