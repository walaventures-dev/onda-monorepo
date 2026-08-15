'use client';

import {
  LockScreen as SharedLockScreen,
  type LockScreenNotification,
} from '@onda/shared-ui';

export {
  IPhonePreview,
  WalletScreen,
  WalletPassCard,
} from '@onda/shared-ui';
export type { LockScreenNotification, PreviewChannel } from '@onda/shared-ui';

const SPA_LOGO = '/demo/onda-spa-logo.svg';

export function LockScreen({
  notifications,
  storeName,
  logoUrl,
}: {
  notifications?: LockScreenNotification[];
  storeName?: string;
  logoUrl?: string | null;
}) {
  return (
    <SharedLockScreen
      notifications={notifications}
      storeName={storeName}
      logoUrl={logoUrl ?? SPA_LOGO}
    />
  );
}
