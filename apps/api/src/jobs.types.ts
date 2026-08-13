export type JobType =
  | 'whatsapp-send'
  | 'brevo-email'
  | 'brevo-sms'
  | 'wallet-notify'
  | 'wompi-renew';

export type WhatsappJobPayload = {
  to: string;
  template: string;
  variables?: Record<string, string>;
  storeId?: string;
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

export type JobPayloadMap = {
  'whatsapp-send': WhatsappJobPayload;
  'brevo-email': BrevoEmailJobPayload;
  'brevo-sms': BrevoSmsJobPayload;
  'wallet-notify': WalletNotifyJobPayload;
  'wompi-renew': WompiRenewJobPayload;
};

export type JobsEnqueueOptions = {
  delayMs?: number;
};
