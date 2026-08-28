import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { HealthController } from './health.controller';
import { StoresController } from './stores.controller';
import { EventsController } from './events.controller';
import { UsersController } from './users.controller';
import { PassesController } from './passes.controller';
import { PassDesignsController } from './pass-designs.controller';
import { TransactionsController } from './transactions.controller';
import { PromotionsController } from './promotions.controller';
import { CartillasController } from './cartillas.controller';
import { MembershipsController } from './memberships.controller';
import {
  AnalyticsController,
  DrawsController,
  LeadsController,
  BillingController,
  FeedbackController,
  WebhooksController,
} from './analytics.controller';
import { AuthController } from './auth.controller';
import { CustomerAuthController } from './customer-auth.controller';
import { UploadsController } from './uploads.controller';
import { ReferralsController } from './referrals.controller';
import { PrismaService } from './prisma.service';
import { WalletService } from './wallet.service';
import { WhatsappService } from './whatsapp.service';
import { CustomerAuthService } from './customer-auth.service';
import { PendingRequestsSseService } from './pending-requests-sse.service';
import { PendingRequestsController } from './pending-requests.controller';
import { CajaController } from './caja.controller';
import { PosController } from './pos.controller';
import { MembersController } from './members.controller';
import { AccumulateService } from './accumulate.service';
import { RedeemService } from './redeem.service';
import { StoreAccessService } from './store-access.service';
import { DemoOndaSpaController } from './demo-onda-spa.controller';
import { CampaignsController } from './campaigns.controller';
import { FirebaseAuthService } from './firebase-auth.service';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { BrevoService } from './brevo.service';
import { MailService } from './mail.service';
import { MAIL_PROVIDER } from './mail.types';
import { MerchantPasswordResetService } from './merchant-password-reset.service';
import { WompiService } from './wompi.service';
import { CartillaService } from './cartilla.service';
import { CampaignsService } from './campaigns.service';
import { PosService } from './pos.service';
import { PosSseService } from './pos-sse.service';
import { MerchantInviteService } from './merchant-invite.service';
import { FirestoreService } from './firestore.service';
import { PromoCodesService } from './promo-codes.service';
import { CodeResolverService } from './code-resolver.service';
import { BillingService } from './billing.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), '.env'),
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'onda-dev-secret-change-me',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    CustomerAuthController,
    StoresController,
    EventsController,
    UsersController,
    PassesController,
    PassDesignsController,
    TransactionsController,
    PromotionsController,
    CartillasController,
    MembershipsController,
    LeadsController,
    AnalyticsController,
    DrawsController,
    BillingController,
    FeedbackController,
    WebhooksController,
    UploadsController,
    PendingRequestsController,
    CajaController,
    PosController,
    MembersController,
    ReferralsController,
    DemoOndaSpaController,
    CampaignsController,
    JobsController,
  ],
  providers: [
    PrismaService,
    WalletService,
    WhatsappService,
    CustomerAuthService,
    PendingRequestsSseService,
    AccumulateService,
    RedeemService,
    StoreAccessService,
    FirebaseAuthService,
    JobsService,
    BrevoService,
    { provide: MAIL_PROVIDER, useExisting: BrevoService },
    MailService,
    MerchantPasswordResetService,
    WompiService,
    CartillaService,
    CampaignsService,
    PosService,
    PosSseService,
    MerchantInviteService,
    FirestoreService,
    PromoCodesService,
    CodeResolverService,
    BillingService,
  ],
})
export class AppModule {}
