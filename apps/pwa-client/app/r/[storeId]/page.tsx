import { Suspense } from 'react';
import { SkeletonPwa } from '@onda/shared-ui';
import StoreEntryPage from './StoreEntryClient';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="onda-pwa-shell items-center justify-center">
          <SkeletonPwa />
        </div>
      }
    >
      <StoreEntryPage />
    </Suspense>
  );
}
