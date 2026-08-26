'use client';

import { Suspense, use, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function PosTabRedirectInner({ tabId }: { tabId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId');

  useEffect(() => {
    const q = storeId ? `?storeId=${storeId}` : '';
    router.replace(`/asociar/${tabId}${q}`);
  }, [router, tabId, storeId]);

  return null;
}

/** @deprecated Usar /asociar/[tabId] */
export default function PosTabRedirectPage({
  params,
}: {
  params: Promise<{ tabId: string }>;
}) {
  const { tabId } = use(params);
  return (
    <Suspense fallback={null}>
      <PosTabRedirectInner tabId={tabId} />
    </Suspense>
  );
}
