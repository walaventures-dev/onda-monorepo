export const ONDA_CLAIM_QR_PREFIX = 'onda:claim:';

export function claimQrPayload(pendingRequestId: string) {
  return `${ONDA_CLAIM_QR_PREFIX}${pendingRequestId}`;
}

export function parseCajaQr(raw: string):
  | { kind: 'claim'; pendingRequestId: string }
  | { kind: 'pass'; serialNumber: string } {
  const text = String(raw || '').trim();
  if (text.startsWith(ONDA_CLAIM_QR_PREFIX)) {
    const pendingRequestId = text.slice(ONDA_CLAIM_QR_PREFIX.length).trim();
    if (pendingRequestId) return { kind: 'claim', pendingRequestId };
  }
  return { kind: 'pass', serialNumber: text };
}
