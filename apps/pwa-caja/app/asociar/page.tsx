'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** @deprecated Usar la app unificada en / */
export default function AsociarRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
