'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { InputOTP, PhoneInput, api } from '@onda/shared-ui';
import { toE164Colombia, isCompletePhoneMask } from '@onda/shared-utils';

type VerifyResult = {
  token: string;
  user: { id: string; name: string; phone: string };
  isNewUser: boolean;
};

const RESEND_SECONDS = 30;

export function OtpStep({ onVerified }: { onVerified: (result: VerifyResult) => void }) {
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (stage !== 'code' || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, resendIn]);

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
      setCode('');
      setResendIn(RESEND_SECONDS);
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
      <div className="flex flex-1 flex-col">
        <div className="mb-1">
          <p className="onda-pwa-label pb-3">Primero, tú</p>
          <h1 className="onda-pwa-headline mt-1 pb-2">¿Cuál es tu WhatsApp?</h1>
          <p className="onda-pwa-sub mt-2">Te enviaremos un código para guardar tus ondas.</p>
        </div>
        <form className="mt-auto flex flex-col gap-3" onSubmit={requestOtp}>
          <p className="onda-pwa-label">Número de WhatsApp</p>
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
            {busy ? 'Enviando…' : 'Enviar código →'}
          </button>
          <p className="onda-pwa-legal">
            Al continuar aceptas los{' '}
            <a href="/terminos" target="_blank" rel="noreferrer">
              términos
            </a>{' '}
            y el{' '}
            <a href="/privacidad" target="_blank" rel="noreferrer">
              tratamiento de datos
            </a>
            .
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-1">
        <p className="onda-pwa-label pb-3">Ya casi</p>
        <h1 className="onda-pwa-headline mt-1 pb-2">Revisa tu WhatsApp</h1>
        <p className="onda-pwa-sub mt-2">
          Enviamos un código de 6 dígitos al {toE164Colombia(phone)}.
        </p>
      </div>
      <form className="mt-auto flex flex-col gap-3" onSubmit={verify}>
        <InputOTP
          autoFocus
          maxLength={6}
          value={code}
          onChange={(value: string) => setCode(value.replace(/\D/g, '').slice(0, 6))}
          className="w-full"
        >
          <InputOTP.Group className="onda-pwa-otp-group w-full flex justify-between gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <InputOTP.Slot key={i} index={i} className="onda-pwa-otp-slot flex-1 text-center" />
            ))}
          </InputOTP.Group>
        </InputOTP>
        {devCode ? (
          <p className="onda-pwa-devcode">
            <span>Modo dev</span>
            <strong>{devCode}</strong>
          </p>
        ) : null}
        {error ? <p className="text-sm text-[var(--onda-danger)]">{error}</p> : null}
        <button type="submit" className="onda-pwa-cta" disabled={code.length !== 6 || busy}>
          {busy ? 'Verificando…' : 'Verificar →'}
        </button>
        <button
          type="button"
          className="onda-pwa-resend"
          onClick={() => requestOtp()}
          disabled={busy || resendIn > 0}
        >
          {resendIn > 0
            ? `Reenviar código en 00:${String(resendIn).padStart(2, '0')}`
            : 'Reenviar código'}
        </button>
      </form>
    </div>
  );
}
