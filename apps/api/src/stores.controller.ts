import { Inject, Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query, } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('stores')
export class StoresController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService
  ) {}

  @Get()
  list() {
    return this.prisma.store.findMany({
      include: { passDesign: true, promotions: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.prisma.store.findUniqueOrThrow({
      where: { id },
      include: { passDesign: true, promotions: true, eventMemberships: true },
    });
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      category?: string;
      pinCode: string;
      googlePlaceId?: string;
      ownerEmail?: string;
      lat?: number;
      lng?: number;
    }
  ) {
    return this.prisma.store.create({
      data: {
        name: body.name,
        category: (body.category as any) || 'RESTAURANT',
        pinCode: body.pinCode,
        googlePlaceId: body.googlePlaceId,
        ownerEmail: body.ownerEmail,
        lat: body.lat,
        lng: body.lng,
        passDesign: {
          create: {
            title: body.name,
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
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      googlePlaceId: string;
      pinCode: string;
      lat: number;
      lng: number;
      planType: 'BASIC' | 'PRO';
      billingStatus: string;
      maxStamps: number;
    }>
  ) {
    let maxStamps: number | undefined;
    if (body.maxStamps != null) {
      maxStamps = Number(body.maxStamps);
      if (!Number.isInteger(maxStamps) || maxStamps < 1 || maxStamps > 12) {
        throw new BadRequestException('El tope de sellos debe ser un número entre 1 y 12');
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
      data: { ...body, maxStamps },
    });
  }

  @Post(':id/validate-pin')
  async validatePin(@Param('id') id: string, @Body() body: { pinCode: string }) {
    const store = await this.prisma.store.findUniqueOrThrow({ where: { id } });
    return { valid: store.pinCode === body.pinCode };
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
