import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { App } from 'firebase-admin/app';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAuthService {
  private readonly logger = new Logger(FirebaseAuthService.name);
  private app: App | null = null;

  get isConfigured(): boolean {
    return Boolean(
      process.env.FIREBASE_PROJECT_ID &&
        (process.env.FIREBASE_PRIVATE_KEY ||
          process.env.GOOGLE_APPLICATION_CREDENTIALS) &&
        (process.env.FIREBASE_CLIENT_EMAIL ||
          process.env.GOOGLE_APPLICATION_CREDENTIALS)
    );
  }

  private ensureApp(): App {
    if (this.app) return this.app;
    if (!this.isConfigured) {
      throw new UnauthorizedException('Firebase Auth no está configurado');
    }
    const existing = getApps()[0];
    if (existing) {
      this.app = existing;
      return existing;
    }
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    this.app = initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
      ...(privateKey && process.env.FIREBASE_CLIENT_EMAIL
        ? {
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey,
            }),
          }
        : {}),
    });
    this.logger.log('Firebase Admin inicializado');
    return this.app;
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    try {
      return await getAuth(this.ensureApp()).verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedException('Token de Firebase inválido');
    }
  }

  bearerToken(header?: string): string {
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta token de sesión');
    }
    return header.slice('Bearer '.length);
  }

  async emailFromAuthHeader(header?: string): Promise<string> {
    const decoded = await this.verifyIdToken(this.bearerToken(header));
    const email = decoded.email?.trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException('La cuenta de Firebase no tiene email');
    }
    return email;
  }

  /**
   * Genera el enlace de reset (oobCode). El envío del correo lo hace MailService,
   * no Firebase — así el proveedor de email es intercambiable.
   */
  async generatePasswordResetLink(
    email: string,
    continueUrl: string
  ): Promise<string> {
    return getAuth(this.ensureApp()).generatePasswordResetLink(email, {
      url: continueUrl,
      handleCodeInApp: false,
    });
  }

  /**
   * Si ya hay un usuario con ese email (p.ej. registrado con contraseña y
   * email sin verificar), Firebase rechaza Google. Marcamos el email como
   * verificado y enlazamos el proveedor para que el cliente pueda reintentar.
   */
  async prepareGoogleMerchantSignIn(
    accessToken: string
  ): Promise<{ retry: boolean }> {
    if (!this.isConfigured || !accessToken.trim()) return { retry: false };
    const profile = await this.googleUserinfo(accessToken);
    const email = profile?.email?.trim().toLowerCase();
    if (!profile || !email || profile.email_verified === false) {
      return { retry: false };
    }
    try {
      const auth = getAuth(this.ensureApp());
      const user = await auth.getUserByEmail(email);
      const hasGoogle = user.providerData.some(
        (p) => p.providerId === 'google.com'
      );
      const updates: {
        emailVerified?: boolean;
        providerToLink?: {
          uid: string;
          providerId: string;
          email: string;
          displayName?: string;
          photoURL?: string;
        };
      } = {};
      if (!user.emailVerified) updates.emailVerified = true;
      if (!hasGoogle && profile.sub) {
        updates.providerToLink = {
          uid: profile.sub,
          providerId: 'google.com',
          email,
          displayName: profile.name,
          photoURL: profile.picture,
        };
      }
      if (Object.keys(updates).length > 0) {
        await auth.updateUser(user.uid, updates);
      }
      return { retry: true };
    } catch (err) {
      const code =
        typeof err === 'object' && err && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code.includes('user-not-found')) return { retry: false };
      this.logger.warn(`prepareGoogleMerchantSignIn: ${code || err}`);
      return { retry: false };
    }
  }

  private async googleUserinfo(accessToken: string): Promise<{
    email?: string;
    email_verified?: boolean;
    sub?: string;
    name?: string;
    picture?: string;
  } | null> {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as {
        email?: string;
        email_verified?: boolean;
        sub?: string;
        name?: string;
        picture?: string;
      };
    } catch {
      return null;
    }
  }
}
