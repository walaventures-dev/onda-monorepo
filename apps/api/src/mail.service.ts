import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  MAIL_PROVIDER,
  type MailAddress,
  type MailMessage,
  type MailProvider,
} from './mail.types';

/**
 * Fachada de correo de la app.
 * El dominio solo habla con este servicio: no conoce Brevo, SES ni el
 * remitente concreto (salvo override explícito en el mensaje).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  /** Remitente por defecto de la plataforma (env), no del proveedor. */
  defaultFrom(): MailAddress {
    return {
      email:
        process.env.MAIL_FROM_EMAIL ||
        process.env.BREVO_SENDER_EMAIL ||
        'hola@onda.lat',
      name:
        process.env.MAIL_FROM_NAME ||
        process.env.BREVO_SENDER_NAME ||
        'Onda',
    };
  }

  async send(message: MailMessage) {
    const from = message.from ?? this.defaultFrom();
    const toList = Array.isArray(message.to) ? message.to : [message.to];
    this.logger.log(
      `mail send provider=${this.provider.name} to=${toList
        .map((t) => t.email)
        .join(',')} subject=${message.subject}`
    );
    return this.provider.send({ ...message, from });
  }
}
