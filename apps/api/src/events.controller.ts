import { Inject, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('events')
export class EventsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService
  ) {}

  @Get()
  list() {
    return this.prisma.event.findMany({
      include: {
        passDesign: true,
        stores: { include: { store: true } },
        promotions: true,
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
      },
    });
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      slug: string;
      startDate: string;
      endDate: string;
      globalTarget?: number;
    }
  ) {
    return this.prisma.event.create({
      data: {
        name: body.name,
        slug: body.slug,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        globalTarget: body.globalTarget ?? 10,
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
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      startDate: string;
      endDate: string;
      status: 'DRAFT' | 'ACTIVE' | 'FINISHED';
      globalTarget: number;
    }>
  ) {
    return this.prisma.event.update({
      where: { id },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    });
  }
}
