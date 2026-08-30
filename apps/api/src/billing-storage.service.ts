import { Injectable, Logger } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { funnelHeroImageUrl } from './mail-templates/brand';

const DEFAULT_BUCKET = 'join-onda.firebasestorage.app';
const LOCAL_DIR = join(process.cwd(), 'uploads', 'billing');

@Injectable()
export class BillingStorageService {
  private readonly logger = new Logger(BillingStorageService.name);
  private storage: Storage | null = null;

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
    if (!exists) {
      await file.save(buffer, {
        contentType,
        resumable: false,
        metadata: { cacheControl: 'public, max-age=31536000' },
      });
      this.logger.log(`Imagen pública subida gs://${this.bucketName}/${objectPath}`);
    }
    try {
      await file.makePublic();
    } catch (e) {
      this.logger.warn(
        `makePublic ${objectPath}: ${e instanceof Error ? e.message : e}`
      );
    }
    return `https://storage.googleapis.com/${this.bucketName}/${objectPath}`;
  }

  private funnelHeroCached: string | null = null;

  async ensureFunnelHeroUrl(): Promise<string> {
    if (this.funnelHeroCached) return this.funnelHeroCached;
    const fallback = funnelHeroImageUrl();
    const localPath = join(
      process.cwd(),
      'apps/landing/public/brand/funnel_image.png'
    );
    if (!existsSync(localPath)) {
      this.funnelHeroCached = fallback;
      return fallback;
    }
    try {
      const url = await this.savePublicImage(
        'brand/funnel_image.png',
        readFileSync(localPath),
        'image/png'
      );
      this.funnelHeroCached = url;
      return url;
    } catch (e) {
      this.logger.warn(
        `No se subió funnel_image: ${e instanceof Error ? e.message : e}`
      );
      this.funnelHeroCached = fallback;
      return fallback;
    }
  }

  private ensureStorage(): Storage {
    if (!this.storage) this.storage = new Storage();
    return this.storage;
  }
}
