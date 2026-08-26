export type AccountingProvider = 'NONE' | 'ALEGRA' | 'SIIGO';

export type PosSalePayload = {
  saleId: string;
  storeId: string;
  total: number;
  completedAt: Date;
  lines: Array<{ name: string; quantity: number; unitPrice: number }>;
};

export type PosRefundPayload = {
  refundId: string;
  saleId: string;
  amount: number;
};

export type SyncResult = {
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  externalId?: string;
  error?: string;
};

export interface AccountingAdapter {
  provider: Exclude<AccountingProvider, 'NONE'>;
  syncSale(sale: PosSalePayload): Promise<SyncResult>;
  syncRefund(refund: PosRefundPayload): Promise<SyncResult>;
}

export class NoOpAccountingAdapter {
  readonly provider = 'NONE' as const;

  async syncSale(): Promise<SyncResult> {
    return { status: 'SKIPPED' };
  }

  async syncRefund(): Promise<SyncResult> {
    return { status: 'SKIPPED' };
  }
}

export function resolveAccountingAdapter(config: {
  provider: AccountingProvider;
  credentials?: unknown;
}): AccountingAdapter | NoOpAccountingAdapter {
  if (config.provider === 'ALEGRA' || config.provider === 'SIIGO') {
    return new NoOpAccountingAdapter();
  }
  return new NoOpAccountingAdapter();
}
