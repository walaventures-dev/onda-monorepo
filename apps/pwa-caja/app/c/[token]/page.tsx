'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Enlace kiosk: entra a la app rutada con el token en la URL. */
export default function CajaTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/?token=${encodeURIComponent(token)}`);
  }, [token, router]);

  return null;
}
