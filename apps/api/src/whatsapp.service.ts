import { createHmac, timingSafeEqual } from 'crypto';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { sendKapsoTemplate, sendWhatsappAuthOtp } from '@onda/whatsapp';
import { JobsService } from './jobs.service';
import type { WhatsappJobPayload } from './jobs.types';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @Inject(forwardRef(() => JobsService)) private readonly jobs: JobsService
  ) {}

  async enqueue(job: WhatsappJobPayload) {
    return this.jobs.enqueue('whatsapp-send', job);
  }

  async send(job: WhatsappJobPayload) {
    if (job.authOtp) {
      const code = job.variables?.['code'];
      if (!code) throw new Error('authOtp job requiere variables.code');
      this.logger.log(`WhatsApp OTP (Cloud API) -> ${job.to}`);
      return sendWhatsappAuthOtp({ to: job.to, code });
    }
    this.logger.log(`WhatsApp ${job.template} (Kapso) -> ${job.to}`);
    return sendKapsoTemplate(job);
  }

  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    const secret = process.env.KAPSO_WEBHOOK_SECRET;
    if (!secret) return true;
    if (!signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const given = signature.replace(/^sha256=/i, '').trim();
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(given, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
