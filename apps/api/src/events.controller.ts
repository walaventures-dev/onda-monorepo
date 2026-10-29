import {
  ConflictException,
  Inject,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('events')
export class EventsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService
  ) {}

  @Get()
  list(@Query('ownerStoreId') ownerStoreId?: string) {
    return this.prisma.event.findMany({
      where: ownerStoreId ? { ownerStoreId } : undefined,
      include: {
        passDesign: true,
        stores: { include: { store: true } },
        promotions: true,
        cartillas: { select: { id: true, name: true, status: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  @Get('slug/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.prisma.event.findUniqueOrThrow({
      where: { slug },
      include: {
        passDesign: true,
        stores: { include: { store: { include: { passDesign: true } } } },
        promotions: true,
        cartillas: { select: { id: true, name: true, status: true } },
      },
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.prisma.event.findUniqueOrThrow({
      where: { id },
      include: {
        passDesign: true,
        stores: { include: { store: true } },
        promotions: true,
        cartillas: { select: { id: true, name: true, status: true } },
      },
    });
  }

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      slug: string;
      startDate: string;
      endDate: string;
      globalTarget?: number;
      address?: string;
      googlePlaceId?: string;
      lat?: number;
      lng?: number;
      ownerStoreId?: string;
    }
  ) {
    const slug = body.slug?.trim();
    if (!slug) {
      throw new ConflictException('El slug del evento es obligatorio.');
    }
    const existing = await this.prisma.event.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(
        `Ya existe un evento con el slug "${slug}". Elige otro.`
      );
    }
    const { ownerStoreId } = body;
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          name: body.name,
          slug,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          globalTarget: body.globalTarget ?? 10,
          address: body.address?.trim() || null,
          googlePlaceId: body.googlePlaceId || null,
          lat: body.lat ?? null,
          lng: body.lng ?? null,
          ownerStoreId: ownerStoreId || null,
          status: 'DRAFT',
          passDesign: {
            create: {
              title: body.name,
              subtitle: 'Evento Onda',
              description: 'Acumula ondas en el circuito',
              backgroundColor: '#6E5AE6',
              foregroundColor: '#FFFFFF',
              labelColor: '#E5F6FC',
            },
          },
        },
        include: { passDesign: true },
      });
      if (ownerStoreId) {
        await tx.storeEventMembership.upsert({
          where: {
            storeId_eventId: { storeId: ownerStoreId, eventId: event.id },
          },
          create: { storeId: ownerStoreId, eventId: event.id, status: 'ACCEPTED' },
          update: { status: 'ACCEPTED' },
        });
      }
      return event;
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      slug: string;
      startDate: string;
      endDate: string;
      status: 'DRAFT' | 'ACTIVE' | 'FINISHED';
      globalTarget: number;
      address: string | null;
      googlePlaceId: string | null;
      lat: number | null;
      lng: number | null;
    }>
  ) {
    const slug = body.slug?.trim();
    if (slug) {
      const existing = await this.prisma.event.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Ya existe un evento con el slug "${slug}". Elige otro.`
        );
      }
    }
    return this.prisma.event.update({
      where: { id },
      data: {
        ...body,
        slug: body.slug?.trim() || undefined,
        address: body.address === undefined ? undefined : body.address?.trim() || null,
        googlePlaceId: body.googlePlaceId === undefined ? undefined : body.googlePlaceId || null,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    });
  }
}
