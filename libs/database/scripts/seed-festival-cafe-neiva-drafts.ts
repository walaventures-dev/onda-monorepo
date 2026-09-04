/**
 * Drafts del Festival del Café (Neiva) — negocios sin dueño + link de asociación.
 *
 * Uso: pnpm exec tsx libs/database/scripts/seed-festival-cafe-neiva-drafts.ts
 */

import { randomBytes } from 'crypto';
import {
  PrismaClient,
  StoreCategory,
  StoreSubcategory,
  StoreSegment,
} from '@prisma/client';

const prisma = new PrismaClient();

const MERCHANT_BASE =
  (process.env.NEXT_PUBLIC_MERCHANT_URL || 'http://localhost:4202').replace(
    /\/$/,
    ''
  );

type FestivalRow = {
  name: string;
  category: StoreCategory;
  subcategory: StoreSubcategory;
  address?: string;
};

/** Mapeo manual: categoría/subcategoría del festival → taxonomía Onda */
const FESTIVAL_BRANDS: FestivalRow[] = [
  {
    name: 'Opita Café',
    category: StoreCategory.RESTAURANT,
    subcategory: StoreSubcategory.CAFE,
    address: 'Cra. 4 #11-59, Neiva, Huila',
  },
  { name: 'Vitalcafé Andino', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Rouillé', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'OnVacation', category: StoreCategory.BRAND, subcategory: StoreSubcategory.OTHER_BRAND },
  { name: 'Café y Cultura', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Oslo Design', category: StoreCategory.BRAND, subcategory: StoreSubcategory.OTHER_BRAND },
  { name: 'Café Asoagueñas', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Flor de Café', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Coffee Summit', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  {
    name: 'El Pancetazo',
    category: StoreCategory.RESTAURANT,
    subcategory: StoreSubcategory.RESTAURANT_FULL,
    address: 'Av la toma #14-21 - Barrio Santa Librada Neiva',
  },
  { name: 'Rivas Cava Café', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  {
    name: 'Amour Amore',
    category: StoreCategory.RESTAURANT,
    subcategory: StoreSubcategory.BAKERY,
    address: 'Domicilios',
  },
  { name: 'Indian', category: StoreCategory.BRAND, subcategory: StoreSubcategory.ALCOHOL },
  { name: 'Legado JG', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Sabajón Doña Betty', category: StoreCategory.BRAND, subcategory: StoreSubcategory.BEVERAGE },
  { name: 'La Escuelita', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Casas Montilla', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Café Don Rema', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Agua Pural el Porvenir', category: StoreCategory.BRAND, subcategory: StoreSubcategory.BEVERAGE },
  { name: 'Aromas del Huila', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Aroma Expreso', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Dulce Café', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Isla Verde', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'El Rincón de Mucas', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Laboyana', category: StoreCategory.BRAND, subcategory: StoreSubcategory.ALCOHOL },
  { name: 'La Ruta del Café', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'La Casa del Vino', category: StoreCategory.BRAND, subcategory: StoreSubcategory.ALCOHOL },
  { name: 'Claroscuro', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Crispetas con Amor', category: StoreCategory.BRAND, subcategory: StoreSubcategory.SNACKS },
  { name: 'Diferencial Coffee', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Brunnet Coffee', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
  { name: 'Café Tres Manantiales', category: StoreCategory.BRAND, subcategory: StoreSubcategory.COFFEE_TEA },
];

const SEGMENT_BY_SUB: Partial<Record<StoreSubcategory, StoreSegment>> = {
  [StoreSubcategory.CAFE]: StoreSegment.CAFE_COFFEE,
  [StoreSubcategory.RESTAURANT_FULL]: StoreSegment.REST_CASUAL,
  [StoreSubcategory.BAKERY]: StoreSegment.BAKERY_PASTRY,
  [StoreSubcategory.COFFEE_TEA]: StoreSegment.COFFEE_TEA_GENERIC,
  [StoreSubcategory.ALCOHOL]: StoreSegment.ALCOHOL_GENERIC,
  [StoreSubcategory.BEVERAGE]: StoreSegment.BEVERAGE_GENERIC,
  [StoreSubcategory.SNACKS]: StoreSegment.SNACKS_GENERIC,
  [StoreSubcategory.OTHER_BRAND]: StoreSegment.OTHER_BRAND_GENERIC,
};

function normalizeSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function newClaimToken() {
  return randomBytes(24).toString('base64url');
}

function generateReferralCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = normalizeSlug(base);
  if (!slug) slug = 'negocio';
  let candidate = slug;
  let n = 2;
  while (await prisma.store.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug.slice(0, 40)}-${n}`;
    n++;
  }
  return candidate;
}

async function uniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateReferralCode();
    const clash = await prisma.store.findUnique({ where: { referralCode: code } });
    if (!clash) return code;
  }
  return generateReferralCode(10);
}

async function main() {
  const created: Array<{ name: string; slug: string; claimUrl: string }> = [];
  const skipped: string[] = [];

  for (const row of FESTIVAL_BRANDS) {
    const slug = normalizeSlug(row.name);
    const existing = await prisma.store.findFirst({
      where: {
        OR: [{ slug }, { name: { equals: row.name, mode: 'insensitive' } }],
      },
    });
    if (existing) {
      skipped.push(`${row.name} (ya existe: ${existing.slug})`);
      continue;
    }

    const segment = SEGMENT_BY_SUB[row.subcategory];
    if (!segment) {
      throw new Error(`Sin segmento para subcategoría ${row.subcategory}`);
    }

    const claimToken = newClaimToken();
    const finalSlug = await uniqueSlug(row.name);
    const referralCode = await uniqueReferralCode();

    await prisma.store.create({
      data: {
        name: row.name.trim(),
        slug: finalSlug,
        ownerName: 'Pendiente',
        ownerEmail: null,
        category: row.category,
        subcategory: row.subcategory,
        segment,
        address: row.address?.trim() || undefined,
        referralCode,
        planType: 'BASIC',
        billingPeriod: 'monthly',
        billingStatus: 'PENDING',
        claimToken,
        claimTokenCreatedAt: new Date(),
        passDesign: {
          create: {
            title: row.name.trim(),
            subtitle: 'Programa de lealtad Onda',
            description: 'Acumula ondas y gana recompensas',
            backgroundColor: '#6E5AE6',
            foregroundColor: '#FFFFFF',
            labelColor: '#3DB9E8',
          },
        },
        cartillas: {
          create: {
            name: 'Cartilla base',
            isDefault: true,
            status: 'ACTIVE',
            maxStamps: 12,
          },
        },
      },
    });

    created.push({
      name: row.name,
      slug: finalSlug,
      claimUrl: `${MERCHANT_BASE}/onboarding/asociar?token=${encodeURIComponent(claimToken)}`,
    });
  }

  console.log(`\n✓ Creados: ${created.length}`);
  for (const c of created) {
    console.log(`  • ${c.name}`);
    console.log(`    slug: ${c.slug}`);
    console.log(`    ${c.claimUrl}\n`);
  }

  if (skipped.length) {
    console.log(`\n○ Omitidos (${skipped.length}):`);
    for (const s of skipped) console.log(`  • ${s}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
