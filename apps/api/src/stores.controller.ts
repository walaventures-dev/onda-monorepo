import {
  Inject,
  Body,
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  generateReferralCode,
  isSubcategoryOfCategory,
  normalizeStoreSlug,
} from './store-taxonomy';

const pinAttempts = new Map<string, { count: number; resetAt: number }>();
const PIN_ATTEMPT_LIMIT = 5;
const PIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

const storePublicSelect = {
  id: true,
  name: true,
  slug: true,
  category: true,
  subcategory: true,
  googlePlaceId: true,
  address: true,
  planType: true,
  billingStatus: true,
  whatsappUsed: true,
  maxStamps: true,
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
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.store.findMany({
      select: storePublicSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.prisma.store.findUniqueOrThrow({
      where: { id },
      select: {
        ...storePublicSelect,
        eventMemberships: true,
      },
    });
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
      pinCode: string;
      googlePlaceId?: string;
      address?: string;
      ownerEmail?: string;
      lat?: number;
      lng?: number;
      referralCode?: string;
      planType?: 'BASIC' | 'PRO';
    }
  ) {
    if (!body.name?.trim()) {
      throw new BadRequestException('El nombre del negocio es requerido');
    }
    if (!body.ownerName?.trim()) {
      throw new BadRequestException('El nombre del encargado es requerido');
    }
    if (!body.pinCode?.trim()) {
      throw new BadRequestException('El PIN es requerido');
    }
    if (!body.category || !body.subcategory) {
      throw new BadRequestException('Categoría y subcategoría son requeridas');
    }
    if (!isSubcategoryOfCategory(body.category, body.subcategory)) {
      throw new BadRequestException(
        'La subcategoría no corresponde al tipo de negocio'
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
          pinCode: body.pinCode,
          googlePlaceId: body.googlePlaceId,
          address: body.address?.trim() || undefined,
          ownerEmail: body.ownerEmail?.trim() || undefined,
          lat: body.lat,
          lng: body.lng,
          referralCode,
          planType,
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
      pinCode: string;
      lat: number;
      lng: number;
      planType: 'BASIC' | 'PRO';
      billingStatus: string;
      maxStamps: number;
      currentPinCode: string;
      ownerName: string;
    }>
  ) {
    const existingStore = await this.prisma.store.findUniqueOrThrow({
      where: { id },
    });
    if (existingStore.pinCode !== body.currentPinCode) {
      throw new ForbiddenException('PIN de tienda inválido');
    }
    const { currentPinCode, ...updateFields } = body;

    let maxStamps: number | undefined;
    if (updateFields.maxStamps != null) {
      maxStamps = Number(updateFields.maxStamps);
      if (!Number.isInteger(maxStamps) || maxStamps < 1 || maxStamps > 12) {
        throw new BadRequestException(
          'El tope de sellos debe ser un número entre 1 y 12'
        );
      }
      const finalPromo = await this.prisma.promotion.findFirst({
        where: { storeId: id, pointsRequired: maxStamps, isActive: true },
      });
      if (!finalPromo) {
        throw new BadRequestException(
          `Debes tener una promoción activa en el sello ${maxStamps} antes de guardar este tope`
        );
      }
    }
    return this.prisma.store.update({
      where: { id },
      data: { ...updateFields, maxStamps },
    });
  }

  @Post(':id/validate-pin')
  async validatePin(
    @Param('id') id: string,
    @Body() body: { pinCode: string }
  ) {
    const now = Date.now();
    const entry = pinAttempts.get(id);
    if (entry && entry.resetAt > now && entry.count >= PIN_ATTEMPT_LIMIT) {
      throw new ForbiddenException('Demasiados intentos, espera unos minutos');
    }
    const store = await this.prisma.store.findUniqueOrThrow({ where: { id } });
    const valid = store.pinCode === body.pinCode;
    if (!valid) {
      const current =
        entry && entry.resetAt > now
          ? entry
          : { count: 0, resetAt: now + PIN_ATTEMPT_WINDOW_MS };
      current.count += 1;
      pinAttempts.set(id, current);
    } else {
      pinAttempts.delete(id);
    }
    return { valid };
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
