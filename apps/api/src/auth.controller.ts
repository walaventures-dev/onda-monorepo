import {
  Inject,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { FirebaseAuthService } from './firebase-auth.service';

const merchantStoreInclude = {
  passDesign: { select: { logoUrl: true } },
  _count: { select: { promotions: true } },
} as const;

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(JwtService) private jwt: JwtService,
    @Inject(FirebaseAuthService) private firebase: FirebaseAuthService
  ) {}

  @Get('merchant/status')
  status() {
    return { firebaseAuth: this.firebase.isConfigured };
  }

  @Post('merchant')
  async merchantLogin(
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: { email?: string }
  ) {
    if (this.firebase.isConfigured) {
      const email = await this.firebase.emailFromAuthHeader(authHeader);
      const stores = await this.storesForEmail(email);
      return { email, stores };
    }

    if (!body.email) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const store = await this.prisma.store.findFirst({
      where: { ownerEmail: body.email },
    });
    if (!store) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const token = await this.jwt.signAsync({
      sub: store.id,
      role: 'merchant',
      email: store.ownerEmail,
    });
    return { token, store };
  }

  @Get('merchant/stores')
  async merchantStores(@Headers('authorization') authHeader: string | undefined) {
    if (!this.firebase.isConfigured) {
      return this.prisma.store.findMany({
        include: merchantStoreInclude,
        orderBy: { createdAt: 'desc' },
      });
    }
    const email = await this.firebase.emailFromAuthHeader(authHeader);
    return this.storesForEmail(email);
  }

  @Post('organizer')
  async organizerLogin(@Body() body: { email: string; password: string }) {
    if (body.password !== 'onda-org' && body.password !== process.env.JWT_SECRET) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const token = await this.jwt.signAsync({
      sub: 'organizer',
      role: 'organizer',
      email: body.email,
    });
    return { token, role: 'organizer' };
  }

  private storesForEmail(email: string) {
    return this.prisma.store.findMany({
      where: { ownerEmail: { equals: email, mode: 'insensitive' } },
      include: merchantStoreInclude,
      orderBy: { createdAt: 'desc' },
    });
  }
}
