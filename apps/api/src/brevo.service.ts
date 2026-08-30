import { Injectable, Logger } from '@nestjs/common';
import type { MailAddress, MailMessage, MailProvider } from './mail.types';

type BrevoSmsInput = {
  to: string;
  message: string;
};

/** Adaptador Brevo → `MailProvider`. El resto de la app no importa este archivo. */
@Injectable()
export class BrevoService implements MailProvider {
  readonly name = 'brevo';
  private readonly logger = new Logger(BrevoService.name);

  get isConfigured(): boolean {
    return Boolean(process.env.BREVO_API_KEY);
  }

  async send(message: MailMessage & { from: MailAddress }) {
    const apiKey = process.env.BREVO_API_KEY;
    const toList = Array.isArray(message.to) ? message.to : [message.to];

    if (!apiKey) {
      this.logger.log(
        `[Brevo stub] from=${message.from.email} to=${toList
          .map((t) => t.email)
          .join(',')} subject=${message.subject}`
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
          email: message.from.email,
          name: message.from.name || message.from.email,
        },
        to: toList.map((t) => ({
          email: t.email,
          name: t.name || t.email,
        })),
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
        ...(message.attachments?.length
          ? {
              attachment: message.attachments.map((a) => ({
                name: a.filename,
                content: a.content.toString('base64'),
              })),
            }
          : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      let detail = body;
      try {
        const parsed = JSON.parse(body) as { message?: string };
        if (parsed.message) detail = parsed.message;
      } catch {
        /* raw */
      }
      if (/unrecognised IP|authorized_ips|authorised_ips/i.test(detail)) {
        throw new Error(
          'Brevo bloqueó el envío: autoriza la IP de este servidor en Brevo → Security → Authorised IPs.'
        );
      }
      throw new Error(`No se pudo enviar el correo (${res.status}): ${detail}`);
    }
    return { ok: true as const };
  }

  /** @deprecated Preferir MailService.send — se mantiene por jobs legacy. */
  async sendEmail(input: {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    return this.send({
      to: { email: input.to, name: input.toName },
      subject: input.subject,
      html: input.html,
      text: input.text,
      from: {
        email:
          process.env.MAIL_FROM_EMAIL ||
          process.env.BREVO_SENDER_EMAIL ||
          'hola@onda.lat',
        name:
          process.env.MAIL_FROM_NAME ||
          process.env.BREVO_SENDER_NAME ||
          'Onda',
      },
    });
  }

  async sendSms(input: BrevoSmsInput) {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    if (!apiKey) {
      this.logger.log(`[Brevo stub] sms to=${input.to} msg=${input.message}`);
      return { ok: true as const, stub: true as const };
    }

    try {
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
        this.logger.warn(`Brevo SMS ${res.status}: ${await res.text()}`);
        return { ok: false as const };
      }
      return { ok: true as const };
    } catch (err) {
      this.logger.warn(
        `Brevo SMS falló (${input.to}): ${err instanceof Error ? err.message : err}`
      );
      return { ok: false as const };
    }
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
