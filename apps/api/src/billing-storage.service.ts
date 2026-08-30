import { Injectable, Logger } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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

  private ensureStorage(): Storage {
    if (!this.storage) this.storage = new Storage();
    return this.storage;
  }
}
