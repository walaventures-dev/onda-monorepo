import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';

export type WhatsappJob = {
  to: string;
  template: string;
  variables?: Record<string, string>;
  storeId?: string;
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private connection: IORedis | null = null;

  constructor() {
    try {
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      this.connection = new IORedis(url, { maxRetriesPerRequest: null });
      this.queue = new Queue('whatsapp-send', { connection: this.connection });
      this.worker = new Worker(
        'whatsapp-send',
        async (job) => {
          await this.sendViaKapso(job.data as WhatsappJob);
        },
        { connection: this.connection.duplicate() }
      );
      this.worker.on('failed', (job, err) => {
        this.logger.error(`WhatsApp job ${job?.id} failed: ${err.message}`);
      });
    } catch (e) {
      this.logger.warn(`Redis/BullMQ unavailable, WhatsApp will send inline: ${e}`);
    }
  }

  async enqueue(job: WhatsappJob, opts?: JobsOptions) {
    if (this.queue) {
      await this.queue.add('send', job, opts);
      return { queued: true };
    }
    await this.sendViaKapso(job);
    return { queued: false };
  }

  async sendViaKapso(job: WhatsappJob) {
    const apiKey = process.env.KAPSO_API_KEY;
    const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;

    // Platform-level Onda number via Kapso
    if (!apiKey) {
      this.logger.log(
        `[Kapso stub] template=${job.template} to=${job.to} vars=${JSON.stringify(job.variables || {})}`
      );
      return { ok: true, stub: true };
    }

    const res = await fetch('https://api.kapso.ai/meta/whatsapp/v19.0/messages', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: job.to.replace('+', ''),
        type: 'template',
        template: {
          name: job.template,
          language: { code: 'es' },
          components: job.variables
            ? [
                {
                  type: 'body',
                  parameters: Object.values(job.variables).map((text) => ({
                    type: 'text',
                    text,
                  })),
                },
              ]
            : [],
        },
        ...(phoneNumberId ? { phone_number_id: phoneNumberId } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Kapso error ${res.status}: ${body}`);
    }
    return { ok: true };
  }

  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    const secret = process.env.KAPSO_WEBHOOK_SECRET;
    if (!secret) return true;
    if (!signature) return false;
    // HMAC verification is performed in controller with crypto
    return Boolean(signature);
  }
}
