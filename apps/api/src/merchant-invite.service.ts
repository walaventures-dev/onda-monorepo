import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  PlanType,
  StoreMemberRole,
  StoreMemberStatus,
} from '@prisma/client';
import { maxCajaSeats } from '@onda/shared-utils';
import { PrismaService } from './prisma.service';
import { JobsService } from './jobs.service';
import {
  teamInviteEmailHtml,
  teamInviteEmailText,
} from './mail-templates/team-invite';
import { inviteAcceptUrl } from './merchant-invite-url';

function newInviteToken() {
  return randomBytes(24).toString('base64url');
}

@Injectable()
export class MerchantInviteService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(JobsService) private jobs: JobsService
  ) {}

  async listMembers(storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { planType: true },
    });
    const members = await this.prisma.storeMember.findMany({
      where: { storeId, status: { not: StoreMemberStatus.REVOKED } },
      orderBy: [{ role: 'asc' }, { invitedAt: 'asc' }],
    });
    const cajaUsed = members.filter(
      (m) =>
        m.role === StoreMemberRole.CAJA &&
        (m.status === StoreMemberStatus.ACTIVE ||
          m.status === StoreMemberStatus.PENDING)
    ).length;
    return {
      members,
      quota: {
        planType: store.planType,
        cajaUsed,
        cajaMax: maxCajaSeats(store.planType),
        adminUsed: 1,
        adminMax: 1,
      },
    };
  }

  async inviteCaja(storeId: string, input: { name: string; email: string }) {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!name || !email) {
      throw new BadRequestException('Nombre y correo son requeridos');
    }

    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    const { members } = await this.listMembers(storeId);
    const cajaCount = members.filter(
      (m) =>
        m.role === StoreMemberRole.CAJA &&
        m.status !== StoreMemberStatus.REVOKED
    ).length;
    if (cajaCount >= maxCajaSeats(store.planType)) {
      throw new ForbiddenException(
        store.planType === PlanType.BASIC
          ? 'Plan Basic permite 1 caja. Actualiza a PRO para hasta 3.'
          : 'Ya alcanzaste el máximo de 3 cajas en PRO.'
      );
    }

    const existing = await this.prisma.storeMember.findUnique({
      where: { storeId_email: { storeId, email } },
    });
    if (existing?.status === StoreMemberStatus.ACTIVE) {
      throw new BadRequestException('Ese correo ya tiene acceso activo');
    }

    const token = newInviteToken();
    const member = await this.prisma.storeMember.upsert({
      where: { storeId_email: { storeId, email } },
      create: {
        storeId,
        email,
        name,
        role: StoreMemberRole.CAJA,
        status: StoreMemberStatus.PENDING,
        inviteToken: token,
      },
      update: {
        name,
        role: StoreMemberRole.CAJA,
        status: StoreMemberStatus.PENDING,
        inviteToken: token,
        revokedAt: null,
        invitedAt: new Date(),
      },
    });

    const inviteUrl = inviteAcceptUrl(token);
    await this.jobs.enqueue('brevo-email', {
      to: email,
      toName: name,
      subject: `Invitación a caja — ${store.name}`,
      html: teamInviteEmailHtml({
        inviteeName: name,
        storeName: store.name,
        roleLabel: 'Caja',
        inviteUrl,
      }),
      text: teamInviteEmailText({
        inviteeName: name,
        storeName: store.name,
        roleLabel: 'Caja',
        inviteUrl,
      }),
    });

    return member;
  }

  async resendInvite(storeId: string, memberId: string) {
    const member = await this.prisma.storeMember.findFirst({
      where: { id: memberId, storeId },
      include: { store: true },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    if (member.status !== StoreMemberStatus.PENDING) {
      throw new BadRequestException('Solo se reenvía a invitaciones pendientes');
    }
    const token = member.inviteToken || newInviteToken();
    if (!member.inviteToken) {
      await this.prisma.storeMember.update({
        where: { id: memberId },
        data: { inviteToken: token },
      });
    }
    const inviteUrl = inviteAcceptUrl(token);
    await this.jobs.enqueue('brevo-email', {
      to: member.email,
      toName: member.name,
      subject: `Invitación a caja — ${member.store.name}`,
      html: teamInviteEmailHtml({
        inviteeName: member.name,
        storeName: member.store.name,
        roleLabel: 'Caja',
        inviteUrl,
      }),
      text: teamInviteEmailText({
        inviteeName: member.name,
        storeName: member.store.name,
        roleLabel: 'Caja',
        inviteUrl,
      }),
    });
    return { ok: true };
  }

  async revokeMember(storeId: string, memberId: string) {
    const member = await this.prisma.storeMember.findFirst({
      where: { id: memberId, storeId },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    if (member.role === StoreMemberRole.ADMIN) {
      throw new ForbiddenException('No puedes revocar al administrador');
    }
    return this.prisma.storeMember.update({
      where: { id: memberId },
      data: {
        status: StoreMemberStatus.REVOKED,
        revokedAt: new Date(),
        inviteToken: null,
      },
    });
  }

  async previewInvite(token: string) {
    const member = await this.prisma.storeMember.findFirst({
      where: { inviteToken: token, status: StoreMemberStatus.PENDING },
      include: { store: { select: { name: true } } },
    });
    if (!member) throw new NotFoundException('Invitación inválida o expirada');
    return {
      email: member.email,
      name: member.name,
      role: member.role,
      storeName: member.store.name,
    };
  }

  async acceptInvite(token: string, firebaseEmail: string) {
    const member = await this.prisma.storeMember.findFirst({
      where: { inviteToken: token, status: StoreMemberStatus.PENDING },
    });
    if (!member) throw new NotFoundException('Invitación inválida o expirada');
    if (member.email.trim().toLowerCase() !== firebaseEmail.trim().toLowerCase()) {
      throw new ForbiddenException(
        'Debes iniciar sesión con el correo de la invitación'
      );
    }
    return this.prisma.storeMember.update({
      where: { id: member.id },
      data: {
        status: StoreMemberStatus.ACTIVE,
        acceptedAt: new Date(),
        inviteToken: null,
      },
      include: { store: true },
    });
  }
}
