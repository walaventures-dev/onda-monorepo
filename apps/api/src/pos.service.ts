import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingProvider,
  PosItemKind,
  PosRefundKind,
  PosSaleStatus,
  PosTabStatus,
  StoreMemberRole,
} from '@prisma/client';
import {
  calcChange,
  DEFAULT_PAYMENT_METHODS,
  parseCajaQr,
  posLineSubtotal,
} from '@onda/shared-utils';
import { PrismaService } from './prisma.service';
import { AccumulateService } from './accumulate.service';
import { PosSseService } from './pos-sse.service';
import { JobsService } from './jobs.service';
import { forwardRef } from '@nestjs/common';
import { resolveAccountingAdapter } from './accounting';

@Injectable()
export class PosService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(AccumulateService) private accumulate: AccumulateService,
    @Inject(PosSseService) private sse: PosSseService,
    @Inject(forwardRef(() => JobsService)) private jobs: JobsService
  ) {}

  async bootstrapStore(storeId: string) {
    const existing = await this.prisma.posPaymentMethodConfig.count({
      where: { storeId },
    });
    if (!existing) {
      await this.prisma.posPaymentMethodConfig.createMany({
        data: DEFAULT_PAYMENT_METHODS.map((m) => ({
          storeId,
          key: m.key,
          label: m.label,
          sortOrder: m.sortOrder,
          isActive: true,
        })),
      });
    }
    await this.prisma.storeAccountingConfig.upsert({
      where: { storeId },
      create: { storeId, provider: AccountingProvider.NONE },
      update: {},
    });
  }

  private tabInclude() {
    return {
      lines: {
        include: {
          item: true,
          addons: { orderBy: { name: 'asc' as const } },
        },
        orderBy: { id: 'asc' as const },
      },
      pass: { include: { user: { select: { name: true, phone: true } } } },
      openedByMember: { select: { id: true, name: true } },
      attendedByMember: { select: { id: true, name: true } },
    };
  }

  private serializeTab(
    tab: Awaited<ReturnType<typeof this.fetchTab>>
  ) {
    const subtotal = tab.lines.reduce(
      (sum, l) => sum + posLineSubtotal(l.quantity, l.unitPrice),
      0
    );
    const customerName =
      tab.pass?.user?.name || tab.guestName || null;
    return {
      id: tab.id,
      storeId: tab.storeId,
      label: tab.label,
      status: tab.status,
      guestName: tab.guestName,
      userId: tab.userId,
      passId: tab.passId,
      openedAt: tab.openedAt.toISOString(),
      checkoutAt: tab.checkoutAt?.toISOString() ?? null,
      lines: tab.lines.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        variantId: l.variantId,
        variantName: l.variantName,
        addons: (l.addons || []).map((a) => ({
          id: a.id,
          addonId: a.addonId,
          name: a.name,
          price: a.price,
        })),
        item: l.item,
      })),
      subtotal,
      total: subtotal,
      customerName,
      openedByMemberId: tab.openedByMemberId ?? null,
      attendedByMemberId: tab.attendedByMemberId ?? null,
      attendedByName: tab.attendedByMember?.name ?? null,
    };
  }

  private async fetchTab(tabId: string) {
    const tab = await this.prisma.posTab.findUnique({
      where: { id: tabId },
      include: this.tabInclude(),
    });
    if (!tab) throw new NotFoundException('Cuenta no encontrada');
    return tab;
  }

  private serializeItem(
    item: {
      id: string;
      storeId: string;
      kind: PosItemKind;
      name: string;
      price: number;
      trackStock: boolean;
      stockQty: number | null;
      isActive: boolean;
      sortOrder: number;
      imageUrl: string | null;
      variants?: Array<{
        id: string;
        itemId: string;
        name: string;
        price: number;
        isDefault: boolean;
        isActive: boolean;
        sortOrder: number;
      }>;
      addons?: Array<{
        sortOrder: number;
        addon: {
          id: string;
          storeId: string;
          name: string;
          price: number;
          isActive: boolean;
          sortOrder: number;
        };
      }>;
    }
  ) {
    return {
      id: item.id,
      storeId: item.storeId,
      kind: item.kind,
      name: item.name,
      price: item.price,
      trackStock: item.trackStock,
      stockQty: item.stockQty,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
      imageUrl: item.imageUrl,
      variants: (item.variants || [])
        .filter((v) => v.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      addons: (item.addons || [])
        .filter((l) => l.addon?.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((l) => ({
          id: l.addon.id,
          storeId: l.addon.storeId,
          name: l.addon.name,
          price: l.addon.price,
          isActive: l.addon.isActive,
          sortOrder: l.addon.sortOrder,
        })),
    };
  }

  private emitTab(storeId: string, kind: string, tabId: string) {
    this.sse.emit(storeId, { kind, tabId });
  }

  async listItems(storeId: string) {
    const items = await this.prisma.posItem.findMany({
      where: { storeId },
      include: {
        variants: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
        addons: {
          include: { addon: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return items.map((i) => this.serializeItem(i));
  }

  async listAddons(storeId: string) {
    return this.prisma.posAddon.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createAddon(
    storeId: string,
    body: { name: string; price?: number }
  ) {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Nombre requerido');
    const price = Math.round(Number(body.price ?? 0));
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException('Precio inválido');
    }
    return this.prisma.posAddon.create({
      data: { storeId, name, price },
    });
  }

  async updateAddon(
    storeId: string,
    addonId: string,
    body: Partial<{ name: string; price: number; isActive: boolean; sortOrder: number }>
  ) {
    const addon = await this.prisma.posAddon.findFirst({
      where: { id: addonId, storeId },
    });
    if (!addon) throw new NotFoundException('Adicional no encontrado');
    return this.prisma.posAddon.update({
      where: { id: addonId },
      data: {
        ...(body.name != null ? { name: body.name.trim() } : {}),
        ...(body.price != null ? { price: Math.round(body.price) } : {}),
        ...(body.isActive != null ? { isActive: body.isActive } : {}),
        ...(body.sortOrder != null ? { sortOrder: body.sortOrder } : {}),
      },
    });
  }

  async setItemAddons(storeId: string, itemId: string, addonIds: string[]) {
    const item = await this.prisma.posItem.findFirst({
      where: { id: itemId, storeId },
    });
    if (!item) throw new NotFoundException('Ítem no encontrado');
    const ids = Array.from(new Set((addonIds || []).filter(Boolean)));
    if (ids.length) {
      const count = await this.prisma.posAddon.count({
        where: { storeId, id: { in: ids }, isActive: true },
      });
      if (count !== ids.length) {
        throw new BadRequestException('Uno o más adicionales no son válidos');
      }
    }
    await this.prisma.$transaction([
      this.prisma.posItemAddon.deleteMany({ where: { itemId } }),
      ...(ids.length
        ? [
            this.prisma.posItemAddon.createMany({
              data: ids.map((addonId, i) => ({
                itemId,
                addonId,
                sortOrder: i,
              })),
            }),
          ]
        : []),
    ]);
    const updated = await this.prisma.posItem.findUnique({
      where: { id: itemId },
      include: {
        variants: true,
        addons: { include: { addon: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    return this.serializeItem(updated!);
  }

  async setItemVariants(
    storeId: string,
    itemId: string,
    variants: Array<{
      id?: string;
      name: string;
      price: number;
      isDefault?: boolean;
      isActive?: boolean;
    }>
  ) {
    const item = await this.prisma.posItem.findFirst({
      where: { id: itemId, storeId },
    });
    if (!item) throw new NotFoundException('Ítem no encontrado');

    const cleaned = (variants || []).map((v, i) => {
      const name = v.name?.trim();
      if (!name) throw new BadRequestException('Nombre de variante requerido');
      const price = Math.round(Number(v.price));
      if (!Number.isFinite(price) || price < 0) {
        throw new BadRequestException(`Precio inválido en variante ${name}`);
      }
      return {
        id: v.id,
        name,
        price,
        isDefault: Boolean(v.isDefault),
        isActive: v.isActive !== false,
        sortOrder: i,
      };
    });

    if (cleaned.filter((v) => v.isDefault).length > 1) {
      throw new BadRequestException('Solo una variante puede ser predeterminada');
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.posItemVariant.findMany({ where: { itemId } });
      const keepIds = new Set(cleaned.map((v) => v.id).filter(Boolean) as string[]);
      const toDelete = existing.filter((e) => !keepIds.has(e.id));
      if (toDelete.length) {
        await tx.posItemVariant.deleteMany({
          where: { id: { in: toDelete.map((d) => d.id) } },
        });
      }
      for (const v of cleaned) {
        if (v.id && existing.some((e) => e.id === v.id)) {
          await tx.posItemVariant.update({
            where: { id: v.id },
            data: {
              name: v.name,
              price: v.price,
              isDefault: v.isDefault,
              isActive: v.isActive,
              sortOrder: v.sortOrder,
            },
          });
        } else {
          await tx.posItemVariant.create({
            data: {
              itemId,
              name: v.name,
              price: v.price,
              isDefault: v.isDefault,
              isActive: v.isActive,
              sortOrder: v.sortOrder,
            },
          });
        }
      }
    });

    const updated = await this.prisma.posItem.findUnique({
      where: { id: itemId },
      include: {
        variants: true,
        addons: { include: { addon: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    return this.serializeItem(updated!);
  }

  async createItem(
    storeId: string,
    body: {
      kind: PosItemKind;
      name: string;
      price: number;
      trackStock?: boolean;
      stockQty?: number | null;
      imageUrl?: string | null;
    }
  ) {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Nombre requerido');
    const price = Math.round(Number(body.price));
    if (!(price >= 0)) throw new BadRequestException('Precio inválido');
    const trackStock = Boolean(body.trackStock) && body.kind === 'PRODUCT';
    return this.prisma.posItem.create({
      data: {
        storeId,
        kind: body.kind,
        name,
        price,
        trackStock,
        stockQty: trackStock ? (body.stockQty ?? 0) : null,
        imageUrl: body.imageUrl?.trim() || null,
      },
    });
  }

  async createItemsBulk(
    storeId: string,
    items: Array<{
      kind: PosItemKind;
      name: string;
      price: number;
      trackStock?: boolean;
      stockQty?: number | null;
    }>
  ) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Envía al menos un ítem');
    }
    if (items.length > 500) {
      throw new BadRequestException('Máximo 500 ítems por carga');
    }

    const rows: Array<{
      storeId: string;
      kind: PosItemKind;
      name: string;
      price: number;
      trackStock: boolean;
      stockQty: number | null;
    }> = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const body = items[i];
      const name = body?.name?.trim();
      if (!name) {
        errors.push({ row: i + 1, message: 'Nombre requerido' });
        continue;
      }
      const kind =
        body.kind === 'SERVICE' ? PosItemKind.SERVICE : PosItemKind.PRODUCT;
      const price = Math.round(Number(body.price));
      if (!Number.isFinite(price) || price < 0) {
        errors.push({ row: i + 1, message: `Precio inválido (${name})` });
        continue;
      }
      const trackStock = Boolean(body.trackStock) && kind === PosItemKind.PRODUCT;
      rows.push({
        storeId,
        kind,
        name,
        price,
        trackStock,
        stockQty: trackStock ? Math.max(0, Math.round(Number(body.stockQty) || 0)) : null,
      });
    }

    if (!rows.length) {
      throw new BadRequestException({
        message: 'Ningún ítem válido',
        errors,
      });
    }

    const result = await this.prisma.posItem.createMany({ data: rows });
    return {
      created: result.count,
      skipped: items.length - rows.length,
      errors,
    };
  }

  async updateItem(
    storeId: string,
    itemId: string,
    body: Partial<{
      name: string;
      price: number;
      trackStock: boolean;
      stockQty: number | null;
      isActive: boolean;
      sortOrder: number;
      imageUrl: string | null;
    }>
  ) {
    const item = await this.prisma.posItem.findFirst({
      where: { id: itemId, storeId },
    });
    if (!item) throw new NotFoundException('Ítem no encontrado');
    return this.prisma.posItem.update({
      where: { id: itemId },
      data: {
        ...(body.name != null ? { name: body.name.trim() } : {}),
        ...(body.price != null ? { price: Math.round(body.price) } : {}),
        ...(body.isActive != null ? { isActive: body.isActive } : {}),
        ...(body.sortOrder != null ? { sortOrder: body.sortOrder } : {}),
        ...(body.trackStock != null && item.kind === 'PRODUCT'
          ? {
              trackStock: body.trackStock,
              stockQty: body.trackStock
                ? (body.stockQty ?? item.stockQty ?? 0)
                : null,
            }
          : {}),
        ...(body.stockQty != null && item.trackStock
          ? { stockQty: body.stockQty }
          : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl?.trim() || null } : {}),
      },
    });
  }

  async listPaymentMethods(storeId: string) {
    await this.bootstrapStore(storeId);
    return this.prisma.posPaymentMethodConfig.findMany({
      where: { storeId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updatePaymentMethods(
    storeId: string,
    methods: Array<{
      key: string;
      label: string;
      isActive: boolean;
      sortOrder: number;
    }>
  ) {
    await this.bootstrapStore(storeId);
    for (const m of methods) {
      await this.prisma.posPaymentMethodConfig.upsert({
        where: { storeId_key: { storeId, key: m.key } },
        create: { storeId, ...m },
        update: m,
      });
    }
    return this.listPaymentMethods(storeId);
  }

  async listTabs(
    storeId: string,
    statuses?: PosTabStatus[],
    attendedBy?: string | null,
    viewerMemberId?: string | null
  ) {
    let attendedFilter: { attendedByMemberId?: string | null } | undefined;
    if (attendedBy && attendedBy !== 'all') {
      if (attendedBy === 'me') {
        if (!viewerMemberId) return [];
        attendedFilter = { attendedByMemberId: viewerMemberId };
      } else if (attendedBy === 'unassigned') {
        attendedFilter = { attendedByMemberId: null };
      } else {
        attendedFilter = { attendedByMemberId: attendedBy };
      }
    }
    const tabs = await this.prisma.posTab.findMany({
      where: {
        storeId,
        status: statuses?.length ? { in: statuses } : undefined,
        ...attendedFilter,
      },
      include: this.tabInclude(),
      orderBy: { openedAt: 'desc' },
    });
    return tabs.map((t) => this.serializeTab(t as any));
  }

  async createTab(
    storeId: string,
    label?: string,
    memberId?: string | null
  ) {
    const count = await this.prisma.posTab.count({
      where: { storeId, status: { in: ['OPEN', 'CHECKOUT'] } },
    });
    const tab = await this.prisma.posTab.create({
      data: {
        storeId,
        label: label?.trim() || `Cuenta #${count + 1}`,
        openedByMemberId: memberId || null,
        attendedByMemberId: memberId || null,
      },
      include: this.tabInclude(),
    });
    const serialized = this.serializeTab(tab as any);
    this.emitTab(storeId, 'tab_created', tab.id);
    return serialized;
  }

  async assignTab(
    storeId: string,
    tabId: string,
    memberId: string | null,
    actor: { memberId: string | null; role: StoreMemberRole | null }
  ) {
    const tab = await this.fetchTab(tabId);
    if (tab.storeId !== storeId) throw new ForbiddenException();
    if (tab.status !== PosTabStatus.OPEN && tab.status !== PosTabStatus.CHECKOUT) {
      throw new BadRequestException('Solo se pueden asignar cuentas abiertas');
    }

    if (memberId) {
      const target = await this.prisma.storeMember.findFirst({
        where: {
          id: memberId,
          storeId,
          status: 'ACTIVE',
        },
      });
      if (!target) throw new BadRequestException('Miembro no encontrado');
    }

    const isAdmin = actor.role === StoreMemberRole.ADMIN;
    const isSelf = Boolean(actor.memberId && memberId === actor.memberId);
    const isClearingSelf =
      memberId === null &&
      Boolean(actor.memberId) &&
      tab.attendedByMemberId === actor.memberId;

    if (!isAdmin && !isSelf && !isClearingSelf) {
      throw new ForbiddenException(
        'Solo puedes asignarte a ti o liberar una cuenta que atiendes'
      );
    }

    const updated = await this.prisma.posTab.update({
      where: { id: tabId },
      data: { attendedByMemberId: memberId },
      include: this.tabInclude(),
    });
    const serialized = this.serializeTab(updated as any);
    this.emitTab(storeId, 'tab_updated', tabId);
    return serialized;
  }

  async listAttendants(storeId: string) {
    const members = await this.prisma.storeMember.findMany({
      where: { storeId, status: 'ACTIVE' },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    return members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role as 'ADMIN' | 'CAJA',
    }));
  }

  async updateTabLines(
    storeId: string,
    tabId: string,
    body: {
      itemId?: string;
      quantity: number;
      lineId?: string;
      variantId?: string | null;
      addonIds?: string[];
    }
  ) {
    const tab = await this.fetchTab(tabId);
    if (tab.storeId !== storeId) throw new ForbiddenException();
    if (tab.status !== PosTabStatus.OPEN) {
      throw new BadRequestException('La cuenta no está abierta para editar');
    }
    const qty = Math.round(Number(body.quantity));
    if (!Number.isFinite(qty) || qty < 0) {
      throw new BadRequestException('Cantidad inválida');
    }

    // Actualizar / borrar línea existente por id
    if (body.lineId) {
      const line = tab.lines.find((l) => l.id === body.lineId);
      if (!line) throw new NotFoundException('Línea no encontrada');
      if (qty === 0) {
        await this.prisma.posTabLine.delete({ where: { id: line.id } });
      } else {
        if (line.item.trackStock && (line.item.stockQty ?? 0) < qty) {
          throw new BadRequestException('Stock insuficiente');
        }
        await this.prisma.posTabLine.update({
          where: { id: line.id },
          data: { quantity: qty },
        });
      }
      const updated = await this.fetchTab(tabId);
      const serialized = this.serializeTab(updated);
      this.emitTab(storeId, 'tab_updated', tabId);
      return serialized;
    }

    if (!body.itemId) throw new BadRequestException('itemId requerido');
    if (qty === 0) {
      throw new BadRequestException('Cantidad debe ser mayor a 0 al agregar');
    }

    const item = await this.prisma.posItem.findFirst({
      where: { id: body.itemId, storeId, isActive: true },
      include: {
        variants: { where: { isActive: true } },
        addons: { include: { addon: true } },
      },
    });
    if (!item) throw new NotFoundException('Ítem no encontrado');
    if (item.trackStock && (item.stockQty ?? 0) < qty) {
      throw new BadRequestException('Stock insuficiente');
    }

    let variantName: string | null = null;
    let variantId: string | null = null;
    let basePrice = item.price;

    if (item.variants.length) {
      const selected =
        (body.variantId
          ? item.variants.find((v) => v.id === body.variantId)
          : null) ||
        item.variants.find((v) => v.isDefault) ||
        item.variants[0];
      if (!selected) throw new BadRequestException('Variante requerida');
      variantId = selected.id;
      variantName = selected.name;
      basePrice = selected.price;
    } else if (body.variantId) {
      throw new BadRequestException('El ítem no tiene variantes');
    }

    const allowedAddonIds = new Set(
      item.addons.filter((l) => l.addon?.isActive).map((l) => l.addonId)
    );
    const requestedAddonIds = Array.from(
      new Set((body.addonIds || []).filter(Boolean))
    );
    for (const id of requestedAddonIds) {
      if (!allowedAddonIds.has(id)) {
        throw new BadRequestException('Adicional no disponible para este ítem');
      }
    }
    const selectedAddons = item.addons
      .filter((l) => requestedAddonIds.includes(l.addonId))
      .map((l) => l.addon);
    const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
    const unitPrice = basePrice + addonsTotal;

    // Misma config → sumar cantidad
    const same = tab.lines.find((l) => {
      if (l.itemId !== item.id) return false;
      if ((l.variantId || null) !== variantId) return false;
      const existingIds = (l.addons || [])
        .map((a) => a.addonId)
        .filter(Boolean)
        .sort()
        .join(',');
      const nextIds = [...requestedAddonIds].sort().join(',');
      return existingIds === nextIds;
    });

    if (same) {
      const nextQty = same.quantity + qty;
      if (item.trackStock && (item.stockQty ?? 0) < nextQty) {
        throw new BadRequestException('Stock insuficiente');
      }
      await this.prisma.posTabLine.update({
        where: { id: same.id },
        data: { quantity: nextQty, unitPrice },
      });
    } else {
      await this.prisma.posTabLine.create({
        data: {
          tabId,
          itemId: item.id,
          quantity: qty,
          unitPrice,
          variantId,
          variantName,
          addons: {
            create: selectedAddons.map((a) => ({
              addonId: a.id,
              name: a.name,
              price: a.price,
            })),
          },
        },
      });
    }

    const updated = await this.fetchTab(tabId);
    const serialized = this.serializeTab(updated);
    this.emitTab(storeId, 'tab_updated', tabId);
    return serialized;
  }

  async checkoutTab(storeId: string, tabId: string) {
    const tab = await this.fetchTab(tabId);
    if (tab.storeId !== storeId) throw new ForbiddenException();
    if (tab.status !== PosTabStatus.OPEN) {
      throw new BadRequestException('La cuenta no está abierta');
    }
    if (!tab.lines.length) {
      throw new BadRequestException('Agrega ítems antes de pedir la cuenta');
    }
    await this.prisma.posTab.update({
      where: { id: tabId },
      data: { status: PosTabStatus.CHECKOUT, checkoutAt: new Date() },
    });
    const updated = await this.fetchTab(tabId);
    const serialized = this.serializeTab(updated);
    this.emitTab(storeId, 'tab_checkout', tabId);
    return serialized;
  }

  async reopenTab(storeId: string, tabId: string) {
    const tab = await this.prisma.posTab.findFirst({
      where: { id: tabId, storeId },
    });
    if (!tab) throw new NotFoundException();
    if (tab.status !== PosTabStatus.CHECKOUT) {
      throw new BadRequestException('Solo cuentas en checkout pueden reabrirse');
    }
    await this.prisma.posTab.update({
      where: { id: tabId },
      data: { status: PosTabStatus.OPEN, checkoutAt: null },
    });
    const updated = await this.fetchTab(tabId);
    const serialized = this.serializeTab(updated);
    this.emitTab(storeId, 'tab_updated', tabId);
    return serialized;
  }

  async voidTab(storeId: string, tabId: string) {
    const tab = await this.prisma.posTab.findFirst({
      where: { id: tabId, storeId },
    });
    if (!tab) throw new NotFoundException();
    if (tab.status === PosTabStatus.PAID) {
      throw new BadRequestException('Usa devolución en ventas pagadas');
    }
    await this.prisma.posTab.update({
      where: { id: tabId },
      data: { status: PosTabStatus.VOID },
    });
    this.emitTab(storeId, 'tab_void', tabId);
    return { ok: true };
  }

  async linkPass(storeId: string, tabId: string, payload: string) {
    const tab = await this.fetchTab(tabId);
    if (tab.storeId !== storeId) throw new ForbiddenException();
    if (tab.status === PosTabStatus.PAID || tab.status === PosTabStatus.VOID) {
      throw new BadRequestException('Cuenta cerrada');
    }
    const scanned = parseCajaQr(payload.trim());
    if (scanned.kind === 'claim') {
      throw new BadRequestException('Escanea el pase del cliente, no un canje');
    }
    const pass = await this.prisma.pass.findUnique({
      where: { serialNumber: scanned.serialNumber },
      include: { user: true },
    });
    if (!pass) throw new BadRequestException('Pase no encontrado');
    if (pass.storeId !== storeId) {
      throw new ForbiddenException('Este pase no es de esta sede');
    }
    await this.prisma.posTab.update({
      where: { id: tabId },
      data: { passId: pass.id, userId: pass.userId, guestName: null },
    });
    const updated = await this.fetchTab(tabId);
    const serialized = this.serializeTab(updated);
    this.emitTab(storeId, 'tab_updated', tabId);
    return serialized;
  }

  async linkPhone(
    storeId: string,
    tabId: string,
    body: { phone: string; guestName?: string }
  ) {
    const tab = await this.fetchTab(tabId);
    if (tab.storeId !== storeId) throw new ForbiddenException();
    if (tab.status === PosTabStatus.PAID || tab.status === PosTabStatus.VOID) {
      throw new BadRequestException('Cuenta cerrada');
    }

    const digits = body.phone.replace(/\D/g, '');
    let phoneE164 = body.phone.trim();
    if (digits.startsWith('57') && digits.length >= 12) {
      phoneE164 = `+${digits}`;
    } else if (digits.startsWith('3') && digits.length === 10) {
      phoneE164 = `+57${digits}`;
    } else if (!phoneE164.startsWith('+') && digits.length >= 10) {
      phoneE164 = `+${digits}`;
    }
    if (digits.length < 10) {
      throw new BadRequestException('Teléfono inválido');
    }

    let user =
      (await this.prisma.user.findUnique({ where: { phone: phoneE164 } })) ||
      (await this.prisma.user.findUnique({ where: { phone: digits } })) ||
      (digits.startsWith('57')
        ? await this.prisma.user.findUnique({
            where: { phone: `+${digits}` },
          })
        : null);

    if (!user) {
      const name = body.guestName?.trim() || 'Cliente';
      user = await this.prisma.user.create({
        data: { phone: phoneE164, name },
      });
    } else if (body.guestName?.trim() && !user.name?.trim()) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { name: body.guestName.trim() },
      });
    }

    let pass = await this.prisma.pass.findFirst({
      where: { userId: user.id, storeId },
    });
    if (!pass) {
      const serial = `ONDA-${storeId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      pass = await this.prisma.pass.create({
        data: {
          userId: user.id,
          storeId,
          serialNumber: serial,
        },
      });
    }

    await this.prisma.posTab.update({
      where: { id: tabId },
      data: {
        passId: pass.id,
        userId: user.id,
        guestName: user.name || body.guestName?.trim() || 'Cliente',
      },
    });
    const updated = await this.fetchTab(tabId);
    const serialized = this.serializeTab(updated);
    this.emitTab(storeId, 'tab_updated', tabId);
    return serialized;
  }

  async payTab(
    storeId: string,
    tabId: string,
    body: { methodKey: string; cashReceived?: number }
  ) {
    const tab = await this.fetchTab(tabId);
    if (tab.storeId !== storeId) throw new ForbiddenException();
    if (tab.status !== PosTabStatus.CHECKOUT) {
      throw new BadRequestException('La cuenta debe estar en checkout');
    }
    const total = tab.lines.reduce(
      (s, l) => s + posLineSubtotal(l.quantity, l.unitPrice),
      0
    );
    if (total <= 0) throw new BadRequestException('Total inválido');

    const method = await this.prisma.posPaymentMethodConfig.findFirst({
      where: { storeId, key: body.methodKey, isActive: true },
    });
    if (!method) throw new BadRequestException('Medio de pago no válido');

    let cashReceived: number | undefined;
    let changeGiven: number | undefined;
    if (body.methodKey === 'cash') {
      cashReceived = Math.round(Number(body.cashReceived));
      if (!(cashReceived >= total)) {
        throw new BadRequestException('El efectivo recibido es insuficiente');
      }
      changeGiven = calcChange(cashReceived, total);
    }

    for (const line of tab.lines) {
      if (line.item.trackStock) {
        const updated = await this.prisma.posItem.updateMany({
          where: {
            id: line.itemId,
            stockQty: { gte: line.quantity },
          },
          data: { stockQty: { decrement: line.quantity } },
        });
        if (!updated.count) {
          throw new BadRequestException(`Sin stock: ${line.item.name}`);
        }
      }
    }

    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.posSale.create({
        data: {
          storeId,
          tabId,
          passId: tab.passId,
          subtotal: total,
          total,
          status: PosSaleStatus.COMPLETED,
          lines: {
            create: tab.lines.map((l) => {
              const addonSuffix = (l.addons || [])
                .map((a) => a.name)
                .join(', ');
              const displayName = [
                l.item.name,
                l.variantName,
                addonSuffix ? `+ ${addonSuffix}` : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return {
                itemId: l.itemId,
                name: displayName,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                variantName: l.variantName,
                addons: {
                  create: (l.addons || []).map((a) => ({
                    name: a.name,
                    price: a.price,
                  })),
                },
              };
            }),
          },
          payments: {
            create: {
              methodKey: body.methodKey,
              amount: total,
              cashReceived: cashReceived ?? null,
              changeGiven: changeGiven ?? null,
            },
          },
        },
        include: { lines: { include: { addons: true } }, payments: true },
      });
      await tx.posTab.update({
        where: { id: tabId },
        data: { status: PosTabStatus.PAID },
      });
      return created;
    });

    let ondasGranted = 0;
    let loyaltyTxId: string | null = null;
    if (tab.passId) {
      try {
        const pass = await this.prisma.pass.findUnique({
          where: { id: tab.passId },
          include: { user: true },
        });
        if (pass) {
          const result = await this.accumulate.accumulate({
            storeId,
            passId: pass.id,
            paymentAmount: total,
          });
          ondasGranted = result.delta;
          const txRow = await this.prisma.transaction.findFirst({
            where: {
              passId: pass.id,
              storeId,
              type: 'ACCUMULATE',
            },
            orderBy: { createdAt: 'desc' },
          });
          loyaltyTxId = txRow?.id ?? null;
        }
      } catch (err) {
        // Venta registrada; lealtad puede hacerse por flujo B/C
      }
      if (ondasGranted > 0) {
        await this.prisma.posSale.update({
          where: { id: sale.id },
          data: { ondasGranted, loyaltyTxId },
        });
      }
    }

    const config = await this.prisma.storeAccountingConfig.findUnique({
      where: { storeId },
    });
    if (config && config.provider !== AccountingProvider.NONE && config.autoSync) {
      await this.jobs.enqueue('pos-accounting-sync', { saleId: sale.id });
    }

    this.emitTab(storeId, 'tab_paid', tabId);
    return this.getSale(storeId, sale.id);
  }

  async listSales(
    storeId: string,
    query: { from?: string; to?: string; limit?: number; offset?: number }
  ) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (to) to.setHours(23, 59, 59, 999);

    const where = {
      storeId,
      ...(from || to
        ? {
            completedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [sales, total] = await Promise.all([
      this.prisma.posSale.findMany({
        where,
        include: { payments: true, lines: true },
        orderBy: { completedAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
      }),
      this.prisma.posSale.count({ where }),
    ]);
    return { sales, total };
  }

  async getSale(storeId: string, saleId: string) {
    const sale = await this.prisma.posSale.findFirst({
      where: { id: saleId, storeId },
      include: {
        payments: true,
        lines: { include: { addons: true } },
        refunds: { include: { lines: true } },
        tab: true,
      },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return sale;
  }

  async refundSale(
    storeId: string,
    saleId: string,
    body: { kind?: PosRefundKind; reason?: string }
  ) {
    const sale = await this.getSale(storeId, saleId);
    if (
      sale.status === PosSaleStatus.VOID ||
      sale.status === PosSaleStatus.REFUNDED
    ) {
      throw new BadRequestException('Venta ya reembolsada');
    }

    const kind = body.kind ?? PosRefundKind.FULL;

    await this.prisma.$transaction(async (tx) => {
      for (const line of sale.lines) {
        const item = await tx.posItem.findUnique({ where: { id: line.itemId } });
        if (item?.trackStock) {
          await tx.posItem.update({
            where: { id: line.itemId },
            data: { stockQty: { increment: line.quantity } },
          });
        }
      }

      let ondasReversed = 0;
      if (sale.passId && sale.ondasGranted > 0 && kind === PosRefundKind.FULL) {
        ondasReversed = await this.accumulate.reverseOndas({
          storeId,
          passId: sale.passId,
          ondasToReverse: sale.ondasGranted,
          paymentAmount: sale.total,
        });
      }

      await tx.posRefund.create({
        data: {
          saleId,
          kind,
          reason: body.reason,
          amount: sale.total,
          ondasReversed,
          lines: {
            create: sale.lines.map((l) => ({
              itemId: l.itemId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
            })),
          },
        },
      });

      await tx.posSale.update({
        where: { id: saleId },
        data: { status: PosSaleStatus.REFUNDED },
      });
    });

    const config = await this.prisma.storeAccountingConfig.findUnique({
      where: { storeId },
    });
    if (config && config.provider !== AccountingProvider.NONE && config.autoSync) {
      await this.jobs.enqueue('pos-accounting-sync', { saleId });
    }

    return this.getSale(storeId, saleId);
  }

  async getAccountingConfig(storeId: string) {
    await this.bootstrapStore(storeId);
    return this.prisma.storeAccountingConfig.findUniqueOrThrow({
      where: { storeId },
    });
  }

  async updateAccountingConfig(
    storeId: string,
    body: {
      provider: AccountingProvider;
      credentials?: unknown;
      autoSync?: boolean;
    }
  ) {
    if (body.provider === AccountingProvider.NONE) {
      return this.prisma.storeAccountingConfig.upsert({
        where: { storeId },
        create: {
          storeId,
          provider: AccountingProvider.NONE,
          credentials: undefined,
          autoSync: false,
        },
        update: {
          provider: AccountingProvider.NONE,
          credentials: undefined,
          autoSync: false,
        },
      });
    }
    return this.prisma.storeAccountingConfig.upsert({
      where: { storeId },
      create: {
        storeId,
        provider: body.provider,
        credentials: body.credentials as any,
        autoSync: Boolean(body.autoSync),
      },
      update: {
        provider: body.provider,
        credentials: body.credentials as any,
        autoSync: Boolean(body.autoSync),
      },
    });
  }

  async getSummary(
    storeId: string,
    from?: string,
    to?: string,
    methodKeys?: string[]
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const methods =
      methodKeys?.map((k) => k.trim()).filter(Boolean) ?? [];

    const sales = await this.prisma.posSale.findMany({
      where: {
        storeId,
        status: PosSaleStatus.COMPLETED,
        completedAt: { gte: fromDate, lte: toDate },
        ...(methods.length
          ? { payments: { some: { methodKey: { in: methods } } } }
          : {}),
      },
      include: { payments: true, lines: { include: { item: true } }, tab: true },
    });

    const totalSales = sales.reduce((s, v) => s + v.total, 0);
    const transactionCount = sales.length;
    const averageTicket =
      transactionCount > 0 ? Math.round(totalSales / transactionCount) : 0;

    const byMethod = new Map<string, number>();
    for (const sale of sales) {
      for (const p of sale.payments) {
        byMethod.set(p.methodKey, (byMethod.get(p.methodKey) ?? 0) + p.amount);
      }
    }

    const itemQty = new Map<string, { name: string; quantity: number }>();
    for (const sale of sales) {
      for (const line of sale.lines) {
        const cur = itemQty.get(line.itemId) ?? {
          name: line.name,
          quantity: 0,
        };
        cur.quantity += line.quantity;
        itemQty.set(line.itemId, cur);
      }
    }

    const customerMap = new Map<
      string,
      { name: string; total: number; visits: number }
    >();
    for (const sale of sales) {
      if (!sale.passId) continue;
      const cur = customerMap.get(sale.passId) ?? {
        name: sale.tab?.guestName || 'Cliente',
        total: 0,
        visits: 0,
      };
      cur.total += sale.total;
      cur.visits += 1;
      customerMap.set(sale.passId, cur);
    }

    const refunds = await this.prisma.posRefund.findMany({
      where: {
        sale: { storeId, completedAt: { gte: fromDate, lte: toDate } },
      },
    });

    const insights: string[] = [];
    const topItem = [...itemQty.entries()].sort(
      (a, b) => b[1].quantity - a[1].quantity
    )[0];
    if (topItem) {
      insights.push(
        `${topItem[1].name} es tu ítem más vendido (${topItem[1].quantity} uds).`
      );
    }
    const lowStock = await this.prisma.posItem.findMany({
      where: {
        storeId,
        trackStock: true,
        stockQty: { lte: 5 },
        isActive: true,
      },
      take: 3,
    });
    for (const item of lowStock) {
      insights.push(`Stock bajo: ${item.name} (${item.stockQty ?? 0} uds).`);
    }

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const seriesMap = new Map<
      string,
      { date: string; ventas: number; transacciones: number; ondas: number }
    >();
    const fromDay = new Date(fromDate);
    fromDay.setUTCHours(0, 0, 0, 0);
    const toDay = new Date(toDate);
    toDay.setUTCHours(0, 0, 0, 0);
    for (let t = fromDay.getTime(); t <= toDay.getTime(); t += 86400000) {
      const key = dayKey(new Date(t));
      seriesMap.set(key, {
        date: key,
        ventas: 0,
        transacciones: 0,
        ondas: 0,
      });
    }
    for (const sale of sales) {
      const key = dayKey(sale.completedAt);
      const row = seriesMap.get(key) ?? {
        date: key,
        ventas: 0,
        transacciones: 0,
        ondas: 0,
      };
      row.ventas += sale.total;
      row.transacciones += 1;
      row.ondas += sale.ondasGranted;
      seriesMap.set(key, row);
    }

    return {
      totalSales,
      transactionCount,
      averageTicket,
      byPaymentMethod: [...byMethod.entries()].map(([methodKey, total]) => ({
        methodKey,
        total,
      })),
      topItems: [...itemQty.entries()]
        .map(([itemId, v]) => ({ itemId, name: v.name, quantity: v.quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10),
      topCustomers: [...customerMap.entries()]
        .map(([passId, v]) => ({ passId, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
      series: [...seriesMap.values()],
      refundsTotal: refunds.reduce((s, r) => s + r.amount, 0),
      ondasGranted: sales.reduce((s, v) => s + v.ondasGranted, 0),
      insights,
    };
  }

  async syncSaleAccounting(saleId: string) {
    const sale = await this.prisma.posSale.findUnique({
      where: { id: saleId },
      include: { lines: true, store: { include: { accountingConfig: true } } },
    });
    if (!sale?.store.accountingConfig) return;
    const adapter = resolveAccountingAdapter(sale.store.accountingConfig);
    const result = await adapter.syncSale({
      saleId: sale.id,
      storeId: sale.storeId,
      total: sale.total,
      completedAt: sale.completedAt,
      lines: sale.lines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    });
    await this.prisma.posAccountingSync.upsert({
      where: { saleId },
      create: {
        saleId,
        provider: sale.store.accountingConfig.provider,
        status: result.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        externalId: result.externalId,
        lastError: result.error,
      },
      update: {
        status: result.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        externalId: result.externalId,
        lastError: result.error,
      },
    });
  }
}
