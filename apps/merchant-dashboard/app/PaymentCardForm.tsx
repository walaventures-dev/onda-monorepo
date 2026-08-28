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

export type PaymentCardResult = CardFormValues & {
  cardToken: string;
  acceptanceToken: string;
  acceptPersonalAuth: string;
};

/** Agrupa dígitos en bloques de 4 (máx. 19 dígitos). */
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
  const acceptanceToken = json.data?.presigned_acceptance?.acceptance_token;
  const acceptPersonalAuth =
    json.data?.presigned_personal_data_auth?.acceptance_token;
  if (!acceptanceToken || !acceptPersonalAuth) {
    throw new Error('Términos de Wompi incompletos');
  }
  return {
    acceptanceToken,
    acceptPersonalAuth,
    permalink: json.data?.presigned_acceptance?.permalink || '',
    personalAuthPermalink:
      json.data?.presigned_personal_data_auth?.permalink || '',
  };
}

async function tokenizeCard(
  publicKey: string,
  card: CardFormValues
): Promise<string> {
  const res = await fetch(`${wompiApiBase()}/tokens/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: card.number.replace(/\D/g, ''),
      exp_month: card.expMonth.padStart(2, '0'),
      exp_year: card.expYear.length === 2 ? `20${card.expYear}` : card.expYear,
      cvc: card.cvc,
      card_holder: card.cardHolder.trim(),
      public_key: publicKey,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'No se pudo tokenizar la tarjeta');
  }
  const json = (await res.json()) as { data?: { id?: string } };
  if (!json.data?.id) {
    throw new Error('Token de tarjeta inválido');
  }
  return json.data.id;
}

export function PaymentCardForm({
  publicKey,
  busy,
  onSubmit,
  formId = 'onda-pay-form',
}: {
  publicKey: string;
  busy?: boolean;
  onSubmit: (result: PaymentCardResult) => void | Promise<void>;
  formId?: string;
}) {
  const [number, setNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [acceptance, setAcceptance] = useState<WompiAcceptance | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
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
  }, [publicKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!acceptance) {
      setError('Espera a cargar los términos de pago');
      return;
    }
    if (!acceptedTerms) {
      setError('Debes aceptar los términos de Wompi');
      return;
    }
    setSubmitting(true);
    try {
      const cardToken = await tokenizeCard(publicKey, {
        number,
        expMonth,
        expYear,
        cvc,
        cardHolder,
      });
      await onSubmit({
        number,
        expMonth,
        expYear,
        cvc,
        cardHolder,
        cardToken,
        acceptanceToken: acceptance.acceptanceToken,
        acceptPersonalAuth: acceptance.acceptPersonalAuth,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la tarjeta');
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = busy || submitting;

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="onda-field sm:col-span-2">
          <span className="onda-field__label">Número de tarjeta</span>
          <input
            className="onda-input tabular-nums tracking-wider"
            value={number}
            onChange={(e) => setNumber(formatCardNumber(e.target.value))}
            placeholder="4242 4242 4242 4242"
            inputMode="numeric"
            autoComplete="cc-number"
            required
            disabled={disabled}
          />
        </label>
        <label className="onda-field">
          <span className="onda-field__label">Mes</span>
          <input
            className="onda-input"
            value={expMonth}
            onChange={(e) =>
              setExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))
            }
            placeholder="12"
            inputMode="numeric"
            required
            disabled={disabled}
          />
        </label>
        <label className="onda-field">
          <span className="onda-field__label">Año</span>
          <input
            className="onda-input"
            value={expYear}
            onChange={(e) =>
              setExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            placeholder="29"
            inputMode="numeric"
            required
            disabled={disabled}
          />
        </label>
        <label className="onda-field">
          <span className="onda-field__label">CVC</span>
          <input
            className="onda-input"
            value={cvc}
            onChange={(e) =>
              setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            placeholder="123"
            inputMode="numeric"
            autoComplete="cc-csc"
            required
            disabled={disabled}
          />
        </label>
        <label className="onda-field">
          <span className="onda-field__label">Titular</span>
          <input
            className="onda-input"
            value={cardHolder}
            onChange={(e) => setCardHolder(e.target.value)}
            placeholder="Ana Pérez"
            autoComplete="cc-name"
            required
            disabled={disabled}
          />
        </label>
      </div>

      {acceptance ? (
        <label className="flex items-start gap-2 text-sm text-[var(--onda-muted)]">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            disabled={disabled}
            className="mt-1"
          />
          <span>
            Acepto los{' '}
            <a
              href={acceptance.permalink}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--onda-primary-500)] underline"
            >
              términos de Wompi
            </a>{' '}
            y la{' '}
            <a
              href={acceptance.personalAuthPermalink}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--onda-primary-500)] underline"
            >
              autorización de datos
            </a>
            .
          </span>
        </label>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--onda-danger)]">{error}</p>
      ) : null}
    </form>
  );
}
