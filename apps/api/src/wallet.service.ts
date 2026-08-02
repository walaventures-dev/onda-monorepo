import { Injectable, Logger } from '@nestjs/common';

export type IssuePassInput = {
  serialNumber: string;
  points: number;
  design: {
    title: string;
    subtitle?: string | null;
    description?: string | null;
    backgroundColor: string;
    foregroundColor: string;
    labelColor?: string | null;
    logoUrl?: string | null;
  };
  holderName: string;
};

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  async issuePass(input: IssuePassInput) {
    const base = process.env.WALLET_API_BASE_URL || 'https://api.wallet.example';
    const key = process.env.WALLET_API_KEY || '';

    // Wallet API integration (sandbox-friendly stub when no key)
    if (!key || key === 'dev-wallet-key') {
      this.logger.log(`Wallet stub issue ${input.serialNumber}`);
      return {
        appleUrl: `${base}/v1/passes/apple/${input.serialNumber}.pkpass`,
        googleUrl: `${base}/v1/passes/google/save/${input.serialNumber}`,
        walletRef: `stub-${input.serialNumber}`,
      };
    }

    const res = await fetch(`${base}/v1/passes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(`Wallet API error: ${res.status}`);
    }

    return (await res.json()) as {
      appleUrl: string;
      googleUrl: string;
      walletRef: string;
    };
  }

  async updatePoints(walletRef: string, points: number) {
    const base = process.env.WALLET_API_BASE_URL || 'https://api.wallet.example';
    const key = process.env.WALLET_API_KEY || '';
    if (!key || key === 'dev-wallet-key' || !walletRef) {
      this.logger.log(`Wallet stub update ${walletRef} -> ${points}`);
      return { ok: true };
    }
    const res = await fetch(`${base}/v1/passes/${walletRef}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ points }),
    });
    return { ok: res.ok };
  }
}
