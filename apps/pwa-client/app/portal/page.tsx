import { Suspense } from 'react';
import { SkeletonPwa } from '@onda/shared-ui';
import PortalClient from './PortalClient';

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="onda-pwa-shell items-center justify-center">
          <SkeletonPwa />
        </div>
      }
    >
      <PortalClient />
    </Suspense>
  );
}
