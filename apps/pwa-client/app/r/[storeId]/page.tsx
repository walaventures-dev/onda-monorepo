import { Suspense } from 'react';
import StoreEntryPage from './StoreEntryClient';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="onda-pwa-shell items-center justify-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-2xl onda-gradient" />
          <p className="text-sm text-[var(--onda-muted)]">Preparando tu pase…</p>
        </div>
      }
    >
      <StoreEntryPage />
    </Suspense>
  );
}
