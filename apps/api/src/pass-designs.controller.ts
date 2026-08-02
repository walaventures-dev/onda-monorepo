import { Inject, Body, Controller, Get, Param, Put } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('pass-designs')
export class PassDesignsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService
  ) {}

  @Get('store/:storeId')
  byStore(@Param('storeId') storeId: string) {
    return this.prisma.passDesign.findUniqueOrThrow({ where: { storeId } });
  }

  @Get('event/:eventId')
  byEvent(@Param('eventId') eventId: string) {
    return this.prisma.passDesign.findUniqueOrThrow({ where: { eventId } });
  }

  @Put('store/:storeId')
  updateStore(
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
    return this.prisma.passDesign.upsert({
      where: { storeId },
      create: {
        storeId,
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
