'use client';

import { use } from 'react';
import { VenderScreen } from '../../../../../VenderScreen';

export default function VenderTabProductosPage({
  params,
}: {
  params: Promise<{ tabId: string }>;
}) {
  const { tabId } = use(params);
  return <VenderScreen screen="grid" tabId={tabId} />;
}
