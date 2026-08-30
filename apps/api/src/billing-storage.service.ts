import { Injectable, Logger } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  funnelHeroImageUrl,
  wordmarkImageUrl,
} from './mail-templates/brand';

const DEFAULT_BUCKET = 'join-onda.firebasestorage.app';
const LOCAL_DIR = join(process.cwd(), 'uploads', 'billing');

export type MailBrandUrls = {
  wordmark: string;
  funnelHero: string;
};

@Injectable()
export class BillingStorageService {
  private readonly logger = new Logger(BillingStorageService.name);
  private storage: Storage | null = null;
  private readonly assetCache = new Map<string, string>();

  get bucketName(): string {
    return (
      process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
      process.env.GCS_BUCKET?.trim() ||
      DEFAULT_BUCKET
    );
  }

  get isConfigured(): boolean {
    return Boolean(
      process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.GCS_BUCKET?.trim()
    );
  }

  objectPath(storeId: string, issuedAt: Date, invoiceNumber: string) {
    const y = issuedAt.getUTCFullYear();
    const m = String(issuedAt.getUTCMonth() + 1).padStart(2, '0');
    return `billing/${storeId}/${y}/${y}-${m}/${invoiceNumber}.pdf`;
  }

  async savePdf(objectPath: string, buffer: Buffer): Promise<string> {
    if (this.isConfigured) {
      try {
        const storage = this.ensureStorage();
        await storage.bucket(this.bucketName).file(objectPath).save(buffer, {
          contentType: 'application/pdf',
          resumable: false,
          metadata: { cacheControl: 'private, max-age=0' },
        });
        this.logger.log(`PDF subido gs://${this.bucketName}/${objectPath}`);
        return objectPath;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Storage falló, se guarda en disco: ${msg}`);
      }
    }
    const full = join(LOCAL_DIR, objectPath);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, buffer);
    return objectPath;
  }

  async readPdf(objectPath: string): Promise<Buffer | null> {
    if (this.isConfigured) {
      try {
        const [buf] = await this.ensureStorage()
          .bucket(this.bucketName)
          .file(objectPath)
          .download();
        return buf;
      } catch {
        /* fallback local */
      }
    }
    const full = join(LOCAL_DIR, objectPath);
    if (!existsSync(full)) return null;
    return readFileSync(full);
  }

  async signedReadUrl(objectPath: string, minutes = 15): Promise<string | null> {
    if (!this.isConfigured) return null;
    try {
      const [url] = await this.ensureStorage()
        .bucket(this.bucketName)
        .file(objectPath)
        .getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + minutes * 60_000,
        });
      return url;
    } catch (e) {
      this.logger.warn(
        `Signed URL falló: ${e instanceof Error ? e.message : e}`
      );
      return null;
    }
  }

  async savePublicImage(
    objectPath: string,
    buffer: Buffer,
    contentType: string
  ): Promise<string> {
    const storage = this.ensureStorage();
    const file = storage.bucket(this.bucketName).file(objectPath);
    const [exists] = await file.exists();
    let token: string | undefined;

    if (!exists) {
      token = randomUUID();
      await file.save(buffer, {
        contentType,
        resumable: false,
        metadata: {
          cacheControl: 'public, max-age=31536000',
          metadata: { firebaseStorageDownloadTokens: token },
        },
      });
      this.logger.log(`Imagen pública subida gs://${this.bucketName}/${objectPath}`);
    } else {
      const [meta] = await file.getMetadata();
      const rawToken = meta.metadata?.firebaseStorageDownloadTokens;
      token =
        typeof rawToken === 'string'
          ? rawToken.split(',')[0]?.trim()
          : undefined;
      if (!token) {
        token = randomUUID();
        await file.setMetadata({
          metadata: {
            ...(meta.metadata || {}),
            firebaseStorageDownloadTokens: token,
          },
        });
      }
    }

    return this.firebaseDownloadUrl(objectPath, token);
  }

  private firebaseDownloadUrl(objectPath: string, token: string): string {
    const encoded = encodeURIComponent(objectPath);
    return `https://firebasestorage.googleapis.com/v0/b/${this.bucketName}/o/${encoded}?alt=media&token=${token}`;
  }

  /** URLs HTTPS estables para logo y foto en correos (Firebase Storage público). */
  async ensureMailBrandUrls(): Promise<MailBrandUrls> {
    const [wordmark, funnelHero] = await Promise.all([
      this.ensureWordmarkUrl(),
      this.ensureFunnelHeroUrl(),
    ]);
    return { wordmark, funnelHero };
  }

  async ensureWordmarkUrl(): Promise<string> {
    return this.ensurePublicBrandAsset({
      cacheKey: 'wordmark',
      objectPath: 'brand/onda-wordmark.png',
      localPaths: [
        join(process.cwd(), 'apps/landing/public/brand/onda-wordmark.png'),
        join(process.cwd(), 'libs/shared/ui/assets/brand/onda-wordmark.png'),
        join(process.cwd(), 'apps/merchant-dashboard/public/brand/onda-wordmark.png'),
      ],
      fallback: wordmarkImageUrl,
      contentType: 'image/png',
    });
  }

  async ensureFunnelHeroUrl(): Promise<string> {
    return this.ensurePublicBrandAsset({
      cacheKey: 'funnelHero',
      objectPath: 'brand/funnel_image.png',
      localPaths: [
        join(process.cwd(), 'apps/landing/public/brand/funnel_image.png'),
      ],
      fallback: funnelHeroImageUrl,
      contentType: 'image/png',
    });
  }

  private async ensurePublicBrandAsset(options: {
    cacheKey: string;
    objectPath: string;
    localPaths: string[];
    fallback: () => string;
    contentType: string;
  }): Promise<string> {
    const cached = this.assetCache.get(options.cacheKey);
    if (cached) return cached;

    const fallback = options.fallback();
    const localPath = options.localPaths.find((p) => existsSync(p));
    if (!localPath) {
      this.assetCache.set(options.cacheKey, fallback);
      return fallback;
    }

    try {
      const url = await this.savePublicImage(
        options.objectPath,
        readFileSync(localPath),
        options.contentType
      );
      this.assetCache.set(options.cacheKey, url);
      return url;
    } catch (e) {
      this.logger.warn(
        `No se subió ${options.objectPath}: ${
          e instanceof Error ? e.message : e
        }`
      );
      this.assetCache.set(options.cacheKey, fallback);
      return fallback;
    }
  }

  private ensureStorage(): Storage {
    if (!this.storage) {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      if (clientEmail && privateKey) {
        this.storage = new Storage({
          projectId:
            process.env.FIREBASE_PROJECT_ID?.trim() ||
            process.env.GCP_PROJECT?.trim(),
          credentials: {
            client_email: clientEmail,
            private_key: privateKey,
          },
        });
      } else {
        this.storage = new Storage();
      }
    }
    return this.storage;
  }
}
