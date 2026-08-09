/** Taxonomy helpers for store category/subcategory (kept local so API build needs no path rewrite). */

export const STORE_SUBCATEGORIES_BY_CATEGORY: Record<string, string[]> = {
  RESTAURANT: [
    'CAFE',
    'RESTAURANT_FULL',
    'BAR',
    'BAKERY',
    'FAST_FOOD',
    'FOOD_TRUCK',
  ],
  SERVICE: [
    'RETAIL',
    'BEAUTY',
    'HEALTH',
    'AUTO',
    'EDUCATION',
    'OTHER_SERVICE',
  ],
  HOSPITALITY: ['HOTEL', 'HOSTEL', 'VACATION_RENTAL', 'EVENT_VENUE'],
};

export function normalizeStoreSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function isSubcategoryOfCategory(
  category: string,
  subcategory: string
): boolean {
  const list = STORE_SUBCATEGORIES_BY_CATEGORY[category] || [];
  return list.includes(subcategory);
}

export function generateReferralCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
