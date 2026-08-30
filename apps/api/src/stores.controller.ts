import {
  Inject,
  Body,
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  HttpException,
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
import { GooglePlacesService } from './google-places.service';
import { CodeResolverService } from './code-resolver.service';
import { WompiService } from './wompi.service';
import { quotePlanWithDiscount } from '@onda/shared-utils';

const storePublicSelect = {
  id: true,
  name: true,
  slug: true,
  category: true,
  subcategory: true,
  segment: true,
  googlePlaceId: true,
  googleRating: true,
  googleReviewCount: true,
  googleRatingUpdatedAt: true,
  address: true,
  planType: true,
  billingStatus: true,
  billingPeriod: true,
  nextBillingAt: true,
  nextUsageBillingAt: true,
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
  promoCodeUsed: true,
  referredByStoreId: true,
  createdAt: true,
  passDesign: true,
  promotions: true,
} as const;

type CreateStoreBody = {
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
};

@Controller('stores')
export class StoresController {
  private readonly logger = new Logger(StoresController.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(JobsService) private jobs: JobsService,
    @Inject(CartillaService) private cartillas: CartillaService,
    @Inject(PosService) private pos: PosService,
    @Inject(BillingService) private billing: BillingService,
    @Inject(CodeResolverService) private codeResolver: CodeResolverService,
    @Inject(WompiService) private wompi: WompiService,
    @Inject(GooglePlacesService) private googlePlaces: GooglePlacesService
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
  async create(@Body() body: CreateStoreBody) {
    const store = await this.insertStore(body, {
      planType: body.planType === 'PRO' ? 'PRO' : 'BASIC',
      billingPeriod:
        body.billingPeriod === '6' ||
        body.billingPeriod === '12' ||
        body.billingPeriod === 'monthly'
          ? body.billingPeriod
          : 'monthly',
      referredByStoreId: await this.resolveReferrerId(body.referralCode),
      billingStatus: 'ACTIVE',
    });
    return store;
  }

  @Post('with-subscription')
  async createWithSubscription(@Body() body: CreateStoreBody) {
    const planType = this.billing.normalizePlan(body.planType);
    let billingPeriod = this.billing.normalizePeriod(body.billingPeriod);

    let codeMeta: {
      referredByStoreId?: string;
      promoCode?: string;
      discountPercentage: number;
    };
    try {
      codeMeta = await this.codeResolver.resolveForSubscription(
        body.referralCode
      );
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Código inválido'
      );
    }

    if (codeMeta.discountPercentage > 30) {
      billingPeriod = 'monthly';
    }
    this.billing.assertBillingAllowed(
      billingPeriod,
      codeMeta.discountPercentage
    );

    const quote = quotePlanWithDiscount(
      planType,
      billingPeriod,
      codeMeta.discountPercentage
    );

    if (quote.amountDue > 0 && this.wompi.isConfigured && !body.cardToken) {
      throw new BadRequestException('Tarjeta requerida para activar el plan');
    }

    let store: Awaited<ReturnType<StoresController['insertStore']>>;
    try {
      store = await this.insertStore(body, {
        planType,
        billingPeriod,
        referredByStoreId: codeMeta.referredByStoreId,
        promoCodeUsed: codeMeta.promoCode,
        billingStatus: 'PENDING',
      });
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`insertStore falló: ${msg}`);
      throw new BadRequestException(
        'No se pudo crear el negocio. Intenta de nuevo.'
      );
    }

    try {
      if (quote.skipPayment) {
        const result = await this.billing.activateComplimentarySubscription({
          storeId: store.id,
          planType,
          billingPeriod,
          promoCode: codeMeta.promoCode,
          referred: Boolean(codeMeta.referredByStoreId),
        });
        return {
          ...result.store,
          passDesign: store.passDesign,
          amountCop: 0,
          quote: result.quote,
          stub: true,
          complimentary: true,
        };
      }

      const result = await this.billing.activatePaidSubscription({
        storeId: store.id,
        planType,
        billingPeriod,
        discountPercentage: codeMeta.discountPercentage,
        promoCode: codeMeta.promoCode,
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
      await this.prisma.store.delete({ where: { id: store.id } }).catch(() => {});
      if (e instanceof HttpException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`with-subscription falló store=${store.id}: ${msg}`);
      if (/Wompi/i.test(msg)) {
        throw new BadRequestException(
          'No se pudo cobrar la tarjeta. Revisa los datos o intenta con otra.'
        );
      }
      throw new BadRequestException(
        'No se pudo activar el negocio. Intenta de nuevo.'
      );
    }
  }

  private async resolveReferrerId(referralCode?: string) {
    if (!referralCode?.trim()) return undefined;
    const resolved = await this.codeResolver.resolve(referralCode);
    if (resolved.kind !== 'referral') return undefined;
    const referrer = await this.prisma.store.findUnique({
      where: { referralCode: resolved.code },
      select: { id: true },
    });
    if (!referrer) {
      throw new BadRequestException('Código de referido inválido');
    }
    return referrer.id;
  }

  private async insertStore(
    body: CreateStoreBody,
    opts: {
      planType: 'BASIC' | 'PRO';
      billingPeriod: 'monthly' | '6' | '12';
      referredByStoreId?: string;
      promoCodeUsed?: string;
      billingStatus?: string;
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
          planType: opts.planType,
          billingPeriod: opts.billingPeriod,
          billingStatus: opts.billingStatus || 'ACTIVE',
          freeMonthsBalance: 0,
          referredByStoreId: opts.referredByStoreId,
          promoCodeUsed: opts.promoCodeUsed,
          passDesign: {
            create: {
              title: body.name.trim(),
              subtitle: 'Programa de lealtad Onda',
              description: 'Acumula ondas y gana recompensas',
              backgroundColor: '#6E5AE6',
              foregroundColor: '#FFFFFF',
              labelColor: '#3DB9E8',
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

    if (store.googlePlaceId) {
      try {
        await this.googlePlaces.saveSnapshot(
          store.id,
          store.googlePlaceId,
          'ONBOARDING'
        );
      } catch (e) {
        this.logger.warn(
          `Snapshot Google Places falló: ${
            e instanceof Error ? e.message : e
          }`
        );
      }
    }

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
