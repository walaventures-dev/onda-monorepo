import {
  Inject,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
  Param,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { FirebaseAuthService } from './firebase-auth.service';
import { MerchantPasswordResetService } from './merchant-password-reset.service';
import { StoreAccessService } from './store-access.service';
import { MerchantInviteService } from './merchant-invite.service';

const merchantStoreInclude = {
  passDesign: { select: { logoUrl: true } },
  _count: { select: { promotions: true } },
  cartillas: {
    where: { isDefault: true },
    select: {
      id: true,
      isDefault: true,
      _count: { select: { items: true } },
    },
  },
} as const;

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(JwtService) private jwt: JwtService,
    @Inject(FirebaseAuthService) private firebase: FirebaseAuthService,
    @Inject(MerchantPasswordResetService)
    private passwordReset: MerchantPasswordResetService,
    @Inject(StoreAccessService) private storeAccess: StoreAccessService,
    @Inject(MerchantInviteService) private invites: MerchantInviteService
  ) {}

  @Get('merchant/status')
  status() {
    return { firebaseAuth: this.firebase.isConfigured };
  }

  /** Público. Siempre responde ok (no revela si el email existe). */
  @Post('merchant/password-reset')
  passwordResetRequest(@Body() body: { email?: string }) {
    return this.passwordReset.request(body.email || '');
  }

  @Post('merchant')
  async merchantLogin(
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: { email?: string }
  ) {
    if (this.firebase.isConfigured) {
      const email = await this.firebase.emailFromAuthHeader(authHeader);
      const stores = await this.storeAccess.storesForEmail(email);
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
    return this.storeAccess.storesForEmail(email);
  }

  @Get('invite/:token')
  async previewInvite(@Param('token') token: string) {
    return this.invites.previewInvite(token);
  }

  @Post('invite/:token/accept')
  async acceptInvite(
    @Param('token') token: string,
    @Headers('authorization') authHeader: string | undefined
  ) {
    if (!this.firebase.isConfigured) {
      throw new UnauthorizedException('Firebase requerido');
    }
    const email = await this.firebase.emailFromAuthHeader(authHeader);
    const member = await this.invites.acceptInvite(token, email);
    return {
      storeId: member.storeId,
      storeName: member.store.name,
      role: member.role,
    };
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
}
