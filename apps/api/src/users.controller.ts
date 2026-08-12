import { Inject, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { WhatsappService } from './whatsapp.service';
import { WalletService } from './wallet.service';
import { remainingOndas } from './plan-quota';

function toE164Colombia(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('57') && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith('3') && digits.length === 10) return `+57${digits}`;
  if (input.trim().startsWith('+')) return input.trim();
  return `+${digits}`;
}

function randomSerial() {
  return `ONDA-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

@Controller()
export class UsersController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(JwtService) private jwt: JwtService,
    @Inject(WhatsappService) private whatsapp: WhatsappService,
    @Inject(WalletService) private wallet: WalletService
  ) {}

  @Get('users/:id')
  get(@Param('id') id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { passes: true },
    });
  }

  @Post('enroll')
  async enroll(
    @Body()
    body: {
      name: string;
      phone: string;
      storeId: string;
      eventId?: string;
      tableId?: string;
    }
  ) {
    const phone = toE164Colombia(body.phone);
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: body.storeId },
      include: { passDesign: true },
    });

    const user = await this.prisma.user.upsert({
      where: { phone },
      create: { name: body.name, phone },
      update: { name: body.name },
    });

    let pass = await this.prisma.pass.findFirst({
      where: {
        userId: user.id,
        storeId: body.storeId,
        ...(body.eventId ? { eventId: body.eventId } : {}),
      },
    });

    if (!pass) {
      const serialNumber = randomSerial();
      const welcomePoints = (await remainingOndas(this.prisma, store.id)) > 0 ? 1 : 0;
      pass = await this.prisma.pass.create({
        data: {
          userId: user.id,
          storeId: body.storeId,
          eventId: body.eventId,
          serialNumber,
          points: welcomePoints,
        },
      });

      if (welcomePoints > 0) {
        await this.prisma.transaction.create({
          data: {
            passId: pass.id,
            storeId: body.storeId,
            type: 'ACCUMULATE',
            points: welcomePoints,
          },
        });
      }

      const design = store.passDesign;
      if (design) {
        try {
          const issued = await this.wallet.issuePass({
            serialNumber,
            points: welcomePoints,
            holderName: user.name,
            organizationName: store.name,
            maxStamps: store.maxStamps,
            kind: 'store',
            design,
          });
          pass = await this.prisma.pass.update({
            where: { id: pass.id },
            data: { walletRef: issued.walletRef },
          });
        } catch {
          // Emisión wallet es best-effort: el Pass en DB ya existe.
        }
      }
    }

    await this.whatsapp.enqueue({
      to: phone,
      template: 'onda_bienvenida',
      variables: { name: user.name, store: store.name, points: String(pass.points) },
      storeId: store.id,
    });

    await this.prisma.store.update({
      where: { id: store.id },
      data: { whatsappUsed: { increment: 1 } },
    });

    const token = await this.jwt.signAsync({
      sub: user.id,
      role: 'customer',
      phone: user.phone,
    });

    return {
      user,
      pass: await this.prisma.pass.findUnique({
        where: { id: pass.id },
        include: {
          store: { include: { passDesign: true } },
          event: { include: { passDesign: true, promotions: true } },
        },
      }),
      token,
      tableId: body.tableId,
    };
  }
}
