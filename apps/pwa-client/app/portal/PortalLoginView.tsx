'use client';

import { useState, type FormEvent } from 'react';
import { PhoneInput, PassPreview } from '@onda/shared-ui';
import { isCompletePhoneMask, toE164Colombia } from '@onda/shared-utils';
import {
  findExistingAccount,
  verifyExistingOtp,
  verifyNewAccountOtp,
  setPortalSession,
} from './lib/mockAuth';

type Step = 'phone' | 'signup-name' | 'otp';
type FlowType = 'existing' | 'new';

export function PortalLoginView({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<Step>('phone');
  const [flowType, setFlowType] = useState<FlowType>('new');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function resetToPhone() {
    setStep('phone');
    setName('');
    setOtp('');
    setError('');
  }

  function submitPhone(e: FormEvent) {
    e.preventDefault();
    if (!isCompletePhoneMask(phone)) return;
    setError('');
    const e164 = toE164Colombia(phone);
    if (findExistingAccount(e164)) {
      setFlowType('existing');
      setStep('otp');
    } else {
      setFlowType('new');
      setStep('signup-name');
    }
  }

  function submitName(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setError('');
    setStep('otp');
  }

  function submitOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const e164 = toE164Colombia(phone);
    const session =
      flowType === 'existing'
        ? verifyExistingOtp(e164, otp)
        : verifyNewAccountOtp(e164, otp, name.trim());
    if (!session) {
      setError('Código incorrecto');
      setBusy(false);
      return;
    }
    setPortalSession(session);
    setBusy(false);
    onSuccess();
  }

  return (
    <div className="onda-pwa-shell">
      <header className="onda-pwa-hero">
        <div className="onda-pwa-hero-copy">
          <p className="onda-pwa-eyebrow">
            <img src="/brand/onda-wordmark.png" alt="Onda" className="h-4 w-auto" />
          </p>
          <h1 className="onda-pwa-title">
            {step === 'signup-name' ? 'Crea tu cuenta Onda' : 'Ingresa a tu cuenta Onda'}
          </h1>
          <p className="onda-pwa-sub">
            {step === 'phone'
              ? 'Con tu número de WhatsApp'
              : step === 'signup-name'
                ? 'Así se verá tu tarjeta'
                : `Enviamos un código a ${phone}`}
          </p>
        </div>
      </header>

      <div className="onda-pwa-body onda-pwa-fade">
        {step === 'phone' && (
          <form className="flex flex-1 flex-col" onSubmit={submitPhone}>
            <div className="onda-pwa-bottom">
              <div className="onda-pwa-fields">
                <PhoneInput
                  required
                  autoFocus
                  enterKeyHint="go"
                  placeholder="WhatsApp"
                  className="onda-pwa-field"
                  value={phone}
                  onChange={setPhone}
                />
              </div>
              <button
                type="submit"
                className="onda-pwa-cta"
                disabled={!isCompletePhoneMask(phone)}
              >
                Continuar
              </button>
              <p className="onda-pwa-legal">
                Modo demo — 3202331296 (cuenta nueva) o 3202331295 (cuenta existente).
              </p>
            </div>
          </form>
        )}

        {step === 'signup-name' && (
          <form className="flex flex-1 flex-col" onSubmit={submitName}>
            <div className="onda-pwa-pass-stage">
              <p className="onda-pwa-pass-badge">Bono de bienvenida · Restaurante AA</p>
              <PassPreview
                compact
                title="Tarjeta Onda"
                subtitle="Tu identidad en todos los restaurantes"
                description="Ganas 1 onda por crear tu cuenta"
                points={1}
                memberName={name}
              />
            </div>

            <div className="onda-pwa-bottom">
              <div className="onda-pwa-fields">
                <input
                  required
                  autoFocus
                  autoComplete="given-name"
                  enterKeyHint="next"
                  placeholder="Tu nombre en el pase"
                  className="onda-pwa-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <button type="submit" className="onda-pwa-cta" disabled={name.trim().length < 2}>
                Continuar
              </button>
              <button type="button" className="onda-pwa-secondary" onClick={resetToPhone}>
                Cambiar número
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form className="flex flex-1 flex-col" onSubmit={submitOtp}>
            <div className="onda-pwa-bottom">
              <div className="onda-pwa-fields">
                <input
                  required
                  autoFocus
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Código de 4 dígitos"
                  className="onda-pwa-field"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
                {error ? (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[var(--onda-danger)]">
                    {error}
                  </p>
                ) : null}
              </div>
              <button type="submit" className="onda-pwa-cta" disabled={otp.length !== 4 || busy}>
                {busy ? 'Verificando…' : 'Verificar'}
              </button>
              <button type="button" className="onda-pwa-secondary" onClick={resetToPhone}>
                Cambiar número
              </button>
              <p className="onda-pwa-legal">
                Modo demo — código {flowType === 'existing' ? '9988' : '1234'}.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
