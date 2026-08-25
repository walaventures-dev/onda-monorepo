import { Inject, Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from './prisma.service';
import { WhatsappService } from './whatsapp.service';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
/** Código fijo en modo mock: no se envía WhatsApp y la PWA lo muestra como `devCode`. */
const MOCK_OTP_CODE = '123456';

function isOtpMock(): boolean {
  const flag = process.env.OTP_MOCK?.trim().toLowerCase();
  if (flag === '0' || flag === 'false') return false;
  // Por ahora mock en prod y en dev. OTP_MOCK=false para enviar por WhatsApp.
  return true;
}

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function randomToken(): string {
  return randomBytes(32).toString('hex');
}

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WhatsappService) private whatsapp: WhatsappService
  ) {}

  async requestOtp(phone: string) {
    const mock = isOtpMock();
    const code = mock ? MOCK_OTP_CODE : randomCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.prisma.otpCode.create({ data: { phone, code, expiresAt } });

    if (mock) {
      this.logger.log(`[OTP mock] ${phone} → ${code}`);
    } else {
      await this.whatsapp.enqueue({
        to: phone,
        template: process.env.WHATSAPP_OTP_TEMPLATE || 'otp_template',
        variables: { code },
        authOtp: true,
      });
    }

    return { expiresAt, devCode: mock ? code : undefined };
  }

  async verifyOtp(phone: string, code: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('Código expirado, solicita uno nuevo');
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Demasiados intentos, solicita un código nuevo');
    }
    if (otp.code !== code) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Código incorrecto');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    let user = await this.prisma.user.findUnique({ where: { phone } });
    const isNewUser = !user;
    if (!user) {
      user = await this.prisma.user.create({ data: { name: '', phone } });
    }

    const token = randomToken();
    await this.prisma.session.create({ data: { token, userId: user.id } });

    return { token, user, isNewUser };
  }

  async setProfile(token: string, name: string) {
    const user = await this.requireSession(token);
    return this.prisma.user.update({ where: { id: user.id }, data: { name } });
  }

  async requireSession(token: string) {
    if (!token) throw new UnauthorizedException('Sesión requerida');
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return session.user;
  }

  async logout(token: string) {
    await this.prisma.session.updateMany({
      where: { token, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true as const };
  }
}
