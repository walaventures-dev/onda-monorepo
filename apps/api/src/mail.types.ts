export type MailAddress = {
  email: string;
  name?: string;
};

export type MailMessage = {
  /** Destinatario(s). Quien llama no sabe qué proveedor los entrega. */
  to: MailAddress | MailAddress[];
  subject: string;
  html: string;
  text?: string;
  /**
   * Remitente opcional. Si se omite, `MailService` usa el remitente
   * configurado de la app (`MAIL_FROM_*`), independiente del proveedor.
   */
  from?: MailAddress;
};

/** Contrato de cualquier proveedor transaccional (Brevo, SES, …). */
export interface MailProvider {
  readonly name: string;
  send(
    message: MailMessage & { from: MailAddress }
  ): Promise<{ ok: true; stub?: boolean }>;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
