'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** @deprecated El POS completo no vive en pwa-caja; redirige al hub */
export default function PosRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
