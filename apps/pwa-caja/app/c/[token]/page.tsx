'use client';

import { use } from 'react';
import { CajaKioskClient } from '../../CajaApp';

export default function CajaTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return <CajaKioskClient token={token} />;
}
