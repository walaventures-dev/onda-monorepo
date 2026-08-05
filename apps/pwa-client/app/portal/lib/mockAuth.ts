import { toE164Colombia } from '@onda/shared-utils';

export interface PortalSession {
  phone: string;
  name: string;
  isNew: boolean;
}

interface ExistingAccount {
  phone: string;
  otp: string;
  name: string;
}

interface NewAccountRule {
  phone: string;
  otp: string;
}

// Cuenta ya existente en Onda: nombre conocido, no se vuelve a pedir.
const EXISTING_ACCOUNTS: ExistingAccount[] = [
  {
    phone: toE164Colombia('3202331295'),
    otp: '9988',
    name: 'Dante Fabrizzio Cabrera Fabrizzio',
  },
];

// Número demo habilitado para simular "crearme por primera vez".
const NEW_ACCOUNT_RULES: NewAccountRule[] = [{ phone: toE164Colombia('3202331296'), otp: '1234' }];

const PORTAL_SESSION_KEY = 'onda_portal_session';

export function findExistingAccount(e164Phone: string): ExistingAccount | null {
  return EXISTING_ACCOUNTS.find((a) => a.phone === e164Phone) || null;
}

export function isNewAccountPhone(e164Phone: string): boolean {
  return NEW_ACCOUNT_RULES.some((r) => r.phone === e164Phone);
}

export function verifyExistingOtp(e164Phone: string, otp: string): PortalSession | null {
  const account = findExistingAccount(e164Phone);
  if (!account || account.otp !== otp) return null;
  return { phone: account.phone, name: account.name, isNew: false };
}

export function verifyNewAccountOtp(
  e164Phone: string,
  otp: string,
  name: string
): PortalSession | null {
  const rule = NEW_ACCOUNT_RULES.find((r) => r.phone === e164Phone);
  if (!rule || rule.otp !== otp) return null;
  return { phone: e164Phone, name, isNew: true };
}

export function getPortalSession(): PortalSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(PORTAL_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalSession;
  } catch {
    return null;
  }
}

export function setPortalSession(session: PortalSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(session));
}

export function clearPortalSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PORTAL_SESSION_KEY);
}
