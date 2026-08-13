import { Injectable, Logger } from '@nestjs/common';

type BrevoEmailInput = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
};

type BrevoSmsInput = {
  to: string;
  message: string;
};

@Injectable()
export class BrevoService {
  private readonly logger = new Logger(BrevoService.name);

  get isConfigured(): boolean {
    return Boolean(process.env.BREVO_API_KEY);
  }

  async sendEmail(input: BrevoEmailInput) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      this.logger.log(
        `[Brevo stub] email to=${input.to} subject=${input.subject}`
      );
      return { ok: true as const, stub: true as const };
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: process.env.BREVO_SENDER_EMAIL || 'hola@onda.lat',
          name: process.env.BREVO_SENDER_NAME || 'Onda',
        },
        to: [{ email: input.to, name: input.toName || input.to }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
      }),
    });
    if (!res.ok) {
      throw new Error(`Brevo email ${res.status}: ${await res.text()}`);
    }
    return { ok: true as const };
  }

  async sendSms(input: BrevoSmsInput) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      this.logger.log(`[Brevo stub] sms to=${input.to} msg=${input.message}`);
      return { ok: true as const, stub: true as const };
    }

    const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: process.env.BREVO_SMS_SENDER || 'Onda',
        recipient: input.to.replace(/\s/g, ''),
        content: input.message.slice(0, 160),
        type: 'transactional',
      }),
    });
    if (!res.ok) {
      throw new Error(`Brevo SMS ${res.status}: ${await res.text()}`);
    }
    return { ok: true as const };
  }

  leadAckEmail(name: string, email: string) {
    return this.sendEmail({
      to: email,
      toName: name,
      subject: 'Recibimos tu mensaje — Onda',
      html: `<p>Hola ${name || ''},</p><p>Gracias por escribirnos. El equipo de Onda te contactará pronto.</p>`,
      text: `Hola ${name || ''}, gracias por escribirnos. El equipo de Onda te contactará pronto.`,
    });
  }

  merchantWelcomeEmail(name: string, email: string, storeName: string) {
    const url = process.env.NEXT_PUBLIC_MERCHANT_URL || 'http://localhost:4202';
    return this.sendEmail({
      to: email,
      toName: name,
      subject: `Tu negocio ${storeName} ya está en Onda`,
      html: `<p>Hola ${name},</p><p>Tu sede <strong>${storeName}</strong> quedó creada. Entra al panel: <a href="${url}">${url}</a></p>`,
      text: `Hola ${name}, tu sede ${storeName} quedó creada. Panel: ${url}`,
    });
  }
}
