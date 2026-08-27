'use client';

import { useEffect, useState, type FormEvent } from 'react';

export type WompiAcceptance = {
  acceptanceToken: string;
  acceptPersonalAuth: string;
  permalink: string;
  personalAuthPermalink: string;
};

export type CardFormValues = {
  number: string;
  expMonth: string;
  expYear: string;
  cvc: string;
  cardHolder: string;
};

/** Agrupa dígitos en bloques de 4 (máx. 19 dígitos → Amex/Visa). */
export function formatCardNumber(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function wompiApiBase() {
  return (
    process.env.NEXT_PUBLIC_WOMPI_API_URL ||
    'https://sandbox.wompi.co/v1'
  ).replace(/\/$/, '');
}

export async function fetchWompiAcceptance(
  publicKey: string
): Promise<WompiAcceptance> {
  const res = await fetch(`${wompiApiBase()}/merchants/${publicKey}`);
  if (!res.ok) {
    throw new Error('No se pudieron cargar los términos de Wompi');
  }
  const json = (await res.json()) as {
    data?: {
      presigned_acceptance?: {
        acceptance_token?: string;
        permalink?: string;
      };
      presigned_personal_data_auth?: {
        acceptance_token?: string;
        permalink?: string;
      };
    };
  };
  const acceptance = json.data?.presigned_acceptance;
  const personal = json.data?.presigned_personal_data_auth;
  if (!acceptance?.acceptance_token || !personal?.acceptance_token) {
    throw new Error('Wompi no devolvió tokens de aceptación');
  }
  return {
    acceptanceToken: acceptance.acceptance_token,
    acceptPersonalAuth: personal.acceptance_token,
    permalink: acceptance.permalink || 'https://wompi.co',
    personalAuthPermalink: personal.permalink || 'https://wompi.co',
  };
}

export async function tokenizeWompiCard(
  publicKey: string,
  card: CardFormValues
): Promise<string> {
  const number = card.number.replace(/\s+/g, '');
  const res = await fetch(`${wompiApiBase()}/tokens/cards`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${publicKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      number,
      cvc: card.cvc,
      exp_month: card.expMonth.padStart(2, '0'),
      exp_year: card.expYear.slice(-2),
      card_holder: card.cardHolder.trim(),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      text.includes('number')
        ? 'Revisa el número de la tarjeta'
        : 'No se pudo tokenizar la tarjeta'
    );
  }
  const json = (await res.json()) as { data?: { id?: string } };
  if (!json.data?.id) {
    throw new Error('Wompi no devolvió token de tarjeta');
  }
  return json.data.id;
}

export function PaymentCardForm({
  publicKey,
  stubMode,
  busy,
  onSubmit,
  submitLabel = 'Pagar y activar',
  onBack,
}: {
  publicKey: string | null;
  stubMode?: boolean;
  busy?: boolean;
  submitLabel?: string;
  onBack?: () => void;
  onSubmit: (payload: {
    cardToken?: string;
    acceptanceToken?: string;
    acceptPersonalAuth?: string;
  }) => void | Promise<void>;
}) {
  const [number, setNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [acceptance, setAcceptance] = useState<WompiAcceptance | null>(null);
  const [error, setError] = useState('');
  const [localBusy, setLocalBusy] = useState(false);

  useEffect(() => {
    if (!publicKey || stubMode) return;
    let cancelled = false;
    fetchWompiAcceptance(publicKey)
      .then((a) => {
        if (!cancelled) setAcceptance(a);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error cargando Wompi');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey, stubMode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (stubMode || !publicKey) {
      await onSubmit({});
      return;
    }
    if (!accepted || !acceptance) {
      setError('Debes aceptar los términos de Wompi');
      return;
    }
    if (!number || !expMonth || !expYear || !cvc || !cardHolder.trim()) {
      setError('Completa los datos de la tarjeta');
      return;
    }
    setLocalBusy(true);
    try {
      const cardToken = await tokenizeWompiCard(publicKey, {
        number,
        expMonth,
        expYear,
        cvc,
        cardHolder,
      });
      await onSubmit({
        cardToken,
        acceptanceToken: acceptance.acceptanceToken,
        acceptPersonalAuth: acceptance.acceptPersonalAuth,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al tokenizar');
    } finally {
      setLocalBusy(false);
    }
  }

  const isBusy = busy || localBusy;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {stubMode || !publicKey ? (
        <p className="rounded-xl bg-[var(--onda-bg)] px-3 py-2.5 text-sm text-[var(--onda-muted)]">
          Modo desarrollo: se activará el plan sin cobro real (Wompi no
          configurado).
        </p>
      ) : (
        <>
          <div className="onda-field">
            <span className="onda-field__label">Titular</span>
            <input
              className="onda-input"
              value={cardHolder}
              onChange={(e) => setCardHolder(e.target.value)}
              placeholder="Como aparece en la tarjeta"
              autoComplete="cc-name"
              required
            />
          </div>
          <div className="onda-field">
            <span className="onda-field__label">Número de tarjeta</span>
            <input
              className="onda-input tabular-nums tracking-wider"
              value={number}
              onChange={(e) => setNumber(formatCardNumber(e.target.value))}
              placeholder="4242 4242 4242 4242"
              inputMode="numeric"
              autoComplete="cc-number"
              maxLength={23}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="onda-field">
              <span className="onda-field__label">Mes</span>
              <input
                className="onda-input tabular-nums"
                value={expMonth}
                onChange={(e) =>
                  setExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))
                }
                placeholder="08"
                inputMode="numeric"
                autoComplete="cc-exp-month"
                required
              />
            </div>
            <div className="onda-field">
              <span className="onda-field__label">Año</span>
              <input
                className="onda-input tabular-nums"
                value={expYear}
                onChange={(e) =>
                  setExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                placeholder="28"
                inputMode="numeric"
                autoComplete="cc-exp-year"
                required
              />
            </div>
            <div className="onda-field">
              <span className="onda-field__label">CVC</span>
              <input
                className="onda-input tabular-nums"
                value={cvc}
                onChange={(e) =>
                  setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                placeholder="123"
                inputMode="numeric"
                autoComplete="cc-csc"
                required
              />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-[var(--onda-muted)]">
            <input
              type="checkbox"
              className="mt-1"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              Acepto la{' '}
              <a
                href={acceptance?.permalink || '#'}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--onda-primary-500)]"
              >
                política de privacidad
              </a>{' '}
              y el{' '}
              <a
                href={acceptance?.personalAuthPermalink || '#'}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--onda-primary-500)]"
              >
                tratamiento de datos
              </a>{' '}
              de Wompi.
            </span>
          </label>
        </>
      )}
      {error ? (
        <p className="text-sm text-[var(--onda-danger)]">{error}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isBusy}
          className="onda-btn-primary min-w-[10rem] rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{
            background:
              'linear-gradient(135deg, var(--onda-primary-500), var(--onda-violet))',
          }}
        >
          {isBusy ? 'Procesando…' : submitLabel}
        </button>
        {onBack ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={onBack}
            className="rounded-full px-4 py-2.5 text-sm font-medium text-[var(--onda-muted)] transition hover:bg-[var(--onda-bg)] hover:text-[var(--onda-ink)]"
          >
            Volver
          </button>
        ) : null}
      </div>
    </form>
  );
}
