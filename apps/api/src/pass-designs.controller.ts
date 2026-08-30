import { Inject, Body, Controller, Get, NotFoundException, Param, Put } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CartillaService } from './cartilla.service';
import { passDesignFromStoreName, resolvePassDesign } from './pass-design.util';

@Controller('pass-designs')
export class PassDesignsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(CartillaService) private cartillas: CartillaService
  ) {}

  @Get('store/:storeId')
  async byStore(@Param('storeId') storeId: string) {
    const design = await this.prisma.passDesign.findUnique({ where: { storeId } });
    if (design) return design;
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Comercio no encontrado');
    return passDesignFromStoreName(store.name);
  }

  @Get('cartilla/:cartillaId')
  async byCartilla(@Param('cartillaId') cartillaId: string) {
    const cartilla = await this.prisma.cartilla.findUnique({
      where: { id: cartillaId },
      include: { passDesign: true, store: { include: { passDesign: true } } },
    });
    if (!cartilla) throw new NotFoundException('Cartilla no encontrada');
    return resolvePassDesign(cartilla.passDesign, cartilla.store.passDesign);
  }

  @Get('event/:eventId')
  byEvent(@Param('eventId') eventId: string) {
    return this.prisma.passDesign.findUniqueOrThrow({ where: { eventId } });
  }

  @Put('cartilla/:cartillaId')
  async updateCartilla(
    @Param('cartillaId') cartillaId: string,
    @Body()
    body: {
      backgroundColor?: string;
      foregroundColor?: string;
      labelColor?: string;
      logoUrl?: string | null;
      stripImageUrl?: string;
      title?: string;
      subtitle?: string;
      description?: string;
    }
  ) {
    await this.cartillas.assertCanEdit(cartillaId);
    const cartilla = await this.prisma.cartilla.findUniqueOrThrow({
      where: { id: cartillaId },
      select: { storeId: true },
    });
    return this.prisma.passDesign.upsert({
      where: { cartillaId },
      create: {
        cartillaId,
        title: body.title || 'Onda Rewards',
        backgroundColor: body.backgroundColor || '#6E5AE6',
        foregroundColor: body.foregroundColor || '#FFFFFF',
        labelColor: body.labelColor,
        logoUrl: body.logoUrl?.trim() || null,
        stripImageUrl: body.stripImageUrl,
        subtitle: body.subtitle,
        description: body.description,
      },
      update: {
        ...body,
        ...(body.logoUrl !== undefined
          ? { logoUrl: body.logoUrl?.trim() || null }
          : {}),
      },
    });
  }

  @Put('store/:storeId')
  async updateStore(
    @Param('storeId') storeId: string,
    @Body()
    body: {
      backgroundColor?: string;
      foregroundColor?: string;
      labelColor?: string;
      logoUrl?: string | null;
      stripImageUrl?: string;
      title?: string;
      subtitle?: string;
      description?: string;
    }
  ) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      include: { passDesign: true },
    });
    const previous = store.passDesign;
    const payload = {
      ...body,
      ...(body.logoUrl !== undefined
        ? { logoUrl: body.logoUrl?.trim() || null }
        : {}),
    };
    const updated = await this.prisma.passDesign.upsert({
      where: { storeId },
      create: {
        storeId,
        title: body.title?.trim() || store.name,
        backgroundColor: body.backgroundColor || '#6E5AE6',
        foregroundColor: body.foregroundColor || '#FFFFFF',
        labelColor: body.labelColor,
        logoUrl: body.logoUrl?.trim() || null,
        stripImageUrl: body.stripImageUrl,
        subtitle: body.subtitle,
        description: body.description,
      },
      update: payload,
    });
    await this.cartillas.syncStoreBrand(
      storeId,
      {
        logoUrl: updated.logoUrl,
        backgroundColor: updated.backgroundColor,
        foregroundColor: updated.foregroundColor,
        labelColor: updated.labelColor || updated.foregroundColor,
      },
      previous
        ? {
            logoUrl: previous.logoUrl,
            backgroundColor: previous.backgroundColor,
            labelColor: previous.labelColor,
          }
        : null,
    );
    return updated;
  }

  @Put('event/:eventId')
  updateEvent(
    @Param('eventId') eventId: string,
    @Body()
    body: {
      backgroundColor?: string;
      foregroundColor?: string;
      labelColor?: string;
      logoUrl?: string;
      stripImageUrl?: string;
      title?: string;
      subtitle?: string;
      description?: string;
    }
  ) {
    return this.prisma.passDesign.upsert({
      where: { eventId },
      create: {
        eventId,
        title: body.title || 'Evento Onda',
        backgroundColor: body.backgroundColor || '#6E5AE6',
        foregroundColor: body.foregroundColor || '#FFFFFF',
        labelColor: body.labelColor,
        logoUrl: body.logoUrl,
        stripImageUrl: body.stripImageUrl,
        subtitle: body.subtitle,
        description: body.description,
      },
      update: body,
    });
  }
}
