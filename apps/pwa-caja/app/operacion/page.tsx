'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** @deprecated Usar /acumular */
export default function OperacionRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/acumular');
  }, [router]);
  return null;
}
