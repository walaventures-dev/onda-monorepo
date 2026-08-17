import { api } from '@onda/shared-ui';

export function isAppleDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
}

export type IssuedWalletLinks = {
  appleUrl?: string | null;
  googleUrl?: string | null;
  walletRef?: string;
};

export async function issueWalletPass(passId: string): Promise<IssuedWalletLinks> {
  return api<IssuedWalletLinks>(`/passes/${passId}/issue`, { method: 'POST' });
}

/** URL de instalación según el dispositivo (Apple o Google Wallet). */
export function walletInstallUrl(
  links: IssuedWalletLinks | null | undefined
): string | undefined {
  if (!links) return undefined;
  const url = isAppleDevice() ? links.appleUrl : links.googleUrl;
  return url || undefined;
}
