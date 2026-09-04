/**
 * Revierte la asociación de un negocio y lo deja otra vez como draft.
 *
 * Uso:
 *   STORE_SLUG=el-pancetazo pnpm exec tsx libs/database/scripts/unclaim-store-draft.ts
 */

import { randomBytes } from 'crypto';
import { PrismaClient, StoreMemberStatus } from '@prisma/client';

const prisma = new PrismaClient();

const MERCHANT_BASE = (
  process.env.NEXT_PUBLIC_MERCHANT_URL || 'https://admin.entraenlaonda.com'
).replace(/\/$/, '');

function newClaimToken() {
  return randomBytes(24).toString('base64url');
}

async function main() {
  const slugOrId = (process.env.STORE_SLUG || process.argv[2] || '').trim();
  if (!slugOrId) {
    throw new Error('Pasa STORE_SLUG o el slug/id como argumento');
  }

  const store = await prisma.store.findFirst({
    where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
  });
  if (!store) {
    throw new Error(`Negocio no encontrado: ${slugOrId}`);
  }
  if (store.claimToken && !store.ownerEmail) {
    console.log(`Ya es draft: ${store.name} (${store.slug})`);
    console.log(
      `claimUrl: ${MERCHANT_BASE}/onboarding/asociar?token=${encodeURIComponent(store.claimToken)}`
    );
    return;
  }

  const claimToken = newClaimToken();
  await prisma.$transaction(async (tx) => {
    await tx.storeMember.updateMany({
      where: {
        storeId: store.id,
        status: { not: StoreMemberStatus.REVOKED },
      },
      data: {
        status: StoreMemberStatus.REVOKED,
        revokedAt: new Date(),
        inviteToken: null,
      },
    });

    await tx.store.update({
      where: { id: store.id },
      data: {
        ownerEmail: null,
        ownerName: 'Pendiente',
        claimToken,
        claimTokenCreatedAt: new Date(),
      },
    });
  });

  console.log(`✓ Desvinculado: ${store.name} (${store.slug})`);
  console.log(`  previousOwnerEmail: ${store.ownerEmail}`);
  console.log(
    `  claimUrl: ${MERCHANT_BASE}/onboarding/asociar?token=${encodeURIComponent(claimToken)}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
