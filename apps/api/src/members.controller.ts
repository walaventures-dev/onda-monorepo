import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { StoreMemberRole } from '@prisma/client';
import { MerchantInviteService } from './merchant-invite.service';
import { StoreAccessService } from './store-access.service';

@Controller('stores/:storeId/members')
export class MembersController {
  constructor(
    @Inject(MerchantInviteService) private invites: MerchantInviteService,
    @Inject(StoreAccessService) private access: StoreAccessService
  ) {}

  @Get()
  async list(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth: string | undefined
  ) {
    await this.access.requireRole(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.invites.listMembers(storeId);
  }

  @Post()
  async invite(
    @Param('storeId') storeId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: { name: string; email: string; role?: 'CAJA' }
  ) {
    await this.access.requireRole(storeId, auth, undefined, StoreMemberRole.ADMIN);
    if (body.role && body.role !== 'CAJA') {
      throw new BadRequestException('Solo se pueden invitar cajas');
    }
    return this.invites.inviteCaja(storeId, body);
  }

  @Post(':memberId/revoke')
  async revoke(
    @Param('storeId') storeId: string,
    @Param('memberId') memberId: string,
    @Headers('authorization') auth: string | undefined
  ) {
    await this.access.requireRole(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.invites.revokeMember(storeId, memberId);
  }

  @Post(':memberId/resend')
  async resend(
    @Param('storeId') storeId: string,
    @Param('memberId') memberId: string,
    @Headers('authorization') auth: string | undefined
  ) {
    await this.access.requireRole(storeId, auth, undefined, StoreMemberRole.ADMIN);
    return this.invites.resendInvite(storeId, memberId);
  }
}
