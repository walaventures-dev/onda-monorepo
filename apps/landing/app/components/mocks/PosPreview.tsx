'use client';

const LINE_ITEMS = [
  { name: 'Café latte', qty: 2, price: '$18.000' },
  { name: 'Croissant', qty: 1, price: '$8.500' },
  { name: 'Jugo natural', qty: 1, price: '$9.000' },
] as const;

export function PosPreview() {
  return (
    <div
      className="mx-auto w-full max-w-sm overflow-hidden rounded-[1.5rem] border border-[var(--onda-border)] bg-[var(--onda-card)] shadow-[0_24px_56px_rgba(26,27,46,0.12)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
            Cuenta abierta
          </p>
          <p className="mt-0.5 font-display text-sm font-semibold text-[var(--onda-ink)]">
            Mesa 4 · Anónima
          </p>
        </div>
        <span className="rounded-full bg-[var(--onda-sky-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--onda-sky)]">
          En curso
        </span>
      </div>

      <ul className="divide-y divide-[var(--onda-border)] px-4">
        {LINE_ITEMS.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--onda-ink)]">
                {item.name}
              </p>
              <p className="text-xs text-[var(--onda-muted)]">×{item.qty}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--onda-ink)]">
              {item.price}
            </p>
          </li>
        ))}
      </ul>

      <div className="border-t border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Total
            </p>
            <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-[var(--onda-ink)]">
              $35.500
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-[var(--onda-primary-100)] px-3 py-1.5 text-xs font-semibold text-[var(--onda-primary-500)]">
            +3 Ondas
          </span>
        </div>
        <div className="mt-4 flex h-11 items-center justify-center rounded-full bg-[var(--onda-primary-500)] text-sm font-semibold text-white">
          Cobrar
        </div>
      </div>
    </div>
  );
}
