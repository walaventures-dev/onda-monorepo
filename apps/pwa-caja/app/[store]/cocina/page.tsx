import { Suspense } from 'react';
import { CocinaClient } from '../../CocinaClient';

export default async function CocinaPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { store } = await params;
  const { token } = await searchParams;
  return (
    <Suspense fallback={null}>
      <CocinaClient store={store} token={token ?? ''} />
    </Suspense>
  );
}
