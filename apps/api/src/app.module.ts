import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
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
import { DemoOndaSpaController } from './demo-onda-spa.controller';
import { CampaignsController } from './campaigns.controller';
import { FirebaseAuthService } from './firebase-auth.service';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { BrevoService } from './brevo.service';
import { WompiService } from './wompi.service';
import { CartillaService } from './cartilla.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    FirebaseAuthService,
    JobsService,
    BrevoService,
    WompiService,
    CartillaService,
  ],
})
export class AppModule {}
