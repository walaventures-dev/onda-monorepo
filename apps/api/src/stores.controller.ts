import {
  Inject,
  Body,
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JobsService } from './jobs.service';
import { CartillaService } from './cartilla.service';
import { PosService } from './pos.service';
import {
  generateReferralCode,
  defaultSegmentFor,
  isSegmentOfSubcategory,
  isSubcategoryOfCategory,
  normalizeStoreSlug,
} from './store-taxonomy';
import {
  storeCreatedEmailHtml,
  storeCreatedEmailText,
} from './mail-templates/store-created';
import { BillingService } from './billing.service';
import { WompiService } from './wompi.service';
import { isDemoReferralCode } from './demo-referral';

const storePublicSelect = {
  id: true,
  name: true,
  slug: true,
  category: true,
  subcategory: true,
  segment: true,
  googlePlaceId: true,
  address: true,
  planType: true,
  billingStatus: true,
  billingPeriod: true,
  nextBillingAt: true,
  whatsappUsed: true,
  maxStamps: true,
  currency: true,
  ondaValue: true,
  lat: true,
  lng: true,
  ownerName: true,
  ownerEmail: true,
  referralCode: true,
  freeMonthsBalance: true,
  referralBonusApplied: true,
  referredByStoreId: true,
  createdAt: true,
  passDesign: true,
  promotions: true,
} as const;

@Controller('stores')
export class StoresController {
  private readonly logger = new Logger(StoresController.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(JobsService) private jobs: JobsService,
    @Inject(CartillaService) private cartillas: CartillaService,
    @Inject(PosService) private pos: PosService,
    @Inject(BillingService) private billing: BillingService,
    @Inject(WompiService) private wompi: WompiService
  ) {}

  @Get()
  list() {
    return this.prisma.store.findMany({
      select: storePublicSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const store = await this.prisma.store.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: {
        ...storePublicSelect,
        eventMemberships: true,
      },
    });
    if (!store) {
      throw new NotFoundException('Comercio no encontrado');
    }
    return store;
  }

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      slug: string;
      ownerName: string;
      category: string;
      subcategory: string;
      segment?: string;
      googlePlaceId?: string;
      address?: string;
      ownerEmail?: string;
      lat?: number;
      lng?: number;
      referralCode?: string;
      planType?: 'BASIC' | 'PRO';
      billingPeriod?: 'monthly' | '6' | '12';
    }
  ) {
    if (!body.name?.trim()) {
      throw new BadRequestException('El nombre del negocio es requerido');
    }
    if (!body.ownerName?.trim()) {
      throw new BadRequestException('El nombre del encargado es requerido');
    }
    if (!body.category || !body.subcategory) {
      throw new BadRequestException('Categoría y subcategoría son requeridas');
    }
    if (!isSubcategoryOfCategory(body.category, body.subcategory)) {
      throw new BadRequestException(
        'La categoría no corresponde al tipo de negocio'
      );
    }
    const segment =
      body.segment || defaultSegmentFor(body.subcategory) || undefined;
    if (!segment || !isSegmentOfSubcategory(body.subcategory, segment)) {
      throw new BadRequestException(
        'La subcategoría no corresponde a la categoría del negocio'
      );
    }

    const slug = normalizeStoreSlug(body.slug || body.name);
    if (!slug) {
      throw new BadRequestException('El slug es inválido');
    }

    const existingSlug = await this.prisma.store.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      throw new ConflictException('Ese slug ya está en uso');
    }

    let referredByStoreId: string | undefined;
    if (body.referralCode?.trim()) {
      if (isDemoReferralCode(body.referralCode)) {
        // Código interno de demos: sin referidor real ni bono.
        referredByStoreId = undefined;
      } else {
        const referrer = await this.prisma.store.findUnique({
          where: { referralCode: body.referralCode.trim().toUpperCase() },
        });
        if (!referrer) {
          throw new BadRequestException('Código de referido inválido');
        }
        referredByStoreId = referrer.id;
      }
    }

    const planType =
      body.planType === 'PRO' || body.planType === 'BASIC'
        ? body.planType
        : 'BASIC';
    const billingPeriod =
      body.billingPeriod === '6' ||
      body.billingPeriod === '12' ||
      body.billingPeriod === 'monthly'
        ? body.billingPeriod
        : 'monthly';

    let referralCode = generateReferralCode();
    for (let i = 0; i < 5; i++) {
      const clash = await this.prisma.store.findUnique({
        where: { referralCode },
      });
      if (!clash) break;
      referralCode = generateReferralCode();
    }

    const store = await this.prisma.$transaction(async (tx) => {
      const created = await tx.store.create({
        data: {
          name: body.name.trim(),
          slug,
          ownerName: body.ownerName.trim(),
          category: body.category as any,
          subcategory: body.subcategory as any,
          segment: segment as any,
          googlePlaceId: body.googlePlaceId,
          address: body.address?.trim() || undefined,
          ownerEmail: body.ownerEmail?.trim() || undefined,
          lat: body.lat,
          lng: body.lng,
          referralCode,
          planType,
          billingPeriod,
          billingStatus: 'PENDING_PAYMENT',
          freeMonthsBalance: 0,
          referredByStoreId,
          passDesign: {
            create: {
              title: body.name.trim(),
              subtitle: 'Programa de lealtad Onda',
              description: 'Acumula ondas y gana recompensas',
              backgroundColor: '#6E5AE6',
              foregroundColor: '#FFFFFF',
              labelColor: '#E5F6FC',
            },
          },
        },
        include: { passDesign: true },
      });

      if (created.ownerEmail) {
        await tx.storeMember.create({
          data: {
            storeId: created.id,
            email: created.ownerEmail.trim(),
            name: created.ownerName,
            role: 'ADMIN',
            status: 'ACTIVE',
            acceptedAt: new Date(),
          },
        });
      }

      return created;
    });

    await this.cartillas.ensureDefaultCartilla(store.id);
    await this.pos.bootstrapStore(store.id);

    if (store.ownerEmail) {
      try {
        await this.jobs.enqueue('brevo-email', {
          to: store.ownerEmail,
          toName: store.ownerName,
          subject: `Tu negocio ${store.name} ya está en Onda`,
          html: storeCreatedEmailHtml({
            ownerName: store.ownerName,
            storeName: store.name,
            referralCode: store.referralCode,
          }),
          text: storeCreatedEmailText({
            ownerName: store.ownerName,
            storeName: store.name,
            referralCode: store.referralCode,
          }),
        });
      } catch (e) {
        this.logger.warn(
          `No se pudo encolar el email de bienvenida: ${
            e instanceof Error ? e.message : e
          }`
        );
      }
    }

    return store;
  }

  /**
   * Alta atómica: crea el comercio y cobra la suscripción (tokenización Wompi).
   * Sin llaves Wompi en local: stub de payment source y ACTIVE.
   */
  @Post('with-subscription')
  async createWithSubscription(
    @Body()
    body: {
      name: string;
      slug: string;
      ownerName: string;
      category: string;
      subcategory: string;
      segment?: string;
      googlePlaceId?: string;
      address?: string;
      ownerEmail?: string;
      lat?: number;
      lng?: number;
      referralCode?: string;
      planType?: 'BASIC' | 'PRO';
      billingPeriod?: 'monthly' | '6' | '12';
      cardToken?: string;
      acceptanceToken?: string;
      acceptPersonalAuth?: string;
    }
  ) {
    const planType = this.billing.normalizePlan(body.planType);
    const billingPeriod = this.billing.normalizePeriod(body.billingPeriod);
    const demo = isDemoReferralCode(body.referralCode);

    if (!demo && this.wompi.isConfigured && !body.cardToken) {
      throw new BadRequestException('Tarjeta requerida para activar el plan');
    }

    const store = await this.create({
      ...body,
      planType,
      billingPeriod,
    });

    try {
      if (demo) {
        const result = await this.billing.activateComplimentarySubscription({
          storeId: store.id,
          planType,
          billingPeriod,
        });
        return {
          ...result.store,
          passDesign: store.passDesign,
          amountCop: 0,
          quote: result.quote,
          stub: true,
          demo: true,
        };
      }

      const result = await this.billing.activatePaidSubscription({
        storeId: store.id,
        planType,
        billingPeriod,
        tokens: body.cardToken
          ? {
              cardToken: body.cardToken,
              acceptanceToken: body.acceptanceToken || '',
              acceptPersonalAuth: body.acceptPersonalAuth || '',
              customerEmail: body.ownerEmail || 'billing@onda.lat',
            }
          : undefined,
      });
      return {
        ...result.store,
        passDesign: store.passDesign,
        amountCop: result.amountCop,
        quote: result.quote,
        stub: result.stub,
      };
    } catch (e) {
      this.logger.error(
        `Pago falló tras crear store ${store.id}: ${
          e instanceof Error ? e.message : e
        }`
      );
      await this.prisma.store.update({
        where: { id: store.id },
        data: { billingStatus: 'PENDING_PAYMENT' },
      });
      throw e instanceof BadRequestException
        ? e
        : new BadRequestException(
            e instanceof Error ? e.message : 'No se pudo procesar el pago'
          );
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      googlePlaceId: string;
      address: string;
      lat: number;
      lng: number;
      planType: 'BASIC' | 'PRO';
      billingStatus: string;
      maxStamps: number;
      currency: string;
      ondaValue: number | null;
      posEnabled: boolean;
      ownerName: string;
    }>
  ) {
    let maxStamps: number | undefined;
    if (body.maxStamps != null) {
      maxStamps = Number(body.maxStamps);
      if (!Number.isInteger(maxStamps) || maxStamps < 1 || maxStamps > 12) {
        throw new BadRequestException(
          'El tope de sellos debe ser un número entre 1 y 12'
        );
      }
    }
    let currency: string | undefined;
    if (body.currency != null) {
      currency = String(body.currency).trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) {
        throw new BadRequestException('La moneda debe ser un código de 3 letras (ej. COP)');
      }
    }
    let ondaValue: number | null | undefined;
    if ('ondaValue' in body) {
      if (body.ondaValue == null) {
        ondaValue = null;
      } else {
        ondaValue = Number(body.ondaValue);
        if (!Number.isFinite(ondaValue) || ondaValue < 0) {
          throw new BadRequestException('El valor de una onda debe ser un número positivo');
        }
      }
    }
    let posEnabled: boolean | undefined;
    if ('posEnabled' in body && body.posEnabled != null) {
      posEnabled = Boolean(body.posEnabled);
    }
    return this.prisma.store.update({
      where: { id },
      data: { ...body, maxStamps, currency, ondaValue, posEnabled },
    });
  }

  @Get(':id/customers')
  async customers(@Param('id') id: string, @Query('q') q?: string) {
    const passes = await this.prisma.pass.findMany({
      where: {
        storeId: id,
        ...(q
          ? {
              OR: [
                { user: { name: { contains: q, mode: 'insensitive' } } },
                { user: { phone: { contains: q } } },
              ],
            }
          : {}),
      },
      include: { user: true },
      orderBy: { user: { createdAt: 'desc' } },
    });
    return passes.map((p) => ({
      passId: p.id,
      points: p.points,
      serialNumber: p.serialNumber,
      user: p.user,
    }));
  }
}
