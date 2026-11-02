'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { AsociarVentaDetail, SkeletonScreen } from '@onda/shared-ui';
import { useCajaSession } from '../../../CajaAppShell';

export default function AsociarTabPage({
  params,
}: {
  params: Promise<{ tabId: string }>;
}) {
  const { tabId } = use(params);
  const { session } = useCajaSession();
  const router = useRouter();
  if (!session) return <SkeletonScreen />;
  return (
    <div className="flex min-h-full w-full flex-col gap-3">
      <AsociarVentaDetail
        storeId={session.storeId}
        tabId={tabId}
        token={session.token}
        ondaValue={session.ondaValue}
        onBack={() => router.back()}
      />
    </div>
  );
}
