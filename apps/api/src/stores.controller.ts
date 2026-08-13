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
import {
  generateReferralCode,
  defaultSegmentFor,
  isSegmentOfSubcategory,
  isSubcategoryOfCategory,
  normalizeStoreSlug,
} from './store-taxonomy';

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
    @Inject(CartillaService) private cartillas: CartillaService
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
      const referrer = await this.prisma.store.findUnique({
        where: { referralCode: body.referralCode.trim().toUpperCase() },
      });
      if (!referrer) {
        throw new BadRequestException('Código de referido inválido');
      }
      referredByStoreId = referrer.id;
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
          freeMonthsBalance: 1,
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

      if (referredByStoreId) {
        await tx.store.update({
          where: { id: referredByStoreId },
          data: { freeMonthsBalance: { increment: 1 } },
        });
      }

      return created;
    });

    await this.cartillas.ensureDefaultCartilla(store.id);

    if (store.ownerEmail) {
      try {
        await this.jobs.enqueue('brevo-email', {
          to: store.ownerEmail,
          toName: store.ownerName,
          subject: `Tu negocio ${store.name} ya está en Onda`,
          html: `<p>Hola ${store.ownerName},</p><p>Tu sede <strong>${store.name}</strong> quedó creada.</p>`,
          text: `Hola ${store.ownerName}, tu sede ${store.name} quedó creada.`,
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
    return this.prisma.store.update({
      where: { id },
      data: { ...body, maxStamps, currency, ondaValue },
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
