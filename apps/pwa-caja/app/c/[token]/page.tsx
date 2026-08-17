import { Suspense } from 'react';
import { CajaClient } from '../../CajaClient';

export default function CajaTokenPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center text-sm text-[var(--onda-muted)]">
          Abriendo caja…
        </main>
      }
    >
      <CajaClient />
    </Suspense>
  );
}
