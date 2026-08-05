'use client';

import { useState, type FormEvent } from 'react';
import { PhoneInput, api } from '@onda/shared-ui';
import { toE164Colombia, isCompletePhoneMask } from '@onda/shared-utils';

type VerifyResult = {
  token: string;
  user: { id: string; name: string; phone: string };
  isNewUser: boolean;
};

export function OtpStep({ onVerified }: { onVerified: (result: VerifyResult) => void }) {
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestOtp(e?: FormEvent) {
    e?.preventDefault();
    if (!isCompletePhoneMask(phone) || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ expiresAt: string; devCode?: string }>('/customer-auth/otp', {
        method: 'POST',
        body: JSON.stringify({ phone: toE164Colombia(phone) }),
      });
      setDevCode(res.devCode || null);
      setStage('code');
    } catch (err: any) {
      setError(err.message || 'No se pudo enviar el código');
    } finally {
      setBusy(false);
    }
  }

  async function verify(e?: FormEvent) {
    e?.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<VerifyResult>('/customer-auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: toE164Colombia(phone), code }),
      });
      onVerified(res);
    } catch (err: any) {
      setError(err.message || 'Código incorrecto');
    } finally {
      setBusy(false);
    }
  }

  if (stage === 'phone') {
    return (
      <form className="flex flex-1 flex-col justify-center gap-3" onSubmit={requestOtp}>
        <p className="onda-pwa-sub">Ingresa tu celular para continuar por WhatsApp</p>
        <PhoneInput
          required
          autoFocus
          enterKeyHint="go"
          placeholder="WhatsApp"
          className="onda-pwa-field"
          value={phone}
          onChange={setPhone}
        />
        {error ? <p className="text-sm text-[var(--onda-danger)]">{error}</p> : null}
        <button
          type="submit"
          className="onda-pwa-cta"
          disabled={!isCompletePhoneMask(phone) || busy}
        >
          {busy ? 'Enviando…' : 'Enviar código'}
        </button>
      </form>
    );
  }

  return (
    <form className="flex flex-1 flex-col justify-center gap-3" onSubmit={verify}>
      <p className="onda-pwa-sub">Ingresa el código de 6 dígitos que te enviamos por WhatsApp</p>
      {devCode ? (
        <p className="rounded-xl bg-[var(--onda-violet-soft)] px-3 py-2 text-sm text-[var(--onda-violet)]">
          Modo desarrollo — tu código es <strong>{devCode}</strong>
        </p>
      ) : null}
      <input
        required
        autoFocus
        type="tel"
        inputMode="numeric"
        maxLength={6}
        placeholder="000000"
        className="onda-pwa-field text-center tracking-[0.4em]"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      {error ? <p className="text-sm text-[var(--onda-danger)]">{error}</p> : null}
      <button type="submit" className="onda-pwa-cta" disabled={code.length !== 6 || busy}>
        {busy ? 'Verificando…' : 'Verificar código'}
      </button>
      <button
        type="button"
        className="onda-pwa-secondary"
        onClick={() => requestOtp()}
        disabled={busy}
      >
        Reenviar código
      </button>
    </form>
  );
}
