import { PrismaClient } from '@prisma/client';

const DEFAULT_PAYMENT_METHODS = [
  { key: 'cash', label: 'Efectivo', sortOrder: 0 },
  { key: 'card', label: 'Tarjeta', sortOrder: 1 },
  { key: 'transfer', label: 'Transferencia', sortOrder: 2 },
] as const;

const prisma = new PrismaClient();

async function main() {
  const stores = await prisma.store.findMany();
  for (const store of stores) {
    if (store.ownerEmail) {
      await prisma.storeMember.upsert({
        where: {
          storeId_email: { storeId: store.id, email: store.ownerEmail.trim() },
        },
        create: {
          storeId: store.id,
          email: store.ownerEmail.trim(),
          name: store.ownerName,
          role: 'ADMIN',
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
        update: { status: 'ACTIVE', role: 'ADMIN' },
      });
    }
    const pmCount = await prisma.posPaymentMethodConfig.count({
      where: { storeId: store.id },
    });
    if (!pmCount) {
      await prisma.posPaymentMethodConfig.createMany({
        data: DEFAULT_PAYMENT_METHODS.map((m) => ({
          storeId: store.id,
          key: m.key,
          label: m.label,
          sortOrder: m.sortOrder,
          isActive: true,
        })),
      });
    }
    await prisma.storeAccountingConfig.upsert({
      where: { storeId: store.id },
      create: { storeId: store.id },
      update: {},
    });
  }
  console.log(`Migrated ${stores.length} stores`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
