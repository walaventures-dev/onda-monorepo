export type JobType =
  | 'whatsapp-send'
  | 'brevo-email'
  | 'brevo-sms'
  | 'wallet-notify'
  | 'wompi-renew'
  | 'usage-billing'
  | 'billing-sweep'
  | 'cartilla-ending-sms'
  | 'campaign-dispatch'
  | 'campaign-pack-renew'
  | 'pos-accounting-sync';

export type WhatsappJobPayload = {
  to: string;
  template: string;
  variables?: Record<string, string>;
  storeId?: string;
  /** true → envía por Meta Cloud API (AUTHENTICATION template). false/ausente → Kapso. */
  authOtp?: boolean;
};

export type BrevoEmailJobPayload = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
};

export type BrevoSmsJobPayload = {
  storeId: string;
  title: string;
  campaignId?: string;
};

export type WalletNotifyJobPayload = {
  walletRef: string;
  message: string;
};

export type WompiRenewJobPayload = {
  storeId: string;
};

export type UsageBillingJobPayload = {
  storeId: string;
};

export type BillingSweepJobPayload = Record<string, never>;

export type CartillaEndingSmsPayload = {
  cartillaId: string;
  storeId: string;
  endsAt: string;
};

export type CampaignDispatchPayload = {
  campaignId: string;
};

export type CampaignPackRenewPayload = {
  storeId: string;
};

export type PosAccountingSyncPayload = {
  saleId: string;
};

export type JobPayloadMap = {
  'whatsapp-send': WhatsappJobPayload;
  'brevo-email': BrevoEmailJobPayload;
  'brevo-sms': BrevoSmsJobPayload;
  'wallet-notify': WalletNotifyJobPayload;
  'wompi-renew': WompiRenewJobPayload;
  'usage-billing': UsageBillingJobPayload;
  'billing-sweep': BillingSweepJobPayload;
  'cartilla-ending-sms': CartillaEndingSmsPayload;
  'campaign-dispatch': CampaignDispatchPayload;
  'campaign-pack-renew': CampaignPackRenewPayload;
  'pos-accounting-sync': PosAccountingSyncPayload;
};

export type JobsEnqueueOptions = {
  delayMs?: number;
};
