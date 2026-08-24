/** Tipos alineados con la API de WalletWallet (https://www.walletwallet.dev/docs/). */

export type BarcodeFormat = 'QR' | 'PDF417' | 'Aztec' | 'Code128';

export type ColorPreset = 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';

export type WalletPlan = 'free' | 'trial' | 'pro' | 'byok';

export type PassField = {
  /** Omitir o string vacío = valor sin label (más grande en ambos wallets). */
  label?: string;
  value: string;
  /**
   * Plantilla del banner en lock-screen al cambiar este campo.
   * Debe incluir `%@` para que iOS muestre el valor nuevo.
   */
  changeMessage?: string;
};

export type PassLocation = {
  latitude: number;
  longitude: number;
  altitude?: number;
  /** Máx. 128 caracteres. */
  relevantText?: string;
};

/**
 * Cuerpo canónico de create/update (`POST|PUT /api/passes`).
 * PUT exige el spec completo; el serial va solo en el path.
 */
export type PassSpec = {
  barcodeValue?: string;
  barcodeFormat?: BarcodeFormat;
  logoText?: string;
  description?: string;
  organizationName?: string;
  primaryFields?: PassField[];
  secondaryFields?: PassField[];
  headerFields?: PassField[];
  backFields?: PassField[];
  locations?: PassLocation[];
  /** Default API: true (pasa privada). */
  sharingProhibited?: boolean;
  colorPreset?: ColorPreset;
  /** 1–3650. */
  expirationDays?: number;
  /** Pro: hex, p.ej. `#1e40af`. Sobrescribe colorPreset. */
  color?: string;
  /** Pro: HTTPS o data URI PNG. */
  logoURL?: string;
  thumbnailURL?: string;
  /** Pro: banner 1080×360; en loyalty es banner opcional + cartilla de ondas. Cambia el pase a storeCard. */
  stripURL?: string;
  iconURL?: string;
};

export type CreatePassResponse = {
  serialNumber: string;
  googleSaveUrl: string;
  /** `.pkpass` firmado en base64. */
  applePass: string;
  /** Página hosted que elige botón según dispositivo. */
  shareUrl: string;
};

export type UpdatePassResponse = {
  serialNumber: string;
  lastUpdated: number;
  notifiedDevices: number;
  unchanged: boolean;
};

export type RevokePassResponse = {
  serialNumber: string;
  deleted: true;
  googleRevoked?: boolean;
  alreadyDeleted?: boolean;
  notifiedDevices: number;
  lastUpdated?: number;
};

/** Respuesta de `GET /api/passes/{serial}`. */
export type WalletPassDevice = {
  deviceLibraryIdentifier?: string;
  pushToken?: string;
  [key: string]: unknown;
};

export type GetPassResponse = {
  serial: string;
  createdAt?: string;
  lastUpdated?: number;
  devices: WalletPassDevice[];
  googleSaveUrl?: string;
};

export type UsageResponse = {
  count: number;
  limit: number;
  remaining: number;
  resetDate: string;
  plan: WalletPlan;
  trialExpiresAt?: string;
};

export type WalletClientConfig = {
  apiKey: string;
  baseUrl?: string;
  /** Si true (o plan pro/byok/trial), se envían color/logo custom. */
  proFeatures?: boolean;
  fetchImpl?: typeof fetch;
};

/** Resultado de dominio para callers legacy (PWA / controllers). */
export type IssuedPassLinks = {
  /** Serial de WalletWallet — usarlo como `walletRef` / handle de update. */
  walletRef: string;
  serialNumber: string;
  shareUrl: string;
  googleSaveUrl: string;
  /** Compat PWA: URL para abrir en Android. */
  googleUrl: string;
  /**
   * Compat PWA: descarga directa del `.pkpass`
   * (`/p/{serial}/apple.pkpass`).
   */
  appleUrl: string;
  /** Base64 del `.pkpass` (útil si se sirve desde nuestro API). */
  applePass?: string;
};

export type PassScenarioId =
  | 'loyalty'
  | 'onda-card'
  | 'event-ticket'
  | 'coupon';
