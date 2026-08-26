'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** @deprecated Usar /c/[token] o / */
export default function PosTabRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
