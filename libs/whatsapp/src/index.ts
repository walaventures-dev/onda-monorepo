// ─── Meta Cloud API — OTP de autenticación ───────────────────────────────────

export type WhatsappAuthOtpJob = {
  /** Número de destino en formato E.164 (con o sin +). */
  to: string;
  /** Código OTP de 6 dígitos. */
  code: string;
};

/**
 * Envía el OTP de login usando la Cloud API de Meta (WhatsApp Business).
 *
 * Requiere las variables de entorno:
 *   WHATSAPP_TOKEN          — token permanente de System User
 *   WHATSAPP_PHONE_NUMBER_ID — ID numérico del número en WhatsApp Manager
 *
 * Opcionales (con valores por defecto razonables):
 *   WHATSAPP_OTP_TEMPLATE  — default "otp_template"
 *   WHATSAPP_OTP_LANGUAGE  — default "es"
 *   WHATSAPP_API_VERSION   — default "v22.0"
 *
 * Si faltan las credenciales, entra en modo stub (log sin exponer el código ni el token).
 */
export async function sendWhatsappAuthOtp(job: WhatsappAuthOtpJob) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log(`[WhatsApp OTP stub] to=${job.to} — credenciales no configuradas`);
    return { ok: true, stub: true };
  }

  const templateName = process.env.WHATSAPP_OTP_TEMPLATE || 'otp_template';
  const languageCode = process.env.WHATSAPP_OTP_LANGUAGE || 'es';
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v22.0';
  const to = job.to.replace(/^\+/, '');

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  // El código debe aparecer dos veces: en el body y en el botón copy-code.
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: job.code }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: job.code }],
        },
      ],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '(sin cuerpo)');
    let detail = errorBody;
    try {
      const parsed = JSON.parse(errorBody) as { error?: { message?: string; error_data?: { details?: string } } };
      detail = parsed.error?.error_data?.details ?? parsed.error?.message ?? errorBody;
    } catch {
      // texto plano; usar tal cual
    }
    throw new Error(`WhatsApp Cloud API error ${res.status}: ${detail}`);
  }

  return { ok: true };
}

// ─── Kapso — mensajes de negocio (bienvenida, invitaciones, código de caja) ──

export type KapsoMessageJob = {
  to: string;
  template: string;
  variables?: Record<string, string>;
  storeId?: string;
};

/** Kapso WhatsApp client — Onda platform number (not per-merchant) */
export async function sendKapsoTemplate(job: KapsoMessageJob) {
  const apiKey = process.env.KAPSO_API_KEY;
  const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;

  if (!apiKey) {
    console.log(
      `[Kapso stub] template=${job.template} to=${job.to}`,
      job.variables
    );
    return { ok: true, stub: true };
  }

  const res = await fetch('https://api.kapso.ai/meta/whatsapp/v19.0/messages', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: job.to.replace('+', ''),
      type: 'template',
      template: {
        name: job.template,
        language: { code: 'es' },
        components: job.variables
          ? [
              {
                type: 'body',
                parameters: Object.values(job.variables).map((text) => ({
                  type: 'text',
                  text,
                })),
              },
            ]
          : [],
      },
      ...(phoneNumberId ? { phone_number_id: phoneNumberId } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Kapso error ${res.status}: ${await res.text()}`);
  }
  return { ok: true };
}

export const ONDA_WHATSAPP_TEMPLATES = [
  'onda_bienvenida',
  'onda_puntos',
  'onda_confirmar_codigo',
  'onda_resena_pro',
  'onda_invitacion_evento',
] as const;
