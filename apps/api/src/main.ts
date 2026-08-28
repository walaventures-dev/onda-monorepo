import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import type { IncomingMessage } from 'http';
import { join } from 'path';
import { loadRootEnv } from './load-env';
import { AppModule } from './app.module';

loadRootEnv();

async function bootstrap() {
  const otpMockOff =
    process.env.OTP_MOCK?.trim().toLowerCase() === '0' ||
    process.env.OTP_MOCK?.trim().toLowerCase() === 'false';
  if (process.env.NODE_ENV === 'production' && otpMockOff) {
    if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error(
        'WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID son requeridos cuando OTP_MOCK está desactivado en producción'
      );
    }
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
  });
  app.use(
    json({
      limit: '3mb',
      verify: (req: IncomingMessage & { rawBody?: Buffer }, _res, buf: Buffer) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(urlencoded({ extended: true, limit: '3mb' }));
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  const port = Number(process.env.PORT || process.env.API_PORT || 3333);
  await app.listen(port);
  console.log(`Onda API listening on http://localhost:${port}/api`);
}

bootstrap();
