import {
  PrismaClient,
  PlanType,
  EventStatus,
  InvitationStatus,
  StoreCategory,
  PromotionType,
  PromotionExpiryMode,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.transaction.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.draw.deleteMany();
  await prisma.pass.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.passDesign.deleteMany();
  await prisma.storeEventMembership.deleteMany();
  await prisma.lead.deleteMany();
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
      title: 'Café cortesía',
      pointsRequired: 3,
      type: PromotionType.PRODUCT,
      productName: 'Café americano',
      expiryMode: PromotionExpiryMode.QUANTITY,
      maxRedemptions: 5,
    },
    {
      title: 'Postre gratis',
      pointsRequired: 5,
      type: PromotionType.PRODUCT,
      productName: 'Postre del día',
      expiryMode: PromotionExpiryMode.QUANTITY,
      maxRedemptions: 20,
    },
    {
      title: '10% descuento',
      pointsRequired: 8,
      type: PromotionType.PERCENT_OFF,
      value: 10,
      expiryMode: PromotionExpiryMode.TIME,
      endsAt: new Date(Date.now() + 3 * 86400000),
    },
    {
      title: 'Entrada 2x1',
      pointsRequired: 10,
      type: PromotionType.BUY_GET,
      buyQuantity: 2,
      getQuantity: 1,
      expiryMode: PromotionExpiryMode.QUANTITY,
      maxRedemptions: 50,
    },
    {
      title: '$5.000 off',
      pointsRequired: 12,
      type: PromotionType.AMOUNT_OFF,
      value: 5000,
      expiryMode: PromotionExpiryMode.TIME,
      endsAt: new Date(Date.now() + 14 * 86400000),
    },
  ];

  const stores = await Promise.all(
    [
      { name: 'Café del Río', category: StoreCategory.RESTAURANT, pin: '1234', lat: 2.9273, lng: -75.2819 },
      { name: 'Asados La 8', category: StoreCategory.RESTAURANT, pin: '5678', lat: 2.934, lng: -75.29 },
      { name: 'Hotel Neiva Plaza', category: StoreCategory.HOSPITALITY, pin: '9999', lat: 2.94, lng: -75.275 },
    ].map((s, i) =>
      prisma.store.create({
        data: {
          name: s.name,
          category: s.category,
          pinCode: s.pin,
          planType: i === 0 ? PlanType.PRO : PlanType.BASIC,
          googlePlaceId: `demo-place-${i}`,
          lat: s.lat,
          lng: s.lng,
          ownerEmail: `owner${i}@onda.lat`,
          whatsappUsed: i * 12,
          passDesign: {
            create: {
              title: s.name,
              subtitle: 'Programa de lealtad Onda',
              description: 'Gana ondas en cada visita y canjea recompensas',
              backgroundColor: i === 0 ? '#3DB9E8' : i === 1 ? '#6E5AE6' : '#5B8AF0',
              foregroundColor: '#FFFFFF',
              labelColor: '#E5F6FC',
            },
          },
          promotions: {
            create: promoTemplates.map((p) => ({ ...p, isActive: true })),
          },
        },
        include: { promotions: true },
      })
    )
  );

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
          createdAt: new Date(now - i * 3600000),
        },
      });
    }
  }

  console.log('Seed OK', {
    event: { id: event.id, slug: event.slug },
    stores: stores.map((s) => ({ id: s.id, name: s.name })),
    user: { id: users[0].id, phone: users[0].phone, passId: users[0].passes[0]?.id },
    testUrls: {
      storeOnly: `http://localhost:4201/r/${stores[1].id}`,
      storeAndEvent: `http://localhost:4201/r/${stores[1].id}?event=${event.slug}`,
      demoEvent: `http://localhost:4201/r/demo?event=${event.slug}`,
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
