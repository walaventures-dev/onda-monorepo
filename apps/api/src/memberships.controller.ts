import { Inject, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WhatsappService } from './whatsapp.service';

@Controller('memberships')
export class MembershipsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WhatsappService) private whatsapp: WhatsappService
  ) {}

  @Get()
  list(@Query('eventId') eventId?: string, @Query('storeId') storeId?: string) {
    return this.prisma.storeEventMembership.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        ...(storeId ? { storeId } : {}),
      },
      include: { store: true, event: true },
    });
  }

  @Post('invite')
  async invite(
    @Body()
    body: {
      storeId: string;
      eventId: string;
      customPromo?: string;
      phone?: string;
    }
  ) {
    const membership = await this.prisma.storeEventMembership.upsert({
      where: {
        storeId_eventId: { storeId: body.storeId, eventId: body.eventId },
      },
      create: {
        storeId: body.storeId,
        eventId: body.eventId,
        status: 'PENDING',
        customPromo: body.customPromo,
      },
      update: { customPromo: body.customPromo, status: 'PENDING' },
      include: { store: true, event: true },
    });

    if (body.phone) {
      await this.whatsapp.enqueue({
        to: body.phone,
        template: 'onda_invitacion_evento',
        variables: {
          store: membership.store.name,
          event: membership.event.name,
        },
        storeId: body.storeId,
      });
    }

    return membership;
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
      customPromo: string;
      nfcKitId: string;
    }>
  ) {
    return this.prisma.storeEventMembership.update({
      where: { id },
      data: body,
      include: { store: true, event: true },
    });
  }
}
