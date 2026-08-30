import { Injectable } from '@nestjs/common';
import {
  BILLING_ISSUER,
  formatChargeDate,
  formatCop,
  PLAN_META,
  type PlanId,
} from '@onda/shared-utils';

export type InvoicePdfLine = {
  label: string;
  amountCop: number;
};

export type InvoicePdfInput = {
  invoiceNumber: string;
  storeName: string;
  storeEmail?: string | null;
  kind: 'PLAN' | 'USAGE' | 'COMBINED';
  status: string;
  periodStart: Date;
  periodEnd: Date;
  planType: PlanId;
  nextBillingAt?: Date | null;
  nextUsageBillingAt?: Date | null;
  lines: InvoicePdfLine[];
  totalCop: number;
  chargedCop: number;
  carriedOutCop: number;
  issuedAt: Date;
};

const KIND_LABEL: Record<InvoicePdfInput['kind'], string> = {
  PLAN: 'Suscripción',
  USAGE: 'Consumos adicionales',
  COMBINED: 'Suscripción y consumos',
};

@Injectable()
export class InvoicePdfService {
  async render(input: InvoicePdfInput): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc
      .fillColor('#052DDE')
      .fontSize(18)
      .text('Onda', { continued: false });
    doc.moveDown(0.3);
    doc.fillColor('#1A1B2E').fontSize(11).text(BILLING_ISSUER.legalName);
    doc
      .fillColor('#6B7289')
      .fontSize(9)
      .text(`${BILLING_ISSUER.website}  ·  NIT ${BILLING_ISSUER.nit}`);

    doc.moveDown(1.2);
    doc.fillColor('#1A1B2E').fontSize(16).text('Recibo de pago');
    doc
      .fillColor('#6B7289')
      .fontSize(10)
      .text(input.invoiceNumber)
      .text(KIND_LABEL[input.kind])
      .text(`Emitido ${formatChargeDate(input.issuedAt)}`);

    doc.moveDown(0.8);
    doc.fillColor('#1A1B2E').fontSize(11).text(input.storeName);
    if (input.storeEmail) {
      doc.fillColor('#6B7289').fontSize(9).text(input.storeEmail);
    }
    doc
      .fillColor('#6B7289')
      .fontSize(9)
      .text(`Plan ${PLAN_META[input.planType].name}`)
      .text(
        `Periodo ${formatChargeDate(input.periodStart)} – ${formatChargeDate(input.periodEnd)}`
      );

    doc.moveDown(1);
    doc.fillColor('#1A1B2E').fontSize(11).text('Detalle');
    doc.moveDown(0.4);
    for (const line of input.lines) {
      const y = doc.y;
      doc.fontSize(10).fillColor('#1A1B2E').text(line.label, 56, y, {
        width: 340,
      });
      doc.text(formatCop(line.amountCop), 400, y, {
        width: 140,
        align: 'right',
      });
      doc.moveDown(0.35);
    }

    doc.moveDown(0.4);
    const totalY = doc.y;
    doc.fontSize(12).fillColor('#052DDE').text('Total', 56, totalY, { width: 340 });
    doc.text(formatCop(input.totalCop), 400, totalY, {
      width: 140,
      align: 'right',
    });

    doc.moveDown(0.8);
    doc.fillColor('#6B7289').fontSize(9);
    if (input.chargedCop > 0) {
      doc.text(`Cobrado a la tarjeta: ${formatCop(input.chargedCop)}`);
    } else if (input.totalCop === 0) {
      doc.text('Sin cargo en este periodo.');
    }
    if (input.carriedOutCop > 0) {
      doc.text(
        `Saldo menor al mínimo de cobro, se traslada al siguiente corte: ${formatCop(input.carriedOutCop)}`
      );
    }

    doc.moveDown(1);
    doc.fillColor('#1A1B2E').fontSize(10).text('Fechas de corte');
    doc.fillColor('#6B7289').fontSize(9);
    if (input.nextBillingAt) {
      doc.text(`Plan: ${formatChargeDate(input.nextBillingAt)}`);
    }
    if (input.nextUsageBillingAt) {
      doc.text(`Consumos adicionales: ${formatChargeDate(input.nextUsageBillingAt)}`);
    }

    doc.moveDown(2);
    doc
      .fillColor('#6B7289')
      .fontSize(8)
      .text(
        'Documento de cobro emitido por Wala Ventures S.A.S. No constituye factura electrónica DIAN.',
        { width: 480 }
      );

    doc.end();
    return done;
  }
}
