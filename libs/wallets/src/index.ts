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

export type IssuePassResult = {
  appleUrl: string;
  googleUrl: string;
  walletRef: string;
};

/** Wallet API client for Apple + Google pass issuance */
export async function issueWalletPass(
  input: IssuePassInput
): Promise<IssuePassResult> {
  const base = process.env.WALLET_API_BASE_URL || 'https://api.wallet.example';
  const key = process.env.WALLET_API_KEY || '';

  if (!key || key === 'dev-wallet-key') {
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

  if (!res.ok) throw new Error(`Wallet API error: ${res.status}`);
  return (await res.json()) as IssuePassResult;
}

export async function updateWalletPoints(walletRef: string, points: number) {
  const base = process.env.WALLET_API_BASE_URL || 'https://api.wallet.example';
  const key = process.env.WALLET_API_KEY || '';
  if (!key || key === 'dev-wallet-key' || !walletRef) return { ok: true };
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
