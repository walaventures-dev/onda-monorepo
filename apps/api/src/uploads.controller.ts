import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

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
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: imageFilter,
    })
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Archivo requerido (campo file)');
    }
    const url = `/uploads/${file.filename}`;
    return {
      url,
      absoluteUrl: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}${url}`,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
