import type { WalletClientConfig } from './types';

export const WALLET_DEFAULT_BASE_URL = 'https://api.walletwallet.dev';

/** Clave placeholder que fuerza modo stub (sin llamadas reales). */
export const WALLET_DEV_STUB_KEY = 'dev-wallet-key';

export function resolveWalletConfig(
  overrides?: Partial<WalletClientConfig>
): WalletClientConfig & { stub: boolean } {
  const apiKey =
    overrides?.apiKey ?? process.env.WALLET_API_KEY ?? process.env.WALLETWALLET_API_KEY ?? '';
  const baseUrl =
    overrides?.baseUrl ??
    process.env.WALLET_API_BASE_URL ??
    process.env.WALLETWALLET_BASE_URL ??
    WALLET_DEFAULT_BASE_URL;

  const plan = (process.env.WALLET_PLAN ?? '').toLowerCase();
  const proFromEnv = process.env.WALLET_PRO === 'true';
  const proFromPlan = plan === 'pro' || plan === 'byok' || plan === 'trial';
  const proFeatures = overrides?.proFeatures ?? (proFromEnv || proFromPlan);

  const stub = !apiKey || apiKey === WALLET_DEV_STUB_KEY;

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ''),
    proFeatures,
    fetchImpl: overrides?.fetchImpl,
    stub,
  };
}

export function isStubWalletRef(walletRef: string | null | undefined): boolean {
  return !walletRef || walletRef.startsWith('stub-');
}
