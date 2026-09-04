import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  StoreMemberRole,
  StoreMemberStatus,
} from '@prisma/client';
import { PrismaService } from './prisma.service';
import { CartillaService } from './cartilla.service';
import { PosService } from './pos.service';
import { GooglePlacesService } from './google-places.service';
import {
  defaultSegmentFor,
  defaultSubcategoryFor,
  generateReferralCode,
  isSegmentOfSubcategory,
  isSubcategoryOfCategory,
  normalizeStoreSlug,
} from './store-taxonomy';
import { storeClaimUrl } from './merchant-invite-url';

export type CreateStoreDraftBody = {
  name: string;
  logoUrl?: string;
  category: string;
  slug?: string;
  subcategory?: string;
  segment?: string;
  googlePlaceId?: string;
  address?: string;
  lat?: number;
  lng?: number;
  ownerName?: string;
  planType?: 'BASIC' | 'PRO';
  billingPeriod?: 'monthly' | '6' | '12';
  referralCode?: string;
};

export type UpdateStoreProfileBody = {
  name?: string;
  slug?: string;
  category?: string;
  subcategory?: string;
  segment?: string;
  googlePlaceId?: string;
  address?: string;
  lat?: number;
  lng?: number;
  logoUrl?: string | null;
  ownerName?: string;
};

function newClaimToken() {
  return randomBytes(24).toString('base64url');
}

@Injectable()
export class StoreDraftService {
  private readonly logger = new Logger(StoreDraftService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(CartillaService) private cartillas: CartillaService,
    @Inject(PosService) private pos: PosService,
    @Inject(GooglePlacesService) private googlePlaces: GooglePlacesService
  ) {}

  async createDraft(body: CreateStoreDraftBody) {
    if (!body.name?.trim()) {
      throw new BadRequestException('El nombre del negocio es requerido');
    }
    if (!body.category?.trim()) {
      throw new BadRequestException('La categoría es requerida');
    }

    const logoUrl = body.logoUrl?.trim() || undefined;

    const category = body.category.trim();
    const subcategory =
      body.subcategory?.trim() || defaultSubcategoryFor(category);
    if (!subcategory) {
      throw new BadRequestException('Categoría inválida');
    }
    if (!isSubcategoryOfCategory(category, subcategory)) {
      throw new BadRequestException(
        'La categoría no corresponde al tipo de negocio'
      );
    }

    const segment =
      body.segment?.trim() || defaultSegmentFor(subcategory) || undefined;
    if (!segment || !isSegmentOfSubcategory(subcategory, segment)) {
      throw new BadRequestException(
        'La subcategoría no corresponde a la categoría del negocio'
      );
    }

    const slug = normalizeStoreSlug(body.slug || body.name);
    if (!slug) {
      throw new BadRequestException('El slug es inválido');
    }

    const existingSlug = await this.prisma.store.findUnique({ where: { slug } });
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

    const claimToken = newClaimToken();
    const planType = body.planType === 'PRO' ? 'PRO' : 'BASIC';
    const billingPeriod =
      body.billingPeriod === '6' ||
      body.billingPeriod === '12' ||
      body.billingPeriod === 'monthly'
        ? body.billingPeriod
        : 'monthly';

    const store = await this.prisma.$transaction(async (tx) => {
      return tx.store.create({
        data: {
          name: body.name.trim(),
          slug,
          ownerName: body.ownerName?.trim() || 'Pendiente',
          category: category as any,
          subcategory: subcategory as any,
          segment: segment as any,
          googlePlaceId: body.googlePlaceId,
          address: body.address?.trim() || undefined,
          lat: body.lat,
          lng: body.lng,
          ownerEmail: null,
          referralCode,
          planType,
          billingPeriod,
          billingStatus: 'PENDING',
          freeMonthsBalance: 0,
          claimToken,
          claimTokenCreatedAt: new Date(),
          passDesign: {
            create: {
              title: body.name.trim(),
              subtitle: 'Programa de lealtad Onda',
              description: 'Acumula ondas y gana recompensas',
              backgroundColor: '#6E5AE6',
              foregroundColor: '#FFFFFF',
              labelColor: '#3DB9E8',
              ...(logoUrl ? { logoUrl } : {}),
            },
          },
        },
        include: { passDesign: true },
      });
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
          `Snapshot Google Places falló: ${e instanceof Error ? e.message : e}`
        );
      }
    }

    return {
      ...store,
      claimUrl: storeClaimUrl(claimToken),
    };
  }

  async updateProfile(storeId: string, body: UpdateStoreProfileBody) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { passDesign: true },
    });
    if (!store) {
      throw new NotFoundException('Negocio no encontrado');
    }

    const category = (body.category?.trim() || store.category) as string;
    const subcategory = (
      body.subcategory?.trim() ||
      store.subcategory ||
      defaultSubcategoryFor(category)
    ) as string;
    if (!subcategory || !isSubcategoryOfCategory(category, subcategory)) {
      throw new BadRequestException(
        'La categoría no corresponde al tipo de negocio'
      );
    }

    const segment = (
      body.segment?.trim() ||
      store.segment ||
      defaultSegmentFor(subcategory)
    ) as string;
    if (!segment || !isSegmentOfSubcategory(subcategory, segment)) {
      throw new BadRequestException(
        'La subcategoría no corresponde a la categoría del negocio'
      );
    }

    let slug: string | undefined;
    if (body.slug != null) {
      slug = normalizeStoreSlug(body.slug || body.name || store.name);
      if (!slug) {
        throw new BadRequestException('El slug es inválido');
      }
      if (slug !== store.slug) {
        const clash = await this.prisma.store.findUnique({ where: { slug } });
        if (clash) {
          throw new ConflictException('Ese slug ya está en uso');
        }
      }
    }

    const name = body.name?.trim() || undefined;
    const googlePlaceId =
      body.googlePlaceId !== undefined
        ? body.googlePlaceId || null
        : undefined;
    const address =
      body.address !== undefined ? body.address?.trim() || null : undefined;

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: {
        ...(name ? { name } : {}),
        ...(slug ? { slug } : {}),
        category: category as any,
        subcategory: subcategory as any,
        segment: segment as any,
        ...(googlePlaceId !== undefined ? { googlePlaceId } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(body.lat !== undefined ? { lat: body.lat } : {}),
        ...(body.lng !== undefined ? { lng: body.lng } : {}),
        ...(body.ownerName?.trim()
          ? { ownerName: body.ownerName.trim() }
          : {}),
      },
      include: { passDesign: true },
    });

    if (body.logoUrl !== undefined || name) {
      const previous = store.passDesign;
      const logoUrl =
        body.logoUrl !== undefined
          ? body.logoUrl?.trim() || null
          : previous?.logoUrl ?? null;
      const design = await this.prisma.passDesign.upsert({
        where: { storeId },
        create: {
          storeId,
          title: name || store.name,
          subtitle: 'Programa de lealtad Onda',
          description: 'Acumula ondas y gana recompensas',
          backgroundColor: '#6E5AE6',
          foregroundColor: '#FFFFFF',
          labelColor: '#3DB9E8',
          logoUrl,
        },
        update: {
          ...(name ? { title: name } : {}),
          ...(body.logoUrl !== undefined ? { logoUrl } : {}),
        },
      });
      await this.cartillas.syncStoreBrand(
        storeId,
        {
          logoUrl: design.logoUrl,
          stripImageUrl: design.stripImageUrl,
          backgroundColor: design.backgroundColor,
          foregroundColor: design.foregroundColor,
          labelColor: design.labelColor || design.foregroundColor,
        },
        previous
          ? {
              logoUrl: previous.logoUrl,
              stripImageUrl: previous.stripImageUrl,
              backgroundColor: previous.backgroundColor,
              labelColor: previous.labelColor,
            }
          : null
      );
    }

    const placeId = googlePlaceId ?? updated.googlePlaceId;
    if (placeId && placeId !== store.googlePlaceId) {
      try {
        await this.googlePlaces.saveSnapshot(storeId, placeId, 'ONBOARDING');
      } catch (e) {
        this.logger.warn(
          `Snapshot Google Places falló: ${e instanceof Error ? e.message : e}`
        );
      }
    }

    return this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      include: { passDesign: true },
    });
  }

  async listDrafts() {
    const stores = await this.prisma.store.findMany({
      where: { claimToken: { not: null } },
      include: { passDesign: { select: { logoUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return stores.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      category: s.category,
      subcategory: s.subcategory,
      segment: s.segment,
      address: s.address,
      googlePlaceId: s.googlePlaceId,
      lat: s.lat,
      lng: s.lng,
      createdAt: s.createdAt,
      claimUrl: s.claimToken ? storeClaimUrl(s.claimToken) : null,
      logoUrl: s.passDesign?.logoUrl ?? null,
    }));
  }

  async rotateClaim(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Negocio no encontrado');
    if (!store.claimToken) {
      throw new BadRequestException('Este negocio ya fue asociado');
    }
    const claimToken = newClaimToken();
    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: { claimToken, claimTokenCreatedAt: new Date() },
    });
    return {
      storeId: updated.id,
      claimUrl: storeClaimUrl(claimToken),
    };
  }

  async previewClaim(token: string) {
    const store = await this.prisma.store.findFirst({
      where: { claimToken: token },
      include: { passDesign: { select: { logoUrl: true } } },
    });
    if (!store) {
      throw new NotFoundException('Enlace de asociación inválido o expirado');
    }
    return {
      storeName: store.name,
      logoUrl: store.passDesign?.logoUrl ?? null,
      category: store.category,
      subcategory: store.subcategory,
      segment: store.segment,
      address: store.address,
      slug: store.slug,
    };
  }

  async acceptClaim(token: string, firebaseEmail: string, ownerName?: string) {
    const email = firebaseEmail.trim().toLowerCase();
    const store = await this.prisma.store.findFirst({
      where: { claimToken: token },
    });
    if (!store) {
      throw new NotFoundException('Enlace de asociación inválido o expirado');
    }
    if (store.ownerEmail) {
      throw new ConflictException('Este negocio ya tiene dueño');
    }

    const existingAdmin = await this.prisma.storeMember.findFirst({
      where: {
        storeId: store.id,
        role: StoreMemberRole.ADMIN,
        status: StoreMemberStatus.ACTIVE,
      },
    });
    if (existingAdmin) {
      throw new ConflictException('Este negocio ya tiene un administrador');
    }

    const displayName = ownerName?.trim() || email.split('@')[0] || 'Encargado';

    await this.prisma.$transaction(async (tx) => {
      await tx.store.update({
        where: { id: store.id },
        data: {
          ownerEmail: email,
          ownerName: displayName,
          claimToken: null,
          claimTokenCreatedAt: null,
        },
      });

      await tx.storeMember.upsert({
        where: { storeId_email: { storeId: store.id, email } },
        create: {
          storeId: store.id,
          email,
          name: displayName,
          role: StoreMemberRole.ADMIN,
          status: StoreMemberStatus.ACTIVE,
          acceptedAt: new Date(),
        },
        update: {
          name: displayName,
          role: StoreMemberRole.ADMIN,
          status: StoreMemberStatus.ACTIVE,
          acceptedAt: new Date(),
          revokedAt: null,
        },
      });
    });

    return {
      storeId: store.id,
      storeName: store.name,
    };
  }
}
