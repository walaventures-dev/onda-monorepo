import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { Storage } from '@google-cloud/storage';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

const imageFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void
) => {
  if (!file.mimetype.match(/^image\/(jpeg|png|webp|gif)$/)) {
    return cb(new BadRequestException('Solo se permiten imágenes JPG, PNG, WEBP o GIF'), false);
  }
  cb(null, true);
};

@Controller('uploads')
export class UploadsController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: imageFilter,
    })
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('Archivo requerido (campo file)');
    }
    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const bucketName = process.env.GCS_BUCKET?.trim();

    if (bucketName) {
      const objectPath = `uploads/${filename}`;
      const storage = new Storage();
      await storage.bucket(bucketName).file(objectPath).save(file.buffer, {
        contentType: file.mimetype,
        resumable: false,
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      });
      const absoluteUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;
      return {
        url: absoluteUrl,
        absoluteUrl,
        filename,
        size: file.size,
        mimetype: file.mimetype,
      };
    }

    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    writeFileSync(join(UPLOAD_DIR, filename), file.buffer);
    const url = `/uploads/${filename}`;
    return {
      url,
      absoluteUrl: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}${url}`,
      filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
