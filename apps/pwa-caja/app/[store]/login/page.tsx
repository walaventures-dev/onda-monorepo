'use client';

import { use, useEffect } from 'react';
import { CajaLoginClient } from '../../CajaApp';

/** Login de caja con ámbito de negocio: /[store]/login. */
export default function StoreLoginPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store } = use(params);

  useEffect(() => {
    document.title = 'Caja · Onda';
  }, []);

  return <CajaLoginClient store={store} />;
}
