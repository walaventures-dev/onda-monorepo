import { Inject, Body, Controller, Get, Param, Put } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CartillaService } from './cartilla.service';

@Controller('pass-designs')
export class PassDesignsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(CartillaService) private cartillas: CartillaService
  ) {}

  @Get('store/:storeId')
  async byStore(@Param('storeId') storeId: string) {
    const def = await this.cartillas.ensureDefaultCartilla(storeId);
    if (def.passDesign) return def.passDesign;
    return this.prisma.passDesign.findUniqueOrThrow({ where: { storeId } });
  }

  @Get('cartilla/:cartillaId')
  byCartilla(@Param('cartillaId') cartillaId: string) {
    return this.prisma.passDesign.findUniqueOrThrow({ where: { cartillaId } });
  }

  @Get('event/:eventId')
  byEvent(@Param('eventId') eventId: string) {
    return this.prisma.passDesign.findUniqueOrThrow({ where: { eventId } });
  }

  @Put('cartilla/:cartillaId')
  updateCartilla(
    @Param('cartillaId') cartillaId: string,
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
      where: { cartillaId },
      create: {
        cartillaId,
        title: body.title || 'Onda Rewards',
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

  @Put('store/:storeId')
  async updateStore(
    @Param('storeId') storeId: string,
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
    const def = await this.cartillas.ensureDefaultCartilla(storeId);
    return this.prisma.passDesign.upsert({
      where: { storeId },
      create: {
        storeId,
        cartillaId: def.id,
        title: body.title || 'Onda Rewards',
        backgroundColor: body.backgroundColor || '#6E5AE6',
        foregroundColor: body.foregroundColor || '#FFFFFF',
        labelColor: body.labelColor,
        logoUrl: body.logoUrl,
        stripImageUrl: body.stripImageUrl,
        subtitle: body.subtitle,
        description: body.description,
      },
      update: { ...body, cartillaId: def.id },
    });
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
