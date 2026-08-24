const DEVICE_KEY = 'onda_demo_device_v1';
const WELCOME_DONE_KEY = 'onda_demo_spa_welcome_done';

export function getDemoDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function hasWelcomePulseDone(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(WELCOME_DONE_KEY) === '1';
}

export function markWelcomePulseDone() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WELCOME_DONE_KEY, '1');
}

export type DemoSpaDesign = {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  logoUrl?: string | null;
  stripImageUrl?: string | null;
};

export type DemoSpaState = {
  passId: string;
  points: number;
  maxStamps: number;
  walletRef?: string | null;
  memberName?: string;
  redeemedThisCycle: boolean;
  design: DemoSpaDesign | null;
  promo: {
    id: string;
    title: string;
    description?: string | null;
    pointsRequired: number;
    value?: number | null;
  } | null;
  needsWelcomePulse?: boolean;
  appleUrl?: string | null;
  googleUrl?: string | null;
  stub?: boolean;
  phase?: string;
  isNew?: boolean;
  action?: 'accumulated' | 'redeemed' | 'already_redeemed';
  notification?: string;
  active?: boolean;
};
