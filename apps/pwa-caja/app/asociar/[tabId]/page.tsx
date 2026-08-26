'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** @deprecated Usar la app unificada en / (modo Cuentas abiertas) */
export default function AsociarTabRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
