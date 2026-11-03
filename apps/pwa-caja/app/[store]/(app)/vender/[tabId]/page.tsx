'use client';

import { use } from 'react';
import { VenderScreen } from '../../../../VenderScreen';

export default function VenderTabPage({
  params,
}: {
  params: Promise<{ tabId: string }>;
}) {
  const { tabId } = use(params);
  return <VenderScreen screen="detail" tabId={tabId} />;
}
