import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from './prisma.service';
import { WompiService } from './wompi.service';
import { JobsService } from './jobs.service';
import { BillingService } from './billing.service';
import { WalletService } from './wallet.service';

@Controller('billing')
export class BillingController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WompiService) private wompi: WompiService,
    @Inject(JobsService) private jobs: JobsService,
    @Inject(BillingService) private billing: BillingService,
    @Inject(WalletService) private wallet: WalletService
  ) {}

  @Get('config')
  config() {
    return {
      wompiConfigured: this.wompi.isConfigured,
      wompiPublicKey: this.wompi.publicKey,
    };
  }

  @Get('store/:storeId')
  summary(
    @Param('storeId') storeId: string,
    @Query('probe') probe?: string
  ) {
    if (probe === '1') {
      return this.billing.summaryProbe(storeId);
    }
    return this.billing.summary(storeId);
  }

  @Get('store/:storeId/invoices')
  invoices(
    @Param('storeId') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.billing.listInvoices(
      storeId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined
    );
  }

  @Get('store/:storeId/usage')
  usage(
    @Param('storeId') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.billing.usageBreakdown(storeId, fromDate, toDate);
  }

  @Get('store/:storeId/invoices/:invoiceId/pdf')
  async pdf(
    @Param('storeId') storeId: string,
    @Param('invoiceId') invoiceId: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const file = await this.billing.getInvoicePdf(storeId, invoiceId);
    if (file.signedUrl && !file.buffer) {
      res.redirect(file.signedUrl);
      return;
    }
    if (!file.buffer) {
      throw new ForbiddenException('No se pudo leer el recibo');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`
    );
    return new StreamableFile(file.buffer);
  }

  @Post('store/:storeId/upgrade')
  async upgrade(@Param('storeId') storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    if (!this.wompi.isConfigured) {
      const updated = await this.prisma.store.update({
        where: { id: storeId },
        data: { planType: 'PRO', billingStatus: 'ACTIVE' },
      });
      await this.wallet.syncStorePassLocations(storeId);
      return { store: updated, stub: true as const, checkout: null };
    }

    const { billingPeriod } = this.wompi.parsePlanFromStore(store);
    const checkout = this.wompi.createCheckout({
      storeId,
      planType: 'PRO',
      billingPeriod,
      kind: 'upgrade',
    });
    await this.prisma.store.update({
      where: { id: storeId },
      data: { wompiTransactionId: checkout.reference },
    });
    return { stub: false as const, checkout };
  }

  @Post('wompi/webhook')
  async wompiWebhook(@Body() body: Record<string, unknown>) {
    if (!this.wompi.verifyEventChecksum(body)) {
      throw new ForbiddenException('Firma Wompi inválida');
    }
    const tx = this.wompi.transactionFromEvent(body);
    if (!tx?.reference || tx.status !== 'APPROVED') {
      return { received: true, ignored: true };
    }
    const store = await this.prisma.store.findFirst({
      where: { wompiTransactionId: tx.reference },
    });
    if (!store) {
      return { received: true, store: null };
    }
    const paymentSourceId =
      tx.paymentSourceId != null
        ? String(tx.paymentSourceId)
        : store.wompiPaymentSourceId;
    await this.prisma.store.update({
      where: { id: store.id },
      data: {
        planType: 'PRO',
        billingStatus: 'ACTIVE',
        wompiPaymentSourceId: paymentSourceId,
      },
    });
    await this.wallet.syncStorePassLocations(store.id);
    if (paymentSourceId && store.nextBillingAt) {
      await this.jobs.scheduleWompiRenew(
        store.id,
        Math.max(0, store.nextBillingAt.getTime() - Date.now())
      );
    }
    return { received: true, storeId: store.id, status: 'PRO' };
  }
}
