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
  'onda_otp_login',
  'onda_bienvenida',
  'onda_puntos',
  'onda_confirmar_codigo',
  'onda_resena_pro',
  'onda_invitacion_evento',
] as const;
