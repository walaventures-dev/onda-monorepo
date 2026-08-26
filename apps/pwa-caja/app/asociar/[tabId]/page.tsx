'use client';

import { Suspense, use, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AsociarVentaDetail } from '@onda/shared-ui';

function AsociarVentaInner({ tabId }: { tabId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId') || '';

  useEffect(() => {
    if (!storeId) router.replace('/asociar');
  }, [storeId, router]);

  if (!storeId) return null;

  return (
    <div className="min-h-dvh p-4">
      <AsociarVentaDetail
        storeId={storeId}
        tabId={tabId}
        onBack={() => router.push('/asociar')}
      />
    </div>
  );
}

export default function AsociarVentaPage({
  params,
}: {
  params: Promise<{ tabId: string }>;
}) {
  const { tabId } = use(params);
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm">Cargando…</p>}>
      <AsociarVentaInner tabId={tabId} />
    </Suspense>
  );
}
