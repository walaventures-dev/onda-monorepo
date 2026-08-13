import {
  PrismaClient,
  PlanType,
  EventStatus,
  InvitationStatus,
  StoreCategory,
  StoreSubcategory,
  StoreSegment,
  PromotionType,
  PromotionExpiryMode,
} from '@prisma/client';

const prisma = new PrismaClient();

function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function demoLogoDataUri(letter: string, bg: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img"><rect width="128" height="128" rx="28" fill="${bg}"/><text x="64" y="84" text-anchor="middle" font-size="64" font-family="system-ui,sans-serif" font-weight="700" fill="#ffffff">${letter}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function main() {
  await prisma.transaction.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.draw.deleteMany();
  await prisma.pendingRequest.deleteMany().catch(() => undefined);
  await prisma.passPromoAssignment.deleteMany().catch(() => undefined);
  await prisma.cartillaPromo.deleteMany().catch(() => undefined);
  await prisma.pass.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.passDesign.deleteMany();
  await prisma.cartilla.deleteMany().catch(() => undefined);
  await prisma.storeEventMembership.deleteMany();
  await prisma.pendingRequest.deleteMany().catch(() => undefined);
  await prisma.lead.deleteMany();
  await prisma.session.deleteMany().catch(() => undefined);
  await prisma.otpCode.deleteMany().catch(() => undefined);
  await prisma.user.deleteMany();
  await prisma.event.deleteMany();
  await prisma.store.deleteMany();

  const event = await prisma.event.create({
    data: {
      name: 'Festival a la Carta Neiva',
      slug: 'festival-neiva',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-31'),
      status: EventStatus.ACTIVE,
      globalTarget: 100,
      passDesign: {
        create: {
          title: 'Festival a la Carta',
          subtitle: 'Circuito Neiva 2026',
          description: 'Acumula 10 ondas y participa por el premio mayor',
          backgroundColor: '#6E5AE6',
          foregroundColor: '#FFFFFF',
          labelColor: '#E5F6FC',
        },
      },
    },
  });

  const promoTemplates = [
    {
      title: 'Café americano Gratis',
      pointsRequired: 3,
      type: PromotionType.PRODUCT,
      productName: 'Café americano',
      value: 4000,
      expiryMode: PromotionExpiryMode.QUANTITY,
      maxRedemptions: 5,
    },
    {
      title: 'Postre del día Gratis',
      pointsRequired: 5,
      type: PromotionType.PRODUCT,
      productName: 'Postre del día',
      value: 8000,
      expiryMode: PromotionExpiryMode.QUANTITY,
      maxRedemptions: 20,
    },
    {
      title: '15% de descuento',
      pointsRequired: 8,
      type: PromotionType.PERCENT_OFF,
      value: 15,
      expiryMode: PromotionExpiryMode.QUANTITY,
      maxRedemptions: 40,
    },
    {
      title: '2x1',
      pointsRequired: 10,
      type: PromotionType.BUY_GET,
      buyQuantity: 2,
      getQuantity: 1,
      expiryMode: PromotionExpiryMode.QUANTITY,
      maxRedemptions: 50,
    },
    {
      title: '$8.000 de descuento',
      pointsRequired: 12,
      type: PromotionType.AMOUNT_OFF,
      value: 8000,
      expiryMode: PromotionExpiryMode.QUANTITY,
      maxRedemptions: 30,
    },
  ];

  const storeDefs = [
    {
      name: 'Café del Río',
      category: StoreCategory.RESTAURANT,
      subcategory: StoreSubcategory.CAFE,
      segment: StoreSegment.CAFE_COFFEE,
      lat: 2.9273,
      lng: -75.2819,
      address: 'Carrera 5 #12-34, Neiva',
      ownerName: 'Ana Pérez',
      referralCode: 'CAFERIO1',
      freeMonthsBalance: 2,
    },
    {
      name: 'Asados La 8',
      category: StoreCategory.RESTAURANT,
      subcategory: StoreSubcategory.RESTAURANT_FULL,
      segment: StoreSegment.REST_TRADITIONAL,
      lat: 2.934,
      lng: -75.29,
      address: 'Calle 8 #10-20, Neiva',
      ownerName: 'Carlos Ruiz',
      referralCode: 'ASADOS81',
      freeMonthsBalance: 1,
      referredByIndex: 0 as number | undefined,
    },
    {
      name: 'Hotel Neiva Plaza',
      category: StoreCategory.HOSPITALITY,
      subcategory: StoreSubcategory.HOTEL,
      segment: StoreSegment.HOTEL_STANDARD,
      lat: 2.94,
      lng: -75.275,
      address: 'Calle 7 #5-50, Neiva',
      ownerName: 'María López',
      referralCode: 'HOTELNP1',
      freeMonthsBalance: 1,
    },
  ];

  const stores = [];
  for (let i = 0; i < storeDefs.length; i++) {
    const s = storeDefs[i];
    const referredByStoreId =
      'referredByIndex' in s && s.referredByIndex != null
        ? stores[s.referredByIndex].id
        : undefined;
    const store = await prisma.store.create({
      data: {
        name: s.name,
        slug: slugify(s.name),
        category: s.category,
        subcategory: s.subcategory,
        segment: s.segment,
        planType: i === 0 ? PlanType.PRO : PlanType.BASIC,
        googlePlaceId: `demo-place-${i}`,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        ownerName: s.ownerName,
        ownerEmail: `owner${i}@onda.lat`,
        referralCode: s.referralCode,
        freeMonthsBalance: s.freeMonthsBalance,
        referredByStoreId,
        whatsappUsed: i * 12,
        passDesign: {
          create: {
            title: s.name,
            subtitle: 'Programa de lealtad Onda',
            description: 'Gana ondas en cada visita y canjea recompensas',
            backgroundColor: i === 0 ? '#3DB9E8' : i === 1 ? '#6E5AE6' : '#5B8AF0',
            foregroundColor: '#FFFFFF',
            labelColor: '#E5F6FC',
            logoUrl: demoLogoDataUri(
              s.name.trim().charAt(0).toUpperCase(),
              i === 0 ? '#3DB9E8' : i === 1 ? '#6E5AE6' : '#5B8AF0',
            ),
          },
        },
        promotions: {
          create: promoTemplates.map((p) => ({
            ...p,
            isActive: true,
            pool: 'RETENCION' as const,
          })),
        },
      },
      include: { promotions: true },
    });
    stores.push(store);
  }

  const ondaSpa = await prisma.store.create({
    data: {
      name: 'Onda Spa',
      slug: 'onda-spa',
      category: StoreCategory.SERVICE,
      subcategory: StoreSubcategory.BEAUTY,
      segment: StoreSegment.BEAUTY_SPA,
      planType: PlanType.PRO,
      maxStamps: 10,
      googlePlaceId: 'demo-place-onda-spa',
      address: 'Calle Demo #1-01, Neiva',
      lat: 2.93,
      lng: -75.28,
      ownerName: 'Demo Onda',
      ownerEmail: 'spa@onda.lat',
      referralCode: 'ONDASPA1',
      freeMonthsBalance: 1,
      whatsappUsed: 0,
      passDesign: {
        create: {
          title: 'Onda Spa',
          subtitle: 'Masajes y bienestar',
          description: 'Completa 10 ondas y lleva 30% en tu próxima sesión de masajes',
          backgroundColor: '#C9DDD4',
          foregroundColor: '#2F4F46',
          labelColor: '#5F7F74',
          logoUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiByb2xlPSJpbWciIGFyaWEtbGFiZWw9Ik9uZGEgU3BhIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ic3BhQmciIHgxPSIyMCIgeTE9IjgiIHgyPSIxMDgiIHkyPSIxMjAiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHN0b3Agc3RvcC1jb2xvcj0iI0U4RjNFRSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNENEU4REYiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjgiIGZpbGw9InVybCgjc3BhQmcpIi8+CiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjM0Q2QjVDIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPgogICAgPHBhdGggZD0iTTY0IDkyYy0xNC0xMC0yMi0yNC0yMi0zOCAwLTEwIDYtMTggMTQtMjIiIHN0cm9rZS13aWR0aD0iMy4yIiBvcGFjaXR5PSIwLjQ1Ii8+CiAgICA8cGF0aCBkPSJNNjQgOTJjMTQtMTAgMjItMjQgMjItMzggMC0xMC02LTE4LTE0LTIyIiBzdHJva2Utd2lkdGg9IjMuMiIgb3BhY2l0eT0iMC40NSIvPgogICAgPHBhdGggZD0iTTY0IDk0VjUyIiBzdHJva2Utd2lkdGg9IjMuMiIvPgogICAgPHBhdGggZD0iTTY0IDU4Yy0xMC04LTE0LTE4LTEyLTI4IDggMiAxNiAxMCAxMiAyOFoiIGZpbGw9IiM1RjlCODYiIHN0cm9rZT0ibm9uZSIvPgogICAgPHBhdGggZD0iTTY0IDU4YzEwLTggMTQtMTggMTItMjgtOCAyLTE2IDEwLTEyIDI4WiIgZmlsbD0iIzdCQjU5RSIgc3Ryb2tlPSJub25lIi8+CiAgICA8cGF0aCBkPSJNNjQgNThjMC0xMiA0LTIyIDEyLTI4LTEwIDAtMTggOC0xOCAyMiAwLTE0LTgtMjItMTgtMjIgOCA2IDEyIDE2IDEyIDI4WiIgZmlsbD0iIzRFOEE3NCIgc3Ryb2tlPSJub25lIi8+CiAgPC9nPgogIDxjaXJjbGUgY3g9IjY0IiBjeT0iOTgiIHI9IjMuNSIgZmlsbD0iI0M5QTA4QSIvPgo8L3N2Zz4K',
        },
      },
      promotions: {
        create: [
          {
            title: '30% de descuento',
            description: '30% de descuento en tu próxima sesión de masajes',
            pointsRequired: 10,
            isActive: true,
            type: PromotionType.PERCENT_OFF,
            value: 30,
            expiryMode: PromotionExpiryMode.QUANTITY,
            maxRedemptions: 1000,
          },
        ],
      },
    },
    include: { promotions: true, passDesign: true },
  });
  stores.push(ondaSpa);

  for (const store of stores) {
    const def = await prisma.cartilla.create({
      data: {
        storeId: store.id,
        name: 'Cartilla permanente',
        isDefault: true,
        status: 'ACTIVE',
        maxStamps: store.maxStamps || 12,
      },
    });
    const design = await prisma.passDesign.findUnique({
      where: { storeId: store.id },
    });
    if (design) {
      await prisma.passDesign.update({
        where: { id: design.id },
        data: { cartillaId: def.id },
      });
    }
    const existing = await prisma.promotion.findMany({
      where: { storeId: store.id },
    });
    for (const p of existing) {
      await prisma.cartillaPromo.create({
        data: {
          cartillaId: def.id,
          promotionId: p.id,
          pointsRequired: p.pointsRequired,
          pool: 'RETENCION',
        },
      });
      const welcome = await prisma.promotion.create({
        data: {
          storeId: store.id,
          title: `${p.title} (bienvenida)`,
          description: p.description,
          pointsRequired: p.pointsRequired,
          isActive: true,
          type: p.type,
          value: p.value != null ? Number(p.value) * 1.2 : p.value,
          buyQuantity: p.buyQuantity,
          getQuantity: p.getQuantity,
          productName: p.productName,
          pool: 'BIENVENIDA',
          intent:
            p.pointsRequired >= (store.maxStamps || 12)
              ? 'PREMIO'
              : p.pointsRequired <= 3
                ? 'GANCHO'
                : 'INTERMEDIA',
          maxRedemptions: p.maxRedemptions,
        },
      });
      await prisma.cartillaPromo.create({
        data: {
          cartillaId: def.id,
          promotionId: welcome.id,
          pointsRequired: welcome.pointsRequired,
          pool: 'BIENVENIDA',
        },
      });
    }
    if (store.id === stores[0].id) {
      const occStart = new Date();
      occStart.setMonth(occStart.getMonth() + 1, 1);
      const occEnd = new Date(occStart);
      occEnd.setMonth(occEnd.getMonth() + 1, 0);
      const occ = await prisma.cartilla.create({
        data: {
          storeId: store.id,
          name: 'Temporada festiva',
          isDefault: false,
          status: 'DRAFT',
          startsAt: occStart,
          endsAt: occEnd,
          maxStamps: store.maxStamps || 12,
          passDesign: {
            create: {
              title: `${store.name} · Festiva`,
              subtitle: 'Cartilla de temporada',
              description: 'Premios especiales este mes',
              backgroundColor: '#052DDE',
              foregroundColor: '#FFFFFF',
              labelColor: '#E5F6FC',
              logoUrl: design?.logoUrl,
            },
          },
        },
      });
      void occ;
    }
  }

  await prisma.storeEventMembership.create({
    data: {
      storeId: stores[0].id,
      eventId: event.id,
      status: InvitationStatus.ACCEPTED,
      customPromo: 'Bebida de cortesía',
      nfcKitId: 'NFC-001',
    },
  });

  await prisma.storeEventMembership.create({
    data: {
      storeId: stores[1].id,
      eventId: event.id,
      status: InvitationStatus.PENDING,
    },
  });

  await prisma.promotion.create({
    data: {
      eventId: event.id,
      title: 'Premio global del festival',
      pointsRequired: 10,
      isActive: true,
      type: PromotionType.OTHER,
      description: 'Participa por el premio mayor del circuito',
      expiryMode: PromotionExpiryMode.TIME,
      endsAt: new Date('2026-08-31'),
    },
  });

  const defaultCartilla0 = await prisma.cartilla.findFirst({
    where: { storeId: stores[0].id, isDefault: true },
  });

  const users = await Promise.all(
    [
      { name: 'Ana Pérez', phone: '+573001112233', points: 8 },
      { name: 'Carlos Ruiz', phone: '+573004445566', points: 3 },
      { name: 'María López', phone: '+573007778899', points: 12 },
      { name: 'Luis Gómez', phone: '+573001234567', points: 1 },
    ].map((u, i) =>
      prisma.user.create({
        data: {
          name: u.name,
          phone: u.phone,
          createdAt: new Date(Date.now() - i * 86400000 * 2),
          passes: {
            create: {
              storeId: stores[0].id,
              eventId: i < 2 ? event.id : undefined,
              serialNumber: `ONDA-DEMO00${i + 1}`,
              points: u.points,
              cartillaId: defaultCartilla0?.id,
            },
          },
        },
        include: { passes: true },
      })
    )
  );

  const store0 = stores[0];
  const promos = store0.promotions;
  const now = Date.now();

  for (let d = 0; d < 14; d++) {
    const day = new Date(now - d * 86400000);
    const pass = users[d % users.length].passes[0];
    await prisma.transaction.create({
      data: {
        passId: pass.id,
        storeId: store0.id,
        type: 'ACCUMULATE',
        points: 1 + (d % 2),
        createdAt: day,
      },
    });
    if (d % 3 === 0 && promos[d % promos.length]) {
      const promo = promos[d % promos.length];
      await prisma.transaction.create({
        data: {
          passId: pass.id,
          storeId: store0.id,
          type: 'REDEEM',
          points: promo.pointsRequired,
          promotionId: promo.id,
          cartillaId: defaultCartilla0?.id,
          createdAt: new Date(day.getTime() + 3600000),
        },
      });
    }
  }

  // Agotar casi el cupo de “Café cortesía” (3 ondas) para insights
  const cafePromo = promos.find((p) => p.pointsRequired === 3) || promos[0];
  if (cafePromo) {
    const existing = await prisma.transaction.count({
      where: { promotionId: cafePromo.id, type: 'REDEEM' },
    });
    for (let i = existing; i < 4; i++) {
      const pass = users[i % users.length].passes[0];
      await prisma.transaction.create({
        data: {
          passId: pass.id,
          storeId: store0.id,
          type: 'REDEEM',
          points: cafePromo.pointsRequired,
          promotionId: cafePromo.id,
          cartillaId: defaultCartilla0?.id,
          createdAt: new Date(now - i * 3600000),
        },
      });
    }
  }

  console.log('Seed OK', {
    event: { id: event.id, slug: event.slug },
    stores: stores.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
    user: { id: users[0].id, phone: users[0].phone, passId: users[0].passes[0]?.id },
    testUrls: {
      storeOnly: `http://localhost:4201/r/${stores[1].slug}`,
      storeAndEvent: `http://localhost:4201/r/${stores[1].slug}?event=${event.slug}`,
      demoEvent: `http://localhost:4201/r/demo?event=${event.slug}`,
      ondaSpaDemo: 'http://localhost:4200/d/onda-spa',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
