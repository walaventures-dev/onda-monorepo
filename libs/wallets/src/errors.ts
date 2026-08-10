export type WalletErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'SERVER'
  | 'NETWORK'
  | 'UNKNOWN';

export class WalletApiError extends Error {
  readonly code: WalletErrorCode;
  readonly status: number;
  readonly resetDate?: string;
  readonly body?: unknown;

  constructor(opts: {
    message: string;
    code: WalletErrorCode;
    status: number;
    resetDate?: string;
    body?: unknown;
  }) {
    super(opts.message);
    this.name = 'WalletApiError';
    this.code = opts.code;
    this.status = opts.status;
    this.resetDate = opts.resetDate;
    this.body = opts.body;
  }

  static fromHttp(status: number, body: unknown): WalletApiError {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : typeof body === 'object' &&
            body !== null &&
            'message' in body &&
            typeof (body as { message: unknown }).message === 'string'
          ? (body as { message: string }).message
          : `Wallet API error: ${status}`;

    const resetDate =
      typeof body === 'object' &&
      body !== null &&
      'resetDate' in body &&
      typeof (body as { resetDate: unknown }).resetDate === 'string'
        ? (body as { resetDate: string }).resetDate
        : undefined;

    const code: WalletErrorCode =
      status === 400
        ? 'VALIDATION'
        : status === 401
          ? 'UNAUTHORIZED'
          : status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : status === 429
                ? 'RATE_LIMIT'
                : status >= 500
                  ? 'SERVER'
                  : 'UNKNOWN';

    return new WalletApiError({ message, code, status, resetDate, body });
  }
}

export function isWalletApiError(err: unknown): err is WalletApiError {
  return err instanceof WalletApiError;
}
