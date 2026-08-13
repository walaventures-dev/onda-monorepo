import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CartillaService } from './cartilla.service';

@Controller('cartillas')
export class CartillasController {
  constructor(@Inject(CartillaService) private cartillas: CartillaService) {}

  @Get()
  list(@Query('storeId') storeId: string) {
    return this.cartillas.list(storeId);
  }

  @Get('calendar')
  calendar(@Query('storeId') storeId: string, @Query('year') year?: string) {
    const y = year ? Number(year) : new Date().getFullYear();
    return this.cartillas.calendar(storeId, y);
  }

  @Get('alerts')
  alerts(@Query('storeId') storeId: string) {
    return this.cartillas.stockAlerts(storeId);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.cartillas.get(id);
  }

  @Post()
  create(
    @Body()
    body: {
      storeId: string;
      name: string;
      isDefault?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
      maxStamps?: number;
      items?: Array<{ promotionId: string; pointsRequired: number }>;
    }
  ) {
    return this.cartillas.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      startsAt?: string | null;
      endsAt?: string | null;
      maxStamps?: number;
      items?: Array<{ promotionId: string; pointsRequired: number }>;
    }
  ) {
    return this.cartillas.update(id, body);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.cartillas.activate(id);
  }

  @Post(':id/end')
  end(@Param('id') id: string) {
    return this.cartillas.endCartilla(id);
  }
}
