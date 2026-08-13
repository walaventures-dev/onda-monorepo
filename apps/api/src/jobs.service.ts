import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { Inject, forwardRef } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from './prisma.service';
import { WhatsappService } from './whatsapp.service';
import { BrevoService } from './brevo.service';
import { WalletService } from './wallet.service';
import { WompiService } from './wompi.service';
import type {
  BrevoEmailJobPayload,
  BrevoSmsJobPayload,
  JobPayloadMap,
  JobType,
  JobsEnqueueOptions,
  WalletNotifyJobPayload,
  WhatsappJobPayload,
  WompiRenewJobPayload,
} from './jobs.types';

const QUEUE_NAME = 'onda-jobs';
const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(forwardRef(() => WhatsappService)) private whatsapp: WhatsappService,
    @Inject(BrevoService) private brevo: BrevoService,
    @Inject(WalletService) private wallet: WalletService,
    @Inject(WompiService) private wompi: WompiService
  ) {}

  get usesCloudTasks(): boolean {
    return Boolean(
      process.env.GCP_PROJECT?.trim() && process.env.CLOUD_TASKS_QUEUE?.trim()
    );
  }

  async onModuleInit() {
    if (this.usesCloudTasks) {
      this.logger.log('Jobs: Cloud Tasks (GCP)');
      return;
    }
    try {
      const connection = {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        maxRetriesPerRequest: null as null,
      };
      this.queue = new Queue(QUEUE_NAME, { connection });
      this.worker = new Worker(
        QUEUE_NAME,
        async (job) => {
          await this.dispatch(job.name as JobType, job.data);
        },
        { connection }
      );
      this.worker.on('failed', (job, err) => {
        this.logger.error(`Job ${job?.name} ${job?.id} failed: ${err.message}`);
      });
      this.logger.log('Jobs: BullMQ/Redis');
    } catch (e) {
      this.logger.warn(`Jobs: inline (Redis unavailable): ${e}`);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueue<K extends JobType>(
    type: K,
    payload: JobPayloadMap[K],
    opts?: JobsEnqueueOptions
  ) {
    if (this.usesCloudTasks) {
      try {
        await this.enqueueCloudTask(type, payload, opts);
        return { queued: true as const, via: 'cloud-tasks' as const };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Cloud Tasks falló (${type}): ${msg}`);
        if (opts?.delayMs) {
          return { queued: false as const, via: 'inline' as const };
        }
      }
    }
    if (this.queue) {
      await this.queue.add(type, payload, {
        delay: opts?.delayMs,
        removeOnComplete: 100,
        removeOnFail: 200,
      });
      return { queued: true as const, via: 'bullmq' as const };
    }
    await this.dispatch(type, payload);
    return { queued: false as const, via: 'inline' as const };
  }

  verifyWorkerSecret(header: string | undefined): void {
    const secret = process.env.JOBS_SECRET;
    if (!secret) return;
    if (header !== secret) {
      throw new UnauthorizedException('Job worker no autorizado');
    }
  }

  async dispatch(type: JobType, payload: unknown) {
    switch (type) {
      case 'whatsapp-send':
        await this.whatsapp.sendViaKapso(payload as WhatsappJobPayload);
        return;
      case 'brevo-email':
        await this.brevo.sendEmail(payload as BrevoEmailJobPayload);
        return;
      case 'brevo-sms':
        await this.dispatchSmsCampaign(payload as BrevoSmsJobPayload);
        return;
      case 'wallet-notify': {
        const p = payload as WalletNotifyJobPayload;
        await this.wallet.notify(p.walletRef, p.message);
        return;
      }
      case 'wompi-renew':
        await this.dispatchWompiRenew(payload as WompiRenewJobPayload);
        return;
      default:
        this.logger.warn(`Job desconocido: ${type}`);
    }
  }

  scheduleWompiRenew(storeId: string) {
    return this.enqueue('wompi-renew', { storeId }, { delayMs: MS_30_DAYS });
  }

  private async dispatchSmsCampaign(payload: BrevoSmsJobPayload) {
    const passes = await this.prisma.pass.findMany({
      where: { storeId: payload.storeId },
      include: { user: true },
    });
    const phones = [
      ...new Set(passes.map((p) => p.user.phone).filter(Boolean)),
    ];
    const message = payload.title.slice(0, 160);
    for (const to of phones) {
      await this.brevo.sendSms({ to, message });
    }
    this.logger.log(
      `SMS campaign ${payload.campaignId ?? ''} store=${payload.storeId} n=${phones.length}`
    );
  }

  private async dispatchWompiRenew(payload: WompiRenewJobPayload) {
    const store = await this.prisma.store.findUnique({
      where: { id: payload.storeId },
    });
    if (!store?.wompiPaymentSourceId) {
      this.logger.log(`[Wompi renew] sin payment source store=${payload.storeId}`);
      return;
    }
    await this.wompi.chargePaymentSource(store.wompiPaymentSourceId, store.id);
    await this.scheduleWompiRenew(store.id);
  }

  private async enqueueCloudTask(
    type: JobType,
    payload: unknown,
    opts?: JobsEnqueueOptions
  ) {
    const { CloudTasksClient } = await import('@google-cloud/tasks');
    const client = new CloudTasksClient();
    const project = process.env.GCP_PROJECT!;
    const location = process.env.GCP_LOCATION || 'us-central1';
    const queue = process.env.CLOUD_TASKS_QUEUE!;
    const workerUrl = (
      process.env.JOBS_WORKER_URL || 'http://localhost:3333'
    ).replace(/\/$/, '');
    const parent = client.queuePath(project, location, queue);
    const url = `${workerUrl}/api/jobs/run`;
    const body = Buffer.from(JSON.stringify({ type, payload })).toString(
      'base64'
    );
    const sa = process.env.CLOUD_TASKS_SA_EMAIL;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.JOBS_SECRET) {
      headers['X-Onda-Jobs-Secret'] = process.env.JOBS_SECRET;
    }

    await client.createTask({
      parent,
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url,
          headers,
          body,
          ...(sa
            ? { oidcToken: { serviceAccountEmail: sa, audience: url } }
            : {}),
        },
        ...(opts?.delayMs
          ? {
              scheduleTime: {
                seconds: Math.floor((Date.now() + opts.delayMs) / 1000),
              },
            }
          : {}),
      },
    });
  }
}
