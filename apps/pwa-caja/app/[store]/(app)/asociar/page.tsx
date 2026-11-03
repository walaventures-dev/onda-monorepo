'use client';

import { useParams, useRouter } from 'next/navigation';
import { AsociarVentaList, SkeletonScreen } from '@onda/shared-ui';
import { PlusCircleIcon as PlusCircle } from '@phosphor-icons/react/dist/csr/PlusCircle';
import { useCajaSession } from '../../../CajaAppShell';

export default function AsociarPage() {
  const { session } = useCajaSession();
  const router = useRouter();
  const params = useParams<{ store: string }>();
  const store = decodeURIComponent(params.store || '');
  if (!session) return <SkeletonScreen />;
  return (
    <div className="flex min-h-[70dvh] flex-col gap-4">
      <div className="flex items-center justify-center gap-2">
        <PlusCircle
          className="h-5 w-5 text-[var(--onda-primary-500)]"
          weight="regular"
          aria-hidden
        />
        <h2 className="font-display text-lg font-semibold text-[var(--onda-ink)]">
          Cuentas
        </h2>
      </div>
      <div className="min-h-0 flex-1">
        <AsociarVentaList
          storeId={session.storeId}
          token={session.token}
          onSelect={(tabId) => router.push(`/${store}/asociar/${tabId}`)}
        />
      </div>
    </div>
  );
}
