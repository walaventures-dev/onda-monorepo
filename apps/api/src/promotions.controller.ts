import { Inject, Body, Controller, Get, Param, Patch, Post, Query, Delete } from '@nestjs/common';
import { PromotionType } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Controller('promotions')
export class PromotionsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService
  ) {}

  @Get()
  list(
    @Query('storeId') storeId?: string,
    @Query('eventId') eventId?: string,
    @Query('type') type?: string,
    @Query('isActive') isActive?: string
  ) {
    const types = type
      ? (type.split(',').filter(Boolean) as PromotionType[])
      : undefined;
    return this.prisma.promotion.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        ...(eventId ? { eventId } : {}),
        ...(types?.length ? { type: { in: types } } : {}),
        ...(isActive === 'true' ? { isActive: true } : {}),
        ...(isActive === 'false' ? { isActive: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  create(
    @Body()
    body: {
      title: string;
      pointsRequired: number;
      storeId?: string;
      eventId?: string;
      description?: string;
      imageUrl?: string;
      isActive?: boolean;
      type?: PromotionType;
      value?: number;
      buyQuantity?: number;
      getQuantity?: number;
      productName?: string;
    }
  ) {
    return this.prisma.promotion.create({
      data: {
        title: body.title,
        pointsRequired: Number(body.pointsRequired),
        storeId: body.storeId,
        eventId: body.eventId,
        description: body.description,
        imageUrl: body.imageUrl,
        isActive: body.isActive ?? true,
        type: body.type || 'OTHER',
        value: body.value != null ? Number(body.value) : undefined,
        buyQuantity: body.buyQuantity != null ? Number(body.buyQuantity) : undefined,
        getQuantity: body.getQuantity != null ? Number(body.getQuantity) : undefined,
        productName: body.productName,
      },
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      title: string;
      pointsRequired: number;
      description: string;
      imageUrl: string | null;
      isActive: boolean;
      type: PromotionType;
      value: number | null;
      buyQuantity: number | null;
      getQuantity: number | null;
      productName: string | null;
    }>
  ) {
    return this.prisma.promotion.update({
      where: { id },
      data: {
        ...body,
        pointsRequired:
          body.pointsRequired != null ? Number(body.pointsRequired) : undefined,
        value: body.value != null ? Number(body.value) : body.value,
        buyQuantity:
          body.buyQuantity != null ? Number(body.buyQuantity) : body.buyQuantity,
        getQuantity:
          body.getQuantity != null ? Number(body.getQuantity) : body.getQuantity,
      },
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.promotion.delete({ where: { id } });
  }
}
