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
import { PrismaService } from './prisma.service';
import { WalletService } from './wallet.service';
import { WhatsappService } from './whatsapp.service';
import { CustomerAuthService } from './customer-auth.service';
import { PendingRequestsSseService } from './pending-requests-sse.service';

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
    MembershipsController,
    LeadsController,
    AnalyticsController,
    DrawsController,
    BillingController,
    FeedbackController,
    WebhooksController,
    UploadsController,
  ],
  providers: [PrismaService, WalletService, WhatsappService, CustomerAuthService, PendingRequestsSseService],
})
export class AppModule {}
