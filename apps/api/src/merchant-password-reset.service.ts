import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { FirebaseAuthService } from './firebase-auth.service';
import { MailService } from './mail.service';
import {
  extractOobCodeFromFirebaseLink,
  passwordResetEmailHtml,
  passwordResetEmailText,
} from './mail-templates/password-reset';

function merchantBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MERCHANT_URL || 'http://localhost:4202'
  ).replace(/\/$/, '');
}

/** Vista propia (marca Onda) — no la página hosted de Firebase. */
function changePasswordPageUrl(): string {
  return `${merchantBaseUrl()}/login/cambiar-contrasena`;
}

function changePasswordUrl(oobCode: string): string {
  const q = new URLSearchParams({ oobCode });
  return `${changePasswordPageUrl()}?${q.toString()}`;
}

/**
 * Orquesta el reset de contraseña del merchant.
 * - Auth (oobCode): Firebase Admin.
 * - Entrega: MailService (Brevo hoy) con HTML de marca Onda.
 * - El usuario completa el cambio en nuestra vista, no en Firebase.
 */
@Injectable()
export class MerchantPasswordResetService {
  private readonly logger = new Logger(MerchantPasswordResetService.name);

  constructor(
    @Inject(FirebaseAuthService) private firebase: FirebaseAuthService,
    @Inject(MailService) private mail: MailService
  ) {}

  async request(emailRaw: string): Promise<{ ok: true }> {
    const email = emailRaw.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Email inválido');
    }

    let appResetUrl: string | null = null;
    try {
      if (!this.firebase.isConfigured) {
        this.logger.warn(
          'Password reset: Firebase Auth no configurado; no se genera enlace'
        );
        return { ok: true };
      }

      const firebaseLink = await this.firebase.generatePasswordResetLink(
        email,
        changePasswordPageUrl()
      );
      const oobCode = extractOobCodeFromFirebaseLink(firebaseLink);
      if (!oobCode) {
        this.logger.warn(
          'Password reset: Firebase no devolvió oobCode en el enlace'
        );
        return { ok: true };
      }
      appResetUrl = changePasswordUrl(oobCode);
    } catch (err) {
      this.logger.log(
        `Password reset sin enlace para ${email}: ${
          err instanceof Error ? err.message : err
        }`
      );
      return { ok: true };
    }

    if (!appResetUrl) return { ok: true };

    try {
      await this.mail.send({
        to: { email },
        subject: 'Cambia tu contraseña — Onda',
        html: passwordResetEmailHtml({ resetUrl: appResetUrl }),
        text: passwordResetEmailText({ resetUrl: appResetUrl }),
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No pudimos enviar el correo. Intenta de nuevo.';
      this.logger.error(
        `Password reset mail falló para ${email}: ${message}` +
          (process.env.NODE_ENV !== 'production'
            ? ` | link de prueba: ${appResetUrl}`
            : '')
      );
      throw new BadGatewayException(message);
    }

    return { ok: true };
  }
}
