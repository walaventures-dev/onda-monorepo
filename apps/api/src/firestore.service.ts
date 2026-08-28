import { Injectable, Logger } from '@nestjs/common';
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

@Injectable()
export class FirestoreService {
  private readonly logger = new Logger(FirestoreService.name);
  private app: App | null = null;
  private db: Firestore | null = null;

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
      throw new Error('Firestore no está configurado');
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
    this.logger.log('Firestore Admin inicializado');
    return this.app;
  }

  getDb(): Firestore {
    if (!this.db) {
      this.db = getFirestore(this.ensureApp());
    }
    return this.db;
  }
}
