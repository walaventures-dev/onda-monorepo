import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { PosUserRole, StoreMemberRole } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { PosUsersService } from './pos-users.service';
import { StoreAccessService } from './store-access.service';

@Controller()
export class PosUsersController {
  constructor(
    @Inject(PosUsersService) private posUsers: PosUsersService,
    @Inject(StoreAccessService) private access: StoreAccessService,
    @Inject(PrismaService) private prisma: PrismaService
  ) {}

  /** Login de la PWA caja: ámbito de tienda (id o slug) + usuario + PIN. */
  @Post('pos/users/login')
  login(@Body() body: { store?: string; storeId?: string; username?: string; pin?: string }) {
    return this.posUsers.login(
      body.store ?? body.storeId ?? '',
      body.username ?? '',
      body.pin ?? ''
    );
  }

  /**
   * Sesión activa del usuario de caja: valida el JWT y devuelve sede,
   * perfil y configuración de visibilidad para pintar la PWA.
   */
  @Get('pos/users/session')
  async session(@Headers('authorization') authHeader: string | undefined) {
    const token = this.access.bearerToken(authHeader);
    if (!token) throw new UnauthorizedException('Falta token de sesión');
    const user = await this.access.tryResolvePosUser(token);
    if (!user) throw new UnauthorizedException('Sesión inválida');
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: user.storeId },
      select: {
        id: true,
        slug: true,
        name: true,
        currency: true,
        ondaValue: true,
        maxStamps: true,
        posEnabled: true,
        posSharedTabs: true,
      },
    });
    return {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
      store,
    };
  }

  @Get('stores/:storeId/pos-users')
  async list(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth?: string
  ) {
    await this.access.requireRole(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.posUsers.list(storeId);
  }

  @Post('stores/:storeId/pos-users')
  async create(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: { username?: string; name?: string; pin?: string; role?: PosUserRole }
  ) {
    await this.access.requireRole(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.posUsers.create(storeId, {
      username: body.username ?? '',
      name: body.name ?? '',
      pin: body.pin ?? '',
      role: body.role as PosUserRole,
    });
  }

  @Post('stores/:storeId/pos-users/:id')
  async update(
    @Param('storeId') storeId: string,
    @Param('id') id: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: { name?: string; role?: PosUserRole; pin?: string; isActive?: boolean }
  ) {
    await this.access.requireRole(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.posUsers.update(storeId, id, {
      name: body.name,
      role: body.role as PosUserRole,
      pin: body.pin,
      isActive: body.isActive,
    });
  }

  @Get('stores/:storeId/pos-users/stats')
  async stats(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    await this.access.requireRole(
      storeId,
      auth,
      undefined,
      StoreMemberRole.ADMIN,
      StoreMemberRole.CAJA
    );
    return this.posUsers.stats(storeId, from, to);
  }
}
