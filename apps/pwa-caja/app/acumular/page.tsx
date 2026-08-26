'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** @deprecated Usar / — el hub incluye acumular y asociar */
export default function AcumularRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
