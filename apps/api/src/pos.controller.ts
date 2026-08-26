import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { StoreMemberRole } from '@prisma/client';
import { PosService } from './pos.service';
import { StoreAccessService } from './store-access.service';
import { PosSseService } from './pos-sse.service';
import { Observable } from 'rxjs';

@Controller('pos')
export class PosController {
  constructor(
    @Inject(PosService) private pos: PosService,
    @Inject(StoreAccessService) private access: StoreAccessService,
    @Inject(PosSseService) private sse: PosSseService
  ) {}

  private storeFromQuery(storeId: string, auth?: string, token?: string) {
    return this.access.resolveAccess(storeId, auth, token);
  }

  private async guardPos(
    storeId: string,
    auth?: string,
    token?: string,
    ...roles: StoreMemberRole[]
  ) {
    const ctx = await this.access.requireRole(storeId, auth, token, ...roles);
    await this.access.requirePosEnabled(storeId);
    return ctx;
  }

  @Get('stores/:storeId/items')
  async listItems(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.listItems(storeId);
  }

  @Post('stores/:storeId/items')
  async createItem(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: Parameters<PosService['createItem']>[1]
  ) {
    await this.guardPos(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.pos.createItem(storeId, body);
  }

  @Post('stores/:storeId/items/bulk')
  async createItemsBulk(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: { items: Parameters<PosService['createItemsBulk']>[1] }
  ) {
    await this.guardPos(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.pos.createItemsBulk(storeId, body.items ?? []);
  }

  @Post('stores/:storeId/items/:itemId')
  async updateItem(
    @Param('storeId') storeId: string,
    @Param('itemId') itemId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: Parameters<PosService['updateItem']>[2]
  ) {
    await this.guardPos(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.pos.updateItem(storeId, itemId, body);
  }

  @Get('stores/:storeId/addons')
  async listAddons(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.listAddons(storeId);
  }

  @Post('stores/:storeId/addons')
  async createAddon(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: Parameters<PosService['createAddon']>[1]
  ) {
    await this.guardPos(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.pos.createAddon(storeId, body);
  }

  @Post('stores/:storeId/addons/:addonId')
  async updateAddon(
    @Param('storeId') storeId: string,
    @Param('addonId') addonId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: Parameters<PosService['updateAddon']>[2]
  ) {
    await this.guardPos(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.pos.updateAddon(storeId, addonId, body);
  }

  @Post('stores/:storeId/items/:itemId/addons')
  async setItemAddons(
    @Param('storeId') storeId: string,
    @Param('itemId') itemId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: { addonIds: string[] }
  ) {
    await this.guardPos(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.pos.setItemAddons(storeId, itemId, body.addonIds ?? []);
  }

  @Post('stores/:storeId/items/:itemId/variants')
  async setItemVariants(
    @Param('storeId') storeId: string,
    @Param('itemId') itemId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: { variants: Parameters<PosService['setItemVariants']>[2] }
  ) {
    await this.guardPos(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.pos.setItemVariants(storeId, itemId, body.variants ?? []);
  }

  @Get('stores/:storeId/payment-methods')
  async paymentMethods(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.listPaymentMethods(storeId);
  }

  @Post('stores/:storeId/payment-methods')
  async updatePaymentMethods(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: { methods: Parameters<PosService['updatePaymentMethods']>[1] }
  ) {
    await this.guardPos(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.pos.updatePaymentMethods(storeId, body.methods ?? []);
  }

  @Get('stores/:storeId/accounting')
  async getAccounting(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth: string | undefined
  ) {
    await this.guardPos(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.pos.getAccountingConfig(storeId);
  }

  @Post('stores/:storeId/accounting')
  async updateAccounting(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: Parameters<PosService['updateAccountingConfig']>[1]
  ) {
    await this.guardPos(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.pos.updateAccountingConfig(storeId, body);
  }

  @Get('stores/:storeId/summary')
  async summary(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth: string | undefined,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('methods') methods?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      undefined,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    const methodKeys = methods
      ? methods.split(',').map((m) => m.trim()).filter(Boolean)
      : undefined;
    return this.pos.getSummary(storeId, from, to, methodKeys);
  }

  @Get('tabs')
  async listTabs(
    @Query('storeId') storeId: string,
    @Query('status') status?: string,
    @Query('attendedBy') attendedBy?: string,
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    const ctx = await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    const statuses = status
      ? (status.split(',') as any)
      : (['OPEN', 'CHECKOUT'] as any);
    return this.pos.listTabs(storeId, statuses, attendedBy, ctx.memberId);
  }

  @Post('tabs')
  async createTab(
    @Query('storeId') storeId: string,
    @Body() body: { label?: string },
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    const ctx = await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.createTab(storeId, body?.label, ctx.memberId);
  }

  @Post('tabs/:tabId/assign')
  async assignTab(
    @Param('tabId') tabId: string,
    @Query('storeId') storeId: string,
    @Body() body: { memberId?: string | null },
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    const ctx = await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    if (ctx.viaCajaToken) {
      throw new ForbiddenException('Inicia sesión de miembro para asignar');
    }
    return this.pos.assignTab(storeId, tabId, body.memberId ?? null, {
      memberId: ctx.memberId,
      role: ctx.role,
    });
  }

  @Get('stores/:storeId/attendants')
  async listAttendants(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.listAttendants(storeId);
  }

  @Get('stores/:storeId/me')
  async me(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    const ctx = await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    if (ctx.viaCajaToken || !ctx.memberId) {
      throw new ForbiddenException('Inicia sesión con tu cuenta de miembro');
    }
    const attendants = await this.pos.listAttendants(storeId);
    const me = attendants.find((a) => a.id === ctx.memberId);
    if (!me) throw new ForbiddenException('Miembro no activo');
    return me;
  }

  @Post('tabs/:tabId/lines')
  async updateLines(
    @Param('tabId') tabId: string,
    @Query('storeId') storeId: string,
    @Body() body: Parameters<PosService['updateTabLines']>[2],
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.updateTabLines(storeId, tabId, body);
  }

  @Post('tabs/:tabId/checkout')
  async checkout(
    @Param('tabId') tabId: string,
    @Query('storeId') storeId: string,
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.checkoutTab(storeId, tabId);
  }

  @Post('tabs/:tabId/reopen')
  async reopen(
    @Param('tabId') tabId: string,
    @Query('storeId') storeId: string,
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.reopenTab(storeId, tabId);
  }

  @Post('tabs/:tabId/void')
  async voidTab(
    @Param('tabId') tabId: string,
    @Query('storeId') storeId: string,
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.voidTab(storeId, tabId);
  }

  @Post('tabs/:tabId/link-pass')
  async linkPass(
    @Param('tabId') tabId: string,
    @Query('storeId') storeId: string,
    @Body() body: { payload: string },
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.linkPass(storeId, tabId, body.payload);
  }

  @Post('tabs/:tabId/link-phone')
  async linkPhone(
    @Param('tabId') tabId: string,
    @Query('storeId') storeId: string,
    @Body() body: { phone: string; guestName?: string },
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.linkPhone(storeId, tabId, body);
  }

  @Post('tabs/:tabId/pay')
  async pay(
    @Param('tabId') tabId: string,
    @Query('storeId') storeId: string,
    @Body() body: { methodKey: string; cashReceived?: number },
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.payTab(storeId, tabId, body);
  }

  @Get('sales')
  async listSales(
    @Query('storeId') storeId: string,
    @Headers('authorization') auth?: string,
    @Query('token') token?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.listSales(storeId, {
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('sales/:saleId')
  async getSale(
    @Param('saleId') saleId: string,
    @Query('storeId') storeId: string,
    @Headers('authorization') auth?: string,
    @Query('token') token?: string
  ) {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.pos.getSale(storeId, saleId);
  }

  @Post('sales/:saleId/refund')
  async refund(
    @Param('saleId') saleId: string,
    @Query('storeId') storeId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: { reason?: string }
  ) {
    await this.guardPos(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.pos.refundSale(storeId, saleId, body);
  }

  @Sse('stream')
  async stream(
    @Query('storeId') storeId: string,
    @Query('token') token?: string,
    @Headers('authorization') auth?: string
  ): Promise<Observable<MessageEvent>> {
    await this.guardPos(
      storeId,
      auth,
      token,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.sse.stream(storeId);
  }
}
