import { Suspense } from 'react';
import { CocinaClient } from '../CocinaClient';

export default async function CocinaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <Suspense fallback={null}>
      <CocinaClient token={token ?? ''} />
    </Suspense>
  );
}
